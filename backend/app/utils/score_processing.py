from datetime import datetime, UTC
from typing import Any, Literal
from collections.abc import Mapping

from ..types import LeaderboardEntry, LeaderboardUpdate, ScoreEntry
from .leaderboard import sort_and_rank_leaderboard


ScoreUpdate = Literal["replace", "refresh", "fill", "keep"]


def classify_score_update(
    incoming: Mapping[str, Any], existing: Mapping[str, Any] | None
) -> ScoreUpdate:
    """How ``incoming`` folds into the stored ``existing`` entry.

    * ``replace``: new entry, higher score, or equal score with a higher percent,
      a new FC or a higher speed. Takes the incoming entry and its ``posted``.
    * ``refresh``: equal score with more plays. Updates plays and run fields in
      place, keeping ``posted``.
    * ``fill``: equal score, and only ``incoming`` has run fields (an entry
      stored before the parser rewrite). Same in-place update.
    * ``keep``: nothing to change.
    """
    if not existing:
        return "replace"
    if incoming["score"] != existing["score"]:
        return "replace" if incoming["score"] > existing["score"] else "keep"
    if (
        incoming["percent"] > existing.get("percent", 0)
        or (bool(incoming["is_fc"]) and not existing.get("is_fc"))
        or incoming["speed"] > existing.get("speed", 0)
    ):
        return "replace"
    if incoming["play_count"] > existing.get("play_count", 0):
        return "refresh"
    if "modifiers" in incoming and "modifiers" not in existing:
        return "fill"
    return "keep"


def fill_in_run_fields(
    target: ScoreEntry | LeaderboardEntry | dict[str, Any], source: Mapping[str, Any]
) -> None:
    """Copy difficulty, modifiers and stars from ``source`` where it has them."""
    if "difficulty" in source:
        target["difficulty"] = source["difficulty"]
    if "modifiers" in source:
        target["modifiers"] = source["modifiers"]
    if "stars" in source:
        target["stars"] = source["stars"]


def refresh_entry(
    target: ScoreEntry | LeaderboardEntry | dict[str, Any], source: Mapping[str, Any]
) -> None:
    """Apply a ``refresh`` or ``fill`` in place: plays and run fields, never ``posted``."""
    target["play_count"] = max(target.get("play_count", 0), source["play_count"])
    fill_in_run_fields(target, source)


def song_last_update(song_info: Mapping[str, Any], kind: ScoreUpdate, now: str) -> str:
    """A fill-in changes nothing the song list shows, so the song keeps its timestamp."""
    if kind == "fill" and song_info.get("last_update"):
        return song_info["last_update"]
    return now


def apply_score_to_leaderboard(
    leaderboard: list[LeaderboardEntry], entry: LeaderboardEntry, user_id: str | int
) -> tuple[list[LeaderboardEntry], ScoreUpdate]:
    """Fold ``entry`` for ``user_id`` into ``leaderboard``."""
    user_id = str(user_id)
    user_entry = next((e for e in leaderboard if e["user_id"] == user_id), None)

    kind = classify_score_update(entry, user_entry)
    if kind == "keep" and user_entry is not None and user_entry.get("posted", "") == "":
        kind = "replace"

    if kind == "keep":
        return leaderboard, kind
    if kind != "replace":
        assert user_entry is not None
        refresh_entry(user_entry, entry)
        return leaderboard, kind

    if user_entry is not None:
        try:
            leaderboard.remove(user_entry)
        except ValueError:
            pass
    leaderboard.append(entry)
    leaderboard = sort_and_rank_leaderboard(leaderboard)
    return leaderboard, kind


def merge_unknown_scores(
    existing_unknown: list[dict[str, Any]],
    songs_dict: dict[str, Any],
    user_id: str | int,
    username: str,
    existing_known: Mapping[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[LeaderboardUpdate]]:
    """Promote previously-unknown scores whose songs are now known.

    Returns ``(newly_known, remaining_unknown, leaderboard_updates)``.
    """
    user_id = str(user_id)
    newly_known: list[dict[str, Any]] = []
    remaining_unknown: list[dict[str, Any]] = []
    leaderboard_updates: list[LeaderboardUpdate] = []

    for unknown_score in existing_unknown:
        identifier = unknown_score["identifier"]
        song_info = songs_dict.get(identifier)
        if song_info:
            now = datetime.now(UTC).isoformat()
            posted = unknown_score.get("posted") or now
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
                "posted": posted,
                "rank": None
            }
            fill_in_run_fields(score_data, unknown_score)
            existing_known_score = existing_known.get(identifier)
            known_kind = classify_score_update(score_data, existing_known_score)
            if known_kind == "replace":
                newly_known.append(score_data)
            elif known_kind != "keep" and existing_known_score is not None:
                refresh_entry(existing_known_score, score_data)

            leaderboard_entry: LeaderboardEntry = {
                "user_id": user_id,
                "username": username,
                "score": unknown_score["score"],
                "percent": unknown_score["percent"],
                "is_fc": unknown_score["is_fc"],
                "speed": unknown_score["speed"],
                "play_count": unknown_score["play_count"],
                "posted": posted
            }
            fill_in_run_fields(leaderboard_entry, unknown_score)
            leaderboard: list[LeaderboardEntry] = song_info.get("leaderboard", []) or []
            leaderboard, board_kind = apply_score_to_leaderboard(
                leaderboard, leaderboard_entry, user_id
            )
            if board_kind != "keep":
                leaderboard_updates.append({
                    "md5": identifier,
                    "name": song_info["name"],
                    "leaderboard": leaderboard,
                    "last_update": song_last_update(song_info, board_kind, now)
                })
        else:
            remaining_unknown.append(unknown_score)

    return newly_known, remaining_unknown, leaderboard_updates
