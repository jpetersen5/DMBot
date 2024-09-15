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
        
        if response.data:
            user = response.data[0]
            return jsonify({
                "id": str(user["id"]),
                "username": user["username"],
                "avatar": user["avatar"],
                "permissions": user["permissions"]
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

@bp.route("/api/users")
def get_users():
    """
    retrieves list of all users in the system
    
    returns:
        JSON: list of user objects; ids, usernames, and avatars
    """
    supabase = get_supabase()
    logger = current_app.logger
    try:
        result = supabase.table("users").select("id", "username", "avatar").execute()
        for user in result.data:
            user["id"] = str(user["id"])
        return jsonify(result.data)
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        return jsonify({"error": "An error occurred while fetching users"}), 500