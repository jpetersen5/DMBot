from types import SimpleNamespace

from flask import Flask

from app import cli as cli_module
from app.services.bugged_scores import find_flagged, remove_bugged_scores


class FakeQuery:
    def __init__(self, db, table):
        self.db, self.table = db, table
        self.range_ = (0, 10**9)
        self.payload = None
        self.filters = {}

    def select(self, _cols):
        return self

    def order(self, _col):
        return self

    @property
    def not_(self):
        return self

    def is_(self, _col, _value):
        return self

    def range(self, start, end):
        self.range_ = (start, end)
        return self

    def update(self, payload):
        self.payload = payload
        return self

    def eq(self, col, value):
        self.filters[col] = value
        return self

    def execute(self):
        if self.payload is not None:
            self.db.calls.append(("update", self.table, self.filters["id"], self.payload))
            return SimpleNamespace(data=[self.payload])
        data = self.db.songs if self.table == "songs_new" else self.db.users
        if self.table == "songs_new":
            data = [s for s in data if s.get("optimal_score") is not None]
        start, end = self.range_
        return SimpleNamespace(data=data[start:end + 1])


class FakeRpc:
    def __init__(self, db, params):
        self.db, self.params = db, params

    def execute(self):
        md5s = {u["md5"] for u in self.params["updates"]}
        if md5s & self.db.fail_md5s:
            raise RuntimeError("write failed")
        self.db.calls.append(("rpc", self.params["updates"]))
        return SimpleNamespace(data=None)


class FakeSupabase:
    def __init__(self, songs, users, fail_md5s=()):
        self.songs, self.users = songs, users
        self.fail_md5s = set(fail_md5s)
        self.calls = []

    def table(self, name):
        return FakeQuery(self, name)

    def rpc(self, name, params):
        assert name == "bulk_update_leaderboards"
        return FakeRpc(self, params)


def entry(user_id, score, is_fc=False, rank=1):
    return {"user_id": user_id, "username": user_id, "score": score, "percent": 98.0, "is_fc": is_fc,
            "speed": 100, "play_count": 1, "posted": "2026-06-22T00:00:00+00:00", "rank": rank}


def profile_score(identifier, score, is_fc=False):
    return {"identifier": identifier, "song_name": identifier, "artist": "A", "percent": 98.0, "is_fc": is_fc,
            "speed": 100, "score": score, "play_count": 1, "posted": "2026-06-22T00:00:00+00:00", "rank": 1}


def fixture():
    songs = [
        {"md5": "m1", "name": "Blight", "artist": "A", "optimal_score": 500,
         "leaderboard": [entry("u1", 900, is_fc=True, rank=1), entry("u2", 480, rank=2)]},
        {"md5": "m2", "name": "Other", "artist": "B", "optimal_score": 1000, "leaderboard": [entry("u1", 400)]},
    ]
    users = [
        {"id": "u1", "username": "u1", "scores": [profile_score("m1", 900, is_fc=True), profile_score("m2", 400)],
         "unknown_scores": [], "stats": {}, "achievements": {"first_fc": "t", "first_score": "t"}},
        {"id": "u2", "username": "u2", "scores": [profile_score("m1", 480)], "unknown_scores": [], "stats": {},
         "achievements": {"first_score": "t"}},
        {"id": "u3", "username": "u3", "scores": [profile_score("m1", 960)], "unknown_scores": [], "stats": {},
         "achievements": {}},
    ]
    return songs, users


def test_find_flagged_from_board_and_profile():
    songs, users = fixture()
    flagged = find_flagged(songs, users)
    assert sorted((f["user_id"], f["md5"]) for f in flagged) == [("u1", "m1"), ("u3", "m1")]
    u1 = next(f for f in flagged if f["user_id"] == "u1")
    assert u1 == {"user_id": "u1", "username": "u1", "md5": "m1", "song_name": "Blight", "score": 900,
                  "optimal_score": 500, "is_fc": True}


def test_preview_writes_nothing():
    songs, users = fixture()
    fake = FakeSupabase(songs, users)
    messages = []
    flagged = remove_bugged_scores(fake, apply=False, log=messages.append)
    assert len(flagged) == 2
    assert fake.calls == []
    assert any("u1" in m and "Blight" in m and "180.0%" in m for m in messages)
    assert any("first_fc" in m for m in messages)


def test_apply_removes_entries_reranks_and_revokes():
    songs, users = fixture()
    fake = FakeSupabase(songs, users)
    remove_bugged_scores(fake, apply=True, log=lambda _m: None)

    updates = {call[2]: call[3] for call in fake.calls if call[0] == "update"}
    assert set(updates) == {"u1", "u3"}
    assert [s["identifier"] for s in updates["u1"]["scores"]] == ["m2"]
    assert updates["u1"]["achievements"] == {"first_score": "t"}
    assert updates["u3"]["scores"] == []

    [rpc] = [call[1] for call in fake.calls if call[0] == "rpc"]
    assert [u["md5"] for u in rpc] == ["m1"]
    assert [(e["user_id"], e["rank"]) for e in rpc[0]["leaderboard"]] == [("u2", 1)]


def test_users_written_before_leaderboards():
    songs, users = fixture()
    fake = FakeSupabase(songs, users)
    remove_bugged_scores(fake, apply=True, log=lambda _m: None)
    kinds = [call[0] for call in fake.calls]
    assert kinds.index("rpc") > max(i for i, k in enumerate(kinds) if k == "update")


def test_failed_leaderboard_write_is_reported_and_found_again():
    songs, users = fixture()
    fake = FakeSupabase(songs, users, fail_md5s={"m1"})
    messages = []
    remove_bugged_scores(fake, apply=True, log=messages.append)
    assert any("m1" in m and "failed" in m.lower() for m in messages)
    assert ("u1", "m1") in {(f["user_id"], f["md5"]) for f in find_flagged(fake.songs, [])}


def test_cli_previews_unless_applied(monkeypatch):
    calls = []
    monkeypatch.setattr(cli_module, "get_supabase", lambda: "client")
    monkeypatch.setattr(cli_module, "remove_bugged_scores", lambda client, apply, log: calls.append((client, apply)))
    app = Flask(__name__)
    cli_module.register_cli(app)
    runner = app.test_cli_runner()

    assert runner.invoke(args=["remove-bugged-scores"]).exit_code == 0
    assert runner.invoke(args=["remove-bugged-scores", "--apply"]).exit_code == 0
    assert calls == [("client", False), ("client", True)]
