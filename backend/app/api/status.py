from flask import Blueprint, jsonify, current_app
from ..services.supabase_service import get_supabase
from ..types import FlaskResponse

bp = Blueprint("status", __name__)

@bp.route("/api/hello", methods=["GET"])
def hello() -> FlaskResponse:
    """
    health check endpoint
    
    returns:
        JSON: message indicating the API is functional
    """
    return jsonify({"message": "Functional"})

@bp.route("/api/db-status", methods=["GET"])
def db_status() -> FlaskResponse:
    """
    checks status of the database connection
    
    returns:
        JSON: status of the database connection
    """
    supabase = get_supabase()
    try:
        _ = supabase.table("users").select("id").limit(1).execute()
        return jsonify({"status": "Connected", "message": "Functional"})
    except Exception as e:
        current_app.logger.error(f"Database status check failed: {str(e)}", exc_info=True)
        return jsonify({"status": "Error", "message": "Database connection failed"}), 503