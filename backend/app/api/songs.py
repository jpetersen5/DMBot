from flask import Blueprint, jsonify, request, current_app
from typing import Any, Dict, List, Optional
from ..services.supabase_service import get_supabase
from ..utils.helpers import sanitize_input

bp = Blueprint("songs", __name__)

ALLOWED_FIELDS = {"name", "artist", "album", "year", "genre", "difficulty", "charter", "song_length"}

@bp.route("/api/songs", methods=["GET"])
def get_songs():
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
    if sort_by == "charter":
        sort_by = "charter_refs"

    query = supabase.table("songs").select("artist", "name", "album", "track", "year", "genre", "difficulty", "song_length", "charter_refs", count="exact")

    if search:
        search = sanitize_input(search)
        if filter:
            filter = sanitize_input(filter)
            if filter == "charter":
                charters_query = (supabase.table("charters").select("name").ilike("name", f"*{search}*"))
                charters_response = charters_query.execute()
                matching_charters = [charter["name"] for charter in charters_response.data]
                
                if matching_charters:
                    charter_array = "{" + ",".join(f'"{charter}"' for charter in matching_charters) + "}"
                    query = query.overlaps("charter_refs", f"{{{charter_array}}}")
                
            elif filter in ["name", "artist", "album", "year", "genre"]:
                query = query.ilike(filter, f"*{search}*")
        else:
            search_fields = ["name", "artist", "album", "year", "genre"]
            or_conditions = [f"{field}.ilike.%{search}%" for field in search_fields]
            charters_query = (supabase.table("charters").select("name").ilike("name", f"*{search}*"))
            charters_response = charters_query.execute()
            matching_charters = [charter["name"] for charter in charters_response.data]

            if matching_charters:
                charter_array = "{" + ",".join(f'"{charter}"' for charter in matching_charters) + "}"
                charter_condition = f"charter_refs.ov.{charter_array}"
                or_conditions.append(charter_condition)
            
            query = query.or_(",".join(or_conditions))

    total_songs = query.execute().count

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
    
    returns:
        JSON: list of related songs
    """
    supabase = get_supabase()
    relation_types = ["album", "artist", "genre", "charter"]
    relation_type = next((param for param in relation_types if param in request.args), None)
    if not relation_type:
        return jsonify({"error": "Invalid relation type"}), 400

    value = request.args.get(relation_type)
    if not value:
        return jsonify({"error": "Missing relation value"}), 400

    query = supabase.table("songs").select("*")

    if relation_type == "charter":
        charter_names = [name.strip() for name in value.split(",")]
        if len(charter_names) == 1:
            query = query.contains("charter_refs", [charter_names[0]])
        else:
            charter_conditions = [
                f"charter_refs.cs.{{'{charter_name}'}}"
                for charter_name in charter_names
            ]
            query = query.or_(",".join(charter_conditions))
    else:
        query = query.eq(relation_type, value)

    if relation_type == "album":
        query = query.order("track", desc=False)
    else:
        query = query.limit(10)
        
    response = query.execute()

    return jsonify({
        "songs": response.data
    })