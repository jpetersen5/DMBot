"""Shared types for the database's JSONB objects..

Use alongside :data:`app.services.supabase_service.Row` (raw ``Dict[str, Any]``)
and :func:`app.services.supabase_service.rows` for narrowing raw PostgREST responses.
"""

from typing import Any, Callable, Dict, List, Optional, Tuple, TypedDict, Union
from werkzeug.wrappers import Response

FlaskResponse = Union[
    Response,
    str,
    Dict[str, Any],
    Tuple[Response, int],
    Tuple[str, int],
    Tuple[Response, int, Dict[str, str]],
]

class _ScoreCore(TypedDict):
    """Score fields that are always present."""
    identifier: str
    percent: float
    is_fc: bool
    speed: int
    score: int
    play_count: int
    posted: str

class ScoreEntry(_ScoreCore, total=False):
    """Entry in a user's ``scores`` / ``unknown_scores`` JSONB array."""
    song_name: str
    artist: str
    charter_refs: List[str]
    rank: Optional[int]
    filepath: str

class _LeaderboardCore(TypedDict):
    """Leaderboard fields that are always present."""
    user_id: str
    username: str
    score: int
    percent: float
    is_fc: bool
    speed: int
    play_count: int
    posted: str


class LeaderboardEntry(_LeaderboardCore, total=False):
    """Entry in a song's ``leaderboard`` JSONB array (``songs_new.leaderboard``)."""
    rank: Optional[int]

class LeaderboardUpdate(TypedDict):
    """A pending write to ``songs_new`` produced while ranking scores."""
    md5: str
    name: str
    leaderboard: List[LeaderboardEntry]
    last_update: str


class AchievementDef(TypedDict, total=False):
    """Achievement definition built by :class:`AchievementProcessor`."""

    id: str
    name: str
    description: str
    rank: int
    category: str
    group: str
    check_function: Callable[..., bool]
    # family-specific extras
    level: int
    song_md5: Any  # str or List[str]
    threshold: int
    requires_fc: bool
    score: int
    charter_refs: List[str]
    remix_artists: List[str]
    recharts_charter_refs: List[str]


class AchievementError(TypedDict):
    """Entry of an achievement that failed to evaluate."""
    id: str
    name: str
    error: str


class ComparisonResult(TypedDict):
    """Result of comparing two users' scores (``/api/users/compare``)."""
    common_songs: List[str]
    wins: int
    losses: int
    ties: int
    fc_diff: int
    total_score_diff: int
    avg_percent_diff: float


class EloHistoryEntry(TypedDict):
    """Entry from the ``elo_history`` table."""
    elo: int
    timestamp: str


class UserRow(TypedDict, total=False):
    """Columns of the ``users`` table that the API reads/writes."""
    id: str
    username: str
    avatar: str
    permissions: Any
    stats: Dict[str, Any]
    elo: int
    scores: List[ScoreEntry]
    unknown_scores: List[ScoreEntry]
    achievements: Dict[str, str]
    last_login: str
