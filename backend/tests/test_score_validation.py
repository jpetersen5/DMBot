import pytest

from app.utils.score_validation import is_bugged_score, split_bugged_unknown


@pytest.mark.parametrize("score, is_fc, optimal, expected", [
    (105_000, True, 100_000, False),
    (105_001, True, 100_000, True),
    (101_290, True, 100_000, False),
    (100_001, False, 100_000, False),
    (105_000, False, 100_000, False),
    (105_001, False, 100_000, True),
    (100_000, False, 100_000, False),
    (3_303_175, False, 410_230, True),
    (999_999, False, None, False),
    (999_999, False, 0, False),
])
def test_is_bugged_score(score, is_fc, optimal, expected):
    assert is_bugged_score(score, is_fc, optimal) is expected


def unknown(identifier, score, is_fc=False):
    return {
        "identifier": identifier,
        "song_name": f"Unknown Song: {identifier}",
        "artist": "Unknown Artist",
        "percent": 98.0,
        "is_fc": is_fc,
        "speed": 100,
        "score": score,
        "play_count": 1,
    }


def test_split_bugged_unknown():
    songs = {
        "m1": {"md5": "m1", "name": "Blight", "artist": "A", "optimal_score": 500},
        "m2": {"md5": "m2", "name": "Fine", "artist": "B", "optimal_score": 500},
    }
    kept, bugged = split_bugged_unknown([unknown("m1", 900), unknown("m2", 480), unknown("m3", 9_999_999)], songs)
    assert [s["identifier"] for s in kept] == ["m2", "m3"]
    assert bugged == [{"identifier": "m1", "song_name": "Blight", "artist": "A", "score": 900, "optimal_score": 500, "is_fc": False}]


def test_split_bugged_unknown_without_optimal_keeps_everything():
    songs = {"m1": {"md5": "m1", "name": "S", "artist": "A", "optimal_score": None}}
    kept, bugged = split_bugged_unknown([unknown("m1", 9_999_999)], songs)
    assert len(kept) == 1 and bugged == []
