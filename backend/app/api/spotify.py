import requests
from flask import Blueprint, jsonify, request, current_app
from ..config import Config
from base64 import b64encode

bp = Blueprint("spotify", __name__)

CLIENT_ID = Config.SPOTIFY_CLIENT_ID
CLIENT_SECRET = Config.SPOTIFY_CLIENT_SECRET

@bp.route("/api/spotify/get_access_token", methods=["GET"])
def get_spotify_access_token():
    auth_header = b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {auth_header}"
    }
    data = {"grant_type": "client_credentials"}
    response = requests.post("https://accounts.spotify.com/api/token", headers=headers, data=data)
    return jsonify({"access_token": response.json().get("access_token")})

@bp.route("/api/spotify/fetch_song_art", methods=["GET"])
def fetch_song_art():
    logger = current_app.logger

    artist = request.args.get("artist", "")
    title = request.args.get("title", "")
    album = request.args.get("album", "")
    access_token = request.args.get("access_token", "")
    
    if not access_token:
        return jsonify({"error": "Failed to obtain Spotify access token"}), 500

    headers = {"Authorization": f"Bearer {access_token}"}
    
    track_response = requests.get(
        f"https://api.spotify.com/v1/search?q=artist:{artist} track:{title} album:{album}&type=track",
        headers=headers
    )
    track_data = track_response.json()
    tracks = track_data.get("tracks", {}).get("items", [])

    if tracks:
        return jsonify({"image_url": tracks[0]["album"]["images"][0]["url"]})

    album_response = requests.get(
        f"https://api.spotify.com/v1/search?q=artist:{artist} album:{album}&type=album",
        headers=headers
    )
    album_data = album_response.json()
    albums = album_data.get("albums", {}).get("items", [])

    if albums:
        return jsonify({"image_url": albums[0]["images"][0]["url"]})

    return jsonify({"error": "No album art found"}), 404