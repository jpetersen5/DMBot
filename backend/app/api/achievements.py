from flask import Blueprint, jsonify
from ..utils.achievement_processor import achievement_processor
from ..types import FlaskResponse

bp = Blueprint("achievements", __name__)

@bp.route("/api/achievements", methods=["GET"])
def get_all_achievements() -> FlaskResponse:
    """
    Retrieve the complete list of all possible achievements

    Returns:
        JSON: Complete achievement definitions
    """
    return jsonify({
        "achievements": achievement_processor.serializable_achievements()
    })
