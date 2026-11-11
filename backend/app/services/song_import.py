"""Upload the output of src/scripts/scan_songs.ts into songs_new and songs_extra."""
import json
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from .supabase_service import Row, rows

DEFAULT_SCAN_FILE = Path(__file__).resolve().parents[2] / "data" / "scanned_songs.json"
DEFAULT_PATHS_FILE = DEFAULT_SCAN_FILE.parent / "hydra_paths.json"

COMPARED = [
    "name", "artist", "album", "genre", "year", "charter_refs", "song_length", "difficulties",
    "loading_phrase", "track", "playlist_path", "has_2x_kick", "note_counts", "instruments",
    "bpm_dominant", "bpm_min", "bpm_max", "optimal_score", "paths",
]

# only present on rows that have Hydra results; songs without them keep what is stored
PATH_COLUMNS = ("optimal_score", "paths")

# charter names on existing songs are curated; scanned spellings are often aliases or typos
KEPT_ON_UPDATE = {"charter_refs"}

PAGE_SIZE = 1000
WRITE_BATCH = 250
EXTRA_BATCH = 200
DETAIL_LIMIT = 100
UNSET_TRACK = 16000


@dataclass
class ImportPlan:
    new: List[Row] = field(default_factory=list)
    updates: List[Tuple[Row, List[str]]] = field(default_factory=list)
    unchanged: int = 0
    untouched: int = 0


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _year(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def prepare_song(song: Dict[str, Any]) -> Row:
    notes = song.get("notesData") or {}
    track = song.get("album_track")
    return {
        "md5": song["md5"],
        "name": song.get("name") or "",
        "artist": song.get("artist") or "",
        "album": song.get("album") or "",
        "genre": song.get("genre") or "",
        "year": _year(song.get("year")),
        "charter_refs": [c for c in (song.get("charter") or "").split(",") if c],
        "song_length": song.get("song_length"),
        "difficulties": {k[5:]: v for k, v in song.items() if k.startswith("diff_") and v != -1},
        "loading_phrase": song.get("loading_phrase") or "",
        "track": None if track == UNSET_TRACK else track,
        "playlist_path": song.get("playlistPath") or "",
        "has_2x_kick": bool(notes.get("has2xKick", False)),
        "note_counts": notes.get("noteCounts") or [],
        "instruments": notes.get("instruments") or [],
        "bpm_dominant": song.get("bpm_dominant"),
        "bpm_min": song.get("bpm_min"),
        "bpm_max": song.get("bpm_max"),
    }


def changed_columns(new: Row, old: Row) -> List[str]:
    return [
        c for c in COMPARED
        if c not in KEPT_ON_UPDATE and (c not in PATH_COLUMNS or c in new) and new.get(c) != old.get(c)
    ]


def plan_import(prepared: List[Row], existing: Dict[str, Row]) -> ImportPlan:
    plan = ImportPlan()
    for row in prepared:
        old = existing.get(row["md5"])
        if old is None:
            plan.new.append(row)
            continue
        cols = changed_columns(row, old)
        if cols:
            plan.updates.append((row, cols))
        else:
            plan.unchanged += 1
    scanned = {row["md5"] for row in prepared}
    plan.untouched = sum(1 for md5 in existing if md5 not in scanned)
    return plan


def update_batches(plan: ImportPlan, now: str) -> Dict[Tuple[str, ...], List[Row]]:
    """Group updates by changed columns so each upsert only SETs those, sparing column-scoped triggers."""
    batches: Dict[Tuple[str, ...], List[Row]] = defaultdict(list)
    for row, cols in plan.updates:
        update = {"md5": row["md5"], **{c: row[c] for c in cols}}
        if not set(cols) <= set(PATH_COLUMNS):
            update["last_update"] = now
        batches[tuple(cols)].append(update)
    return dict(batches)


def _short(value: Any, width: int = 60) -> str:
    text = repr(value) if not isinstance(value, str) else value
    return text if len(text) <= width else text[: width - 3] + "..."


def describe_plan(plan: ImportPlan, existing: Dict[str, Row]) -> List[str]:
    lines = [
        f"  new:       {len(plan.new)}",
        f"  changed:   {len(plan.updates)}",
        f"  unchanged: {plan.unchanged}",
        f"  in the database but not scanned (left untouched): {plan.untouched}",
    ]
    if len(plan.new) + len(plan.updates) <= DETAIL_LIMIT:
        for row in plan.new:
            lines.append(f"  + {row['name']} - {row['artist']} [{row['playlist_path']}]")
        for row, cols in plan.updates:
            old = existing[row["md5"]]
            lines.append(f"  ~ {row['name']} - {row['artist']} ({row['md5']})")
            lines.extend(f"      {c}: {_short(old.get(c))} -> {_short(row[c])}" for c in cols)
        return lines

    by_column: Dict[str, List[Row]] = defaultdict(list)
    for row, cols in plan.updates:
        for c in cols:
            by_column[c].append(row)
    if by_column:
        lines.append("Changed columns:")
    for col, changed in sorted(by_column.items(), key=lambda kv: -len(kv[1])):
        row = changed[0]
        example = f"{_short(row['name'], 30)}: {_short(existing[row['md5']].get(col), 30)} -> {_short(row[col], 30)}"
        lines.append(f"  {col:<15} {len(changed):>6}   e.g. {example}")
    if plan.new:
        counts: Dict[str, int] = defaultdict(int)
        for row in plan.new:
            for playlist in (row["playlist_path"] or "<none>").split(","):
                counts[playlist] += 1
        lines.append("New songs by playlist (top 10):")
        lines.extend(f"  {n:>6}  {name}" for name, n in sorted(counts.items(), key=lambda kv: -kv[1])[:10])
    return lines


def _fetch_all(supabase: Any, table: str, columns: List[str], order: str = "id") -> List[Row]:
    found: List[Row] = []
    start = 0
    while True:
        page = rows(
            supabase.table(table).select(",".join(columns))
            .order(order).range(start, start + PAGE_SIZE - 1).execute().data
        )
        found.extend(page)
        if len(page) < PAGE_SIZE:
            return found
        start += PAGE_SIZE


def fetch_existing(supabase: Any) -> Dict[str, Row]:
    return {row["md5"]: row for row in _fetch_all(supabase, "songs_new", ["md5", *COMPARED])}


def resolve_aliases(row: Row, aliases: Dict[str, List[str]]) -> Row:
    """Same exact-match expansion as the canonicalize_charter_refs() database function."""
    resolved: List[str] = []
    for ref in row["charter_refs"]:
        for name in aliases.get(ref, [ref]):
            if name not in resolved:
                resolved.append(name)
    return {**row, "charter_refs": resolved}


def _fold(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).casefold().strip()


def lookalike_charters(new_rows: List[Row], profiles: List[str]) -> Dict[str, str]:
    """Charter names on new songs that differ from an existing profile only by case or accents."""
    known = set(profiles)
    by_fold = {_fold(name): name for name in profiles}
    found: Dict[str, str] = {}
    for row in new_rows:
        for ref in row["charter_refs"]:
            match = by_fold.get(_fold(ref))
            if ref not in known and match:
                found[ref] = match
    return found


def _chunks(items: List[Any], size: int) -> List[List[Any]]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def strip_nul(value: Any) -> Any:
    """Postgres text and jsonb reject \\u0000, which scan-chart can echo from corrupt chart files."""
    if isinstance(value, str):
        return value.replace("\x00", "")
    if isinstance(value, list):
        return [strip_nul(v) for v in value]
    if isinstance(value, dict):
        return {k: strip_nul(v) for k, v in value.items()}
    return value


def extra_data(song: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in song.items() if k != "folders"}


def stale_extra(scanned: List[Dict[str, Any]], stored: Dict[str, Any]) -> List[Row]:
    """songs_extra rows missing or out of date, compared directly so an interrupted run can resume."""
    return [
        {"md5": song["md5"], "song_data": extra_data(song)}
        for song in scanned if stored.get(song["md5"]) != extra_data(song)
    ]


def attach_paths(prepared: List[Row], paths: Dict[str, Any]) -> int:
    """Merge Hydra results into prepared rows; returns how many results matched no scanned song."""
    by_md5 = {row["md5"]: row for row in prepared}
    for md5, result in paths.items():
        row = by_md5.get(md5)
        if row is not None:
            row["optimal_score"] = result["optimal_score"]
            row["paths"] = result["paths"]
    return sum(1 for md5 in paths if md5 not in by_md5)


def import_songs(
    supabase: Any,
    path: Path,
    apply: bool,
    log: Callable[[str], None] = print,
    paths_file: Optional[Path] = None,
) -> ImportPlan:
    scanned: List[Dict[str, Any]] = strip_nul(json.loads(Path(path).read_text(encoding="utf-8")))
    existing = fetch_existing(supabase)
    aliases = {row["alias"]: row["canonicals"] for row in _fetch_all(supabase, "charter_aliases", ["alias", "canonicals"], order="alias")}
    profiles = [row["name"] for row in _fetch_all(supabase, "charters", ["id", "name"])]
    prepared = [resolve_aliases(prepare_song(song), aliases) for song in scanned]
    unmatched_paths = 0
    if paths_file is not None:
        hydra_paths: Dict[str, Any] = json.loads(Path(paths_file).read_text(encoding="utf-8"))
        unmatched_paths = attach_paths(prepared, hydra_paths)
        log(f"Hydra paths for {len(hydra_paths) - unmatched_paths} scanned songs from {paths_file}")
    plan = plan_import(prepared, existing)
    stored_extra = {row["md5"]: row["song_data"] for row in _fetch_all(supabase, "songs_extra", ["id", "md5", "song_data"])}
    extra = stale_extra(scanned, stored_extra)

    log(f"{'' if apply else '[preview] '}{len(scanned)} scanned songs, {len(existing)} in the database")
    for line in describe_plan(plan, existing):
        log(line)
    log(f"  full scan data to refresh: {len(extra)}")
    if unmatched_paths:
        log(f"  Hydra paths skipped for {unmatched_paths} songs not in the scan")
    lookalikes = lookalike_charters(plan.new, profiles)
    if lookalikes:
        log("New charter names that look like an existing charter but have no alias (add to charter_aliases if they match):")
        for name, match in sorted(lookalikes.items()):
            log(f"  {name} -> {match}")
    if not apply:
        log("Nothing written. Re-run with --apply to write these changes.")
        return plan

    now = utc_now()
    for batch in _chunks(plan.new, WRITE_BATCH):
        supabase.table("songs_new").upsert([{**row, "last_update": now} for row in batch], on_conflict="md5").execute()
    log(f"Inserted {len(plan.new)} new songs")

    for batch_rows in update_batches(plan, now).values():
        for batch in _chunks(batch_rows, WRITE_BATCH):
            supabase.table("songs_new").upsert(batch, on_conflict="md5").execute()
    log(f"Updated {len(plan.updates)} songs")

    for batch in _chunks(extra, EXTRA_BATCH):
        supabase.table("songs_extra").upsert(batch, on_conflict="md5").execute()
    log(f"Stored full scan data for {len(extra)} songs")
    return plan
