import json
from types import SimpleNamespace

import pytest

from app.services import song_import
from app.services.song_import import (
    changed_columns,
    describe_plan,
    import_songs,
    plan_import,
    prepare_song,
    update_batches,
)

NOW = "2026-11-08T00:00:00+00:00"


def scanned(md5="a" * 32, **overrides):
    song = {
        "md5": md5,
        "name": "Sleepers",
        "artist": "Saosin",
        "album": "Saosin",
        "genre": "Emo",
        "year": "2006",
        "charter": "TDC,Sang Duta",
        "song_length": 171455,
        "diff_drums": 4,
        "diff_guitar": 3,
        "diff_keys": -1,
        "loading_phrase": "Multitrack",
        "album_track": 16000,
        "playlistPath": "BirdmanExe Sync Drive",
        "notesData": {"has2xKick": False, "noteCounts": [{"instrument": "drums", "difficulty": "expert", "count": 1420}], "instruments": ["drums"]},
        "bpm_dominant": 145,
        "bpm_min": 140,
        "bpm_max": 150,
        "folders": ["Synced Charts\\Sync Charts\\BirdmanExe Drive\\x"],
    }
    song.update(overrides)
    return song


def db_row(song):
    return {"md5": song["md5"], **{k: v for k, v in song.items() if k in song_import.COMPARED}}


class TestPrepareSong:
    def test_maps_scan_fields_to_columns(self):
        row = prepare_song(scanned())
        assert row == {
            "md5": "a" * 32,
            "name": "Sleepers",
            "artist": "Saosin",
            "album": "Saosin",
            "genre": "Emo",
            "year": 2006,
            "charter_refs": ["TDC", "Sang Duta"],
            "song_length": 171455,
            "difficulties": {"drums": 4, "guitar": 3},
            "loading_phrase": "Multitrack",
            "track": None,
            "playlist_path": "BirdmanExe Sync Drive",
            "has_2x_kick": False,
            "note_counts": [{"instrument": "drums", "difficulty": "expert", "count": 1420}],
            "instruments": ["drums"],
            "bpm_dominant": 145,
            "bpm_min": 140,
            "bpm_max": 150,
        }

    @pytest.mark.parametrize("year, expected", [("2006", 2006), ("", None), ("2006a", None), (None, None)])
    def test_year(self, year, expected):
        assert prepare_song(scanned(year=year))["year"] == expected

    def test_blank_charter_is_an_empty_list(self):
        assert prepare_song(scanned(charter=""))["charter_refs"] == []
        assert prepare_song(scanned(charter=None))["charter_refs"] == []

    def test_missing_text_becomes_empty_string_for_not_null_columns(self):
        row = prepare_song(scanned(name=None, artist=None, album=None, genre=None, loading_phrase=None))
        assert [row[c] for c in ("name", "artist", "album", "genre", "loading_phrase")] == ["", "", "", "", ""]

    def test_real_track_number_is_kept(self):
        assert prepare_song(scanned(album_track=3))["track"] == 3

    def test_missing_notes_data(self):
        row = prepare_song(scanned(notesData=None))
        assert (row["has_2x_kick"], row["note_counts"], row["instruments"]) == (False, [], [])


class TestChangedColumns:
    def test_identical_rows(self):
        row = prepare_song(scanned())
        assert changed_columns(row, dict(row)) == []

    def test_reports_each_differing_column(self):
        old = {**prepare_song(scanned()), "bpm_dominant": None, "playlist_path": "Chorus"}
        assert changed_columns(prepare_song(scanned()), old) == ["playlist_path", "bpm_dominant"]

    def test_existing_charters_are_kept(self):
        new = prepare_song(scanned(charter="Kcunningham04"))
        assert changed_columns(new, {**new, "charter_refs": ["Chaotrope"]}) == []

    def test_json_key_order_does_not_count(self):
        new = prepare_song(scanned())
        old = {**new, "difficulties": {"guitar": 3, "drums": 4}}
        assert changed_columns(new, old) == []


class TestPlan:
    def test_sorts_songs_into_new_changed_and_unchanged(self):
        same = prepare_song(scanned("1" * 32))
        changed = prepare_song(scanned("2" * 32))
        new = prepare_song(scanned("3" * 32))
        existing = {
            same["md5"]: dict(same),
            changed["md5"]: {**changed, "bpm_dominant": None},
            "4" * 32: {**same, "md5": "4" * 32},
        }
        plan = plan_import([same, changed, new], existing)
        assert [r["md5"] for r in plan.new] == [new["md5"]]
        assert [(r["md5"], cols) for r, cols in plan.updates] == [(changed["md5"], ["bpm_dominant"])]
        assert plan.unchanged == 1
        assert plan.untouched == 1

    def test_update_batches_group_by_changed_columns_and_stamp_last_update(self):
        a = prepare_song(scanned("1" * 32))
        b = prepare_song(scanned("2" * 32))
        c = prepare_song(scanned("3" * 32, name="Renamed"))
        existing = {
            a["md5"]: {**a, "bpm_dominant": None},
            b["md5"]: {**b, "bpm_dominant": None},
            c["md5"]: {**c, "name": "Old"},
        }
        batches = update_batches(plan_import([a, b, c], existing), NOW)
        assert batches == {
            ("bpm_dominant",): [
                {"md5": a["md5"], "bpm_dominant": 145, "last_update": NOW},
                {"md5": b["md5"], "bpm_dominant": 145, "last_update": NOW},
            ],
            ("name",): [{"md5": c["md5"], "name": "Renamed", "last_update": NOW}],
        }


class TestDescribePlan:
    def test_lists_every_change_when_small(self):
        song = prepare_song(scanned())
        plan = plan_import([song], {song["md5"]: {**song, "bpm_dominant": None}})
        text = "\n".join(describe_plan(plan, {song["md5"]: {**song, "bpm_dominant": None}}))
        assert "Sleepers" in text
        assert "bpm_dominant: None -> 145" in text

    def test_summarises_per_column_when_large(self):
        songs = [prepare_song(scanned(f"{i:032d}")) for i in range(150)]
        existing = {s["md5"]: {**s, "bpm_dominant": None} for s in songs}
        lines = describe_plan(plan_import(songs, existing), existing)
        text = "\n".join(lines)
        assert "bpm_dominant" in text and "150" in text
        assert len(lines) < 30


class FakeQuery:
    def __init__(self, db, table):
        self.db, self.table = db, table
        self.range_ = (0, 10**9)

    def select(self, _cols):
        return self

    def order(self, _col):
        return self

    def range(self, start, end):
        self.range_ = (start, end)
        return self

    def upsert(self, payload, on_conflict):
        self.db.writes.append((self.table, on_conflict, payload))
        self.payload = payload
        return self

    def execute(self):
        if hasattr(self, "payload"):
            return SimpleNamespace(data=self.payload)
        if self.table == "charters":
            return SimpleNamespace(data=self.db.charters)
        if self.table == "charter_aliases":
            return SimpleNamespace(data=self.db.aliases)
        if self.table == "songs_extra":
            return SimpleNamespace(data=self.db.extra)
        start, end = self.range_
        return SimpleNamespace(data=self.db.rows[start:end + 1])


class FakeSupabase:
    def __init__(self, rows):
        self.rows = rows
        self.charters = []
        self.aliases = []
        self.extra = []
        self.writes = []

    def table(self, name):
        return FakeQuery(self, name)


@pytest.fixture
def scan_file(tmp_path):
    def write(songs):
        path = tmp_path / "scanned.json"
        path.write_text(json.dumps(songs), encoding="utf-8")
        return path
    return write


def test_preview_writes_nothing(scan_file):
    existing = scanned("1" * 32, bpm_dominant=None)
    fake = FakeSupabase([db_row(prepare_song(existing))])
    import_songs(fake, scan_file([scanned("1" * 32), scanned("2" * 32)]), apply=False, log=lambda _m: None)
    assert fake.writes == []


def test_apply_inserts_new_updates_changed_and_stores_extra_without_folders(scan_file, monkeypatch):
    monkeypatch.setattr(song_import, "utc_now", lambda: NOW)
    existing = prepare_song(scanned("1" * 32))
    fake = FakeSupabase([{**existing, "bpm_dominant": None}])
    import_songs(fake, scan_file([scanned("1" * 32), scanned("2" * 32)]), apply=True, log=lambda _m: None)

    songs_writes = [(conflict, payload) for table, conflict, payload in fake.writes if table == "songs_new"]
    assert songs_writes[0] == ("md5", [{**prepare_song(scanned("2" * 32)), "last_update": NOW}])
    assert songs_writes[1] == ("md5", [{"md5": "1" * 32, "bpm_dominant": 145, "last_update": NOW}])

    extra = [payload for table, _c, payload in fake.writes if table == "songs_extra"]
    stored = [row for batch in extra for row in batch]
    assert sorted(r["md5"] for r in stored) == ["1" * 32, "2" * 32]
    assert all("folders" not in r["song_data"] for r in stored)


def test_extra_is_refreshed_independently_of_songs_new(scan_file):
    in_sync = scanned("1" * 32)
    stale = scanned("2" * 32)
    missing = scanned("3" * 32)
    fake = FakeSupabase([db_row(prepare_song(s)) for s in (in_sync, stale, missing)])
    fake.extra = [
        {"md5": in_sync["md5"], "song_data": song_import.extra_data(in_sync)},
        {"md5": stale["md5"], "song_data": {**song_import.extra_data(stale), "bpm_dominant": None}},
    ]
    messages = []
    import_songs(fake, scan_file([in_sync, stale, missing]), apply=True, log=messages.append)

    assert not any(table == "songs_new" for table, _c, _p in fake.writes)
    stored = [row["md5"] for table, _c, batch in fake.writes if table == "songs_extra" for row in batch]
    assert sorted(stored) == [stale["md5"], missing["md5"]]
    assert any("full scan data to refresh: 2" in m for m in messages)


def test_nul_characters_are_stripped_before_writing(scan_file):
    nul = chr(0)
    song = scanned(folderIssues=[{"description": f"got: 'd{nul}x'"}], name=f"Bad{nul}Name")
    fake = FakeSupabase([])
    import_songs(fake, scan_file([song]), apply=True, log=lambda _m: None)
    written = json.dumps([payload for _t, _c, payload in fake.writes])
    assert "\\u0000" not in written
    assert "BadName" in written


def test_existing_rows_are_paged(scan_file):
    rows = [db_row(prepare_song(scanned(f"{i:032d}"))) for i in range(2500)]
    fake = FakeSupabase(rows)
    messages = []
    import_songs(fake, scan_file([]), apply=False, log=messages.append)
    assert any("2500" in m for m in messages)


@pytest.mark.parametrize("args, expected_apply", [([], False), (["--apply"], True)])
def test_cli_previews_unless_applied(scan_file, monkeypatch, args, expected_apply):
    from flask import Flask

    from app import cli as cli_module

    calls = []
    monkeypatch.setattr(cli_module, "get_supabase", lambda: "client")
    monkeypatch.setattr(cli_module, "import_songs", lambda client, path, apply, log, paths_file: calls.append((client, path, apply)))
    path = scan_file([])
    app = Flask(__name__)
    cli_module.register_cli(app)

    result = app.test_cli_runner().invoke(args=["import-songs", "--file", str(path), *args])

    assert result.exit_code == 0, result.output
    assert calls == [("client", path, expected_apply)]


class TestCharterNames:
    ALIASES = {"Kcunningham04": ["Chaotrope"], "ZachsCharts": ["Hababa2"], "CyclopsDragon; Austin Tomlinson": ["CyclopsDragon", "Austin Tomlinson"]}

    def test_aliases_resolve_to_their_canonical_charters(self):
        row = {**prepare_song(scanned()), "charter_refs": ["Kcunningham04", "Bounty"]}
        assert song_import.resolve_aliases(row, self.ALIASES)["charter_refs"] == ["Chaotrope", "Bounty"]

    def test_compound_alias_expands_and_dedupes_in_order(self):
        row = {**prepare_song(scanned()), "charter_refs": ["CyclopsDragon; Austin Tomlinson", "CyclopsDragon"]}
        assert song_import.resolve_aliases(row, self.ALIASES)["charter_refs"] == ["CyclopsDragon", "Austin Tomlinson"]

    def test_alias_matching_is_exact(self):
        row = {**prepare_song(scanned()), "charter_refs": ["kcunningham04"]}
        assert song_import.resolve_aliases(row, self.ALIASES)["charter_refs"] == ["kcunningham04"]

    def test_import_writes_canonical_names_for_new_songs(self, scan_file):
        fake = FakeSupabase([])
        fake.aliases = [{"alias": "ZachsCharts", "canonicals": ["Hababa2"]}]
        import_songs(fake, scan_file([scanned(charter="ZachsCharts,Bounty")]), apply=True, log=lambda _m: None)
        inserted = next(payload for table, _c, payload in fake.writes if table == "songs_new")
        assert inserted[0]["charter_refs"] == ["Hababa2", "Bounty"]

    def test_preview_flags_unaliased_lookalikes_of_existing_charters(self, scan_file):
        fake = FakeSupabase([])
        fake.charters = [{"name": "Sr. Dedos Rápidos"}]
        messages = []
        import_songs(fake, scan_file([scanned(charter="Sr. Dedos Rapidos,Brand New")]), apply=False, log=messages.append)
        text = "\n".join(messages)
        assert "Sr. Dedos Rapidos -> Sr. Dedos Rápidos" in text
        assert "Brand New ->" not in text


PATHS = [{"score": 500, "path": "(No mult squeezes.) | 1", "breakdown": {"base": 100, "combo": 300, "sp": 100, "solo": 0, "accents": 0, "ghosts": 0}}]


class TestOptimalPaths:
    def test_paths_are_compared_when_present(self):
        song = scanned()
        old = {**db_row(song), **prepare_song(song), "optimal_score": None, "paths": None}
        new = {**prepare_song(song), "optimal_score": 500, "paths": PATHS}
        assert changed_columns(new, old) == ["optimal_score", "paths"]

    def test_missing_paths_never_null_existing_ones(self):
        song = scanned()
        old = {**prepare_song(song), "optimal_score": 500, "paths": PATHS}
        assert changed_columns(prepare_song(song), old) == []

    def test_path_only_updates_do_not_bump_last_update(self):
        plan = song_import.ImportPlan(updates=[({"md5": "a" * 32, "optimal_score": 500, "paths": PATHS}, ["optimal_score", "paths"])])
        [batch] = update_batches(plan, NOW).values()
        assert batch == [{"md5": "a" * 32, "optimal_score": 500, "paths": PATHS}]

    def test_mixed_updates_still_bump_last_update(self):
        row = {**prepare_song(scanned()), "paths": PATHS}
        plan = song_import.ImportPlan(updates=[(row, ["name", "paths"])])
        [batch] = update_batches(plan, NOW).values()
        assert batch[0]["last_update"] == NOW


def write_paths(tmp_path, paths):
    path = tmp_path / "hydra_paths.json"
    path.write_text(json.dumps(paths), encoding="utf-8")
    return path


def test_import_attaches_paths_by_md5(scan_file, tmp_path, monkeypatch):
    monkeypatch.setattr(song_import, "utc_now", lambda: NOW)
    fake = FakeSupabase([])
    paths_file = write_paths(tmp_path, {"2" * 32: {"optimal_score": 500, "paths": PATHS}})
    import_songs(fake, scan_file([scanned("2" * 32)]), apply=True, log=lambda _m: None, paths_file=paths_file)
    [inserted] = [row for table, _c, batch in fake.writes if table == "songs_new" for row in batch]
    assert inserted["optimal_score"] == 500 and inserted["paths"] == PATHS


def test_import_updates_paths_without_bumping_last_update(scan_file, tmp_path, monkeypatch):
    monkeypatch.setattr(song_import, "utc_now", lambda: NOW)
    song = scanned("1" * 32)
    fake = FakeSupabase([{**prepare_song(song), "optimal_score": None, "paths": None}])
    paths_file = write_paths(tmp_path, {"1" * 32: {"optimal_score": 500, "paths": PATHS}})
    import_songs(fake, scan_file([song]), apply=True, log=lambda _m: None, paths_file=paths_file)
    songs_writes = [batch for table, _c, batch in fake.writes if table == "songs_new"]
    assert songs_writes == [[{"md5": "1" * 32, "optimal_score": 500, "paths": PATHS}]]


def test_import_reports_paths_for_unscanned_songs(scan_file, tmp_path):
    fake = FakeSupabase([])
    paths_file = write_paths(tmp_path, {"9" * 32: {"optimal_score": 500, "paths": PATHS}})
    messages = []
    import_songs(fake, scan_file([scanned("2" * 32)]), apply=True, log=messages.append, paths_file=paths_file)
    assert any("1 " in m and "not in the scan" in m for m in messages)
    written = json.dumps([payload for _t, _c, payload in fake.writes])
    assert "9" * 32 not in written


def test_cli_passes_paths_file(scan_file, tmp_path, monkeypatch):
    from flask import Flask

    from app import cli as cli_module

    calls = []
    monkeypatch.setattr(cli_module, "get_supabase", lambda: "client")
    monkeypatch.setattr(cli_module, "import_songs", lambda client, path, apply, log, paths_file: calls.append(paths_file))
    path = scan_file([])
    paths_file = write_paths(tmp_path, {})
    app = Flask(__name__)
    cli_module.register_cli(app)

    result = app.test_cli_runner().invoke(args=["import-songs", "--file", str(path), "--paths", str(paths_file)])

    assert result.exit_code == 0, result.output
    assert calls == [paths_file]


def test_cli_skips_missing_default_paths_file(scan_file, tmp_path, monkeypatch):
    from flask import Flask

    from app import cli as cli_module

    calls = []
    monkeypatch.setattr(cli_module, "get_supabase", lambda: "client")
    monkeypatch.setattr(cli_module, "DEFAULT_PATHS_FILE", tmp_path / "absent.json")
    monkeypatch.setattr(cli_module, "import_songs", lambda client, path, apply, log, paths_file: calls.append(paths_file))
    app = Flask(__name__)
    cli_module.register_cli(app)

    result = app.test_cli_runner().invoke(args=["import-songs", "--file", str(scan_file([]))])

    assert result.exit_code == 0, result.output
    assert calls == [None]
