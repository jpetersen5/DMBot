from flask import Blueprint, jsonify
from ..utils.achievement_processor import AchievementProcessor

bp = Blueprint("achievements", __name__)

@bp.route("/api/achievements", methods=["GET"])
def get_all_achievements():
    """
    Retrieve the complete list of all possible achievements
    
    Returns:
        JSON: Complete achievement definitions
    """
    achievement_processor = AchievementProcessor()
    
    achievements = [
        {
            key: value for key, value in achievement.items() 
            if key != "check_function" and not key.startswith("_")
        }
        for achievement in achievement_processor.achievements
    ]
    
    return jsonify({
        "achievements": achievements
    }) 