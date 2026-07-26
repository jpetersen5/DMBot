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
        # songs_new is no longer updated one row at a time; leaderboard writes
        # go through the bulk_update_leaderboards rpc (see FakeRpc). Only the
        # users profile update reaches here now.
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
            self.holder.songs_new_columns.append(self.columns)
            return SimpleNamespace(data=list(self.holder.songs_new))
        return SimpleNamespace(data=[])


class FakeApiError(Exception):
    """Stand-in for postgrest's APIError."""

    def __init__(self, code: str, message: str = "boom"):
        super().__init__({"message": message, "code": code, "hint": None, "details": None})


class FakeRpc:
    """Stand-in for a supabase rpc() call chain.

    Failure injection, to exercise the statement-timeout retry path:

    * ``rpc_max_chunk``  -- chunks larger than this raise 57014 (timeout).
    * ``rpc_fail_md5s``  -- any chunk containing one of these raises 57014
      (song can't be written).
    * ``rpc_error_md5s`` -- any chunk containing one raises a non-timeout error
      (should not be retried).
    """

    def __init__(self, fn_name: str, params: dict, holder: SimpleNamespace):
        self.fn_name = fn_name
        self.params = params
        self.holder = holder

    def execute(self):
        self.holder.rpc_calls.append((self.fn_name, self.params))
        if self.fn_name == "bulk_update_leaderboards":
            chunk = self.params["updates"]
            md5s = {entry["md5"] for entry in chunk}
            self.holder.attempted_chunks.append(chunk)

            if md5s & self.holder.rpc_error_md5s:
                raise FakeApiError("42883", "function does not exist")
            if md5s & self.holder.rpc_fail_md5s:
                raise FakeApiError("57014", "canceling statement due to statement timeout")
            if self.holder.rpc_max_chunk is not None and len(chunk) > self.holder.rpc_max_chunk:
                raise FakeApiError("57014", "canceling statement due to statement timeout")

            self.holder.leaderboard_chunks.append(chunk)
            self.holder.leaderboard_updates.extend(chunk)
        return SimpleNamespace(data=None)


class FakeSupabase:
    def __init__(self, holder: SimpleNamespace):
        self.holder = holder

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(name, self.holder)

    def rpc(self, fn_name: str, params: dict) -> FakeRpc:
        return FakeRpc(fn_name, params, self.holder)


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


def incoming_song(identifier: str, score_value: int, speed: int = 100, play_count: int = 1) -> dict:
    """A song as it arrives from the scoredata parser (drums == instrument 9)."""
    return {
        "identifier": identifier,
        "play_count": play_count,
        "scores": [{
            "instrument": 9,
            "percent": 100.0,
            "is_fc": False,
            "speed": speed,
            "score": score_value,
        }],
    }


def run_process(
    monkeypatch,
    existing_scores,
    unknown_scores=None,
    songs_new=None,
    songs=None,
    stats=None,
    achievement_errors=None,
    rpc_max_chunk=None,
    rpc_fail_md5s=None,
    rpc_error_md5s=None,
):
    """Drive process_and_save_scores."""
    holder = SimpleNamespace(
        user_id="u1",
        user_rows=[{
            "username": "tester",
            "scores": existing_scores,
            "unknown_scores": unknown_scores or [],
            "stats": {} if stats is None else stats,
            "achievements": {},
        }],
        songs_new=songs_new or [],
        songs_new_columns=[],
        leaderboard_updates=[],
        leaderboard_chunks=[],
        attempted_chunks=[],
        rpc_calls=[],
        rpc_max_chunk=rpc_max_chunk,
        rpc_fail_md5s=set(rpc_fail_md5s or ()),
        rpc_error_md5s=set(rpc_error_md5s or ()),
        update_data=None,
        socketio=MagicMock(),
    )

    ach_input = SimpleNamespace(scores=None, stats=None)

    def fake_process_achievements(user_achievement_data):
        # snapshot what achievement processing was handed
        ach_input.scores = list(user_achievement_data["scores"])
        ach_input.stats = user_achievement_data["stats"]
        return {}, list(achievement_errors or [])

    monkeypatch.setattr(scores_module, "get_supabase", lambda: FakeSupabase(holder))
    monkeypatch.setattr(scores_module, "socketio", holder.socketio)
    monkeypatch.setattr(scores_module, "redis", MagicMock())
    monkeypatch.setattr(
        scores_module.achievement_processor,
        "process_achievements",
        fake_process_achievements,
    )

    app = Flask(__name__)
    with app.app_context():
        scores_module.process_and_save_scores({"songs": songs or []}, "u1")

    return holder, ach_input


def completion_event(holder) -> dict:
    """The payload of the terminal score_processing_complete emit."""
    for call in holder.socketio.emit.call_args_list:
        if call.args and call.args[0] == "score_processing_complete":
            return call.args[1]
    raise AssertionError("no score_processing_complete emit")


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


def test_batch_song_fetch_uses_slim_columns(monkeypatch):
    unknown = unknown_score("m1", 500, 100, r"C:\songs\foo\notes.chart")
    song_row = {"md5": "m1", "name": "Foo", "artist": "Bar", "leaderboard": []}

    holder, _ = run_process(
        monkeypatch,
        existing_scores=[],
        unknown_scores=[unknown],
        songs_new=[song_row],
    )

    assert holder.songs_new_columns, "expected a songs_new batch fetch"
    for cols in holder.songs_new_columns:
        assert cols == "md5,name,artist,charter_refs,leaderboard"
        assert cols != "*"


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


def test_leaderboard_writes_go_through_bulk_rpc(monkeypatch):
    """A single leaderboard change is written via the bulk rpc, not a per-row
    songs_new update."""
    unknown = unknown_score("m1", 500, 100, r"C:\songs\foo\notes.chart")
    song_row = {"md5": "m1", "name": "Foo", "artist": "Bar", "leaderboard": []}

    holder, _ = run_process(
        monkeypatch,
        existing_scores=[],
        unknown_scores=[unknown],
        songs_new=[song_row],
    )

    # exactly one rpc chunk, carrying only md5/leaderboard/last_update
    assert len(holder.leaderboard_chunks) == 1
    fn_name, params = holder.rpc_calls[0]
    assert fn_name == "bulk_update_leaderboards"
    entry = params["updates"][0]
    assert entry["md5"] == "m1"
    assert "last_update" in entry
    assert set(entry.keys()) == {"md5", "leaderboard", "last_update"}


def test_leaderboard_updates_are_chunked_at_100(monkeypatch):
    """250 changed songs are flushed in chunks of at most 100 rpc calls, and
    every song still gets written exactly once."""
    total = 250
    unknowns = [
        unknown_score(f"m{i}", 500, 100, rf"C:\songs\foo{i}\notes.chart")
        for i in range(total)
    ]
    song_rows = [
        {"md5": f"m{i}", "name": f"Song {i}", "artist": "Bar", "leaderboard": []}
        for i in range(total)
    ]

    holder, _ = run_process(
        monkeypatch,
        existing_scores=[],
        unknown_scores=unknowns,
        songs_new=song_rows,
    )

    # 250 updates -> chunks of 100, 100, 50
    assert [len(chunk) for chunk in holder.leaderboard_chunks] == [100, 100, 50]
    assert all(fn == "bulk_update_leaderboards" for fn, _ in holder.rpc_calls)
    assert len(holder.rpc_calls) == 3

    assert all(len(chunk) <= 100 for chunk in holder.leaderboard_chunks)
    written_md5s = [entry["md5"] for entry in holder.leaderboard_updates]
    assert len(written_md5s) == total
    assert set(written_md5s) == {f"m{i}" for i in range(total)}


# --- statement-timeout handling -------------------------------------------------


def test_is_statement_timeout_reads_both_error_shapes():
    """postgrest exposes the SQLSTATE as either an attribute or a dict in args."""
    from app.utils.leaderboard_writer import is_statement_timeout

    with_attr = Exception("boom")
    setattr(with_attr, "code", "57014")

    assert is_statement_timeout(with_attr)
    assert is_statement_timeout(FakeApiError("57014"))
    assert not is_statement_timeout(FakeApiError("42883"))
    assert not is_statement_timeout(Exception("no code at all"))


def test_timed_out_chunk_is_retried_in_halves(monkeypatch):
    """A chunk too large for the statement timeout is subdivided until it fits,
    so every song still lands rather than the whole chunk being dropped."""
    total = 100
    unknowns = [unknown_score(f"m{i}", 500, 100, rf"C:\s{i}") for i in range(total)]
    song_rows = [
        {"md5": f"m{i}", "name": f"Song {i}", "artist": "Bar", "leaderboard": []}
        for i in range(total)
    ]

    holder, _ = run_process(
        monkeypatch,
        existing_scores=[],
        unknown_scores=unknowns,
        songs_new=song_rows,
        rpc_max_chunk=25,
    )

    # 100 -> (fails) -> 50, 50 -> (each fails) -> 25 x 4
    assert [len(chunk) for chunk in holder.leaderboard_chunks] == [25, 25, 25, 25]

    written = [entry["md5"] for entry in holder.leaderboard_updates]
    assert set(written) == {f"m{i}" for i in range(total)}
    assert len(written) == total, "no song should be written twice"

    assert completion_event(holder)["status"] == "completed"


def test_permanently_failing_song_does_not_take_the_batch_with_it(monkeypatch):
    """One song that times out even alone is reported, while every other song is
    still written."""
    total = 10
    unknowns = [unknown_score(f"m{i}", 500, 100, rf"C:\s{i}") for i in range(total)]
    song_rows = [
        {"md5": f"m{i}", "name": f"Song {i}", "artist": "Bar", "leaderboard": []}
        for i in range(total)
    ]

    holder, _ = run_process(
        monkeypatch,
        existing_scores=[],
        unknown_scores=unknowns,
        songs_new=song_rows,
        rpc_fail_md5s={"m3"},
    )

    written = {entry["md5"] for entry in holder.leaderboard_updates}
    assert written == {f"m{i}" for i in range(total)} - {"m3"}

    event = completion_event(holder)
    assert event["status"] == "completed_with_errors"
    assert "1 leaderboard(s) could not be updated" in event["message"]


def test_non_timeout_error_is_not_retried(monkeypatch):
    """A non-57014 failure is terminal for its chunk -- halving it would just
    repeat the same error."""
    unknowns = [unknown_score(f"m{i}", 500, 100, rf"C:\s{i}") for i in range(4)]
    song_rows = [
        {"md5": f"m{i}", "name": f"Song {i}", "artist": "Bar", "leaderboard": []}
        for i in range(4)
    ]

    holder, _ = run_process(
        monkeypatch,
        existing_scores=[],
        unknown_scores=unknowns,
        songs_new=song_rows,
        rpc_error_md5s={"m0"},
    )

    assert len(holder.attempted_chunks) == 1, "expected no retry"
    assert holder.leaderboard_updates == []
    assert completion_event(holder)["status"] == "completed_with_errors"


def test_rank_is_dropped_when_its_leaderboard_write_failed(monkeypatch):
    """A rank computed against a leaderboard that never reached the database is
    fiction, and must not be shown on the user's profile."""
    song_rows = [
        {"md5": "good", "name": "Good", "artist": "Bar", "leaderboard": []},
        {"md5": "bad", "name": "Bad", "artist": "Bar", "leaderboard": []},
    ]

    holder, _ = run_process(
        monkeypatch,
        existing_scores=[],
        songs_new=song_rows,
        songs=[incoming_song("good", 500), incoming_song("bad", 400)],
        rpc_fail_md5s={"bad"},
    )

    persisted = {s["identifier"]: s for s in holder.update_data["scores"]}
    assert persisted["good"]["rank"] == 1, "written leaderboard keeps its rank"
    assert persisted["bad"]["rank"] is None, "failed leaderboard must not keep a rank"


def test_rank_is_kept_when_the_write_succeeds(monkeypatch):
    """Guards the test above: the rank is only dropped because the write failed."""
    song_rows = [{"md5": "good", "name": "Good", "artist": "Bar", "leaderboard": []}]

    holder, _ = run_process(
        monkeypatch,
        existing_scores=[],
        songs_new=song_rows,
        songs=[incoming_song("good", 500)],
    )

    persisted = {s["identifier"]: s for s in holder.update_data["scores"]}
    assert persisted["good"]["rank"] == 1
    assert completion_event(holder)["status"] == "completed"


def test_achievement_and_leaderboard_failures_are_both_reported(monkeypatch):
    unknowns = [unknown_score("m0", 500, 100, r"C:\s0")]
    song_rows = [{"md5": "m0", "name": "Song", "artist": "Bar", "leaderboard": []}]

    holder, _ = run_process(
        monkeypatch,
        existing_scores=[],
        unknown_scores=unknowns,
        songs_new=song_rows,
        achievement_errors=[{"id": "x", "name": "X", "error": "nope"}],
        rpc_fail_md5s={"m0"},
    )

    event = completion_event(holder)
    assert event["status"] == "completed_with_errors"
    assert "achievement errors" in event["message"]
    assert "leaderboard" in event["message"]


# --- stats ----------------------------------------------------------------------


def test_null_stats_does_not_reach_achievements(monkeypatch):
    """users.stats is SQL NULL until update_all_user_stats first runs."""
    holder, ach_input = run_process(
        monkeypatch,
        existing_scores=[score("a", 500, 100), score("b", 400, 100)],
        stats=None,
    )

    assert ach_input.stats is not None
    assert ach_input.stats["total_scores"] == 2
    assert ach_input.stats["total_score"] == 900


def test_stats_are_not_written_from_python(monkeypatch):
    """The update_user_stats BEFORE UPDATE trigger owns the stored copy."""
    holder, _ = run_process(
        monkeypatch,
        existing_scores=[score("a", 500, 100)],
        unknown_scores=[unknown_score("u1", 100, 100, r"C:\x")],
        stats={"rank": 7, "total_scores": 0, "total_fcs": 0, "total_score": 0, "avg_percent": 0},
    )

    assert "stats" not in holder.update_data
    assert len(holder.update_data["scores"]) == 1
    assert len(holder.update_data["unknown_scores"]) == 1


def test_recomputed_stats_still_reach_achievements(monkeypatch):
    _, ach_input = run_process(
        monkeypatch,
        existing_scores=[score("a", 500, 100)],
        unknown_scores=[unknown_score("u1", 100, 100, r"C:\x")],
        stats={"rank": 7, "total_scores": 0, "total_fcs": 0, "total_score": 0, "avg_percent": 0},
    )

    assert ach_input.stats["total_scores"] == 2
    assert ach_input.stats["total_score"] == 600
    assert ach_input.stats["rank"] == 7
