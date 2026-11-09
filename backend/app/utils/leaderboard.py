from datetime import datetime, UTC
from typing import List

from ..types import LeaderboardEntry


def sort_and_rank_leaderboard(leaderboard: List[LeaderboardEntry]) -> List[LeaderboardEntry]:
    """
    sorts and ranks the leaderboard

    params:
        leaderboard (list): list of leaderboard entries

    returns:
        list: sorted and ranked leaderboard
    """
    def sort_key(entry: LeaderboardEntry) -> tuple:
        speed = entry.get("speed", 0)
        score = entry.get("score", 0)
        posted = entry.get("posted", "")

        if posted:
            try:
                posted_date = datetime.fromisoformat(posted)
            except ValueError:
                posted_date = datetime.now(UTC)
        else:
            posted_date = datetime.now(UTC)

        if speed < 100:
            return (0, speed, score, -posted_date.timestamp())
        else:
            return (1, score, speed, -posted_date.timestamp())

    sorted_leaderboard = sorted(leaderboard, key=sort_key, reverse=True)

    # posted only orders ties for display, it never decides the placement
    previous_key = None
    rank = 0
    for position, entry in enumerate(sorted_leaderboard, 1):
        key = sort_key(entry)[:3]
        if key != previous_key:
            previous_key, rank = key, position
        entry["rank"] = rank

    return sorted_leaderboard
