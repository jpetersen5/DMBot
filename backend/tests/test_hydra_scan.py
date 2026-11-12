import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

from scripts.hydra_scan import (
    analyze_chart,
    collect_outcomes,
    find_song_folders,
    optimal_result,
    path_entry,
    path_string,
    pick_chart,
    scan_folders,
    write_outputs,
)


def fake_path(score, verbose, base=0, combo=0, sp=0, solo=0, accents=0, ghosts=0):
    return SimpleNamespace(
        totalscore=lambda: score,
        pathstring_verbose=lambda: verbose,
        score_base=base,
        score_combo=combo,
        score_sp=sp,
        score_solo=solo,
        score_accents=accents,
        score_ghosts=ghosts,
    )


def fake_record(paths):
    return SimpleNamespace(all_paths=lambda: iter(paths))


def test_path_string_drops_score_section():
    assert path_string("(No mult squeezes.) | E1 (45 ms) 2 | Score: 228,710") == "(No mult squeezes.) | E1 (45 ms) 2"
    assert path_string("2x, 3x | (No activations.) | Score: 337,470") == "2x, 3x | (No activations.)"


def test_path_entry_maps_breakdown():
    p = fake_path(228710, "(No mult squeezes.) | 1 2 | Score: 228,710", base=47510, combo=139560, sp=41640)
    assert path_entry(p) == {
        "score": 228710,
        "path": "(No mult squeezes.) | 1 2",
        "breakdown": {"base": 47510, "combo": 139560, "sp": 41640, "solo": 0, "accents": 0, "ghosts": 0},
    }


def test_optimal_result_keeps_only_ties_capped_at_10():
    paths = [fake_path(500, f"(No mult squeezes.) | {i} | Score: 500") for i in range(12)]
    paths.append(fake_path(490, "(No mult squeezes.) | 9 | Score: 490"))
    result = optimal_result(paths)
    assert result is not None
    assert result["optimal_score"] == 500
    assert len(result["paths"]) == 10
    assert all(p["score"] == 500 for p in result["paths"])
    assert [p["path"] for p in result["paths"]][:2] == ["(No mult squeezes.) | 0", "(No mult squeezes.) | 1"]


def test_optimal_result_uses_the_best_score_wherever_it_is():
    result = optimal_result([fake_path(490, "a | 1 | Score: 490"), fake_path(500, "b | 2 | Score: 500")])
    assert result is not None
    assert [p["score"] for p in result["paths"]] == [500]


def test_zero_optimal_is_none():
    assert optimal_result([fake_path(0, "(No mult squeezes.) | (No activations.) | Score: 0")]) is None
    assert optimal_result([]) is None


def test_pick_chart_order_and_case(tmp_path):
    (tmp_path / "Notes.Chart").write_bytes(b"c")
    (tmp_path / "NOTES.MID").write_bytes(b"m")
    (tmp_path / "song.ini").write_bytes(b"")
    chart = pick_chart(tmp_path)
    assert chart is not None and chart.name == "NOTES.MID"
    (tmp_path / "NOTES.MID").unlink()
    chart = pick_chart(tmp_path)
    assert chart is not None and chart.name == "Notes.Chart"


def test_pick_chart_none_without_chart(tmp_path):
    (tmp_path / "song.ini").write_bytes(b"")
    assert pick_chart(tmp_path) is None


def test_find_song_folders_recurses(tmp_path):
    (tmp_path / "a" / "b").mkdir(parents=True)
    (tmp_path / "c").mkdir()
    (tmp_path / "a" / "notes.mid").write_bytes(b"1")
    (tmp_path / "a" / "b" / "notes.chart").write_bytes(b"2")
    (tmp_path / "c" / "song.ini").write_bytes(b"")
    found = sorted(find_song_folders([tmp_path]))
    assert found == [tmp_path / "a", tmp_path / "a" / "b"]


def test_analyze_chart_hashes_bytes_and_passes_format(tmp_path):
    chart = tmp_path / "notes.midi"
    chart.write_bytes(b"abc")
    seen = []

    def analyze(data, fmt):
        seen.append((data, fmt))
        return fake_record([fake_path(10, "a | 1 | Score: 10")])

    md5, result = analyze_chart(chart, analyze)
    assert md5 == hashlib.md5(b"abc").hexdigest()
    assert seen == [(b"abc", "mid")]
    assert result is not None and result["optimal_score"] == 10


def test_analyze_chart_chart_format(tmp_path):
    chart = tmp_path / "notes.chart"
    chart.write_bytes(b"x")
    formats = []
    analyze_chart(chart, lambda data, fmt: formats.append(fmt) or fake_record([]))
    assert formats == ["chart"]


def test_scan_records_errors_and_continues(tmp_path):
    bad, good = tmp_path / "bad", tmp_path / "good"
    bad.mkdir()
    good.mkdir()
    (bad / "notes.mid").write_bytes(b"bad")
    (good / "notes.mid").write_bytes(b"good")

    def analyze(data, fmt):
        if data == b"bad":
            raise ValueError("corrupt chart")
        return fake_record([fake_path(10, "a | 1 | Score: 10")])

    results, errors = scan_folders([bad, good], analyze)
    assert list(results) == [hashlib.md5(b"good").hexdigest()]
    assert errors == [{"folder": str(bad), "error": "ValueError('corrupt chart')"}]


def test_scan_skips_songs_without_optimal(tmp_path):
    (tmp_path / "notes.mid").write_bytes(b"z")
    results, errors = scan_folders([tmp_path], lambda data, fmt: fake_record([]))
    assert results == {} and errors == []


def test_collect_keeps_results_when_interrupted():
    def outcomes():
        yield Path("a"), "m1", {"optimal_score": 5, "paths": []}, None
        yield Path("b"), None, None, "ValueError('bad')"
        raise KeyboardInterrupt

    results, errors, interrupted = collect_outcomes(outcomes(), total=10)
    assert interrupted
    assert results == {"m1": {"optimal_score": 5, "paths": []}}
    assert errors == [{"folder": "b", "error": "ValueError('bad')"}]


def test_write_outputs_removes_stale_errors_file(tmp_path):
    out = tmp_path / "hydra_paths.json"
    stale = tmp_path / "hydra_paths_errors.json"
    stale.write_text("[]", encoding="utf-8")
    write_outputs(out, {"m1": {"optimal_score": 5, "paths": []}}, [])
    assert json.loads(out.read_text(encoding="utf-8")) == {"m1": {"optimal_score": 5, "paths": []}}
    assert not stale.exists()
