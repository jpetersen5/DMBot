from app.api.scores import sort_and_rank_leaderboard
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

def test_earlier_post_wins_score_tie():
    lb = sort_and_rank_leaderboard([
        entry(500, posted="2025-06-01T00:00:00+00:00", user_id="2"),
        entry(500, posted="2025-01-01T00:00:00+00:00", user_id="1"),
    ])
    assert lb[0]["user_id"] == "1"

def test_malformed_posted_date_does_not_crash():
    lb = sort_and_rank_leaderboard([entry(500, posted="not-a-date"), entry(400)])
    assert len(lb) == 2
