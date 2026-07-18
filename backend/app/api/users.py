from typing import List, Optional
from flask import Blueprint, jsonify, request
from ..services.supabase_service import get_supabase, rows, rows_as
from ..utils.achievement_processor import achievement_processor
from ..utils.helpers import token_required
from ..types import ComparisonResult, FlaskResponse, ScoreEntry, UserRow

bp = Blueprint("users", __name__)

@bp.route("/api/user")
@token_required
def get_user(user_id: str) -> FlaskResponse:
    """
    retrieves current user's information based on their JWT token
    
    returns:
        JSON: User information; id, username, and avatar
    
    authentication:
        requires valid JWT token in the Authorization header
    """
    return get_user_by_id(user_id)

@bp.route("/api/user/<string:user_id>")
@bp.route("/api/users/discord/<string:user_id>")
def get_user_by_id(user_id: str) -> FlaskResponse:
    """
    Retrieves user information based on the provided user ID (Discord ID)

    Args:
        user_id (str): The Discord ID of the user

    Returns:
        JSON: User information; id, username, avatar, permissions, stats, elo

    Note:
        /api/users/discord/<user_id> is a deprecated alias for this endpoint;
        both routes resolve to the same user by Discord ID.
    """
    supabase = get_supabase()
    response = supabase.table("users").select("id, username, avatar, permissions, stats, elo").eq("id", user_id).execute()
    elo_history = supabase.table("elo_history").select("elo, timestamp").eq("user_id", user_id).order("timestamp", desc=False).execute()
    elo_history_data = rows(elo_history.data) if elo_history.data else []

    if response.data:
        user = rows(response.data)[0]
        return jsonify({
            "id": str(user["id"]),
            "username": user["username"],
            "avatar": user["avatar"],
            "permissions": user.get("permissions", {}),
            "stats": user.get("stats", {}),
            "elo": user.get("elo", 1000),
            "elo_history": elo_history_data
        })
    else:
        return jsonify({"error": "User not found"}), 404

@bp.route("/api/user/<string:user_id>/has-scores", methods=["GET"])
def user_has_scores(user_id: str) -> FlaskResponse:
    supabase = get_supabase()
    
    query = supabase.table("users").select("scores").eq("id", user_id)
    result = query.execute()

    if not result.data:
        return jsonify({"error": "User not found"}), 404

    has_scores = rows(result.data)[0].get("scores") is not None
    return jsonify({"has_scores": has_scores})

SLIM_STAT_FIELDS = ("rank", "total_score", "total_scores", "total_fcs", "avg_percent")

@bp.route("/api/all-users")
def get_all_users() -> FlaskResponse:
    """
    retrieves list of all users in the system

    returns:
        JSON: list of user objects; ids, usernames, elo, avatars, and slim stats
    """
    supabase = get_supabase()
    result = supabase.table("users").select("id", "username", "avatar", "stats", "elo").execute()
    users = []
    for user in rows(result.data):
        stats = user.get("stats")
        slim_stats = {k: stats[k] for k in SLIM_STAT_FIELDS if k in stats} if stats else stats
        users.append({
            "id": str(user["id"]),
            "username": user["username"],
            "avatar": user["avatar"],
            "stats": slim_stats,
            "elo": user["elo"]
        })
    return jsonify(users)

@bp.route("/api/users/compare", methods=["POST"])
def compare_users() -> FlaskResponse:
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    user1_id = data.get("user1_id")
    user2_id = data.get("user2_id")

    if not user1_id or not user2_id:
        return jsonify({"error": "Both user IDs are required"}), 400

    user1_data = get_user_scores_by_id(user1_id)
    user2_data = get_user_scores_by_id(user2_id)

    if not user1_data:
        return jsonify({"error": "User 1 not found"}), 404
    if not user2_data:
        return jsonify({"error": "User 2 not found"}), 404

    user1_known_scores = user1_data.get("scores", [])
    user1_unknown_scores = user1_data.get("unknown_scores", [])
    user2_known_scores = user2_data.get("scores", [])
    user2_unknown_scores = user2_data.get("unknown_scores", [])

    if not user1_known_scores:
        return jsonify({"error": "User 1 has no scores"}), 404
    if not user2_known_scores:
        return jsonify({"error": "User 2 has no scores"}), 404

    if user1_unknown_scores:
        user1_scores = user1_known_scores + user1_unknown_scores
    else:
        user1_scores = user1_known_scores

    if user2_unknown_scores:
        user2_scores = user2_known_scores + user2_unknown_scores
    else:
        user2_scores = user2_known_scores

    comparison_results = compare_user_scores(user1_scores, user2_scores)

    if comparison_results is None:
        return jsonify({"error": "User 1 and User 2 have no common scores"}), 404

    return jsonify(comparison_results)

def get_user_scores_by_id(user_id: str) -> Optional[UserRow]:
    supabase = get_supabase()
    response = supabase.table("users").select("scores, unknown_scores").eq("id", user_id).execute()
    return rows_as(response.data, UserRow)[0] if response.data else None

def compare_user_scores(
    user1_scores: List[ScoreEntry], user2_scores: List[ScoreEntry]
) -> Optional[ComparisonResult]:
    user1_dict = {score["identifier"]: score for score in user1_scores}
    user2_dict = {score["identifier"]: score for score in user2_scores}

    common_songs = set(user1_dict.keys()) & set(user2_dict.keys())

    if not common_songs:
        return None

    wins = 0
    losses = 0
    ties = 0
    fc_diff = 0
    total_score_diff = 0
    avg_percent_diff = 0

    for identifier in common_songs:
        score1 = user1_dict[identifier]
        score2 = user2_dict[identifier]

        if score1["score"] > score2["score"]:
            wins += 1
        elif score1["score"] < score2["score"]:
            losses += 1
        else:
            ties += 1

        fc_diff += score1["is_fc"] - score2["is_fc"]
        total_score_diff += score1["score"] - score2["score"]
        avg_percent_diff += score1["percent"] - score2["percent"]

    total_songs = len(common_songs)
    common_songs = list(common_songs)
    
    return {
        "common_songs": common_songs,
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "fc_diff": fc_diff,
        "total_score_diff": total_score_diff,
        "avg_percent_diff": avg_percent_diff / total_songs if total_songs > 0 else 0,
    }

@bp.route("/api/user/<string:user_id>/achievements", methods=["GET"])
def get_user_achievements(user_id: str) -> FlaskResponse:
    """
    Retrieves achievements for a specific user
    
    Args:
        user_id (str): The ID of the user to retrieve achievements for
        
    Returns:
        JSON: List of user achievements with achieved status
    """
    supabase = get_supabase()
    response = supabase.table("users").select("achievements").eq("id", user_id).execute()

    if not response.data:
        return jsonify({"error": "User not found"}), 404

    user_achievements = rows(response.data)[0].get("achievements", {}) or {}

    all_achievements = achievement_processor.serializable_achievements()

    for achievement in all_achievements:
        achievement_id = achievement["id"]
        if achievement_id in user_achievements:
            achievement["achieved"] = True
            achievement["timestamp"] = user_achievements[achievement_id]
        else:
            achievement["achieved"] = False
            achievement["timestamp"] = None

    return jsonify({"achievements": all_achievements})