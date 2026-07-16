from flask import Blueprint, jsonify, request
from ..services.supabase_service import get_supabase, rows
from ..types import FlaskResponse

bp = Blueprint("charters", __name__)

@bp.route("/api/charter/<string:charter_id>", methods=["GET"])
def get_charter_by_id(charter_id: str) -> FlaskResponse:
    """
    retrieves charter data by ID

    params:
        charter_id (str): The ID of the charter

    returns:
        JSON: charter data for the given ID
    """
    supabase = get_supabase()
    query = supabase.table("charters").select("id, name, colorized_name, user_id, charter_stats, charter_songs").eq("id", charter_id)
    response = query.execute()
    if response.data:
        return jsonify(response.data[0]), 200
    else:
        return jsonify({"error": "Charter not found"}), 404

@bp.route("/api/all-charter-data", methods=["GET"])
def get_all_charters_data() -> FlaskResponse:
    """
    retrieves all charters with colorized names and user ids

    returns:
        JSON: list of charters with their colorized names and user ids
    """
    supabase = get_supabase()
    query = supabase.table("charters").select("id", "name", "colorized_name", "user_id")
    response = query.execute()

    charters_data = {charter["name"]: {
        "id": str(charter["id"]),
        "name": charter["colorized_name"] or charter["name"],
        "userId": str(charter["user_id"]) if charter["user_id"] else None
    } for charter in rows(response.data)}

    return jsonify(charters_data), 200

@bp.route("/api/charter-colors", methods=["GET"])
def get_charters_colors() -> FlaskResponse:
    """
    retrieves colorized names for a list of charters

    params:
        names (str): comma-separated list of charter names

    returns:
        JSON: dictionary of charter names and their colorized versions
    """
    supabase = get_supabase()
    names = request.args.get("names", "").split(",")
    names = [name.strip() for name in names]

    if not names:
        return jsonify({"error": "No charter names provided"}), 400

    query = supabase.table("charters").select("name", "colorized_name").in_("name", names)
    response = query.execute()

    charters_data = {charter["name"]: charter["colorized_name"] or charter["name"] for charter in rows(response.data)}

    return jsonify(charters_data), 200

@bp.route("/api/user/<string:user_id>/charter", methods=["GET"])
def is_user_charter(user_id: str) -> FlaskResponse:
    """
    retrieves charter data for a user

    params:
        user_id (str): The Discord ID of the user

    returns:
        JSON: charter data for the user
    """
    supabase = get_supabase()
    query = supabase.table("charters").select("id, name, colorized_name, user_id, charter_stats, charter_songs").eq("user_id", user_id)
    response = query.execute()
    return jsonify(response.data if response.data else []), 200
