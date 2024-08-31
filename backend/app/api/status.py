from flask import Blueprint, jsonify
from ..services.supabase_service import get_supabase
import os

bp = Blueprint("status", __name__)

@bp.route("/api/hello", methods=["GET"])
def hello():
    """
    health check endpoint
    
    returns:
        JSON: message indicating the API is functional
    """
    return jsonify({"message": "Functional"})

@bp.route("/api/db-status", methods=["GET"])
def db_status():
    """
    checks status of the database connection
    
    returns:
        JSON: status of the database connection
    """
    supabase = get_supabase()
    try:
        result = supabase.table("users").select("id").limit(1).execute()
        return jsonify({"status": "Connected", "message": "Functional"})
    except Exception as e:
        return jsonify({"status": "Error", "message": str(e)})