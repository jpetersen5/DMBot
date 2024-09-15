import os
import re
import jwt
from datetime import datetime, UTC
from flask import Blueprint, jsonify, request, current_app
from typing import Any, Dict, List, Optional
from ..config import Config
from ..services.supabase_service import get_supabase
from ..utils.helpers import sanitize_input, allowed_file
from werkzeug.utils import secure_filename

bp = Blueprint("songs", __name__)

ALLOWED_FIELDS = {"name", "artist", "album", "year", "genre", "difficulty", "charter", "song_length", "last_update", "scores_count", "md5"}
ALLOWED_FILTERS = {"name", "artist", "album", "year", "genre", "charter"}

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
        query = supabase.table("songs").select("*").eq("id", int(identifier))
    else:
        query = supabase.table("songs").select("*").eq("md5", identifier)
    result = query.execute()

    if not result.data:
        return jsonify({"error": "Song not found"}), 404

    song = result.data[0]
    return jsonify(song)

@bp.route("/api/songs", methods=["GET"])
def get_songs():
    """
    retrieves songs from the database

    params:
        page (int): page number (default 1)
        per_page (int): number of songs per page (default 20)
        sort_by (str): field to sort by (default "last_update")
        sort_order (str): sort order ("asc" or "desc", default "desc")
        search (str): search query (default None)
        filter (str): field to filter by (default None)

    returns:
        JSON: list of songs, total count, page number, songs per page, sort field, and sort order
    """
    supabase = get_supabase()
    logger = current_app.logger
    
    page: int = max(1, int(request.args.get("page", 1)))
    per_page: int = max(10, min(100, int(request.args.get("per_page", 20))))
    sort_by: str = sanitize_input(request.args.get("sort_by", "last_update").lower())
    sort_order: str = request.args.get("sort_order", "desc").lower()
    search: Optional[str] = request.args.get("search")
    filters: List[str] = request.args.get("filter", "").split(",")

    filters = [filter for filter in filters if filter in ALLOWED_FILTERS]
    if sort_order not in ["asc", "desc"]:
        sort_order = "desc"
    if sort_by not in ALLOWED_FIELDS:
        sort_by = "last_update"
    elif sort_by == "charter":
        sort_by = "charter_refs"

    query = supabase.table("songs").select("*")
    count_query = supabase.table("songs").select("id", count="exact")

    if search:
        search_terms = sanitize_input(search).split()
        search_fields = filters if filters else ["name", "artist", "album", "year", "genre", "charter"]
        
        for term in search_terms:
            term_filter = []
            for field in search_fields:
                if field != "charter":
                    condition = f"{field}.ilike.%{term}%"
                    term_filter.append(condition)

            if search_fields.count("charter") > 0:
                charters_query = supabase.table("charters").select("name").ilike("name", f"*{term}*")
                charters_response = charters_query.execute()
                matching_charters = [charter["name"] for charter in charters_response.data]
                if matching_charters:
                    charter_condition = f"charter_refs.ov.{{{','.join(matching_charters)}}}"
                    term_filter.append(charter_condition)
            
            if term_filter:
                query = query.or_(",".join(term_filter))
                count_query = count_query.or_(",".join(term_filter))

    total_songs = count_query.execute().count

    query = query.order(sort_by, desc=(sort_order == "desc"))
    query = query.range((page - 1) * per_page, page * per_page - 1)

    result = query.execute()

    songs: List[Dict[str, Any]] = result.data

    return jsonify({
        "songs": songs,
        "total": total_songs,
        "page": page,
        "per_page": per_page,
        "sort_by": sort_by,
        "sort_order": sort_order
    })

@bp.route("/api/related-songs", methods=["GET"])
def get_related_songs():
    """
    retrieves songs related by album, artist, genre, or charter
    
    params:
        album, artist, genre, or charter (str): relation type and value
        page (int): page number (default 1)
        per_page (int): number of songs per page (default 8)
    
    returns:
        JSON: list of related songs, total count, page number, and songs per page
    """
    supabase = get_supabase()
    logger = current_app.logger

    relation_types = ["album", "artist", "genre", "charter"]
    relation_type = next((param for param in relation_types if param in request.args), None)
    if not relation_type:
        return jsonify({"error": "Invalid relation type"}), 400

    value = request.args.get(relation_type)
    if not value:
        return jsonify({"error": "Missing relation value"}), 400

    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 8))

    query = supabase.table("songs").select("id", "artist", "name", "album", "track", "year", "genre", "difficulty", "song_length", "charter_refs", "last_update")
    count_query = supabase.table("songs").select("id", count="exact")

    if relation_type == "charter":
        charters = value.split(",")
        charter_query = supabase.table("charters").select("name").in_("name", charters)
        charters_response = charter_query.execute()
        matching_charters = [charter["name"] for charter in charters_response.data]

        if matching_charters:
            query = query.overlaps("charter_refs", matching_charters)
            count_query = count_query.overlaps("charter_refs", matching_charters)
    else:
        query = query.eq(relation_type, value)
        count_query = count_query.eq(relation_type, value)

    total_count = count_query.execute().count

    if relation_type == "album":
        query = query.order("track", desc=False)
    else:
        query = query.order("last_update", desc=True)

    query = query.range((page - 1) * per_page, page * per_page - 1)
        
    response = query.execute()

    return jsonify({
        "songs": response.data,
        "total": total_count,
        "page": page,
        "per_page": per_page
    })

@bp.route("/api/songs-by-ids", methods=["POST"])
def get_songs_by_ids():
    """
    retrieves songs from the database by their IDs

    params:
        ids (str): comma-separated list of song IDs
        page (int): page number (default 1)
        per_page (int): number of songs per page (default 20)
        sort_by (str): field to sort by (default "last_update")
        sort_order (str): sort order ("asc" or "desc", default "desc")

    returns:
        JSON: list of songs, total count, page number, songs per page, sort field, and sort order
    """
    supabase = get_supabase()
    logger = current_app.logger
    
    data = request.json
    ids = data.get("ids", [])
    page = max(1, int(data.get("page", 1)))
    per_page = max(10, min(100, int(data.get("per_page", 20))))
    sort_by = sanitize_input(data.get("sort_by", "last_update").lower())
    sort_order = data.get("sort_order", "desc").lower()

    if sort_order not in ["asc", "desc"]:
        sort_order = "desc"
    if sort_by not in ALLOWED_FIELDS:
        sort_by = "last_update"
    elif sort_by == "charter":
        sort_by = "charter_refs"

    query = supabase.table("songs").select("*").in_("id", ids)
    count_query = supabase.table("songs").select("id", count="exact").in_("id", ids)

    total_songs = count_query.execute().count

    query = query.order(sort_by, desc=(sort_order == "desc"))
    query = query.range((page - 1) * per_page, page * per_page - 1)

    result = query.execute()

    songs = result.data

    return jsonify({
        "songs": songs,
        "total": total_songs,
        "page": page,
        "per_page": per_page,
        "sort_by": sort_by,
        "sort_order": sort_order
    })

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
            
            existing_song = supabase.table("songs").select("id").eq("md5", identifier).execute()
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
            
            new_song = {
                "md5": identifier,
                "artist": song_data.get("artist", ""),
                "name": song_data.get("name", "") + " (Unverified)",
                "album": song_data.get("album", ""),
                "genre": song_data.get("genre", ""),
                "track": int(song_data.get("track", "0")) if song_data.get("track", "").isdigit() else None,
                "year": song_data.get("year", ""),
                "difficulty": int(song_data.get("diff_drums", "0")) if song_data.get("diff_drums", "").isdigit() else None,
                "song_length": int(song_data.get("song_length", "0")) if song_data.get("song_length", "").isdigit() else None,
                "charter_refs": charter_refs,
                "last_update": datetime.now(UTC).isoformat()
            }
            
            response = supabase.table("songs").insert(new_song).execute()
            
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
            song_query = supabase.table("songs").select("name").eq("id", song_id).execute()
            if not song_query.data:
                return jsonify({"error": "Song not found"}), 404
            current_name = song_query.data[0]["name"]
            new_name = current_name.replace(" (Unverified)", "")
            update_response = supabase.table("songs").update({"name": new_name}).eq("id", song_id).execute()
            if update_response.data:
                return jsonify({"message": "Song verified successfully"}), 200
            else:
                return jsonify({"error": "Failed to verify song"}), 500
        elif action == "remove":
            delete_response = supabase.table("songs").delete().eq("id", song_id).execute()
            if delete_response.data:
                return jsonify({"message": "Song removed successfully"}), 200
            else:
                return jsonify({"error": "Failed to remove song"}), 500
    except Exception as e:
        logger.error(f"Error performing admin action: {str(e)}")
        return jsonify({"error": "An error occurred while performing the action"}), 500