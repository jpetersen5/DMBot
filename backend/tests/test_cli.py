from types import SimpleNamespace

from flask import Flask

from app import cli as cli_module


class FakeQuery:
    def __init__(self, table_name: str, holder: SimpleNamespace):
        self.table_name = table_name
        self.holder = holder
        self.op = None
        self.columns = ""
        self._range = None
        self._in = None
        self._eq = {}
        self._payload = None

    def select(self, cols):
        self.op = "select"
        self.columns = cols
        return self

    def update(self, payload):
        self.op = "update"
        self._payload = payload
        return self

    def eq(self, col, val):
        self._eq[col] = val
        return self

    def in_(self, col, vals):
        self._in = (col, list(vals))
        return self

    def range(self, start, end):
        self._range = (start, end)
        return self

    def execute(self):
        if self.op == "update":
            if self.table_name == "users":
                self.holder.user_updates[self._eq["id"]] = self._payload
            else:
                self.holder.song_updates[self._eq["md5"]] = self._payload
            return SimpleNamespace(data=[{"id": self._eq.get("id")}])

        if self.table_name == "users":
            data = self.holder.users
            if self._range is not None:
                start, end = self._range
                data = data[start:end + 1]
            requested = [c.strip() for c in self.columns.split(",")]
            projected = [
                {k: v for k, v in row.items() if k in requested} for row in data
            ]
            return SimpleNamespace(data=projected)

        if self.table_name == "songs_new":
            _, wanted = self._in or ("md5", [])
            matched = [s for s in self.holder.songs if s["md5"] in wanted]
            return SimpleNamespace(data=matched)

        return SimpleNamespace(data=[])


class FakeSupabase:
    def __init__(self, holder: SimpleNamespace):
        self.holder = holder

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(name, self.holder)


def unknown(identifier: str, score_value: int, user_id: str) -> dict:
    return {
        "identifier": identifier,
        "song_name": f"Unknown Song: {identifier}",
        "artist": "Unknown Artist",
        "percent": 100.0,
        "is_fc": False,
        "speed": 100,
        "score": score_value,
        "play_count": 1,
    }


def test_promote_unknown_scores_merges_shared_song_leaderboard(monkeypatch):
    holder = SimpleNamespace(
        users=[
            {
                "id": "u1",
                "username": "alice",
                "scores": [],
                "unknown_scores": [unknown("shared", 1000, "u1")],
            },
            {
                "id": "u2",
                "username": "bob",
                "scores": [],
                "unknown_scores": [unknown("shared", 2000, "u2")],
            },
        ],
        songs=[
            {
                "md5": "shared",
                "name": "Shared Song",
                "artist": "Artist",
                "charter_refs": [],
                "leaderboard": [],
            }
        ],
        user_updates={},
        song_updates={},
    )

    monkeypatch.setattr(cli_module, "get_supabase", lambda: FakeSupabase(holder))

    app = Flask(__name__)
    cli_module.register_cli(app)

    result = app.test_cli_runner().invoke(
        args=["promote-unknown-scores", "--no-dry-run"]
    )

    assert result.exit_code == 0, result.output

    assert "shared" in holder.song_updates
    leaderboard = holder.song_updates["shared"]["leaderboard"]
    user_ids = [entry["user_id"] for entry in leaderboard]
    assert user_ids.count("u1") == 1
    assert user_ids.count("u2") == 1
    assert len(leaderboard) == 2

    for user_id, expected_score in (("u1", 1000), ("u2", 2000)):
        payload = holder.user_updates[user_id]
        promoted = {s["identifier"]: s for s in payload["scores"]}
        assert "shared" in promoted
        assert promoted["shared"]["score"] == expected_score
        assert payload["unknown_scores"] == []


def test_promote_unknown_scores_dry_run_writes_nothing(monkeypatch):
    holder = SimpleNamespace(
        users=[
            {
                "id": "u1",
                "username": "alice",
                "scores": [],
                "unknown_scores": [unknown("shared", 1000, "u1")],
            }
        ],
        songs=[
            {
                "md5": "shared",
                "name": "Shared Song",
                "artist": "Artist",
                "charter_refs": [],
                "leaderboard": [],
            }
        ],
        user_updates={},
        song_updates={},
    )

    monkeypatch.setattr(cli_module, "get_supabase", lambda: FakeSupabase(holder))

    app = Flask(__name__)
    cli_module.register_cli(app)

    result = app.test_cli_runner().invoke(args=["promote-unknown-scores"])

    assert result.exit_code == 0, result.output
    assert holder.user_updates == {}
    assert holder.song_updates == {}
