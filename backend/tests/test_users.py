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
    """Records the column list passed to .select() and returns per-table data.
    Emulates server-side .order() so ordering can be delegated to the query."""

    def __init__(self, table_name: str, log: list, data_map: dict, order_log: list):
        self.table_name = table_name
        self.log = log
        self.data_map = data_map
        self.order_log = order_log
        self.columns = None
        self.order_by = None

    def select(self, *cols):
        self.columns = cols[0] if len(cols) == 1 else cols
        return self

    def eq(self, *a):
        return self

    def order(self, column, desc=False):
        self.order_by = (column, desc)
        self.order_log.append((self.table_name, column, desc))
        return self

    def execute(self):
        self.log.append((self.table_name, self.columns))
        data = self.data_map.get(self.table_name, [])
        if self.order_by:
            column, desc = self.order_by
            data = sorted(data, key=lambda row: row[column], reverse=desc)
        return SimpleNamespace(data=data)


class SelectSupabase:
    def __init__(self, data_map: dict):
        self.log: list = []
        self.order_log: list = []
        self.data_map = data_map

    def table(self, name: str) -> SelectQuery:
        return SelectQuery(name, self.log, self.data_map, self.order_log)


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


def test_get_user_applies_defensive_defaults(monkeypatch):
    sparse_row = {"id": 123, "username": "alice", "avatar": "hash"}
    for path in ("/api/user/123", "/api/users/discord/123"):
        fake_sb = SelectSupabase({"users": [sparse_row], "elo_history": []})
        client = make_client(monkeypatch, fake_sb)

        r = client.get(path)
        assert r.status_code == 200, path
        data = json.loads(r.data)
        assert data["permissions"] == {}
        assert data["stats"] == {}
        assert data["elo"] == 1000
        assert data["elo_history"] == []


def test_get_user_delegates_elo_ordering_to_query(monkeypatch):
    fake_sb = SelectSupabase({"users": [USER_ROW], "elo_history": ELO_HISTORY})
    client = make_client(monkeypatch, fake_sb)

    r = client.get("/api/user/123")
    assert r.status_code == 200
    assert ("elo_history", "timestamp", False) in fake_sb.order_log
    data = json.loads(r.data)
    assert [e["elo"] for e in data["elo_history"]] == [1100, 1200]


# --- get_all_users -----------------------------------------------------------

FULL_STATS = {
    "rank": 3,
    "total_score": 5000,
    "total_scores": 42,
    "total_fcs": 7,
    "avg_percent": 91.5,
    "total_notes": 123456,
    "internal_debug": {"nested": True},
}


def make_all_users_client(monkeypatch, rows_data):
    fake_sb = SelectSupabase({"users": rows_data})
    app = Flask(__name__)
    app.register_blueprint(users_module.bp)
    monkeypatch.setattr(users_module, "get_supabase", lambda: fake_sb)
    return app.test_client()


def test_get_all_users_returns_slim_stats(monkeypatch):
    row = {"id": 1, "username": "alice", "avatar": "hash", "stats": FULL_STATS, "elo": 1234}
    client = make_all_users_client(monkeypatch, [row])

    r = client.get("/api/all-users")
    assert r.status_code == 200
    users = json.loads(r.data)
    assert len(users) == 1
    user = users[0]

    assert set(user.keys()) == {"id", "username", "avatar", "stats", "elo"}
    assert user["id"] == "1"  # coerced to string
    assert set(user["stats"].keys()) == set(users_module.SLIM_STAT_FIELDS)
    assert user["stats"] == {
        "rank": 3,
        "total_score": 5000,
        "total_scores": 42,
        "total_fcs": 7,
        "avg_percent": 91.5,
    }


def test_get_all_users_preserves_missing_stats(monkeypatch):
    rows_data = [
        {"id": 1, "username": "none-stats", "avatar": None, "stats": None, "elo": 1000},
        {"id": 2, "username": "empty-stats", "avatar": None, "stats": {}, "elo": 1000},
    ]
    client = make_all_users_client(monkeypatch, rows_data)

    r = client.get("/api/all-users")
    assert r.status_code == 200
    users = json.loads(r.data)
    by_name = {u["username"]: u for u in users}
    assert by_name["none-stats"]["stats"] is None
    assert by_name["empty-stats"]["stats"] == {}


def test_get_all_users_only_includes_present_slim_fields(monkeypatch):
    row = {"id": 1, "username": "alice", "avatar": None,
           "stats": {"rank": 5, "total_score": 100}, "elo": 1000}
    client = make_all_users_client(monkeypatch, [row])

    r = client.get("/api/all-users")
    users = json.loads(r.data)
    assert users[0]["stats"] == {"rank": 5, "total_score": 100}
