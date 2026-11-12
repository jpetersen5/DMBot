"""Detects scores inflated by Clone Hero's solo-after-online scoring bug."""
from typing import Any, Dict, List, Mapping, Optional, Tuple

from ..types import BuggedScore

BUG_MARGIN = 0.05


def is_bugged_score(score: int, is_fc: bool, optimal_score: Optional[int]) -> bool:
    if not optimal_score or optimal_score <= 0:
        return False
    return score > optimal_score * (1 + BUG_MARGIN)


def bugged_score(identifier: str, song: Mapping[str, Any], score: Mapping[str, Any]) -> BuggedScore:
    return {
        "identifier": identifier,
        "song_name": song.get("name") or "",
        "artist": song.get("artist") or "",
        "score": score["score"],
        "optimal_score": song["optimal_score"],
        "is_fc": bool(score["is_fc"]),
    }


def split_bugged_unknown(
    unknown: List[Dict[str, Any]], songs_dict: Mapping[str, Any]
) -> Tuple[List[Dict[str, Any]], List[BuggedScore]]:
    kept: List[Dict[str, Any]] = []
    bugged: List[BuggedScore] = []
    for entry in unknown:
        song = songs_dict.get(entry.get("identifier", ""))
        if song and is_bugged_score(entry["score"], entry["is_fc"], song.get("optimal_score")):
            bugged.append(bugged_score(entry["identifier"], song, entry))
        else:
            kept.append(entry)
    return kept, bugged
