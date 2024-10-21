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

@bp.route("/api/spotify/fetch_song_data", methods=["GET"])
def fetch_song_data():
    logger = current_app.logger

    artist = request.args.get("artist", "")
    title = request.args.get("title", "")
    album = request.args.get("album", "")
    access_token = request.args.get("access_token", "")
    
    if not access_token:
        return jsonify({"error": "Failed to obtain Spotify access token"}), 500

    headers = {"Authorization": f"Bearer {access_token}"}

    artist_response = requests.get(
        f"https://api.spotify.com/v1/search?q=artist:{artist}&type=artist",
        headers=headers
    )
    artist_data = artist_response.json()
    genres = []
    artist_items = artist_data.get("artists", {}).get("items", [])
    if artist_items:
        genres = artist_items[0].get("genres", [])
    
    track_response = requests.get(
        f"https://api.spotify.com/v1/search?q=artist:{artist} track:{title} album:{album}&type=track",
        headers=headers
    )
    track_data = track_response.json()
    tracks = track_data.get("tracks", {}).get("items", [])

    if not tracks:
        track_response = requests.get(
            f"https://api.spotify.com/v1/search?q=artist:{artist} track:{title}&type=track",
            headers=headers
        )
        track_data = track_response.json()
        tracks = track_data.get("tracks", {}).get("items", [])

    if tracks:
        track_id = tracks[0]["id"]
        image_url = tracks[0]["album"]["images"][0]["url"]
        
        audio_features_response = requests.get(
            f"https://api.spotify.com/v1/audio-features/{track_id}",
            headers=headers
        )
        audio_features = audio_features_response.json()

        audio_analysis_response = requests.get(
            f"https://api.spotify.com/v1/audio-analysis/{track_id}",
            headers=headers
        )
        audio_analysis = audio_analysis_response.json()

        return jsonify({
            "image_url": image_url,
            "tempo": audio_features.get("tempo"),
            "time_signature": audio_features.get("time_signature"),
            "tempo_confidence": audio_analysis.get("track", {}).get("tempo_confidence"),
            "time_signature_confidence": audio_analysis.get("track", {}).get("time_signature_confidence"),
            "danceability": audio_features.get("danceability"),
            "energy": audio_features.get("energy"),
            "valence": audio_features.get("valence"),
            "loudness": audio_features.get("loudness"),
            "genres": genres if genres else []
        })

    # If no track found, try searching for the album and return at least the album art
    album_response = requests.get(
        f"https://api.spotify.com/v1/search?q=artist:{artist} album:{album}&type=album",
        headers=headers
    )
    album_data = album_response.json()
    albums = album_data.get("albums", {}).get("items", [])

    if albums:
        return jsonify({"image_url": albums[0]["images"][0]["url"]})

    return jsonify({"error": "No album art or audio features found"}), 404