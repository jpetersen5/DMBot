"""Removes scores inflated by Clone Hero's solo-after-online bug from leaderboards and profiles."""
import logging
from datetime import UTC, datetime
from typing import AbstractSet, Any, Callable, Dict, List, Set, Tuple, TypedDict

from ..types import LeaderboardEntry, LeaderboardUpdate
from ..utils.achievement_processor import achievement_processor
from ..utils.leaderboard import sort_and_rank_leaderboard
from ..utils.leaderboard_writer import LEADERBOARD_CHUNK_SIZE, push_leaderboard_updates
from ..utils.score_validation import is_bugged_score
from ..utils.user_stats import compute_user_stats
from .supabase_service import Row, rows

logger = logging.getLogger(__name__)

PAGE_SIZE = 1000


class FlaggedScore(TypedDict):
    user_id: str
    username: str
    md5: str
    song_name: str
    score: int
    optimal_score: int
    is_fc: bool


def find_flagged(songs: List[Row], users: List[Row]) -> List[FlaggedScore]:
    by_md5 = {song["md5"]: song for song in songs if song.get("optimal_score")}
    flagged: Dict[Tuple[str, str], FlaggedScore] = {}

    def flag(user_id: str, username: str, song: Row, score: int, is_fc: bool) -> None:
        if is_bugged_score(score, is_fc, song["optimal_score"]):
            flagged.setdefault((user_id, song["md5"]), {
                "user_id": user_id,
                "username": username,
                "md5": song["md5"],
                "song_name": song.get("name") or "",
                "score": score,
                "optimal_score": song["optimal_score"],
                "is_fc": bool(is_fc),
            })

    for song in by_md5.values():
        for entry in song.get("leaderboard") or []:
            flag(str(entry["user_id"]), entry.get("username") or "", song, entry["score"], entry["is_fc"])
    for user in users:
        for score in user.get("scores") or []:
            song = by_md5.get(score.get("identifier", ""))
            if song:
                flag(str(user["id"]), user.get("username") or "", song, score["score"], score["is_fc"])
    return list(flagged.values())


def _fetch_paged(supabase: Any, table: str, columns: str, only_analysed: bool = False) -> List[Row]:
    found: List[Row] = []
    start = 0
    while True:
        query = supabase.table(table).select(columns)
        if only_analysed:
            query = query.not_.is_("optimal_score", "null")
        page = rows(query.order("id").range(start, start + PAGE_SIZE - 1).execute().data)
        found.extend(page)
        if len(page) < PAGE_SIZE:
            return found
        start += PAGE_SIZE


def _cleaned_user(user: Row, md5s: Set[str]) -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[str]]:
    scores = [s for s in user.get("scores") or [] if s.get("identifier") not in md5s]
    unknown = user.get("unknown_scores") or []
    achievements = dict(user.get("achievements") or {})
    revoked = achievement_processor.revoked_achievements({
        "id": user["id"],
        "scores": [s for s in scores if s.get("speed", 0) >= 100],
        "unknown_scores": unknown,
        "stats": compute_user_stats(scores, unknown, user.get("stats") or {}),
        "achievements": achievements,
    })
    for achievement_id in revoked:
        achievements.pop(achievement_id, None)
    return scores, achievements, revoked


def remove_bugged_scores(
    supabase: Any, *, apply: bool = False, log: Callable[[str], None] = print, skip: AbstractSet[str] = frozenset()
) -> List[FlaggedScore]:
    prefix = "" if apply else "[preview] "
    songs = _fetch_paged(supabase, "songs_new", "id,md5,name,artist,optimal_score,leaderboard", only_analysed=True)
    songs = [song for song in songs if song["md5"] not in skip]
    users = _fetch_paged(supabase, "users", "id,username,scores,unknown_scores,stats,achievements")
    flagged = find_flagged(songs, users)
    log(f"{prefix}{len(flagged)} bugged score(s) across {len(songs)} analysed songs")
    for f in flagged:
        ratio = f["score"] / f["optimal_score"] * 100
        log(f"  {f['username']} ({f['user_id']}): {f['song_name']} {f['score']:,} vs optimal "
            f"{f['optimal_score']:,} ({ratio:.1f}%, {'FC' if f['is_fc'] else 'non-FC'})")

    md5s_by_user: Dict[str, Set[str]] = {}
    for f in flagged:
        md5s_by_user.setdefault(f["user_id"], set()).add(f["md5"])

    user_writes: List[Tuple[str, Dict[str, Any]]] = []
    total_revoked = 0
    for user in users:
        md5s = md5s_by_user.get(str(user["id"]))
        if not md5s:
            continue
        scores, achievements, revoked = _cleaned_user(user, md5s)
        total_revoked += len(revoked)
        for achievement_id in revoked:
            log(f"  revoke {achievement_id} from {user.get('username')} ({user['id']})")
        user_writes.append((str(user["id"]), {"scores": scores, "achievements": achievements}))

    now = datetime.now(UTC).isoformat()
    flagged_keys = {(f["user_id"], f["md5"]) for f in flagged}
    leaderboard_updates: List[LeaderboardUpdate] = []
    for song in songs:
        board: List[LeaderboardEntry] = song.get("leaderboard") or []
        kept = [e for e in board if (str(e["user_id"]), song["md5"]) not in flagged_keys]
        if len(kept) != len(board):
            leaderboard_updates.append({
                "md5": song["md5"],
                "name": song.get("name") or "",
                "leaderboard": sort_and_rank_leaderboard(kept),
                "last_update": now,
            })

    log(f"{prefix}{len(user_writes)} profile(s), {len(leaderboard_updates)} leaderboard(s), "
        f"{total_revoked} achievement(s) to revoke")
    if not apply:
        log("Nothing written. Re-run with --apply to write these changes.")
        return flagged

    for user_id, payload in user_writes:
        supabase.table("users").update(payload).eq("id", user_id).execute()
    failed = push_leaderboard_updates(supabase, leaderboard_updates, LEADERBOARD_CHUNK_SIZE, logger)
    for update in failed:
        log(f"  FAILED leaderboard write for {update['name']} ({update['md5']}); re-run to retry")
    log(f"Done: removed {len(flagged)} bugged score(s); {len(failed)} leaderboard write(s) failed")
    return flagged
