from flask import Blueprint, jsonify, request, redirect, session, current_app
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import jwt
import secrets
import datetime
import requests
from postgrest.exceptions import APIError
from ..services.supabase_service import get_supabase
from ..config import Config

bp = Blueprint("auth", __name__)
limiter = Limiter(get_remote_address, app=current_app, default_limits=[])

@bp.route("/api/auth/login")
def login():
    """
    initiates Discord OAuth2 login process
    
    returns:
        redirect to the Discord authorization page
    """
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state
    api = Config.DISCORD_API_ENDPOINT
    id = Config.DISCORD_CLIENT_ID
    redirect_uri = Config.DISCORD_REDIRECT_URI
    return redirect(
        f"{api}/oauth2/authorize?client_id={id}&redirect_uri={redirect_uri}"
        f"&response_type=code&scope=identify&state={state}"
    )

@bp.route("/api/auth/callback")
@limiter.limit("5 per minute")
def callback():
    """
    handles OAuth2 callback from Discord, creates or updates user data,
    issues a JWT token for authentication
    
    params:
        code (str): The authorization code returned by Discord
    
    returns:
        redirect to the frontend with the JWT token
    """
    supabase = get_supabase()
    logger = current_app.logger
    state = request.args.get("state")
    if not state or state != session.get("oauth_state"):
        return jsonify({"error": "Invalid OAuth state"}), 400
    
    api = Config.DISCORD_API_ENDPOINT
    try:
        code = request.args.get("code")
        data = {
            "client_id": Config.DISCORD_CLIENT_ID,
            "client_secret": Config.DISCORD_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": Config.DISCORD_REDIRECT_URI
        }
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        response = requests.post(f"{api}/oauth2/token", data=data, headers=headers)
        response.raise_for_status()
        credentials = response.json()
        access_token = credentials["access_token"]

        user_response = requests.get(f"{api}/users/@me", headers={
            "Authorization": f"Bearer {access_token}"
        })
        user_response.raise_for_status()
        user_data: dict = user_response.json()

        user_data = {
            "id": user_data["id"],
            "username": user_data["username"],
            "avatar": user_data.get("avatar", ""),
            "last_login": datetime.datetime.now(datetime.UTC).isoformat()
        }

        result = supabase.table("users").upsert(user_data).execute()

        if not result.data:
            raise APIError("Failed to upsert user data")
    
        token: str = jwt.encode({
            "user_id": user_data["id"],
            "exp": datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30)
        }, Config.JWT_SECRET, algorithm="HS256")
    
        return redirect(f"{Config.FRONTEND_URL}/auth?token={token}")
    
    except requests.RequestException as e:
       if e.response.status_code == 429:
           retry_after = int(e.response.headers.get("Retry-After", "unknown"))
           return jsonify({"error": f"Rate limited by Discord. Please try again after {retry_after // 60 // 60}:{retry_after // 60 % 60}:{retry_after % 60}."}), 429
       else:
           logger.error(f"Error during Discord API request: {str(e)}")
           return jsonify({"error": "Failed to authenticate with Discord"}), 500
    except APIError as e:
        logger.error(f"Supabase API error: {str(e)}")
        return jsonify({"error": "Database operation failed"}), 500
    except Exception as e:
        logger.error(f"Unexpected error in callback: {str(e)}")
        return jsonify({"error": "An unexpected error occurred"}), 500

@bp.route("/api/auth/logout")
def logout():
    """
    log out the current user by clearing their session
    
    returns:
        JSON: message confirming successful logout
    """
    session.pop("user", None)
    return jsonify({"message": "Logged out successfully"})