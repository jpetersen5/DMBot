import json

from flask import Flask

from app.api import status as status_module


def make_client(monkeypatch, fake_sb):
    app = Flask(__name__)
    app.register_blueprint(status_module.bp)
    monkeypatch.setattr(status_module, "get_supabase", lambda: fake_sb)
    return app.test_client()


class _OkQuery:
    def select(self, *a):
        return self

    def limit(self, *a):
        return self

    def execute(self):
        return None


class _OkSupabase:
    def table(self, name):
        return _OkQuery()


class _FailingSupabase:
    def table(self, name):
        raise RuntimeError("connection refused")


def test_db_status_connected(monkeypatch):
    client = make_client(monkeypatch, _OkSupabase())
    r = client.get("/api/db-status")
    assert r.status_code == 200
    assert json.loads(r.data)["status"] == "Connected"


def test_db_status_reports_503_on_failure(monkeypatch):
    client = make_client(monkeypatch, _FailingSupabase())
    r = client.get("/api/db-status")
    assert r.status_code == 503
    assert json.loads(r.data)["status"] == "Error"
