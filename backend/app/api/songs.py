import os
import re
import jwt
from datetime import datetime, UTC
from flask import Blueprint, jsonify, request, current_app
from typing import List
from ..config import Config
from ..services.supabase_service import get_supabase
from ..utils.helpers import allowed_file
from werkzeug.utils import secure_filename

bp = Blueprint("songs", __name__)

ALLOWED_FIELDS = {"name", "artist", "album", "year", "genre", "charter", "song_length", "last_update", "scores_count", "md5"}
ALLOWED_FILTERS = {"name", "artist", "album", "genre", "charter"}

@bp.route("/api/songs/<string:identifier>", methods=["GET"])
def get_song(identifier):
    """
    retrieves a single song from the database by its ID or MD5 identifier

    params:
        identifier (str): ID or MD5 of the song to retrieve

    returns:
        JSON: song details
    """
    supabase = get_supabase()
    
    if identifier.isdigit():
        query = supabase.table("songs_new").select("*").eq("id", int(identifier))
    else:
        query = supabase.table("songs_new").select("*").eq("md5", identifier)
    result = query.execute()

    if not result.data:
        return jsonify({"error": "Song not found"}), 404

    song = result.data[0]
    return jsonify(song)

@bp.route("/api/songs", methods=["GET"])
def get_songs():
    """
    retrieves songs from the database

    returns:
        JSON: list of songs
    """
    supabase = get_supabase()
    logger = current_app.logger

    batch_size = 10000
    offset = 0
    songs = []

    while True:
        query = supabase.table("songs_new").select("*").limit(batch_size).offset(offset)
        result = query.execute()
        songs.extend(result.data)
        if len(result.data) < batch_size:
            break
        offset += batch_size

    return jsonify(songs)

@bp.route("/api/related-songs", methods=["GET"])
def get_related_songs():
    """
    retrieves songs related by album, artist, genre, and charter

    params:
        album (str, optional): album name
        artist (str, optional): artist name
        genre (str, optional): genre name
        charter (str, optional): charter name
    
    returns:
        JSON: list of related songs 
    """
    supabase = get_supabase()
    logger = current_app.logger

    album = request.args.get("album")
    album_songs = []
    if album:
        album_query = supabase.table("songs_new").select("*").eq("album", album)
        album_response = album_query.execute()
        album_songs = album_response.data

    artist = request.args.get("artist")
    artist_songs = []
    if artist:
        artist_query = supabase.table("songs_new").select("*").eq("artist", artist)
        artist_response = artist_query.execute()
        artist_songs = artist_response.data
    
    genre = request.args.get("genre")
    genre_songs = []
    if genre:
        genre_query = supabase.table("songs_new").select("*").eq("genre", genre)
        genre_response = genre_query.execute()
        genre_songs = genre_response.data

    charter = request.args.get("charter")
    charter_songs = []
    if charter:
        charters = charter.split(",")
        charter_query = supabase.table("charters").select("name").in_("name", charters)
        charter_response = charter_query.execute()
        matching_charters = [charter["name"] for charter in charter_response.data]

        if matching_charters:
            charters_query = supabase.table("songs_new").select("*").overlaps("charter_refs", matching_charters)
            charters_response = charters_query.execute()
            charter_songs = charters_response.data

    return jsonify({
        "album_songs": album_songs,
        "artist_songs": artist_songs,
        "genre_songs": genre_songs,
        "charter_songs": charter_songs
    })

@bp.route("/api/songs-by-ids", methods=["POST"])
def get_songs_by_ids():
    """
    retrieves songs from the database by their IDs

    params:
        ids (str[] | int[]): list of song IDs

    returns:
        JSON: list of songs
    """
    supabase = get_supabase()
    logger = current_app.logger
    
    data = request.json
    ids = data.get("ids", [])

    songs = []
    for i in range(0, len(ids), 500):
        batch = ids[i:i+500]
        if isinstance(batch[0], int):
            query = supabase.table("songs_new").select("*").in_("id", batch)
        else:
            query = supabase.table("songs_new").select("*").in_("md5", batch)
        result = query.execute()
        songs.extend(result.data)

    return jsonify(songs)

@bp.route("/api/songs/<string:md5>/extra", methods=["GET"])
def get_song_extra(md5):
    """
    Retrieves extra song data from the songs_extra table by MD5

    params:
        md5 (str): MD5 of the song to retrieve

    returns:
        JSON: detailed song data
    """
    supabase = get_supabase()
    
    query = supabase.table("songs_extra").select("song_data").eq("md5", md5)
    result = query.execute()

    if not result.data:
        return jsonify({"error": "Song not found"}), 404

    song_data = result.data[0]["song_data"]
    return jsonify(song_data)

def strip_color_tags(text: str) -> str:
    return re.sub(r'<color=[^>]+>(.*?)</color>', r'\1', text)

def strip_tags(text: str) -> str:
    return re.sub(r'</?b>', '', text)

def process_charter_name(charter: str) -> str:
    return strip_tags(strip_color_tags(charter.strip())).strip()

def split_charters(charter_string: str) -> List[str]:
    char_delimiters = [",", "/", "&"]
    multichar_delimiters = [" - ", " + ", " and "]

    def is_in_color_tag(pos, text):
        open_tags = [m.start() for m in re.finditer(r'<color=', text[:pos])]
        close_tags = [m.start() for m in re.finditer(r'color>', text[:pos])]
        return len(open_tags) > len(close_tags)

    result = []
    current = []
    i = 0
    while i < len(charter_string):
        if any(charter_string.startswith(delim, i) for delim in multichar_delimiters) and not is_in_color_tag(i, charter_string):
            if current:
                result.append("".join(current).strip())
                current = []
            i += len(next(delim for delim in multichar_delimiters if charter_string.startswith(delim, i)))
        elif charter_string[i] in char_delimiters and not is_in_color_tag(i, charter_string):
            if current:
                result.append("".join(current).strip())
                current = []
            i += 1
        else:
            current.append(charter_string[i])
            i += 1

    if current:
        result.append("".join(current).strip())

    return [charter.strip() for charter in result if charter.strip()]

def fetch_existing_charters(supabase):
    response = supabase.table("charters").select("id", "name").execute()
    return {charter["name"]: charter["id"] for charter in response.data}

def parse_ini_file(ini_path):
    """
    Parse the song.ini file to extract required fields, attempting to handle different encodings.
    """
    logger = current_app.logger
    data = {}
    required_fields = [
        "artist", "name", "album", "track", "year",
        "genre", "diff_drums", "song_length", "charter"
    ]
    try:
        with open(ini_path, "r", encoding="utf-8") as file:
            lines = file.readlines()
    except UnicodeDecodeError:
        try:
            with open(ini_path, "r", encoding="cp1252") as file:
                lines = file.readlines()
        except UnicodeDecodeError:
            logger.error(f"Failed to decode {ini_path}. Skipping.")
            return data

    for line in lines:
        key, _, value = line.partition("=")
        key = key.strip().lower()
        value = value.strip()
        if key in required_fields:
            data[key] = value
    return data

# Unused until I update it to use geo's scan chart
@bp.route("/api/songs/upload_ini", methods=["POST"])
def upload_song_ini():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files["file"]
    identifier = request.form.get("identifier")
    
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        try:
            song_data = parse_ini_file(filepath)
            song_data["md5"] = identifier
            
            supabase = get_supabase()
            logger = current_app.logger
            
            existing_song = supabase.table("songs_new").select("id").eq("md5", identifier).execute()
            if existing_song.data:
                return jsonify({"error": "Song already exists in the database"}), 400
            
            existing_charters = fetch_existing_charters(supabase)
            
            charter_string = song_data.get("charter", "")
            charters = split_charters(charter_string)
            charter_refs = []
            new_charters = []
            
            for charter in charters:
                processed_name = process_charter_name(charter)
                charter_refs.append(processed_name)
                if processed_name not in existing_charters and processed_name not in new_charters:
                    new_charters.append({"name": processed_name})
                    
            if new_charters:
                new_charters_response = supabase.table("charters").insert(new_charters).execute()
                if new_charters_response.data:
                    logger.info(f"Inserted {len(new_charters)} new charters.")
                else:
                    return jsonify({"error": "Failed to add charters to database"}), 500
                
            difficulties = {
                "drums": int(song_data.get("diff_drums", "0")) if song_data.get("diff_drums", "").isdigit() else None,
                "guitar": int(song_data.get("diff_guitar", "0")) if song_data.get("diff_guitar", "").isdigit() else None,
                "bass": int(song_data.get("diff_bass", "0")) if song_data.get("diff_bass", "").isdigit() else None,
                "vocals": int(song_data.get("diff_vocals", "0")) if song_data.get("diff_vocals", "").isdigit() else None,
                "rhythm": int(song_data.get("diff_rhythm", "0")) if song_data.get("diff_rhythm", "").isdigit() else None
            }
            
            new_song = {
                "md5": identifier,
                "artist": song_data.get("artist", ""),
                "name": song_data.get("name", "") + " (Unverified)",
                "album": song_data.get("album", ""),
                "genre": song_data.get("genre", ""),
                "track": int(song_data.get("track", "0")) if song_data.get("track", "").isdigit() else None,
                "year": int(song_data.get("year", "0")) if song_data.get("year", "").isdigit() else None,
                "difficulty": difficulties,
                "song_length": int(song_data.get("song_length", "0")) if song_data.get("song_length", "").isdigit() else None,
                "charter_refs": charter_refs,
                "last_update": datetime.now(UTC).isoformat()
            }
            
            response = supabase.table("songs_new").insert(new_song).execute()
            
            if response.data:
                return jsonify({"message": "Song added successfully"}), 200
            else:
                return jsonify({"error": "Failed to add song to database"}), 500
            
        except Exception as e:
            current_app.logger.error(f"Error processing song.ini: {str(e)}")
            return jsonify({"error": str(e)}), 500
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
    
    return jsonify({"error": "Invalid file"}), 400

@bp.route("/api/songs/<int:song_id>/admin", methods=["POST"])
def admin_song_action(song_id):
    """
    Handles admin actions for songs (verify or remove)

    params:
        song_id (int): ID of the song to perform action on
        action (str): 'verify' or 'remove'

    returns:
        JSON: result of the action
    """
    supabase = get_supabase()
    logger = current_app.logger

    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "No token provided"}), 401
    try:
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        user_id = payload["user_id"]
        user_response = supabase.table("users").select("permissions").eq("id", user_id).execute()
        if not user_response.data or user_response.data[0]["permissions"] != "admin":
            return jsonify({"error": "Unauthorized"}), 403
    except Exception as e:
        logger.error(f"Error checking user permissions: {str(e)}")
        return jsonify({"error": "Unauthorized"}), 403

    action = request.json.get("action")
    if action not in ["verify", "remove"]:
        return jsonify({"error": "Invalid action"}), 400

    try:
        if action == "verify":
            song_query = supabase.table("songs_new").select("name").eq("id", song_id).execute()
            if not song_query.data:
                return jsonify({"error": "Song not found"}), 404
            current_name = song_query.data[0]["name"]
            new_name = current_name.replace(" (Unverified)", "")
            update_response = supabase.table("songs_new").update({"name": new_name}).eq("id", song_id).execute()
            if update_response.data:
                return jsonify({"message": "Song verified successfully"}), 200
            else:
                return jsonify({"error": "Failed to verify song"}), 500
        elif action == "remove":
            delete_response = supabase.table("songs_new").delete().eq("id", song_id).execute()
            if delete_response.data:
                return jsonify({"message": "Song removed successfully"}), 200
            else:
                return jsonify({"error": "Failed to remove song"}), 500
    except Exception as e:
        logger.error(f"Error performing admin action: {str(e)}")
        return jsonify({"error": "An error occurred while performing the action"}), 500