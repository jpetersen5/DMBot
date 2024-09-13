from flask import Blueprint, jsonify, request, current_app
from ..services.supabase_service import get_supabase
from ..utils.helpers import sanitize_input

bp = Blueprint("charters", __name__)

@bp.route("/api/charter/<string:charter_id>", methods=["GET"])
def get_charter_by_id(charter_id):
    """
    retrieves charter data by ID

    params:
        charter_id (str): The ID of the charter

    returns:
        JSON: charter data for the given ID
    """
    supabase = get_supabase()
    logger = current_app.logger
    try:
        query = supabase.table("charters").select("*").eq("id", charter_id)
        response = query.execute()
        if response.data:
            return jsonify(response.data[0]), 200
        else:
            return jsonify({"error": "Charter not found"}), 404
    except Exception as e:
        logger.error(f"Error fetching charter data: {str(e)}")
        return jsonify({"error": "An error occurred while fetching charter data"}), 500

@bp.route("/api/all-charter-data", methods=["GET"])
def get_all_charters_data():
    """
    retrieves all charters with colorized names and user ids

    returns:
        JSON: list of charters with their colorized names and user ids
    """
    supabase = get_supabase()
    logger = current_app.logger
    try:
        query = supabase.table("charters").select("id", "name", "colorized_name", "user_id")
        response = query.execute()
        
        charters_data = {charter["name"]: {
            "id": str(charter["id"]),
            "name": charter["colorized_name"] or charter["name"],
            "userId": str(charter["user_id"]) if charter["user_id"] else None
        } for charter in response.data}
        
        return jsonify(charters_data), 200
    except Exception as e:
        logger.error(f"Error fetching charter data: {str(e)}")
        return jsonify({"error": "An error occurred while fetching charter data"}), 500

@bp.route("/api/charter-colors", methods=["GET"])
def get_charters_colors():
    """
    retrieves colorized names for a list of charters

    params:
        names (str): comma-separated list of charter names

    returns:
        JSON: dictionary of charter names and their colorized versions
    """
    supabase = get_supabase()
    logger = current_app.logger
    try:
        names = request.args.get("names", "").split(",")
        names = [sanitize_input(name).strip() for name in names]
        
        if not names:
            return jsonify({"error": "No charter names provided"}), 400

        query = supabase.table("charters").select("name", "colorized_name").in_("name", names)
        response = query.execute()
        
        charters_data = {charter["name"]: charter["colorized_name"] or charter["name"] for charter in response.data}
        
        return jsonify(charters_data), 200
    except Exception as e:
        logger.error(f"Error fetching charter data: {str(e)}")
        return jsonify({"error": "An error occurred while fetching charter data"}), 500

@bp.route("/api/user/<string:user_id>/charter", methods=["GET"])
def is_user_charter(user_id):
    """
    retrieves charter data for a user 

    params:
        user_id (str): The Discord ID of the user

    returns:
        JSON: charter data for the user
    """
    supabase = get_supabase()
    logger = current_app.logger
    try:
        query = supabase.table("charters").select("*").eq("user_id", user_id)
        response = query.execute()
        
        if response.data:
            return jsonify(response.data[0]), 200
        else:
            return jsonify({"error": "User is not a charter"}), 404
    except Exception as e:
        logger.error(f"Error fetching charter data: {str(e)}")
        return jsonify({"error": "An error occurred while fetching charter data"}), 500