"""Chunked writes to ``songs_new.leaderboard`` with exponential backoff."""

import logging
from typing import Any, Callable, List, Optional

from ..types import LeaderboardUpdate

LEADERBOARD_CHUNK_SIZE = 100
STATEMENT_TIMEOUT_CODE = "57014"


def is_statement_timeout(exc: Exception) -> bool:
    """Whether ``exc`` is a Postgres statement timeout."""
    code = getattr(exc, "code", None)
    if code is None and isinstance(getattr(exc, "args", None), tuple) and exc.args:
        first = exc.args[0]
        if isinstance(first, dict):
            code = first.get("code")
    return str(code) == STATEMENT_TIMEOUT_CODE


def push_leaderboard_updates(
    supabase: Any,
    updates: List[LeaderboardUpdate],
    chunk_size: int,
    logger: logging.Logger,
    on_progress: Optional[Callable[[int], None]] = None,
) -> List[LeaderboardUpdate]:
    """Write ``updates`` to songs_new via the bulk_update_leaderboards RPC.

    Timeouts are retried in halves. Failures are non-blocking.
    """
    failed: List[LeaderboardUpdate] = []

    for i in range(0, len(updates), chunk_size):
        chunk = updates[i:i + chunk_size]
        payload = [
            {
                "md5": update["md5"],
                "leaderboard": update["leaderboard"],
                "last_update": update["last_update"],
            }
            for update in chunk
        ]

        try:
            supabase.rpc("bulk_update_leaderboards", {"updates": payload}).execute()
        except Exception as e:
            if is_statement_timeout(e) and len(chunk) > 1:
                logger.warning(
                    f"Leaderboard chunk of {len(chunk)} timed out, retrying in halves"
                )
                failed.extend(
                    push_leaderboard_updates(
                        supabase, chunk, max(1, len(chunk) // 2), logger, on_progress
                    )
                )
            else:
                logger.error(
                    f"Error updating leaderboards for {len(chunk)} song(s): {str(e)}",
                    exc_info=True,
                )
                failed.extend(chunk)
            continue

        if on_progress:
            on_progress(len(chunk))

    return failed
