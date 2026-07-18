from typing import Any, Callable, Dict, List

from ..types import LeaderboardEntry
from ..utils.score_processing import merge_unknown_scores
from .supabase_service import rows


def promote_unknown_scores(
    supabase: Any,
    *,
    dry_run: bool = True,
    log: Callable[[str], None] = lambda _msg: None,
) -> Dict[str, Any]:
    """Promote unknown scores whose songs now exist in ``songs_new``."""
    prefix = "[dry-run] " if dry_run else ""

    users: List[Dict[str, Any]] = []
    offset = 0
    page_size = 1000
    while True:
        page = rows(
            supabase.table("users")
            .select("id,username,scores,unknown_scores")
            .range(offset, offset + page_size - 1)
            .execute()
            .data
        )
        if not page:
            break
        users.extend(u for u in page if u.get("unknown_scores"))
        if len(page) < page_size:
            break
        offset += page_size

    log(f"{prefix}Scanning {len(users)} user(s) with pending unknown scores")

    song_leaderboards: Dict[str, List[LeaderboardEntry]] = {}
    touched_songs: Dict[str, Dict[str, str]] = {}
    failures: List[str] = []
    total_promoted = 0
    total_dropped = 0

    for index, user in enumerate(users, 1):
        user_id = str(user["id"])
        username = user.get("username") or "Unknown User"
        unknown = user.get("unknown_scores") or []
        existing_scores = user.get("scores") or []

        try:
            existing_known = {
                s["identifier"]: s for s in existing_scores if "identifier" in s
            }

            identifiers = list(
                dict.fromkeys(s["identifier"] for s in unknown if "identifier" in s)
            )

            songs_dict: Dict[str, Any] = {}
            for i in range(0, len(identifiers), 500):
                batch = identifiers[i:i + 500]
                fetched = rows(
                    supabase.table("songs_new")
                    .select("md5,name,artist,charter_refs,leaderboard")
                    .in_("md5", batch)
                    .execute()
                    .data
                )
                for song in fetched:
                    songs_dict[song["md5"]] = song

            for md5, song in songs_dict.items():
                if md5 not in song_leaderboards:
                    song_leaderboards[md5] = song.get("leaderboard") or []
                song["leaderboard"] = song_leaderboards[md5]

            newly_known, remaining_unknown, lb_updates = merge_unknown_scores(
                unknown, songs_dict, user_id, username, existing_known
            )

            known_count = sum(
                1 for s in unknown if s.get("identifier") in songs_dict
            )
            promoted = len(newly_known)
            dropped = known_count - promoted
            total_promoted += promoted
            total_dropped += dropped

            log(
                f"  [{index}/{len(users)}] {username} ({user_id}): "
                f"{promoted} promotion(s), {dropped} dropped overlap(s), "
                f"{len(remaining_unknown)} still unknown"
            )

            for update in lb_updates:
                song_leaderboards[update["md5"]] = update["leaderboard"]
                touched_songs[update["md5"]] = {
                    "name": update["name"],
                    "last_update": update["last_update"],
                }

            changed = bool(newly_known) or len(remaining_unknown) != len(unknown)
            if changed and not dry_run:
                combined = existing_scores + newly_known
                merged_scores = {
                    s["identifier"]: s for s in combined if "identifier" in s
                }
                cleaned_unknown = [
                    u for u in remaining_unknown
                    if u.get("identifier") not in merged_scores
                ]
                supabase.table("users").update(
                    {
                        "scores": list(merged_scores.values()),
                        "unknown_scores": cleaned_unknown,
                    }
                ).eq("id", user_id).execute()

        except Exception as exc:  # noqa: BLE001 - collect, don't abort
            message = f"{username} ({user_id}): {exc}"
            failures.append(message)
            log(f"  [{index}/{len(users)}] FAILED - {message}")

    log(f"{prefix}{len(touched_songs)} song leaderboard(s) touched")
    if not dry_run:
        for md5, meta in touched_songs.items():
            try:
                payload: Dict[str, Any] = {
                    "leaderboard": song_leaderboards[md5],
                    "last_update": meta["last_update"],
                }
                supabase.table("songs_new").update(payload).eq("md5", md5).execute()
            except Exception as exc:  # noqa: BLE001
                message = f"leaderboard {meta['name']} ({md5}): {exc}"
                failures.append(message)
                log(f"  FAILED - {message}")

    log(
        f"{prefix if dry_run else 'Done: '}"
        f"{total_promoted} promotion(s), {total_dropped} dropped overlap(s) "
        f"across {len(users)} user(s); {len(failures)} failure(s)"
    )
    if failures:
        log("Failures:")
        for message in failures:
            log(f"  - {message}")

    return {
        "users": len(users),
        "promoted": total_promoted,
        "dropped": total_dropped,
        "touched_songs": len(touched_songs),
        "failures": failures,
    }
