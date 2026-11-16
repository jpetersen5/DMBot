import json
from typing import Any

from app.utils.score_processing import (
    apply_score_to_leaderboard,
    classify_score_update,
    merge_unknown_scores,
)
from app.utils.achievement_processor import achievement_processor
from app.types import LeaderboardEntry


def score(score_value: int, play_count: int = 1) -> dict[str, Any]:
    return {
        "identifier": "md5",
        "percent": 100.0,
        "is_fc": False,
        "speed": 100,
        "score": score_value,
        "play_count": play_count,
        "posted": "2025-01-01T00:00:00+00:00",
    }


def lb_entry(
    score_value: int,
    play_count: int = 1,
    posted: str = "2025-01-01T00:00:00+00:00",
    user_id: str = "u1",
) -> LeaderboardEntry:
    return {
        "user_id": user_id,
        "username": "tester",
        "score": score_value,
        "percent": 100.0,
        "is_fc": False,
        "speed": 100,
        "play_count": play_count,
        "posted": posted,
    }


# --- classify_score_update ---------------------------------------------------

def with_run(entry: dict[str, Any]) -> dict[str, Any]:
    return {**entry, "difficulty": 3, "modifiers": 2, "stars": 5}


def test_new_score_replaces():
    assert classify_score_update(score(100), None) == "replace"


def test_higher_score_replaces():
    assert classify_score_update(score(200), score(100)) == "replace"


def test_equal_score_higher_playcount_refreshes():
    assert classify_score_update(score(100, play_count=5), score(100, play_count=3)) == "refresh"


def test_equal_score_equal_playcount_kept():
    assert classify_score_update(score(100, play_count=3), score(100, play_count=3)) == "keep"


def test_lower_score_kept():
    assert classify_score_update(score(50), score(100)) == "keep"


def test_equal_score_higher_percent_replaces():
    assert classify_score_update({**score(100), "percent": 99}, {**score(100), "percent": 98}) == "replace"


def test_equal_score_new_fc_replaces():
    assert classify_score_update({**score(100), "is_fc": 1}, {**score(100), "is_fc": 0}) == "replace"


def test_equal_score_higher_speed_replaces():
    assert classify_score_update({**score(100), "speed": 110}, score(100)) == "replace"


def test_equal_score_lower_percent_more_plays_refreshes():
    incoming = {**score(100, play_count=5), "percent": 90}
    assert classify_score_update(incoming, score(100, play_count=3)) == "refresh"


def test_legacy_entry_is_filled():
    assert classify_score_update(with_run(score(100)), score(100)) == "fill"


def test_filled_entry_with_same_plays_kept():
    assert classify_score_update(with_run(score(100)), with_run(score(100))) == "keep"


def test_lower_score_does_not_fill():
    assert classify_score_update(with_run(score(50)), score(100)) == "keep"


# --- apply_score_to_leaderboard ---------------------------------------------

def test_new_user_added_to_leaderboard():
    leaderboard = [lb_entry(500, user_id="other")]
    result, kind = apply_score_to_leaderboard(leaderboard, lb_entry(300, user_id="u1"), "u1")
    assert kind == "replace"
    assert {e["user_id"] for e in result} == {"other", "u1"}


def test_lower_score_leaves_leaderboard_untouched():
    original = [lb_entry(500, user_id="u1")]
    result, kind = apply_score_to_leaderboard(original, lb_entry(300, user_id="u1"), "u1")
    assert kind == "keep"
    assert result is original
    assert [e["score"] for e in result] == [500]


def test_missing_timestamp_entry_is_replaced_even_at_equal_score():
    leaderboard = [lb_entry(400, posted="", user_id="u1")]
    incoming = lb_entry(400, posted="2025-06-01T00:00:00+00:00", user_id="u1")
    result, kind = apply_score_to_leaderboard(leaderboard, incoming, "u1")
    assert kind == "replace"
    u1_entries = [e for e in result if e["user_id"] == "u1"]
    assert len(u1_entries) == 1
    assert u1_entries[0]["posted"] == "2025-06-01T00:00:00+00:00"
    assert u1_entries[0].get("rank") == 1


def test_higher_score_replaces_single_leaderboard_entry():
    leaderboard = [lb_entry(300, user_id="u1")]
    result, kind = apply_score_to_leaderboard(leaderboard, lb_entry(900, user_id="u1"), "u1")
    assert kind == "replace"
    u1_entries = [e for e in result if e["user_id"] == "u1"]
    assert len(u1_entries) == 1
    assert u1_entries[0]["score"] == 900


# --- merge_unknown_scores ----------------------------------------------------

def test_unknown_score_promoted_when_song_known():
    unknown = [score(1000)]  # identifier == "md5"
    songs_dict = {"md5": {"name": "Song Name", "artist": "Artist", "leaderboard": []}}
    newly_known, remaining, lb_updates = merge_unknown_scores(unknown, songs_dict, "u1", "tester", {})

    assert remaining == []
    assert len(newly_known) == 1
    known = newly_known[0]
    assert known["identifier"] == "md5"
    assert known["song_name"] == "Song Name"
    assert known["artist"] == "Artist"
    assert known["score"] == 1000
    assert known["charter_refs"] == []
    assert known["rank"] is None

    assert len(lb_updates) == 1
    update = lb_updates[0]
    assert update["md5"] == "md5"
    assert update["name"] == "Song Name"
    assert any(e["user_id"] == "u1" and e["score"] == 1000 for e in update["leaderboard"])


def test_promoted_score_carries_charter_refs():
    unknown = [score(1000)]
    songs_dict = {"md5": {"name": "Song Name", "artist": "Artist", "leaderboard": [], "charter_refs": [7, 9]}}
    newly_known, _, _ = merge_unknown_scores(unknown, songs_dict, "u1", "tester", {})

    assert newly_known[0]["charter_refs"] == [7, 9]


def test_unknown_score_stays_unknown_when_song_absent():
    unknown = [score(1000)]
    newly_known, remaining, lb_updates = merge_unknown_scores(unknown, {}, "u1", "tester", {})

    assert newly_known == []
    assert lb_updates == []
    assert remaining == unknown


def test_promotion_does_not_duplicate_existing_leaderboard_row():
    unknown = [score(1000)]
    songs_dict = {
        "md5": {
            "name": "Song Name",
            "artist": "Artist",
            "leaderboard": [lb_entry(1000, user_id="u1")],
        }
    }
    _, _, lb_updates = merge_unknown_scores(unknown, songs_dict, "u1", "tester", {})

    assert lb_updates == []


def test_promotion_emitting_update_keeps_single_row_per_user():
    unknown = [score(2000)]
    songs_dict = {
        "md5": {
            "name": "Song Name",
            "artist": "Artist",
            "leaderboard": [lb_entry(1000, user_id="u1"), lb_entry(500, user_id="other")],
        }
    }
    _, _, lb_updates = merge_unknown_scores(unknown, songs_dict, "u1", "tester", {})

    assert len(lb_updates) == 1
    board = lb_updates[0]["leaderboard"]
    u1_rows = [e for e in board if e["user_id"] == "u1"]
    assert len(u1_rows) == 1
    assert u1_rows[0]["score"] == 2000


def test_int_user_id_serializes_as_string_and_matches_existing_entry():
    unknown = [score(2000)]
    songs_dict = {
        "md5": {
            "name": "Song Name",
            "artist": "Artist",
            "leaderboard": [lb_entry(1000, user_id="90071992547409910")],
        }
    }
    _, _, lb_updates = merge_unknown_scores(
        unknown, songs_dict, 90071992547409910, "tester", {}
    )

    assert len(lb_updates) == 1
    board = lb_updates[0]["leaderboard"]
    user_rows = [e for e in board if e["user_id"] == "90071992547409910"]
    assert len(user_rows) == 1
    assert user_rows[0]["score"] == 2000
    assert isinstance(user_rows[0]["user_id"], str)
    assert '"user_id": "90071992547409910"' in json.dumps(user_rows[0])


def test_better_existing_known_score_not_clobbered_by_worse_promotion():
    unknown = [score(500)]
    songs_dict = {"md5": {"name": "Song Name", "artist": "Artist", "leaderboard": []}}
    existing_known = {"md5": score(1000)}
    newly_known, remaining, _ = merge_unknown_scores(
        unknown, songs_dict, "u1", "tester", existing_known
    )

    assert newly_known == []
    assert remaining == []


def test_better_promotion_overrides_worse_existing_known_score():
    unknown = [score(2000)]
    songs_dict = {"md5": {"name": "Song Name", "artist": "Artist", "leaderboard": []}}
    existing_known = {"md5": score(1000)}
    newly_known, remaining, _ = merge_unknown_scores(
        unknown, songs_dict, "u1", "tester", existing_known
    )

    assert len(newly_known) == 1
    assert newly_known[0]["score"] == 2000
    assert remaining == []


def test_overlapping_identifier_always_removed_from_unknowns():
    unknown = [score(1)]
    songs_dict = {"md5": {"name": "Song Name", "artist": "Artist", "leaderboard": []}}
    existing_known = {"md5": score(999999)}
    _, remaining, _ = merge_unknown_scores(unknown, songs_dict, "u1", "tester", existing_known)

    assert all(u["identifier"] != "md5" for u in remaining)


# --- AchievementProcessor.build_client_achievement ---------------------------

def test_build_client_achievement_matches_definition_shape():
    timestamp = "2025-01-01T00:00:00+00:00"
    result = achievement_processor.build_client_achievement("first_score", timestamp)
    assert result is not None

    definition = next(a for a in achievement_processor.achievements if a["id"] == "first_score")
    assert result == {
        "id": "first_score",
        "name": definition["name"],
        "description": definition["description"],
        "rank": definition["rank"],
        "category": definition["category"],
        "achieved": True,
        "timestamp": timestamp,
        "group": definition.get("group"),
        "song_md5": definition.get("song_md5"),
    }
    assert set(result) == {
        "id", "name", "description", "rank", "category",
        "achieved", "timestamp", "group", "song_md5",
    }


def test_build_client_achievement_returns_none_for_unknown_id():
    assert achievement_processor.build_client_achievement("does_not_exist", "ts") is None


# --- run field fill-in -------------------------------------------------------

RUN = {"difficulty": 3, "modifiers": 2, "stars": 5}


def test_leaderboard_fill_in_keeps_rank_order_and_posted():
    other = lb_entry(600, user_id="u2")
    other["rank"] = 1
    mine = lb_entry(500)
    mine["rank"] = 2
    incoming = lb_entry(500, posted="2026-11-15T00:00:00+00:00")
    incoming.update(difficulty=3, modifiers=2, stars=5)

    result, kind = apply_score_to_leaderboard([other, mine], incoming, "u1")

    assert kind == "fill"
    assert [e["user_id"] for e in result] == ["u2", "u1"]
    filled = result[1]
    assert {k: filled.get(k) for k in RUN} == RUN
    assert filled["posted"] == "2025-01-01T00:00:00+00:00"
    assert filled.get("rank") == 2


def test_leaderboard_already_filled_is_unchanged():
    mine = lb_entry(500)
    mine.update(difficulty=3, modifiers=2, stars=5, rank=1)
    incoming = lb_entry(500, posted="2026-11-15T00:00:00+00:00")
    incoming.update(difficulty=3, modifiers=2, stars=5)
    _, kind = apply_score_to_leaderboard([mine], incoming, "u1")
    assert kind == "keep"


def test_merge_unknown_carries_run_fields():
    unknown = [{**score(1000), "difficulty": 3, "modifiers": 2, "stars": 4}]
    songs_dict = {"md5": {"name": "Song Name", "artist": "Artist", "leaderboard": []}}
    newly_known, _, lb_updates = merge_unknown_scores(unknown, songs_dict, "u1", "tester", {})
    expected = {"difficulty": 3, "modifiers": 2, "stars": 4}
    assert {k: newly_known[0].get(k) for k in expected} == expected
    entry = lb_updates[0]["leaderboard"][0]
    assert {k: entry.get(k) for k in expected} == expected


def test_leaderboard_refresh_updates_plays_and_keeps_posted():
    mine = lb_entry(500)
    mine["rank"] = 1
    incoming = lb_entry(500, play_count=4, posted="2026-11-15T00:00:00+00:00")
    result, kind = apply_score_to_leaderboard([mine], incoming, "u1")
    assert kind == "refresh"
    assert result[0]["play_count"] == 4
    assert result[0]["posted"] == "2025-01-01T00:00:00+00:00"


def test_promotion_fills_equal_known_entry_in_place():
    known = score(1000)
    unknown = [with_run(score(1000))]
    songs_dict = {"md5": {"name": "Song Name", "artist": "Artist", "leaderboard": []}}
    newly_known, _, _ = merge_unknown_scores(unknown, songs_dict, "u1", "tester", {"md5": known})
    assert newly_known == []
    assert known["modifiers"] == 2
    assert known["posted"] == "2025-01-01T00:00:00+00:00"
