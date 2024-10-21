from flask import Blueprint, jsonify, request, current_app
import jwt
from ..services.supabase_service import get_supabase
from ..config import Config

bp = Blueprint("users", __name__)

@bp.route("/api/user")
def get_user():
    """
    retrieves current user's information based on their JWT token
    
    returns:
        JSON: User information; id, username, and avatar
    
    authentication:
        requires valid JWT token in the Authorization header
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "No token provided"}), 401
    try:
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        user_id = payload["user_id"]
        return get_user_by_id(user_id)
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/api/user/<string:user_id>")
def get_user_by_id(user_id):
    """
    Retrieves user information based on the provided user ID
    
    Args:
        user_id (str): The Discord ID of the user
    
    Returns:
        JSON: User information; id, username, and avatar
    """
    supabase = get_supabase()
    try:
        response = supabase.table("users").select("*").eq("id", user_id).execute()
        elo_history = supabase.table("elo_history").select("elo, timestamp").eq("user_id", user_id).execute()
        elo_history_data = sorted(elo_history.data, key=lambda x: x["timestamp"], reverse=False) if elo_history.data else []

        if response.data:
            user = response.data[0]
            return jsonify({
                "id": str(user["id"]),
                "username": user["username"],
                "avatar": user["avatar"],
                "permissions": user["permissions"],
                "stats": user["stats"],
                "elo": user["elo"],
                "elo_history": elo_history_data
            })
        else:
            return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@bp.route("/api/user/<string:user_id>/has-scores", methods=["GET"])
def user_has_scores(user_id):
    supabase = get_supabase()
    
    query = supabase.table("users").select("scores").eq("id", user_id)
    result = query.execute()

    if not result.data:
        return jsonify({"error": "User not found"}), 404

    has_scores = result.data[0].get("scores") is not None
    return jsonify({"has_scores": has_scores})

@bp.route("/api/all-users")
def get_all_users():
    """
    retrieves list of all users in the system
    
    returns:
        JSON: list of user objects; ids, usernames, elo, and avatars
    """
    supabase = get_supabase()
    logger = current_app.logger
    try:
        result = supabase.table("users").select("id", "username", "avatar", "stats", "elo").execute()
        users = []
        for user in result.data:
            users.append({
                "id": str(user["id"]),
                "username": user["username"],
                "avatar": user["avatar"],
                "stats": user["stats"],
                "elo": user["elo"]
            })
        return jsonify(users)
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        return jsonify({"error": "An error occurred while fetching users"}), 500

@bp.route("/api/users/compare", methods=["POST"])
def compare_users():
    data = request.json
    user1_id = data.get("user1_id")
    user2_id = data.get("user2_id")

    if not user1_id or not user2_id:
        return jsonify({"error": "Both user IDs are required"}), 400

    try:
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
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
def get_user_scores_by_id(user_id):
    supabase = get_supabase()
    try:
        response = supabase.table("users").select("scores, unknown_scores").eq("id", user_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def compare_user_scores(user1_scores, user2_scores):
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