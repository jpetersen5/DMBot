import struct

import pytest

from app.utils.scoredata import (
    ScoreDataError,
    UnsupportedScoreDataVersion,
    parse_score_data,
)

Run = tuple[int, int, int, int, int, int, int, int]
Record = tuple[str, int, list[Run]]


def drum_run(score: int, instrument: int = 9) -> Run:
    return (instrument, 3, 100, 0, 100, 5, 0x2, score)


def pack_record(record: Record) -> bytes:
    md5_hex, play_count, runs = record
    out = bytes.fromhex(md5_hex) + struct.pack("<BHB", len(runs), play_count, 0)
    for run in runs:
        out += struct.pack("<HBBBHBII", *run)
    return out


def build(records: list[Record], version: int = 20211009, trailing: bytes = b"", count: int | None = None) -> bytes:
    header = struct.pack("<II", version, len(records) if count is None else count)
    return header + b"".join(pack_record(r) for r in records) + trailing


MD5_A = "06259f41f6533b721dfeac1816b54cac"
MD5_B = "a0988c70358b733cbfd05584b7fc6b24"


def test_first_record_is_kept():
    result = parse_score_data(build([(MD5_A, 1, [drum_run(100)]), (MD5_B, 1, [drum_run(200)])]))
    assert [s["identifier"] for s in result["songs"]] == [MD5_A, MD5_B]


def test_all_fields_decoded():
    result = parse_score_data(build([(MD5_A, 7, [(9, 1, 100, 1, 150, 6, 0x1002, 123456)])]))
    song = result["songs"][0]
    assert song["play_count"] == 7
    assert song["scores"] == [{
        "instrument": 9, "difficulty": 1, "percent": 100, "is_fc": 1,
        "speed": 150, "stars": 6, "modifiers": 0x1002, "score": 123456,
    }]


def test_high_modifier_bytes_kept():
    result = parse_score_data(build([(MD5_A, 1, [(9, 3, 90, 0, 100, 4, 0x01040002, 5)])]))
    assert result["songs"][0]["scores"][0]["modifiers"] == 0x01040002


def test_trailing_stale_records_ignored():
    stale = pack_record((MD5_B, 3, [drum_run(999)]))
    result = parse_score_data(build([(MD5_A, 1, [drum_run(100)])], trailing=stale))
    assert [s["identifier"] for s in result["songs"]] == [MD5_A]


def test_multi_instrument_record():
    result = parse_score_data(build([(MD5_A, 2, [drum_run(617075, instrument=8), drum_run(423525)])]))
    runs = result["songs"][0]["scores"]
    assert [(r["instrument"], r["score"]) for r in runs] == [(8, 617075), (9, 423525)]


def test_zero_records():
    assert parse_score_data(build([])) == {"version": 20211009, "songs": []}


def test_truncated_record_rejected():
    with pytest.raises(ScoreDataError):
        parse_score_data(build([(MD5_A, 1, [drum_run(100)])], count=2))


def test_short_header_rejected():
    with pytest.raises(ScoreDataError):
        parse_score_data(b"\x01\x02")


def test_unsupported_version_rejected():
    with pytest.raises(UnsupportedScoreDataVersion) as excinfo:
        parse_score_data(build([], version=20251011))
    assert excinfo.value.version == 20251011
