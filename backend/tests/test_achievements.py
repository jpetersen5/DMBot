import json
from types import SimpleNamespace

from flask import Flask

from app.api import achievements as achievements_module
from app.api import users as users_module
from app.utils.achievement_processor import achievement_processor


class SelectQuery:
    def __init__(self, table_name: str, data_map: dict):
        self.table_name = table_name
        self.data_map = data_map

    def select(self, *cols):
        return self

    def eq(self, *a):
        return self

    def execute(self):
        return SimpleNamespace(data=self.data_map.get(self.table_name, []))


class SelectSupabase:
    def __init__(self, data_map: dict):
        self.data_map = data_map

    def table(self, name: str) -> SelectQuery:
        return SelectQuery(name, self.data_map)


def make_client(monkeypatch, data_map: dict):
    app = Flask(__name__)
    app.register_blueprint(achievements_module.bp)
    app.register_blueprint(users_module.bp)
    monkeypatch.setattr(users_module, "get_supabase", lambda: SelectSupabase(data_map))
    return app.test_client()


def test_get_all_achievements_uses_shared_singleton(monkeypatch):
    client = make_client(monkeypatch, {})

    r = client.get("/api/achievements")
    assert r.status_code == 200
    achievements = json.loads(r.data)["achievements"]

    # every definition is serializable and stripped of internals
    assert len(achievements) == len(achievement_processor.achievements)
    for a in achievements:
        assert "check_function" not in a
        assert not any(k.startswith("_") for k in a)


def test_both_endpoints_return_identical_definitions(monkeypatch):
    client = make_client(monkeypatch, {"users": [{"achievements": {}}]})

    all_defs = json.loads(client.get("/api/achievements").data)["achievements"]
    user_defs = json.loads(client.get("/api/user/123/achievements").data)["achievements"]

    def strip(defs):
        return [
            {k: v for k, v in d.items() if k not in ("achieved", "timestamp")}
            for d in defs
        ]

    assert strip(user_defs) == all_defs
    for d in user_defs:
        assert d["achieved"] is False
        assert d["timestamp"] is None
