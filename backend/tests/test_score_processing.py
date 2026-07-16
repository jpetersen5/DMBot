from app.utils.score_processing import (
    apply_score_to_leaderboard,
    evaluate_score_update,
    merge_unknown_scores,
)
from app.utils.achievement_processor import achievement_processor
from app.types import LeaderboardEntry


def score(score_value: int, play_count: int = 1) -> dict:
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


# --- evaluate_score_update ---------------------------------------------------

def test_new_score_always_updates():
    assert evaluate_score_update(score(100), None) is True


def test_higher_score_updates():
    assert evaluate_score_update(score(200), score(100)) is True


def test_equal_score_higher_playcount_updates():
    assert evaluate_score_update(score(100, play_count=5), score(100, play_count=3)) is True


def test_equal_score_equal_playcount_ignored():
    assert evaluate_score_update(score(100, play_count=3), score(100, play_count=3)) is False


def test_lower_score_ignored():
    assert evaluate_score_update(score(50), score(100)) is False


# --- apply_score_to_leaderboard ---------------------------------------------

def test_new_user_added_to_leaderboard():
    leaderboard = [lb_entry(500, user_id="other")]
    result, updated = apply_score_to_leaderboard(leaderboard, lb_entry(300, user_id="u1"), "u1")
    assert updated is True
    assert {e["user_id"] for e in result} == {"other", "u1"}


def test_lower_score_leaves_leaderboard_untouched():
    original = [lb_entry(500, user_id="u1")]
    result, updated = apply_score_to_leaderboard(original, lb_entry(300, user_id="u1"), "u1")
    assert updated is False
    assert result is original
    assert [e["score"] for e in result] == [500]


def test_missing_timestamp_entry_is_replaced_even_at_equal_score():
    leaderboard = [lb_entry(400, posted="", user_id="u1")]
    incoming = lb_entry(400, posted="2025-06-01T00:00:00+00:00", user_id="u1")
    result, updated = apply_score_to_leaderboard(leaderboard, incoming, "u1")
    assert updated is True
    u1_entries = [e for e in result if e["user_id"] == "u1"]
    assert len(u1_entries) == 1
    assert u1_entries[0]["posted"] == "2025-06-01T00:00:00+00:00"
    assert u1_entries[0].get("rank") == 1


def test_higher_score_replaces_single_leaderboard_entry():
    leaderboard = [lb_entry(300, user_id="u1")]
    result, updated = apply_score_to_leaderboard(leaderboard, lb_entry(900, user_id="u1"), "u1")
    assert updated is True
    u1_entries = [e for e in result if e["user_id"] == "u1"]
    assert len(u1_entries) == 1
    assert u1_entries[0]["score"] == 900


# --- merge_unknown_scores ----------------------------------------------------

def test_unknown_score_promoted_when_song_known():
    unknown = [score(1000)]  # identifier == "md5"
    songs_dict = {"md5": {"name": "Song Name", "artist": "Artist", "leaderboard": []}}
    newly_known, remaining, lb_updates = merge_unknown_scores(unknown, songs_dict, "u1", "tester")

    assert remaining == []
    assert len(newly_known) == 1
    known = newly_known[0]
    assert known["identifier"] == "md5"
    assert known["song_name"] == "Song Name"
    assert known["artist"] == "Artist"
    assert known["score"] == 1000

    assert len(lb_updates) == 1
    update = lb_updates[0]
    assert update["md5"] == "md5"
    assert update["name"] == "Song Name"
    assert any(e["user_id"] == "u1" and e["score"] == 1000 for e in update["leaderboard"])


def test_unknown_score_stays_unknown_when_song_absent():
    unknown = [score(1000)]
    newly_known, remaining, lb_updates = merge_unknown_scores(unknown, {}, "u1", "tester")

    assert newly_known == []
    assert lb_updates == []
    assert remaining == unknown


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
