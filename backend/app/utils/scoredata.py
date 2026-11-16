"""Parser for Clone Hero's ``scoredata.bin``.

Layout (little-endian): ``i32 version, i32 count``, then ``count`` records of
``md5[16], u8 entries, u16 play_count, u8 reserved`` followed by 16-byte entries
of ``i16 instrument, u8 difficulty, u8 percent, u8 is_fc, u16 speed, u8 stars,
u32 modifiers, i32 score``. Checked against the game's own save code: it opens
the file with ``File.OpenWrite``, which doesn't truncate, so bytes after the
last counted record are stale and ignored.
"""

import struct
from typing import Final, TypedDict

SUPPORTED_VERSION: Final = 20211009

_HEADER = struct.Struct("<ii")
_RECORD = struct.Struct("<16sBHx")
_ENTRY = struct.Struct("<hBBBHBIi")
_VERSION_RANGE: Final = range(20000101, 21000101)


class ScoreDataError(ValueError):
    """The file is not a readable scoredata.bin."""


class UnsupportedScoreDataVersion(ScoreDataError):
    def __init__(self, version: int) -> None:
        super().__init__(f"unsupported score data version {version}")
        self.version = version


class ScoreDataRun(TypedDict):
    instrument: int
    difficulty: int
    percent: int
    is_fc: int
    speed: int
    stars: int
    modifiers: int
    score: int


class ScoreDataSong(TypedDict):
    identifier: str
    play_count: int
    scores: list[ScoreDataRun]


class ScoreDataFile(TypedDict):
    version: int
    songs: list[ScoreDataSong]


def parse_score_data(data: bytes) -> ScoreDataFile:
    try:
        version, count = _HEADER.unpack_from(data, 0)
        if version != SUPPORTED_VERSION:
            if version in _VERSION_RANGE:
                raise UnsupportedScoreDataVersion(version)
            raise ScoreDataError("not a scoredata.bin file")
        offset = _HEADER.size
        songs: list[ScoreDataSong] = []
        for _ in range(count):
            md5, entries, play_count = _RECORD.unpack_from(data, offset)
            offset += _RECORD.size
            runs: list[ScoreDataRun] = []
            for _ in range(entries):
                instrument, difficulty, percent, is_fc, speed, stars, modifiers, score = (
                    _ENTRY.unpack_from(data, offset)
                )
                offset += _ENTRY.size
                runs.append({
                    "instrument": instrument,
                    "difficulty": difficulty,
                    "percent": percent,
                    "is_fc": is_fc,
                    "speed": speed,
                    "stars": stars,
                    "modifiers": modifiers,
                    "score": score,
                })
            songs.append({"identifier": md5.hex(), "play_count": play_count, "scores": runs})
    except struct.error as e:
        raise ScoreDataError("truncated score data") from e
    return {"version": version, "songs": songs}
