from app.utils.helpers import allowed_file

def test_allowed_extensions():
    assert allowed_file("scoredata.bin")
    assert allowed_file("song.ini")
    assert not allowed_file("evil.py")
    assert not allowed_file("noextension")