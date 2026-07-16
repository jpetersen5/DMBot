import json
from types import SimpleNamespace

from flask import Flask

from app.api import users as users_module

USER_ROW = {
    "id": 123,
    "username": "alice",
    "avatar": "avatar_hash",
    "permissions": {"admin": False},
    "stats": {"total_scores": 10},
    "elo": 1234,
    "scores": [{"identifier": "x", "score": 100}],
    "unknown_scores": [{"identifier": "y", "score": 50}],
    "achievements": {},
}

ELO_HISTORY = [
    {"elo": 1200, "timestamp": "2026-01-02T00:00:00+00:00"},
    {"elo": 1100, "timestamp": "2026-01-01T00:00:00+00:00"},
]

EXPECTED_KEYS = {"id", "username", "avatar", "permissions", "stats", "elo", "elo_history"}
EXPECTED_USER_COLUMNS = "id, username, avatar, permissions, stats, elo"


class SelectQuery:
    """Records the column list passed to .select() and returns per-table data."""

    def __init__(self, table_name: str, log: list, data_map: dict):
        self.table_name = table_name
        self.log = log
        self.data_map = data_map
        self.columns = None

    def select(self, *cols):
        self.columns = cols[0] if len(cols) == 1 else cols
        return self

    def eq(self, *a):
        return self

    def execute(self):
        self.log.append((self.table_name, self.columns))
        return SimpleNamespace(data=self.data_map.get(self.table_name, []))


class SelectSupabase:
    def __init__(self, data_map: dict):
        self.log: list = []
        self.data_map = data_map

    def table(self, name: str) -> SelectQuery:
        return SelectQuery(name, self.log, self.data_map)


def make_client(monkeypatch, fake_sb: SelectSupabase):
    app = Flask(__name__)
    app.register_blueprint(users_module.bp)
    monkeypatch.setattr(users_module, "get_supabase", lambda: fake_sb)
    return app.test_client()


def users_columns(fake_sb: SelectSupabase):
    return [cols for table, cols in fake_sb.log if table == "users"]


def test_get_user_by_id_response_shape(monkeypatch):
    fake_sb = SelectSupabase({"users": [USER_ROW], "elo_history": ELO_HISTORY})
    client = make_client(monkeypatch, fake_sb)

    r = client.get("/api/user/123")
    assert r.status_code == 200
    data = json.loads(r.data)

    assert set(data.keys()) == EXPECTED_KEYS
    assert data["id"] == "123"  # coerced to string
    assert data["username"] == "alice"
    assert data["avatar"] == "avatar_hash"
    assert data["permissions"] == {"admin": False}
    assert data["stats"] == {"total_scores": 10}
    assert data["elo"] == 1234
    # elo history sorted ascending by timestamp
    assert [e["elo"] for e in data["elo_history"]] == [1100, 1200]
    # the heavy blobs never leak into the response
    assert "scores" not in data
    assert "unknown_scores" not in data


def test_get_user_by_id_selects_slim_columns(monkeypatch):
    fake_sb = SelectSupabase({"users": [USER_ROW], "elo_history": ELO_HISTORY})
    client = make_client(monkeypatch, fake_sb)

    client.get("/api/user/123")

    cols = users_columns(fake_sb)
    assert cols, "expected a users query"
    for c in cols:
        assert c == EXPECTED_USER_COLUMNS
        assert "scores" not in c
        assert "unknown_scores" not in c
        assert c != "*"


def test_get_user_by_id_not_found(monkeypatch):
    fake_sb = SelectSupabase({"users": [], "elo_history": []})
    client = make_client(monkeypatch, fake_sb)

    r = client.get("/api/user/999")
    assert r.status_code == 404
    assert "error" in json.loads(r.data)


def test_get_user_by_discord_id_response_shape(monkeypatch):
    fake_sb = SelectSupabase({"users": [USER_ROW], "elo_history": ELO_HISTORY})
    client = make_client(monkeypatch, fake_sb)

    r = client.get("/api/users/discord/123")
    assert r.status_code == 200
    data = json.loads(r.data)

    assert set(data.keys()) == EXPECTED_KEYS
    assert data["id"] == "123"
    assert data["elo"] == 1234
    assert [e["elo"] for e in data["elo_history"]] == [1100, 1200]
    assert "scores" not in data
    assert "unknown_scores" not in data


def test_get_user_by_discord_id_selects_slim_columns(monkeypatch):
    fake_sb = SelectSupabase({"users": [USER_ROW], "elo_history": ELO_HISTORY})
    client = make_client(monkeypatch, fake_sb)

    client.get("/api/users/discord/123")

    cols = users_columns(fake_sb)
    assert cols, "expected a users query"
    for c in cols:
        assert c == EXPECTED_USER_COLUMNS
        assert "scores" not in c
        assert c != "*"


def test_get_user_by_discord_id_not_found(monkeypatch):
    fake_sb = SelectSupabase({"users": [], "elo_history": []})
    client = make_client(monkeypatch, fake_sb)

    r = client.get("/api/users/discord/999")
    assert r.status_code == 404
    assert "error" in json.loads(r.data)
