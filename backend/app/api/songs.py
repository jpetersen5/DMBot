from flask import Blueprint, jsonify, request, current_app
from typing import Any, Dict, List, Optional
from ..services.supabase_service import get_supabase
from ..utils.helpers import sanitize_input

bp = Blueprint("songs", __name__)

ALLOWED_FIELDS = {"name", "artist", "album", "year", "genre", "difficulty", "charter", "song_length"}
ALLOWED_FILTERS = {"name", "artist", "album", "year", "genre", "charter"}

@bp.route("/api/songs/<int:song_id>", methods=["GET"])
def get_song(song_id):
    """
    retrieves a single song from the database by its ID

    params:
        song_id (int): ID of the song to retrieve

    returns:
        JSON: song details
    """
    supabase = get_supabase()
    
    query = supabase.table("songs").select("*").eq("id", song_id)
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
        sort_by (str): field to sort by (default "name")
        sort_order (str): sort order ("asc" or "desc", default "asc")
        search (str): search query (default None)
        filter (str): field to filter by (default None)

    returns:
        JSON: list of songs, total count, page number, songs per page, sort field, and sort order
    """
    supabase = get_supabase()
    logger = current_app.logger
    
    page: int = max(1, int(request.args.get("page", 1)))
    per_page: int = max(10, min(100, int(request.args.get("per_page", 20))))
    sort_by: str = sanitize_input(request.args.get("sort_by", "name"))
    sort_order: str = request.args.get("sort_order", "asc").lower()
    search: Optional[str] = request.args.get("search")
    filter: Optional[str] = request.args.get("filter")

    if sort_order not in ["asc", "desc"]:
        sort_order = "asc"
    if sort_by not in ALLOWED_FIELDS:
        sort_by = "name"
    if filter and filter not in ALLOWED_FILTERS:
        filter = None
    if sort_by == "charter":
        sort_by = "charter_refs"

    query = supabase.table("songs").select("id", "artist", "name", "album", "track", "year", "genre", "difficulty", "song_length", "charter_refs")
    count_query = supabase.table("songs").select("id", count="exact")

    if search:
        search_terms = sanitize_input(search).split()
        search_fields = ["name", "artist", "album", "year", "genre"] if not filter else [filter]
        
        for term in search_terms:
            term_filter = None
            for field in search_fields:
                if field != "charter":
                    condition = f"{field}.ilike.%{term}%"
                    term_filter = condition if term_filter is None else f"{term_filter},{condition}"
            
            charters_query = supabase.table("charters").select("name").ilike("name", f"*{term}*")
            charters_response = charters_query.execute()
            matching_charters = [charter["name"] for charter in charters_response.data]
            if matching_charters:
                charter_condition = f"charter_refs.ov.{{{','.join(matching_charters)}}}"
                term_filter = charter_condition if term_filter is None else f"{term_filter},{charter_condition}"
            
            if term_filter:
                query = query.or_(term_filter)
                count_query = count_query.or_(term_filter)

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

    query = supabase.table("songs").select("id", "artist", "name", "album", "track", "year", "genre", "difficulty", "song_length", "charter_refs")
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
        query = query.order("name", desc=False)

    query = query.range((page - 1) * per_page, page * per_page - 1)
        
    response = query.execute()

    return jsonify({
        "songs": response.data,
        "total": total_count,
        "page": page,
        "per_page": per_page
    })