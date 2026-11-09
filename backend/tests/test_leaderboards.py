from types import SimpleNamespace

from flask import Flask

from app.api import leaderboards as leaderboards_module


class RpcSupabase:
    def __init__(self, rpc_data):
        self.rpc_calls: list = []
        self.rpc_data = rpc_data

    def rpc(self, fn: str, params: dict):
        self.rpc_calls.append(SimpleNamespace(fn=fn, params=params))
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=self.rpc_data))


def make_client(monkeypatch, fake_sb: RpcSupabase):
    app = Flask(__name__)
    app.register_blueprint(leaderboards_module.bp)
    monkeypatch.setattr(leaderboards_module, "get_supabase", lambda: fake_sb)
    return app.test_client()


def test_user_scores_calls_rpc_with_path_id(monkeypatch):
    sb = RpcSupabase({"scores": [], "unknown_scores": []})
    make_client(monkeypatch, sb).get("/api/user/42/scores")

    assert len(sb.rpc_calls) == 1
    assert sb.rpc_calls[0].fn == "get_user_scores"
    assert sb.rpc_calls[0].params == {"p_user_id": "42"}


def test_user_scores_passes_board_size_through(monkeypatch):
    payload = {
        "scores": [{"identifier": "a", "rank": 1, "board_size": 20}],
        "unknown_scores": [{"identifier": "b", "filepath": None}],
    }
    response = make_client(monkeypatch, RpcSupabase(payload)).get("/api/user/42/scores")

    assert response.status_code == 200
    assert response.get_json() == payload


def test_user_scores_404_when_rpc_returns_null(monkeypatch):
    response = make_client(monkeypatch, RpcSupabase(None)).get("/api/user/42/scores")

    assert response.status_code == 404
    assert response.get_json() == {"error": "User not found"}


def test_user_scores_scoreless_user_is_200_empty(monkeypatch):
    payload = {"scores": [], "unknown_scores": []}
    response = make_client(monkeypatch, RpcSupabase(payload)).get("/api/user/42/scores")

    assert response.status_code == 200
    assert response.get_json() == payload
