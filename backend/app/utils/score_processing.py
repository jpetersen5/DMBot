from datetime import datetime, UTC
from typing import Any, Dict, List, Mapping, Optional, Tuple, cast

from ..types import LeaderboardEntry, LeaderboardUpdate
from .leaderboard import sort_and_rank_leaderboard


def evaluate_score_update(
    incoming: Mapping[str, Any], existing: Optional[Mapping[str, Any]]
) -> bool:
    """Decide whether ``incoming`` should replace ``existing``.

    * no existing entry -> always update
    * strictly higher score -> update
    * equal score but strictly higher play count -> update
    * otherwise -> keep the existing entry
    """
    if not existing:
        return True
    if incoming["score"] > existing["score"]:
        return True
    if incoming["score"] == existing["score"] and incoming["play_count"] > existing.get("play_count", 0):
        return True
    return False


def apply_score_to_leaderboard(
    leaderboard: List[LeaderboardEntry], entry: Mapping[str, Any], user_id: str
) -> Tuple[List[LeaderboardEntry], bool]:
    """Fold ``entry`` for ``user_id`` into ``leaderboard``.

    Returns the (possibly re-sorted) leaderboard and whether it changed. When no
    update is warranted the input list is returned unchanged.
    """
    user_entry = next((e for e in leaderboard if e["user_id"] == user_id), None)

    should_update = evaluate_score_update(entry, user_entry)
    if not should_update and user_entry is not None and user_entry.get("posted", "") == "":
        should_update = True

    if not should_update:
        return leaderboard, False

    if user_entry is not None:
        try:
            leaderboard.remove(user_entry)
        except ValueError:
            pass
    leaderboard.append(cast(LeaderboardEntry, entry))
    leaderboard = sort_and_rank_leaderboard(leaderboard)
    return leaderboard, True


def merge_unknown_scores(
    existing_unknown: List[Dict[str, Any]],
    songs_dict: Dict[str, Any],
    user_id: str,
    username: str,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[LeaderboardUpdate]]:
    """Promote previously-unknown scores whose songs are now known.

    Returns ``(newly_known, remaining_unknown, leaderboard_updates)``.
    """
    newly_known: List[Dict[str, Any]] = []
    remaining_unknown: List[Dict[str, Any]] = []
    leaderboard_updates: List[LeaderboardUpdate] = []

    for unknown_score in existing_unknown:
        song_info = songs_dict.get(unknown_score["identifier"])
        if song_info:
            score_data = {
                "identifier": unknown_score["identifier"],
                "song_name": song_info["name"],
                "artist": song_info["artist"],
                "percent": unknown_score["percent"],
                "is_fc": unknown_score["is_fc"],
                "speed": unknown_score["speed"],
                "score": unknown_score["score"],
                "play_count": unknown_score["play_count"],
                "posted": datetime.now(UTC).isoformat()
            }
            newly_known.append(score_data)

            leaderboard_entry = {
                "user_id": user_id,
                "username": username,
                "score": unknown_score["score"],
                "percent": unknown_score["percent"],
                "is_fc": unknown_score["is_fc"],
                "speed": unknown_score["speed"],
                "play_count": unknown_score["play_count"],
                "posted": datetime.now(UTC).isoformat()
            }
            leaderboard = song_info.get("leaderboard", []) or []
            leaderboard.append(leaderboard_entry)
            leaderboard = sort_and_rank_leaderboard(leaderboard)

            leaderboard_updates.append({
                "md5": unknown_score["identifier"],
                "name": song_info["name"],
                "leaderboard": leaderboard,
                "last_update": datetime.now(UTC).isoformat()
            })
        else:
            remaining_unknown.append(unknown_score)

    return newly_known, remaining_unknown, leaderboard_updates
