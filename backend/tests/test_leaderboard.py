from app.utils.leaderboard import sort_and_rank_leaderboard
from app.types import LeaderboardEntry


def entry(
    score: int,
    speed: int = 100,
    posted: str = "2025-01-01T00:00:00+00:00",
    user_id: str = "1",
) -> LeaderboardEntry:
    return {
        "user_id": user_id,
        "username": f"user_{user_id}",
        "score": score,
        "percent": 100.0,
        "is_fc": False,
        "speed": speed,
        "play_count": 1,
        "posted": posted,
    }

def test_higher_score_ranks_first():
    lb = sort_and_rank_leaderboard([entry(100), entry(300), entry(200)])
    assert [e["score"] for e in lb] == [300, 200, 100]
    assert [e.get("rank") for e in lb] == [1, 2, 3]

def test_sub_100_speed_ranks_below_full_speed():
    lb = sort_and_rank_leaderboard([entry(999999, speed=99), entry(1000, speed=100)] )
    assert lb[0]["score"] == 1000

def test_higher_speed_wins_score_tie_at_full_speed():
    lb = sort_and_rank_leaderboard([
        entry(500, speed=100, user_id="slow"),
        entry(500, speed=150, user_id="fast"),
    ])
    assert lb[0]["user_id"] == "fast"

def test_full_ordering_score_then_speed_then_posted():
    lb = sort_and_rank_leaderboard([
        entry(500, speed=100, posted="2025-06-01T00:00:00+00:00", user_id="tie_late"),
        entry(500, speed=100, posted="2025-01-01T00:00:00+00:00", user_id="tie_early"),
        entry(500, speed=150, user_id="fast"),
        entry(600, speed=100, user_id="top"),
        entry(999999, speed=50, user_id="sub100"),
    ])
    assert [e["user_id"] for e in lb] == ["top", "fast", "tie_early", "tie_late", "sub100"]
    assert [e.get("rank") for e in lb] == [1, 2, 3, 3, 5]

def test_earlier_post_wins_score_tie():
    lb = sort_and_rank_leaderboard([
        entry(500, posted="2025-06-01T00:00:00+00:00", user_id="2"),
        entry(500, posted="2025-01-01T00:00:00+00:00", user_id="1"),
    ])
    assert lb[0]["user_id"] == "1"

def test_malformed_posted_date_does_not_crash():
    lb = sort_and_rank_leaderboard([entry(500, posted="not-a-date"), entry(400)])
    assert len(lb) == 2

def test_ties_share_a_place_and_skip_the_next():
    scores = [123000, 123000, 120000, 120000, 120000, 115000]
    lb = sort_and_rank_leaderboard([entry(s, user_id=str(i)) for i, s in enumerate(scores)])
    assert [e.get("rank") for e in lb] == [1, 1, 3, 3, 3, 6]

def test_resubmitting_a_tying_score_keeps_the_shared_place():
    lb = sort_and_rank_leaderboard([
        entry(500, posted="2025-06-01T00:00:00+00:00", user_id="resubmitted"),
        entry(500, posted="2025-01-01T00:00:00+00:00", user_id="first"),
    ])
    assert [e["user_id"] for e in lb] == ["first", "resubmitted"]
    assert [e.get("rank") for e in lb] == [1, 1]

def test_same_score_different_speed_does_not_tie():
    lb = sort_and_rank_leaderboard([entry(500, speed=100, user_id="slow"), entry(500, speed=150, user_id="fast")])
    assert [e.get("rank") for e in lb] == [1, 2]

def test_sub_100_speed_ties_rank_below_full_speed():
    lb = sort_and_rank_leaderboard([
        entry(900, speed=90, user_id="a"),
        entry(1000, speed=100, user_id="top"),
        entry(900, speed=90, user_id="b"),
    ])
    assert lb[0]["user_id"] == "top"
    assert [e.get("rank") for e in lb] == [1, 2, 2]
