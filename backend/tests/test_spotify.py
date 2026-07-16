import json
from types import SimpleNamespace

import pytest
import requests
from flask import Flask

from app.api import spotify as spotify_module


class FakeQuery:
    """Records select/update calls on a supabase table and returns canned rows."""

    def __init__(self, table_name: str, log: list, data_map: dict):
        self.table_name = table_name
        self.log = log
        self.data_map = data_map
        self.op = None
        self.payload = None

    def select(self, *cols):
        self.op = "select"
        return self

    def update(self, payload):
        self.op = "update"
        self.payload = payload
        return self

    def eq(self, *a):
        return self

    def execute(self):
        self.log.append(SimpleNamespace(op=self.op, table=self.table_name, payload=self.payload))
        return SimpleNamespace(data=self.data_map.get((self.table_name, self.op), []))


class FakeSupabase:
    def __init__(self, data_map: dict):
        self.log: list = []
        self.data_map = data_map

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(name, self.log, self.data_map)


class FakeHTTPResp:
    def __init__(self, payload: dict, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")


@pytest.fixture(autouse=True)
def reset_token_cache():
    """Each test starts with an empty in-process token cache."""
    spotify_module._token = None
    spotify_module._token_expires_at = 0.0
    yield
    spotify_module._token = None
    spotify_module._token_expires_at = 0.0


def make_client(monkeypatch, fake_sb: FakeSupabase):
    app = Flask(__name__)
    app.register_blueprint(spotify_module.bp)
    monkeypatch.setattr(spotify_module, "get_supabase", lambda: fake_sb)
    return app.test_client()


def stub_token(monkeypatch):
    """Make the token POST succeed with a fresh client-credentials token."""
    def fake_post(url, headers=None, data=None, timeout=None):
        return FakeHTTPResp({"access_token": "tok", "expires_in": 3600})
    monkeypatch.setattr(spotify_module.session, "post", fake_post)


def track_hit_search(url, headers=None, params=None, timeout=None):
    """First (album-scoped) track search returns a track with album art."""
    return FakeHTTPResp({
        "tracks": {"items": [{"album": {"images": [{"url": "http://img/cover.jpg"}]}}]}
    })


def empty_search(url, headers=None, params=None, timeout=None):
    """Every search returns no items (track and album)."""
    return FakeHTTPResp({"tracks": {"items": []}, "albums": {"items": []}})


# --- (a) cached: image_fetched_at set -> stored value, no Spotify, no writes ----

def test_cached_returns_stored_value_no_spotify_no_write(monkeypatch):
    fake_sb = FakeSupabase({
        ("songs_new", "select"): [{
            "name": "n", "artist": "a", "album": "al",
            "image_url": "http://img/stored.jpg",
            "image_fetched_at": "2026-07-01T00:00:00+00:00",
        }],
    })

    def boom(*a, **k):
        raise AssertionError("Spotify must not be called when cached")

    monkeypatch.setattr(spotify_module.session, "get", boom)
    monkeypatch.setattr(spotify_module.session, "post", boom)

    client = make_client(monkeypatch, fake_sb)
    r = client.get("/api/spotify/album_art/5")

    assert r.status_code == 200
    assert json.loads(r.data) == {"image_url": "http://img/stored.jpg"}
    # only the initial select ran; no update write
    assert [c.op for c in fake_sb.log] == ["select"]


def test_cached_negative_returns_null_no_spotify(monkeypatch):
    fake_sb = FakeSupabase({
        ("songs_new", "select"): [{
            "name": "n", "artist": "a", "album": "al",
            "image_url": None,
            "image_fetched_at": "2026-07-01T00:00:00+00:00",
        }],
    })

    def boom(*a, **k):
        raise AssertionError("Spotify must not be called when cached")

    monkeypatch.setattr(spotify_module.session, "get", boom)
    monkeypatch.setattr(spotify_module.session, "post", boom)

    client = make_client(monkeypatch, fake_sb)
    r = client.get("/api/spotify/album_art/5")

    assert r.status_code == 200
    assert json.loads(r.data) == {"image_url": None}
    assert [c.op for c in fake_sb.log] == ["select"]


# --- (b) never-fetched -> Spotify called, write has art + fetched_at, no last_update

def test_never_fetched_writes_art_without_last_update(monkeypatch):
    fake_sb = FakeSupabase({
        ("songs_new", "select"): [{
            "name": "n", "artist": "a", "album": "al",
            "image_url": None, "image_fetched_at": None,
        }],
        ("songs_new", "update"): [{"id": 5}],
    })
    stub_token(monkeypatch)
    monkeypatch.setattr(spotify_module.session, "get", track_hit_search)

    client = make_client(monkeypatch, fake_sb)
    r = client.get("/api/spotify/album_art/5")

    assert r.status_code == 200
    assert json.loads(r.data) == {"image_url": "http://img/cover.jpg"}

    updates = [c for c in fake_sb.log if c.op == "update"]
    assert len(updates) == 1
    payload = updates[0].payload
    assert payload["image_url"] == "http://img/cover.jpg"
    assert "image_fetched_at" in payload
    assert "last_update" not in payload


# --- (c) no results -> null cached (write happens) ----------------------------

def test_no_results_caches_null(monkeypatch):
    fake_sb = FakeSupabase({
        ("songs_new", "select"): [{
            "name": "n", "artist": "a", "album": "al",
            "image_url": None, "image_fetched_at": None,
        }],
        ("songs_new", "update"): [{"id": 5}],
    })
    stub_token(monkeypatch)
    monkeypatch.setattr(spotify_module.session, "get", empty_search)

    client = make_client(monkeypatch, fake_sb)
    r = client.get("/api/spotify/album_art/5")

    assert r.status_code == 200
    assert json.loads(r.data) == {"image_url": None}

    updates = [c for c in fake_sb.log if c.op == "update"]
    assert len(updates) == 1
    payload = updates[0].payload
    assert payload["image_url"] is None
    assert "image_fetched_at" in payload
    assert "last_update" not in payload


# --- (d) Spotify HTTP error -> null returned, NO write ------------------------

def test_spotify_http_error_returns_null_no_write(monkeypatch):
    fake_sb = FakeSupabase({
        ("songs_new", "select"): [{
            "name": "n", "artist": "a", "album": "al",
            "image_url": None, "image_fetched_at": None,
        }],
        ("songs_new", "update"): [{"id": 5}],
    })
    stub_token(monkeypatch)

    def failing_search(url, headers=None, params=None, timeout=None):
        return FakeHTTPResp({}, status_code=502)

    monkeypatch.setattr(spotify_module.session, "get", failing_search)

    client = make_client(monkeypatch, fake_sb)
    r = client.get("/api/spotify/album_art/5")

    assert r.status_code == 200
    assert json.loads(r.data) == {"image_url": None}
    # transient failure must NOT be cached
    assert [c.op for c in fake_sb.log] == ["select"]


def test_token_failure_returns_null_no_write(monkeypatch):
    fake_sb = FakeSupabase({
        ("songs_new", "select"): [{
            "name": "n", "artist": "a", "album": "al",
            "image_url": None, "image_fetched_at": None,
        }],
        ("songs_new", "update"): [{"id": 5}],
    })

    def failing_token(url, headers=None, data=None, timeout=None):
        raise requests.ConnectionError("no route")

    monkeypatch.setattr(spotify_module.session, "post", failing_token)

    client = make_client(monkeypatch, fake_sb)
    r = client.get("/api/spotify/album_art/5")

    assert r.status_code == 200
    assert json.loads(r.data) == {"image_url": None}
    assert [c.op for c in fake_sb.log] == ["select"]


def test_missing_song_returns_404(monkeypatch):
    fake_sb = FakeSupabase({("songs_new", "select"): []})
    client = make_client(monkeypatch, fake_sb)
    r = client.get("/api/spotify/album_art/999")
    assert r.status_code == 404
