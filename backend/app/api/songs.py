from flask import Blueprint, jsonify, request, current_app
from typing import Any, Dict, List, Optional
from postgrest.base_request_builder import BaseFilterRequestBuilder
from ..services.supabase_service import get_supabase
from ..utils.helpers import sanitize_input

bp = Blueprint("songs", __name__)

ALLOWED_FIELDS = {"name", "artist", "album", "year", "genre", "difficulty", "charter", "song_length"}

# @bp.route("/api/songs", methods=["GET"])
# def get_songs():
#     """
#     retrieves paginated, sorted, and optionally filtered list of songs
    
#     params:
#         page (int): page number (default: 1)
#         per_page (int): items per page (default: 20, min: 10, max: 100)
#         sort_by (str): field to sort by (default: "name")
#         sort_order (str): sort order "asc" or "desc" (default: "asc")
#         search (str): search term to filter songs
#         filter (str): field to apply the search filter
    
#     returns:
#         JSON: Paginated list of songs and metadata.
#     """
#     supabase = get_supabase()
#     logger = current_app.logger
#     try:
#         page = max(1, request.args.get("page", 1, type=int))
#         per_page = min(max(request.args.get("per_page", 20, type=int), 10), 100)
#         sort_by = sanitize_input(request.args.get("sort_by", "name"))
#         sort_order = "desc" if request.args.get("sort_order", "asc").lower() == "desc" else "asc"
#         search = sanitize_input(request.args.get("search", ""))
#         filter_field = sanitize_input(request.args.get("filter", ""))

#         if sort_by not in ALLOWED_FIELDS:
#             sort_by = "name"
#         if filter_field and filter_field not in ALLOWED_FIELDS:
#             filter_field = ""
        
#         start = (page - 1) * per_page
#         end = start + per_page - 1

#         logger.info(f"Querying songs with parameters: page={page}, per_page={per_page}, sort_by={sort_by}, sort_order={sort_order}, search={search}, filter={filter_field}")

#         query = supabase.table("songs").select("*", count="exact")
        
#         if search:
#             search_lower = search.lower()
#             if filter_field == "charter":
#                 charters_query = supabase.table("charters").select("name").ilike("name", f"%{search_lower}%")
#                 charters_response = charters_query.execute()
#                 matching_charters = [charter["name"] for charter in charters_response.data]
                
#                 if matching_charters:
#                     query = query.filter("charter_refs", "cs", "{" + ",".join(matching_charters) + "}")
#                 else:
#                     return jsonify({
#                         "songs": [],
#                         "total": 0,
#                         "page": page,
#                         "per_page": per_page,
#                         "sort_by": sort_by,
#                         "sort_order": sort_order
#                     }), 200
#             elif filter_field:
#                 query = query.ilike(filter_field, f"%{search}%")
#             else:
#                 search_fields = ["name", "artist", "album", "year", "genre"]
#                 #or_conditions = [f"{field}.ilike.%{search}%" for field in search_fields]
#                 or_conditions = [f"textSearch({field}, '{search}')" for field in search_fields]
#                 charters_query = supabase.table("charters").select("name").ilike("name", f"%{search_lower}%")
#                 charters_response = charters_query.execute()
#                 matching_charters = [charter["name"] for charter in charters_response.data]
#                 if matching_charters:
#                     charter_conditions = [f"charter_refs.cs.{{'{charter}'}}" for charter in matching_charters]
#                     query = query.or_(",".join(charter_conditions))
                
#                 query = query.or_(",".join(or_conditions))

#         try:
#             count_response = query.execute()
#             total_songs = count_response.count
#         except APIError as e:
#             logger.error(f"Error executing count query: {str(e)}")
#             total_songs = 0

#         query = query.order(sort_by, desc=(sort_order == "desc")).range(start, end)
        
#         try:
#             response = query.execute()
#             songs: list[dict] = response.data
#         except APIError as e:
#             logger.error(f"Error executing main query: {str(e)}")
#             songs: list[dict] = []

#         charter_names = set()
#         for song in songs:
#             if song.get("charter_refs"):
#                 charter_names.update(song.get("charter_refs", []))
#             else:
#                 logger.warning(f"Song {song.get('id', 'unknown')} has no charter_refs")

#         if charter_names:
#             try:
#                 charters_query = supabase.table("charters").select("name", "colorized_name").in_("name", list(charter_names))
#                 charters_response = charters_query.execute()
#                 charters_data = {charter["name"]: charter["colorized_name"] for charter in charters_response.data if charter["colorized_name"]}
#             except APIError as e:
#                 logger.error(f"Error fetching charter data: {str(e)}")
#                 charters_data = {}
#         else:
#             charters_data = {}

#         for song in songs:
#             if song.get("charter_refs"):
#                 song["charters"] = [charters_data.get(charter, charter) for charter in song.get("charter_refs", [])]
#             else:
#                 song["charters"] = []
#                 logger.warning(f"Song {song.get('id', 'unknown')} has no charters")

#         logger.info(f"Total songs matching query: {total_songs}")
#         logger.info(f"Retrieved {len(songs)} songs")

#         return jsonify({
#             "songs": songs,
#             "total": total_songs,
#             "page": page,
#             "per_page": per_page,
#             "sort_by": sort_by,
#             "sort_order": sort_order
#         }), 200
#     except APIError as e:
#         logger.error(f"Supabase API error: {str(e)}")
#         return jsonify({"error": str(e)}), 400
#     except Exception as e:
#         logger.exception("An unexpected error occurred")
#         return jsonify({"error": str(e)}), 500

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
                    charter_array = "\\{" + ",".join(f'"{charter}"' for charter in matching_charters) + "\\}"
                    query = query.contains("charter_refs", charter_array)
                    logger.info(f"Filtering by charter: {charter_array}")
                
            elif filter in ["name", "artist", "album", "year", "genre"]:
                query = query.ilike(filter, f"*{search}*")
        else:
            search_fields = ["name", "artist", "album", "year", "genre"]
            or_conditions = [f"{field}.ilike.%{search}%" for field in search_fields]
            
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