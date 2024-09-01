from flask import Blueprint, jsonify, request
from ..services.supabase_service import get_supabase
from ..utils.helpers import sanitize_input

bp = Blueprint("leaderboard", __name__)

@bp.route("/api/leaderboard/<string:song_id>", methods=["GET"])
def get_leaderboard(song_id):
    supabase = get_supabase()
    
    page = max(1, int(request.args.get("page", 1)))
    per_page = max(10, min(100, int(request.args.get("per_page", 10))))
    sort_by = sanitize_input(request.args.get("sort_by", "score"))
    sort_order = request.args.get("sort_order", "desc").lower()

    if sort_order not in ["asc", "desc"]:
        sort_order = "desc"

    query = supabase.table("songs").select("leaderboard").eq("id", song_id)
    result = query.execute()

    if not result.data:
        return jsonify({"error": "Song not found"}), 404

    leaderboard = result.data[0].get("leaderboard", [])
    if not leaderboard:
        return jsonify({"error": "Leaderboard is empty"}), 404
    total_entries = len(leaderboard)

    leaderboard.sort(key=lambda x: x[sort_by], reverse=(sort_order == "desc"))

    start_index = (page - 1) * per_page
    end_index = start_index + per_page
    paginated_leaderboard = leaderboard[start_index:end_index]

    return jsonify({
        "entries": paginated_leaderboard,
        "total": total_entries,
        "page": page,
        "per_page": per_page,
        "sort_by": sort_by,
        "sort_order": sort_order
    })