from typing import Any, Iterable, Mapping, Optional

from ..types import UserStats

ScoreLike = Mapping[str, Any]

_TRUE_TEXT = frozenset({"true", "t", "yes", "y", "on", "1"})


def _as_bool(value: Any) -> bool:
    """Coerce a JSON value the way ``::boolean`` would, defaulting to False."""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in _TRUE_TEXT
    return False


def _as_number(value: Any) -> float:
    """Coerce a JSON value to a number, treating null/garbage as 0."""
    if isinstance(value, bool) or value is None:
        return 0
    if isinstance(value, (int, float)):
        return value
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


def compute_user_stats(
    scores: Optional[Iterable[ScoreLike]],
    unknown_scores: Optional[Iterable[ScoreLike]],
    previous_stats: Optional[Mapping[str, Any]] = None,
) -> UserStats:
    """Compute ``users.stats`` exactly as ``compute_user_stats_jsonb`` does.

    See migration 004 for the database equivalent trigger function.
    """
    all_scores = [*(scores or []), *(unknown_scores or [])]
    total_scores = len(all_scores)

    total_fcs = sum(1 for score in all_scores if _as_bool(score.get("is_fc")))
    total_score = sum(_as_number(score.get("score")) for score in all_scores)
    total_percent = sum(_as_number(score.get("percent")) for score in all_scores)

    return {
        "total_scores": total_scores,
        "total_fcs": total_fcs,
        "total_score": int(total_score),
        "avg_percent": (total_percent / total_scores) if total_scores else 0,
        "rank": (previous_stats or {}).get("rank"),
    }
