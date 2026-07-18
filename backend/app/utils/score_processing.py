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
    leaderboard: List[LeaderboardEntry], entry: Mapping[str, Any], user_id: str | int
) -> Tuple[List[LeaderboardEntry], bool]:
    """Fold ``entry`` for ``user_id`` into ``leaderboard``."""
    user_id = str(user_id)
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
    user_id: str | int,
    username: str,
    existing_known: Mapping[str, Any],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[LeaderboardUpdate]]:
    """Promote previously-unknown scores whose songs are now known.

    Returns ``(newly_known, remaining_unknown, leaderboard_updates)``.
    """
    user_id = str(user_id)
    newly_known: List[Dict[str, Any]] = []
    remaining_unknown: List[Dict[str, Any]] = []
    leaderboard_updates: List[LeaderboardUpdate] = []

    for unknown_score in existing_unknown:
        identifier = unknown_score["identifier"]
        song_info = songs_dict.get(identifier)
        if song_info:
            now = datetime.now(UTC).isoformat()
            score_data = {
                "identifier": identifier,
                "song_name": song_info["name"],
                "artist": song_info["artist"],
                "charter_refs": song_info.get("charter_refs", []),
                "percent": unknown_score["percent"],
                "is_fc": unknown_score["is_fc"],
                "speed": unknown_score["speed"],
                "score": unknown_score["score"],
                "play_count": unknown_score["play_count"],
                "posted": now,
                "rank": None
            }
            existing_known_score = existing_known.get(identifier)
            if evaluate_score_update(score_data, existing_known_score):
                newly_known.append(score_data)

            leaderboard_entry = {
                "user_id": user_id,
                "username": username,
                "score": unknown_score["score"],
                "percent": unknown_score["percent"],
                "is_fc": unknown_score["is_fc"],
                "speed": unknown_score["speed"],
                "play_count": unknown_score["play_count"],
                "posted": now
            }
            leaderboard = song_info.get("leaderboard", []) or []
            leaderboard, changed = apply_score_to_leaderboard(
                leaderboard, leaderboard_entry, user_id
            )
            if changed:
                leaderboard_updates.append({
                    "md5": identifier,
                    "name": song_info["name"],
                    "leaderboard": leaderboard,
                    "last_update": now
                })
        else:
            remaining_unknown.append(unknown_score)

    return newly_known, remaining_unknown, leaderboard_updates
