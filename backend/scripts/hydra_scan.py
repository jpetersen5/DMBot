"""Runs Hydra over chart folders and writes optimal scores and paths for import-songs.

    <hydra>/.venv/Scripts/python.exe backend/scripts/hydra_scan.py --hydra <hydra checkout> <song root>...
        [--out <file>] [--workers <n>] [--limit <n>]

Run it with an interpreter that has Hydra's requirements installed. Chart files are found and
hashed exactly as src/scripts/scan_songs.ts does, so md5s line up with scanned_songs.json.
"""
import argparse
import hashlib
import importlib
import json
import multiprocessing
import os
import sys
import time
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

CHART_FILES = ("notes.mid", "notes.chart", "notes.midi")
MAX_TIED_PATHS = 10
DEFAULT_OUT = Path(__file__).resolve().parents[1] / "data" / "hydra_paths.json"
HYDRA_SETTINGS = ("Expert", True, True, "scores", 1)

Analyze = Callable[[bytes, str], Any]
Result = Dict[str, Any]


def pick_chart(folder: Path) -> Optional[Path]:
    by_name = {entry.name.lower(): entry for entry in folder.iterdir() if entry.is_file()}
    return next((by_name[name] for name in CHART_FILES if name in by_name), None)


def find_song_folders(roots: List[Path]) -> List[Path]:
    found: List[Path] = []
    for root in roots:
        for dirpath, _dirnames, filenames in os.walk(root):
            if any(name.lower() in CHART_FILES for name in filenames):
                found.append(Path(dirpath))
    return found


def path_string(verbose: str) -> str:
    return verbose.rsplit(" | Score: ", 1)[0]


def path_entry(hydra_path: Any) -> Result:
    return {
        "score": hydra_path.totalscore(),
        "path": path_string(hydra_path.pathstring_verbose()),
        "breakdown": {
            "base": hydra_path.score_base,
            "combo": hydra_path.score_combo,
            "sp": hydra_path.score_sp,
            "solo": hydra_path.score_solo,
            "accents": hydra_path.score_accents,
            "ghosts": hydra_path.score_ghosts,
        },
    }


def optimal_result(hydra_paths: Iterable[Any]) -> Optional[Result]:
    entries = [path_entry(p) for p in hydra_paths]
    if not entries:
        return None
    best = max(entry["score"] for entry in entries)
    if best <= 0:
        return None
    tied = [entry for entry in entries if entry["score"] == best][:MAX_TIED_PATHS]
    return {"optimal_score": best, "paths": tied}


def analyze_chart(chart: Path, analyze: Analyze) -> Tuple[str, Optional[Result]]:
    data = chart.read_bytes()
    fmt = "chart" if chart.suffix.lower() == ".chart" else "mid"
    record = analyze(data, fmt)
    return hashlib.md5(data).hexdigest(), optimal_result(record.all_paths())


def scan_folder(folder: Path, analyze: Analyze) -> Tuple[str, Optional[Result]]:
    chart = pick_chart(folder)
    if chart is None:
        raise FileNotFoundError("no chart file")
    return analyze_chart(chart, analyze)


def scan_folders(folders: List[Path], analyze: Analyze) -> Tuple[Dict[str, Result], List[Dict[str, str]]]:
    results: Dict[str, Result] = {}
    errors: List[Dict[str, str]] = []
    for folder in folders:
        try:
            md5, result = scan_folder(folder, analyze)
        except Exception as error:
            errors.append({"folder": str(folder), "error": repr(error)})
            continue
        if result is not None and md5 not in results:
            results[md5] = result
    return results, errors


def hydra_analyzer(hydra_dir: str) -> Analyze:
    if hydra_dir not in sys.path:
        sys.path.insert(0, hydra_dir)
    hyutil = importlib.import_module("hydra.hyutil")

    def analyze(data: bytes, fmt: str) -> Any:
        entry = hyutil.analyze_chart_bytes_chart if fmt == "chart" else hyutil.analyze_chart_bytes_mid
        return entry(data, *HYDRA_SETTINGS)

    return analyze


_worker_analyze: Optional[Analyze] = None


def _init_worker(hydra_dir: str) -> None:
    global _worker_analyze
    _worker_analyze = hydra_analyzer(hydra_dir)


def _scan_one(folder: Path) -> Tuple[Path, Optional[str], Optional[Result], Optional[str]]:
    assert _worker_analyze is not None
    try:
        md5, result = scan_folder(folder, _worker_analyze)
    except Exception as error:
        return folder, None, None, repr(error)
    return folder, md5, result, None


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description="Write Hydra optimal scores and paths for import-songs.")
    parser.add_argument("roots", nargs="+", type=Path)
    parser.add_argument("--hydra", required=True, type=Path, help="Hydra checkout")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args(argv)

    try:
        hydra_analyzer(str(args.hydra))
    except ImportError as error:
        print(f"Could not import Hydra from {args.hydra}: {error!r}")
        print("Run this script with an interpreter that has Hydra's requirements, e.g. <hydra>/.venv/Scripts/python.exe")
        return 1
    missing = [str(root) for root in args.roots if not root.is_dir()]
    if missing:
        print(f"song root not found: {', '.join(missing)}")
        return 1

    started = time.time()
    folders = find_song_folders(args.roots)[: args.limit]
    print(f"Found {len(folders)} song folders; analysing with {args.workers} workers")

    results: Dict[str, Result] = {}
    errors: List[Dict[str, str]] = []
    with multiprocessing.Pool(args.workers, initializer=_init_worker, initargs=(str(args.hydra),)) as pool:
        for done, (folder, md5, result, error) in enumerate(pool.imap_unordered(_scan_one, folders, chunksize=8), 1):
            if error is not None:
                errors.append({"folder": str(folder), "error": error})
            elif md5 is not None and result is not None and md5 not in results:
                results[md5] = result
            if done % 250 == 0 or done == len(folders):
                print(f"\rAnalysed {done} of {len(folders)}", end="", flush=True)
    print()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(results, separators=(",", ":")), encoding="utf-8")
    errors_file = args.out.with_name(args.out.stem + "_errors.json")
    if errors:
        errors_file.write_text(json.dumps(errors, indent=2), encoding="utf-8")

    print(f"Wrote optimal paths for {len(results)} charts to {args.out}")
    if errors:
        print(f"{len(errors)} folders failed, see {errors_file}")
    print(f"Done in {time.time() - started:.0f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
