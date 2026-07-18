from types import SimpleNamespace
from unittest.mock import MagicMock

from flask import Flask

from app.api import scores as scores_module


class FakeQuery:
    """Stand-in for a supabase table query chain.

    Only the calls that ``process_and_save_scores`` actually makes are
    supported: users select (by column list), users update (captured), and
    songs_new select. Filters (eq/in_) are chainable no-ops.
    """

    def __init__(self, table_name: str, holder: SimpleNamespace):
        self.table_name = table_name
        self.holder = holder
        self.op = None
        self.columns = ""

    def select(self, cols):
        self.op = "select"
        self.columns = cols
        return self

    def update(self, payload):
        self.op = "update"
        if self.table_name == "songs_new":
            self.holder.leaderboard_updates.append(payload)
        else:
            self.holder.update_data = payload
        return self

    def eq(self, *a):
        return self

    def in_(self, *a):
        return self

    def execute(self):
        if self.op == "update":
            return SimpleNamespace(data=[{"id": self.holder.user_id}])
        if self.table_name == "users":
            requested = [c.strip() for c in self.columns.split(",")]
            projected = [
                {k: v for k, v in row.items() if k in requested}
                for row in self.holder.user_rows
            ]
            return SimpleNamespace(data=projected)
        if self.table_name == "songs_new":
            # in_ is a no-op, so return every seeded song regardless of filter
            return SimpleNamespace(data=list(self.holder.songs_new))
        return SimpleNamespace(data=[])


class FakeSupabase:
    def __init__(self, holder: SimpleNamespace):
        self.holder = holder

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(name, self.holder)


def score(identifier: str, score_value: int, speed: int) -> dict:
    return {
        "identifier": identifier,
        "song_name": f"Song {identifier}",
        "artist": "Artist",
        "percent": 100.0,
        "is_fc": False,
        "speed": speed,
        "score": score_value,
        "play_count": 1,
    }


def unknown_score(identifier: str, score_value: int, speed: int, filepath: str) -> dict:
    return {
        "identifier": identifier,
        "song_name": f"Unknown Song: {identifier}",
        "artist": "Unknown Artist",
        "percent": 100.0,
        "is_fc": False,
        "speed": speed,
        "score": score_value,
        "play_count": 1,
        "filepath": filepath,
    }


def run_process(monkeypatch, existing_scores, unknown_scores=None, songs_new=None):
    """Drive process_and_save_scores with no incoming songs, so the persisted
    scores are exactly the user's existing scores. Returns (holder, ach_input)."""
    holder = SimpleNamespace(
        user_id="u1",
        user_rows=[{
            "username": "tester",
            "scores": existing_scores,
            "unknown_scores": unknown_scores or [],
            "stats": {},
            "achievements": {},
        }],
        songs_new=songs_new or [],
        leaderboard_updates=[],
        update_data=None,
    )

    ach_input = SimpleNamespace(scores=None)

    def fake_process_achievements(user_achievement_data):
        # snapshot the scores handed to achievement processing
        ach_input.scores = list(user_achievement_data["scores"])
        return {}, []

    monkeypatch.setattr(scores_module, "get_supabase", lambda: FakeSupabase(holder))
    monkeypatch.setattr(scores_module, "socketio", MagicMock())
    monkeypatch.setattr(scores_module, "redis", MagicMock())
    monkeypatch.setattr(
        scores_module.achievement_processor,
        "process_achievements",
        fake_process_achievements,
    )

    app = Flask(__name__)
    with app.app_context():
        scores_module.process_and_save_scores({"songs": []}, "u1")

    return holder, ach_input


def test_sub_100_scores_persist_but_excluded_from_achievements(monkeypatch):
    existing = [
        score("a", 500, 100),
        score("b", 400, 90),
        score("c", 300, 90),
        score("d", 200, 100),
    ]
    holder, ach_input = run_process(monkeypatch, existing)

    persisted = holder.update_data["scores"]
    persisted_ids = {s["identifier"] for s in persisted}
    assert persisted_ids == {"a", "b", "c", "d"}
    persisted_by_id = {s["identifier"]: s for s in persisted}
    assert persisted_by_id["b"]["speed"] == 90
    assert persisted_by_id["c"]["speed"] == 90

    ach_ids = {s["identifier"] for s in ach_input.scores}
    assert ach_ids == {"a", "d"}
    assert all(s["speed"] >= 100 for s in ach_input.scores)


def test_all_sub_100_scores_excluded_from_achievements(monkeypatch):
    existing = [
        score("x", 300, 90),
        score("y", 200, 80),
        score("z", 100, 70),
    ]
    holder, ach_input = run_process(monkeypatch, existing)

    assert {s["identifier"] for s in holder.update_data["scores"]} == {"x", "y", "z"}
    assert ach_input.scores == []


def test_unknown_score_promoted_when_song_now_known(monkeypatch):
    unknown = unknown_score("m1", 500, 100, r"C:\songs\foo\notes.chart")
    song_row = {"md5": "m1", "name": "Foo", "artist": "Bar", "leaderboard": []}

    holder, _ = run_process(
        monkeypatch,
        existing_scores=[],
        unknown_scores=[unknown],
        songs_new=[song_row],
    )

    persisted = holder.update_data["scores"]
    assert {s["identifier"] for s in persisted} == {"m1"}

    assert holder.update_data["unknown_scores"] == []

    assert holder.leaderboard_updates, "expected a leaderboard write"
    leaderboard = holder.leaderboard_updates[-1]["leaderboard"]
    assert any(entry["user_id"] == "u1" for entry in leaderboard)


def test_unknown_score_survives_when_song_still_unknown(monkeypatch):
    unknown = unknown_score("m2", 500, 100, r"C:\songs\bar\notes.chart")

    holder, _ = run_process(
        monkeypatch,
        existing_scores=[],
        unknown_scores=[unknown],
        songs_new=[],
    )

    assert holder.update_data["scores"] == []

    persisted_unknown = holder.update_data["unknown_scores"]
    assert len(persisted_unknown) == 1
    assert persisted_unknown[0]["identifier"] == "m2"
    assert persisted_unknown[0]["filepath"] == r"C:\songs\bar\notes.chart"
