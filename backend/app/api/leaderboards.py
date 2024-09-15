from flask import Blueprint, jsonify, request
from ..services.supabase_service import get_supabase
from ..utils.helpers import sanitize_input

bp = Blueprint("leaderboard", __name__)

@bp.route("/api/leaderboard/<string:song_id>", methods=["GET"])
def get_leaderboard(song_id):
    supabase = get_supabase()
    
    page = max(1, int(request.args.get("page", 1)))
    per_page = max(10, min(100, int(request.args.get("per_page", 10))))
    sort_by = sanitize_input(request.args.get("sort_by", "rank"))
    sort_order = request.args.get("sort_order", "asc").lower()

    if sort_order not in ["asc", "desc"]:
        sort_order = "asc"

    query = supabase.table("songs").select("leaderboard").eq("id", song_id)
    result = query.execute()

    if not result.data:
        return jsonify({"error": "Song not found"}), 404

    leaderboard = result.data[0].get("leaderboard", [])
    if not leaderboard:
        return jsonify({"error": "Leaderboard is empty"}), 404

    if sort_by == "posted":
        sorted_leaderboard = sorted(leaderboard, key=lambda x: x.get("posted", ""), reverse=(sort_order == "desc"))
    elif sort_by == "play_count":
        sorted_leaderboard = sorted(leaderboard, key=lambda x: x.get("play_count", 0), reverse=(sort_order == "desc"))
    elif sort_by == "rank":
        if "rank" not in leaderboard[0]:
            sorted_leaderboard = sorted(leaderboard, key=lambda x: x["score"], reverse=(sort_order == "desc"))
        else:
            sorted_leaderboard = sorted(leaderboard, key=lambda x: x["rank"], reverse=(sort_order == "desc"))
    else:
        sorted_leaderboard = sorted(leaderboard, key=lambda x: x[sort_by], reverse=(sort_order == "desc"))

    total_entries = len(sorted_leaderboard)
    start_index = (page - 1) * per_page
    end_index = start_index + per_page
    paginated_leaderboard = sorted_leaderboard[start_index:end_index]

    return jsonify({
        "entries": paginated_leaderboard,
        "total": total_entries,
        "page": page,
        "per_page": per_page,
        "sort_by": sort_by,
        "sort_order": sort_order
    })

@bp.route("/api/user/<string:user_id>/scores", methods=["GET"])
def get_user_scores(user_id):
    supabase = get_supabase()
    
    page = max(1, int(request.args.get("page", 1)))
    per_page = max(10, min(100, int(request.args.get("per_page", 10))))
    sort_by = sanitize_input(request.args.get("sort_by", "posted"))
    sort_order = request.args.get("sort_order", "desc").lower()
    show_unknown = request.args.get("unknown", "false").lower() == "true"

    if sort_order not in ["asc", "desc"]:
        sort_order = "desc"

    query = supabase.table("users").select("scores, unknown_scores").eq("id", user_id)
    result = query.execute()

    if not result.data:
        return jsonify({"error": "User not found"}), 404

    if show_unknown:
        scores = result.data[0].get("unknown_scores", [])
    else:
        scores = result.data[0].get("scores", [])

    if not scores:
        return jsonify({"error": "No scores found"}), 404

    if sort_by == "posted":
        sorted_scores = sorted(scores, key=lambda x: x.get("posted", ""), reverse=(sort_order == "desc"))
    elif sort_by == "play_count":
        sorted_scores = sorted(scores, key=lambda x: x.get("play_count", 0), reverse=(sort_order == "desc"))
    else:
        sorted_scores = sorted(scores, key=lambda x: x[sort_by], reverse=(sort_order == "desc"))

    total_scores = len(sorted_scores)
    start_index = (page - 1) * per_page
    end_index = start_index + per_page
    paginated_scores = sorted_scores[start_index:end_index]

    return jsonify({
        "scores": paginated_scores,
        "total": total_scores,
        "page": page,
        "per_page": per_page,
        "sort_by": sort_by,
        "sort_order": sort_order
    })

@bp.route("/api/user/<string:user_id>/stats", methods=["GET"])
def get_user_stats(user_id):
    supabase = get_supabase()
    
    query = supabase.table("users").select("stats").eq("id", user_id)
    result = query.execute()

    if not result.data:
        return jsonify({"error": "User not found"}), 404

    stats = result.data[0].get("stats", {})
    if not stats:
        return jsonify({"error": "No stats found"}), 404

    return jsonify({
        "total_fcs": stats.get("total_fcs", 0),
        "avg_percent": stats.get("avg_percent", 0),
        "total_score": stats.get("total_score", 0),
        "total_scores": stats.get("total_scores", 0)
    })