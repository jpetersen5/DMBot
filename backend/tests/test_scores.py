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
            if "stats" in self.columns:
                return SimpleNamespace(data=[{"stats": {}}])
            return SimpleNamespace(data=self.holder.user_rows)
        # songs_new (or anything else) — no songs in these tests
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


def run_process(monkeypatch, existing_scores):
    """Drive process_and_save_scores with no incoming songs, so the persisted
    scores are exactly the user's existing scores. Returns (holder, ach_input)."""
    holder = SimpleNamespace(
        user_id="u1",
        user_rows=[{
            "username": "tester",
            "scores": existing_scores,
            "achievements": {},
        }],
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
    # After sorting by score desc: A(100), B(99), C(99), D(100).
    # B and C are consecutive sub-100 entries — the case the old
    # remove-while-iterating loop mishandled (it skipped C).
    existing = [
        score("a", 500, 100),
        score("b", 400, 99),
        score("c", 300, 99),
        score("d", 200, 100),
    ]
    holder, ach_input = run_process(monkeypatch, existing)

    # (a) ALL scores — including both sub-100 entries — survive persistence.
    persisted = holder.update_data["scores"]
    persisted_ids = {s["identifier"] for s in persisted}
    assert persisted_ids == {"a", "b", "c", "d"}
    persisted_by_id = {s["identifier"]: s for s in persisted}
    assert persisted_by_id["b"]["speed"] == 99
    assert persisted_by_id["c"]["speed"] == 99

    # (b) Achievement processing sees only speed >= 100 scores; both
    # consecutive sub-100 entries are excluded.
    ach_ids = {s["identifier"] for s in ach_input.scores}
    assert ach_ids == {"a", "d"}
    assert all(s["speed"] >= 100 for s in ach_input.scores)


def test_all_sub_100_scores_excluded_from_achievements(monkeypatch):
    # A run of three consecutive sub-100 entries: the old bug would have left
    # the middle ones behind. None should reach achievement processing.
    existing = [
        score("x", 300, 90),
        score("y", 200, 80),
        score("z", 100, 70),
    ]
    holder, ach_input = run_process(monkeypatch, existing)

    assert {s["identifier"] for s in holder.update_data["scores"]} == {"x", "y", "z"}
    assert ach_input.scores == []
