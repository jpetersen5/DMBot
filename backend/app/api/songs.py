import os
import re
import requests
from datetime import datetime, UTC
from flask import Blueprint, jsonify, request, current_app, Response
from typing import Any, Dict, Iterator, List
from supabase import Client
from ..services.supabase_service import get_supabase, rows
from ..utils.helpers import allowed_file, token_required
from ..types import FlaskResponse
from werkzeug.utils import secure_filename

bp = Blueprint("songs", __name__)

session = requests.Session()

ALLOWED_FIELDS = {"name", "artist", "album", "year", "genre", "charter", "song_length", "last_update", "scores_count", "md5"}
ALLOWED_FILTERS = {"name", "artist", "album", "genre", "charter"}

SLIM_SONG_COLUMNS = (
    "id,md5,name,artist,album,track,year,genre,song_length,charter_refs,"
    "scores_count,last_update,instruments,has_2x_kick,loading_phrase,playlist_path"
)

@bp.route("/api/songs/<string:identifier>", methods=["GET"])
def get_song(identifier: str) -> FlaskResponse:
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

# structural bytes that matter when scanning a JSON value for its extent
_STRUCT_BYTES = re.compile(rb'[\\"\[\]]')

def _stream_songs_array(chunks: Iterator[bytes]) -> Iterator[bytes]:
    """
    stream only the ``songs`` array value out of a get_song_list envelope

    NOTE: this bare-array shim is removable once backwards compat is no longer required
    """
    KEY = b'"songs"'
    QUOTE, BACKSLASH, OPEN, CLOSE = 0x22, 0x5C, 0x5B, 0x5D
    phase = "seek_key"      # -> seek_open -> stream -> done
    carry = b""             # bytes retained across chunks while still seeking
    depth = 0               # array-bracket nesting depth once streaming
    in_string = False
    pending_escape = False  # first byte of the next chunk is a string escape

    for chunk in chunks:
        if phase == "done":
            continue

        if phase == "seek_key":
            carry += chunk
            idx = carry.find(KEY)
            if idx == -1:
                # keep only enough tail to catch a boundary-split key match
                carry = carry[-(len(KEY) - 1):]
                continue
            phase = "seek_open"
            chunk = carry[idx + len(KEY):]
            carry = b""

        if phase == "seek_open":
            # only ':' and whitespace sit between the key and its '[' value
            carry += chunk
            open_idx = carry.find(b"[")
            if open_idx == -1:
                continue
            phase = "stream"
            chunk = carry[open_idx:]
            carry = b""
            depth = 0
            in_string = False
            pending_escape = False

        # phase == "stream": the whole chunk is part of the array value; emit it,
        # scanning only structural bytes to find where the array value ends.
        n = len(chunk)
        pos = 1 if pending_escape else 0  # skip an escape carried over a boundary
        pending_escape = False
        finished = False
        while True:
            m = _STRUCT_BYTES.search(chunk, pos)
            if m is None:
                break
            i = m.start()
            b = chunk[i]
            if in_string:
                if b == BACKSLASH:
                    # the escaped byte carries no structural meaning; skip past it
                    pos = i + 2
                    if pos > n:
                        pending_escape = True
                    continue
                if b == QUOTE:
                    in_string = False
            elif b == QUOTE:
                in_string = True
            elif b == OPEN:
                depth += 1
            elif b == CLOSE:
                depth -= 1
                if depth == 0:
                    yield chunk[:i + 1]
                    finished = True
                    break
            pos = i + 1

        if finished:
            phase = "done"
            continue
        yield chunk

@bp.route("/api/songs", methods=["GET"])
def get_songs() -> FlaskResponse:
    """
    retrieves the full song list or delta via the ``get_song_list`` RPC

    query params:
        since (str, optional): ISO-8601 timestamp; returns only songs updated
            at/after it plus tombstones deleted since then
        v (str, optional): ``2`` opts into the new envelope response shape

    returns:
        with ``v=2`` or ``since``: the RPC envelope ``{"server_time", "songs", "deleted"}``
        legacy clients: a bare JSON array of songs
    """
    logger = current_app.logger

    since = request.args.get("since")
    if since is not None:
        try:
            datetime.fromisoformat(since)
        except ValueError:
            return jsonify({"error": "Invalid 'since' timestamp; expected ISO-8601"}), 400

    envelope = since is not None or request.args.get("v") == "2"

    body: Dict[str, Any] = {}
    if since is not None:
        body["since"] = since

    url = f"{current_app.config['SUPABASE_URL']}/rest/v1/rpc/get_song_list"
    key = current_app.config["SUPABASE_SERVICE_KEY"]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    try:
        resp = session.post(url, json=body, headers=headers, stream=True, timeout=(5, 120))
    except (requests.Timeout, requests.ConnectionError) as e:
        logger.error(f"get_song_list RPC error: {e}")
        return jsonify({"error": "Failed to fetch songs"}), 502
    if resp.status_code != 200:
        logger.error(f"get_song_list RPC failed: {resp.status_code} {resp.text[:500]}")
        return jsonify({"error": "Failed to fetch songs"}), 502

    raw = resp.iter_content(chunk_size=65536)
    stream = raw if envelope else _stream_songs_array(raw)
    return Response(stream, mimetype="application/json")

@bp.route("/api/related-songs", methods=["GET"])
def get_related_songs() -> FlaskResponse:
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
        album_query = supabase.table("songs_new").select(SLIM_SONG_COLUMNS).eq("album", album)
        album_response = album_query.execute()
        album_songs = album_response.data

    artist = request.args.get("artist")
    artist_songs = []
    if artist:
        artist_query = supabase.table("songs_new").select(SLIM_SONG_COLUMNS).eq("artist", artist)
        artist_response = artist_query.execute()
        artist_songs = artist_response.data
    
    genre = request.args.get("genre")
    genre_songs = []
    if genre:
        genre_query = supabase.table("songs_new").select(SLIM_SONG_COLUMNS).eq("genre", genre)
        genre_response = genre_query.execute()
        genre_songs = genre_response.data

    charter = request.args.get("charter")
    charter_songs = []
    if charter:
        charters = charter.split(",")
        charter_query = supabase.table("charters").select("name").in_("name", charters)
        charter_response = charter_query.execute()
        matching_charters = [charter["name"] for charter in rows(charter_response.data)]

        if matching_charters:
            charters_query = supabase.table("songs_new").select(SLIM_SONG_COLUMNS).overlaps("charter_refs", matching_charters)
            charters_response = charters_query.execute()
            charter_songs = charters_response.data

    return jsonify({
        "album_songs": album_songs,
        "artist_songs": artist_songs,
        "genre_songs": genre_songs,
        "charter_songs": charter_songs
    })

@bp.route("/api/songs-by-ids", methods=["POST"])
def get_songs_by_ids() -> FlaskResponse:
    """
    retrieves songs from the database by their IDs

    params:
        ids (str[] | int[]): list of song IDs

    returns:
        JSON: list of songs
    """
    supabase = get_supabase()
    
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    ids = data.get("ids", [])
    if not ids:
        return jsonify({"error": "No IDs provided"}), 400

    songs = []
    for i in range(0, len(ids), 500):
        batch = ids[i:i+500]
        if isinstance(batch[0], int):
            query = supabase.table("songs_new").select(SLIM_SONG_COLUMNS).in_("id", batch)
        else:
            query = supabase.table("songs_new").select(SLIM_SONG_COLUMNS).in_("md5", batch)
        result = query.execute()
        songs.extend(result.data)

    return jsonify(songs)

@bp.route("/api/songs/<string:md5>/extra", methods=["GET"])
def get_song_extra(md5: str) -> FlaskResponse:
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

    song_data = rows(result.data)[0]["song_data"]
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

def fetch_existing_charters(supabase: Client) -> Dict[str, Any]:
    response = supabase.table("charters").select("id", "name").execute()
    return {charter["name"]: charter["id"] for charter in rows(response.data)}

def parse_ini_file(ini_path: str) -> Dict[str, str]:
    """
    Parse the song.ini file to extract required fields, attempting to handle different encodings.
    """
    logger = current_app.logger
    data: Dict[str, str] = {}
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
def upload_song_ini() -> FlaskResponse:
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files["file"]
    identifier = request.form.get("identifier")

    if not identifier:
        return jsonify({"error": "No identifier provided"}), 400

    if file.filename is None or file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join("unused", filename)
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
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
    
    return jsonify({"error": "Invalid file"}), 400

@bp.route("/api/songs/<int:song_id>/admin", methods=["POST"])
@token_required
def admin_song_action(user_id: str, song_id: int) -> FlaskResponse:
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
    if not request.json:
        return jsonify({"error": "No JSON data provided"}), 400

    user_response = supabase.table("users").select("permissions").eq("id", user_id).execute()
    if not user_response.data or rows(user_response.data)[0]["permissions"] != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    action = request.json.get("action")
    if action not in ["verify", "remove"]:
        return jsonify({"error": "Invalid action"}), 400

    if action == "verify":
        song_query = supabase.table("songs_new").select("name").eq("id", song_id).execute()
        if not song_query.data:
            return jsonify({"error": "Song not found"}), 404
        current_name = rows(song_query.data)[0]["name"]
        new_name = current_name.replace(" (Unverified)", "")
        # bump last_update so delta (since=) clients pick up the verified name
        update_response = supabase.table("songs_new").update({
            "name": new_name,
            "last_update": datetime.now(UTC).isoformat(),
        }).eq("id", song_id).execute()
        if update_response.data:
            return jsonify({"message": "Song verified successfully"}), 200
        else:
            return jsonify({"error": "Failed to verify song"}), 500
    else:
        # tombstone the song first so delta clients learn it was deleted
        song_query = supabase.table("songs_new").select("id", "md5").eq("id", song_id).execute()
        if not song_query.data:
            return jsonify({"error": "Song not found"}), 404
        song = rows(song_query.data)[0]
        supabase.table("deleted_songs").upsert({"song_id": song["id"], "md5": song["md5"]}).execute()
        delete_response = supabase.table("songs_new").delete().eq("id", song_id).execute()
        if delete_response.data:
            return jsonify({"message": "Song removed successfully"}), 200
        else:
            try:
                supabase.table("deleted_songs").delete().eq("song_id", song["id"]).execute()
            except Exception as cleanup_err:
                logger.error(f"Failed to roll back tombstone for song {song['id']}: {cleanup_err}")
            return jsonify({"error": "Failed to remove song"}), 500