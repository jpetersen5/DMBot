from app.utils.user_stats import compute_user_stats


def s(**kwargs) -> dict:
    base = {"score": 0, "percent": 0.0, "is_fc": False}
    base.update(kwargs)
    return base


def test_empty_inputs():
    stats = compute_user_stats([], [])
    assert stats == {
        "total_scores": 0,
        "total_fcs": 0,
        "total_score": 0,
        "avg_percent": 0,
        "rank": None,
    }


def test_none_inputs_behave_like_empty():
    """users.scores and users.unknown_scores are nullable; unnest(NULL) yields no
    rows rather than erroring."""
    assert compute_user_stats(None, None)["total_scores"] == 0


def test_unknown_scores_are_counted():
    """The RPC sums both arrays -- it applies no known/unknown distinction."""
    stats = compute_user_stats(
        [s(score=100, percent=90.0)],
        [s(score=50, percent=70.0)],
    )
    assert stats["total_scores"] == 2
    assert stats["total_score"] == 150
    assert stats["avg_percent"] == 80.0


def test_no_speed_filter_is_applied():
    """Deliberate: achievements filter to speed >= 100, the stats RPC does not.
    Matching the RPC keeps stats consistent with what the profile displays."""
    stats = compute_user_stats([s(score=100, speed=50), s(score=100, speed=100)], [])
    assert stats["total_scores"] == 2
    assert stats["total_score"] == 200


def test_is_fc_accepts_int_and_bool_encodings():
    """Stored as int 0/1 in practice, but the SQL casts text to boolean, so
    "true"/"false" work too. Plain Python truthiness would read "0" as True."""
    scores = [
        s(is_fc=1), s(is_fc=0),
        s(is_fc=True), s(is_fc=False),
        s(is_fc="true"), s(is_fc="false"),
        s(is_fc="1"), s(is_fc="0"),
    ]
    assert compute_user_stats(scores, [])["total_fcs"] == 4


def test_missing_or_null_is_fc_counts_as_not_fc():
    """(score->>'is_fc')::boolean is NULL, and the RPC's CASE takes the ELSE."""
    assert compute_user_stats([{"score": 1}, s(is_fc=None)], [])["total_fcs"] == 0


def test_missing_score_still_counts_toward_total_scores():
    """SUM skips NULLs but COUNT(*) counts the row."""
    stats = compute_user_stats([{"percent": 50.0}, s(score=100, percent=100.0)], [])
    assert stats["total_scores"] == 2
    assert stats["total_score"] == 100
    # divided by the full count, not just the rows that had a value
    assert stats["avg_percent"] == 75.0


def test_avg_percent_is_true_division():
    stats = compute_user_stats([s(percent=100.0), s(percent=99.0), s(percent=98.0)], [])
    assert stats["avg_percent"] == (100.0 + 99.0 + 98.0) / 3


def test_rank_is_carried_forward():
    """rank is an elo ranking across all users, so it cannot be derived for one
    user in isolation."""
    assert compute_user_stats([], [], {"rank": 42})["rank"] == 42
    assert compute_user_stats([], [], {})["rank"] is None
    assert compute_user_stats([], [], None)["rank"] is None
