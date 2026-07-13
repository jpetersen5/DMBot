import datetime
import json
from types import SimpleNamespace

import jwt
from flask import Flask
from flask.testing import FlaskClient

from app.api import songs as songs_module

ENVELOPE = {
    "server_time": "2026-07-13T00:00:00+00:00",
    "songs": [
        {"id": 1, "md5": "aaa", "name": "Song One"},
        {"id": 2, "md5": "bbb", "name": 'Weird "name" with ] and [ inside'},
    ],
    "deleted": [],
}


class FakeResp:
    """Minimal stand-in for a streaming requests.Response."""

    def __init__(self, status_code: int, payload: bytes = b"", text: str = ""):
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def iter_content(self, chunk_size: int = 65536):
        # deliberately chunk small so cross-chunk state is exercised
        step = 8
        for i in range(0, len(self._payload), step):
            yield self._payload[i:i + step]


def make_app(monkeypatch, resp: FakeResp):
    """Return (test app, holder) where holder.last captures the RPC call."""
    app = Flask(__name__)
    app.config["SUPABASE_URL"] = "http://sb.test"
    app.config["SUPABASE_SERVICE_KEY"] = "service-key"
    app.register_blueprint(songs_module.bp)

    holder = SimpleNamespace(last=None)

    def fake_post(url, json=None, headers=None, stream=False):
        holder.last = SimpleNamespace(url=url, json=json, headers=headers, stream=stream)
        return resp

    monkeypatch.setattr(songs_module.requests, "post", fake_post)
    return app, holder


def envelope_bytes() -> bytes:
    return json.dumps(ENVELOPE).encode()


def test_no_params_returns_bare_array(monkeypatch):
    app, _ = make_app(monkeypatch, FakeResp(200, envelope_bytes()))
    r = app.test_client().get("/api/songs")
    assert r.status_code == 200
    data = json.loads(r.data)
    assert isinstance(data, list)
    assert data == ENVELOPE["songs"]


def test_v2_returns_envelope(monkeypatch):
    app, _ = make_app(monkeypatch, FakeResp(200, envelope_bytes()))
    r = app.test_client().get("/api/songs?v=2")
    assert r.status_code == 200
    data = json.loads(r.data)
    assert isinstance(data, dict)
    assert set(data.keys()) == {"server_time", "songs", "deleted"}
    assert data["songs"] == ENVELOPE["songs"]


def test_since_passes_through_and_keeps_envelope(monkeypatch):
    app, holder = make_app(monkeypatch, FakeResp(200, envelope_bytes()))
    since = "2026-01-01T00:00:00+00:00"
    r = app.test_client().get("/api/songs", query_string={"since": since})
    assert r.status_code == 200
    assert isinstance(json.loads(r.data), dict)
    # the RPC body carried the since cursor
    assert holder.last.json == {"since": since}


def test_no_since_sends_empty_body(monkeypatch):
    app, holder = make_app(monkeypatch, FakeResp(200, envelope_bytes()))
    app.test_client().get("/api/songs")
    assert holder.last.json == {}


def test_garbage_since_returns_400(monkeypatch):
    app, _ = make_app(monkeypatch, FakeResp(200, envelope_bytes()))
    r = app.test_client().get("/api/songs?since=not-a-date")
    assert r.status_code == 400
    assert "error" in json.loads(r.data)


def test_rpc_500_returns_502(monkeypatch):
    app, _ = make_app(monkeypatch, FakeResp(500, b"boom", text="boom"))
    r = app.test_client().get("/api/songs?v=2")
    assert r.status_code == 502
    assert "error" in json.loads(r.data)


def test_envelope_stripper_handles_key_order_and_strings():
    # songs not last, and a value string containing brackets and escaped quotes
    songs = [{"id": 1, "name": 'has ] bracket, "quote", back\\slash \\ and [x]'},
             {"id": 2, "tags": ["a]b", "c\\"]}]
    payload = json.dumps({
        "deleted": [],
        "songs": songs,
        "server_time": "t",
    }).encode()
    # feed one byte at a time to stress cross-chunk state
    out = b"".join(songs_module._stream_songs_array(bytes([b]) for b in payload))
    assert json.loads(out) == songs


class FakeQuery:
    def __init__(self, table_name: str, log: list, data_map: dict):
        self.table_name = table_name
        self.log = log
        self.data_map = data_map
        self.op = None

    def select(self, *a):
        self.op = "select"
        return self

    def upsert(self, payload):
        self.op = "upsert"
        return self

    def update(self, payload):
        self.op = "update"
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, *a):
        return self

    def execute(self):
        self.log.append((self.op, self.table_name))
        return SimpleNamespace(data=self.data_map.get((self.table_name, self.op), []))


class FakeSupabase:
    def __init__(self, data_map: dict):
        self.log: list = []
        self.data_map = data_map

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(name, self.log, self.data_map)


def admin_client(monkeypatch, fake_sb: FakeSupabase) -> FlaskClient:
    app = Flask(__name__)
    app.register_blueprint(songs_module.bp)
    monkeypatch.setattr(songs_module, "get_supabase", lambda: fake_sb)
    return app.test_client()


def admin_token() -> str:
    from app.config import Config
    secret = Config.JWT_SECRET
    assert secret is not None
    return jwt.encode(
        {"user_id": "1",
         "exp": datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=1)},
        secret, algorithm="HS256",
    )


def test_admin_remove_tombstones_before_delete(monkeypatch):
    data_map = {
        ("users", "select"): [{"permissions": "admin"}],
        ("songs_new", "select"): [{"id": 5, "md5": "abc"}],
        ("songs_new", "delete"): [{"id": 5}],
    }
    fake_sb = FakeSupabase(data_map)
    client = admin_client(monkeypatch, fake_sb)
    r = client.post("/api/songs/5/admin",
                    json={"action": "remove"},
                    headers={"Authorization": f"Bearer {admin_token()}"})
    assert r.status_code == 200
    ops = fake_sb.log
    assert ("upsert", "deleted_songs") in ops
    assert ("delete", "songs_new") in ops
    assert ops.index(("upsert", "deleted_songs")) < ops.index(("delete", "songs_new"))


def test_admin_remove_missing_song_404_no_tombstone(monkeypatch):
    data_map = {
        ("users", "select"): [{"permissions": "admin"}],
        ("songs_new", "select"): [],
    }
    fake_sb = FakeSupabase(data_map)
    client = admin_client(monkeypatch, fake_sb)
    r = client.post("/api/songs/5/admin",
                    json={"action": "remove"},
                    headers={"Authorization": f"Bearer {admin_token()}"})
    assert r.status_code == 404
    assert ("upsert", "deleted_songs") not in fake_sb.log
    assert ("delete", "songs_new") not in fake_sb.log


def test_admin_verify_bumps_last_update(monkeypatch):
    data_map = {
        ("users", "select"): [{"permissions": "admin"}],
        ("songs_new", "select"): [{"name": "Cool Song (Unverified)"}],
        ("songs_new", "update"): [{"id": 5}],
    }
    fake_sb = FakeSupabase(data_map)

    captured = {}
    orig_update = FakeQuery.update

    def spy_update(self, payload):
        captured["payload"] = payload
        return orig_update(self, payload)

    monkeypatch.setattr(FakeQuery, "update", spy_update)
    client = admin_client(monkeypatch, fake_sb)
    r = client.post("/api/songs/5/admin",
                    json={"action": "verify"},
                    headers={"Authorization": f"Bearer {admin_token()}"})
    assert r.status_code == 200
    assert captured["payload"]["name"] == "Cool Song"
    assert "last_update" in captured["payload"]
    # parses as a datetime
    datetime.datetime.fromisoformat(captured["payload"]["last_update"])
