import time
import requests
from base64 import b64encode
from datetime import datetime, UTC
from flask import Blueprint, jsonify, request
from ..config import Config
from ..types import FlaskResponse
from ..services.supabase_service import get_supabase, rows

bp = Blueprint("spotify", __name__)

CLIENT_ID = Config.SPOTIFY_CLIENT_ID
CLIENT_SECRET = Config.SPOTIFY_CLIENT_SECRET

session = requests.Session()
TIMEOUT = (5, 15)

_token: str | None = None
_token_expires_at: float = 0.0  # time.monotonic() deadline


def _get_client_token() -> str | None:
    """Obtain a Spotify client-credentials token, cached in-process until ~60s
    before it expires. Returns None if the token request fails (caller should
    treat that as a transient miss and not cache a result)."""
    global _token, _token_expires_at
    if _token is not None and time.monotonic() < _token_expires_at:
        return _token

    auth_header = b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {auth_header}",
    }
    data = {"grant_type": "client_credentials"}
    try:
        response = session.post(
            "https://accounts.spotify.com/api/token",
            headers=headers, data=data, timeout=TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError):
        return None

    token = payload.get("access_token")
    if not token:
        return None
    expires_in = payload.get("expires_in", 3600)
    _token = token
    _token_expires_at = time.monotonic() + max(0, expires_in - 60)
    return token


def _spotify_search(token: str, query: str, search_type: str, result_key: str) -> list:
    """Run a Spotify search and return the items list. Raises on HTTP failure."""
    response = session.get(
        "https://api.spotify.com/v1/search",
        headers={"Authorization": f"Bearer {token}"},
        params={"q": query, "type": search_type},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return response.json().get(result_key, {}).get("items", [])


def _search_album_art(token: str, artist: str, title: str, album: str) -> str | None:
    """Find album art via track search (album-scoped, then relaxed) with an album
    search fallback. Returns the image URL or None. Raises on Spotify HTTP failure."""
    tracks = _spotify_search(token, f"artist:{artist} track:{title} album:{album}", "track", "tracks")
    if not tracks:
        tracks = _spotify_search(token, f"artist:{artist} track:{title}", "track", "tracks")
    if tracks:
        images = tracks[0].get("album", {}).get("images", [])
        if images:
            return images[0].get("url")

    albums = _spotify_search(token, f"artist:{artist} album:{album}", "album", "albums")
    if albums:
        images = albums[0].get("images", [])
        if images:
            return images[0].get("url")

    return None


@bp.route("/api/spotify/album_art/<int:song_id>", methods=["GET"])
def get_album_art(song_id: int) -> FlaskResponse:
    """Return cached Spotify album art for a song, lazily fetching + caching it on
    the first request (write-through). ``image_fetched_at`` non-null means we have
    already searched (a null ``image_url`` is a cached negative result)."""
    supabase = get_supabase()

    result = (
        supabase.table("songs_new")
        .select("name,artist,album,image_url,image_fetched_at")
        .eq("id", song_id)
        .execute()
    )
    if not result.data:
        return jsonify({"error": "Song not found"}), 404

    song = rows(result.data)[0]

    if song.get("image_fetched_at") is not None:
        return jsonify({"image_url": song.get("image_url")})

    token = _get_client_token()
    if token is None:
        return jsonify({"image_url": None})

    try:
        image_url = _search_album_art(
            token,
            song.get("artist") or "",
            song.get("name") or "",
            song.get("album") or "",
        )
    except requests.RequestException:
        return jsonify({"image_url": None})

    supabase.table("songs_new").update({
        "image_url": image_url,
        "image_fetched_at": datetime.now(UTC).isoformat(),
    }).eq("id", song_id).execute()

    return jsonify({"image_url": image_url})


# DEPRECATED
@bp.route("/api/spotify/get_access_token", methods=["GET"])
def get_spotify_access_token() -> FlaskResponse:
    auth_header = b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {auth_header}"
    }
    data = {"grant_type": "client_credentials"}
    response = session.post(
        "https://accounts.spotify.com/api/token",
        headers=headers, data=data, timeout=TIMEOUT,
    )
    return jsonify({"access_token": response.json().get("access_token")})


@bp.route("/api/spotify/fetch_song_data", methods=["GET"])
def fetch_song_data() -> FlaskResponse:
    artist = request.args.get("artist", "")
    title = request.args.get("title", "")
    album = request.args.get("album", "")
    access_token = request.args.get("access_token", "")

    if not access_token:
        return jsonify({"error": "Failed to obtain Spotify access token"}), 500

    try:
        image_url = _search_album_art(access_token, artist, title, album)
    except requests.RequestException:
        image_url = None

    return jsonify({"image_url": image_url, "genres": []})
