from flask import Blueprint, jsonify
from ..services.supabase_service import get_supabase

bp = Blueprint("leaderboard", __name__)

@bp.route("/api/leaderboard/<string:song_id>", methods=["GET"])
def get_leaderboard(song_id):
    supabase = get_supabase()

    query = supabase.table("songs_new").select("leaderboard").eq("id", song_id)
    result = query.execute()

    if not result.data:
        return jsonify({"error": "Song not found"}), 404

    leaderboard = result.data[0].get("leaderboard", [])
    if not leaderboard:
        return jsonify({"error": "Leaderboard is empty"}), 404
    
    return jsonify({"leaderboard": leaderboard})

@bp.route("/api/user/<string:user_id>/scores", methods=["GET"])
def get_user_scores(user_id):
    supabase = get_supabase()

    query = supabase.table("users").select("scores, unknown_scores").eq("id", user_id)
    result = query.execute()

    if not result.data:
        return jsonify({"error": "User not found"}), 404

    scores, unknown_scores = result.data[0].get("scores", []), result.data[0].get("unknown_scores", [])

    return jsonify({"scores": scores, "unknown_scores": unknown_scores})

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