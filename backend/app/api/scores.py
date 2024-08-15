from flask import Blueprint, jsonify, request, current_app
from ..services.supabase_service import get_supabase
from ..utils.helpers import allowed_file, get_process_songs_script
from ..config import Config
from ..extensions import socketio, redis
from werkzeug.utils import secure_filename
import os
import jwt

bp = Blueprint("scores", __name__)
exec(get_process_songs_script())
MAX_FILE_SIZE = 1024 * 1024 * 1 # 1 MB

def update_processing_status(user_id, status, progress, processed, total):
    """
    updates the processing status in redis
    """
    redis.hset(f"processing_status:{user_id}", mapping={
        "status": status,
        "progress": progress,
        "processed": processed,
        "total": total
    })

def process_and_save_scores(result, user_id):
    """
    processes score data and saves it to the database

    params:
        result (dict): parsed score data
        user_id (str): Discord ID of the user
    
    returns:
        None
    """
    supabase = get_supabase()
    logger = current_app.logger
    user_scores = []
    batch_size = 50
    total_songs = len(result["songs"])
    processed_songs = 0
    leaderboard_updates = []
    
    update_processing_status(user_id, "in_progress", 0, processed_songs, total_songs)

    logger.info(f"Fetching user data for user {user_id}")
    user_data = supabase.table("users").select("username").eq("id", user_id).execute().data
    username = user_data[0]["username"] if user_data else "Unknown User"
    
    for i in range(0, total_songs, batch_size):
        batch = result["songs"][i:i+batch_size]
        song_identifiers = [song["identifier"] for song in batch]
        
        logger.info(f"Fetching information for batch of {len(song_identifiers)} songs")
        songs_info = supabase.table("songs").select("*").in_("md5", song_identifiers).execute().data
        songs_dict = {song["md5"]: song for song in songs_info}

        for song in batch:
            processed_songs += 1
            song_info = songs_dict.get(song["identifier"])
        
            if song_info:
                for score in song["scores"]:
                    if score["instrument"] == 9:  # drums
                        score_data = {
                            "identifier": song["identifier"],
                            "song_name": song_info["name"] if song_info else f"Unknown Song: {song['identifier']}",
                            "artist": song_info["artist"] if song_info else "Unknown Artist",
                            "percent": score["percent"],
                            "is_fc": score["is_fc"],
                            "speed": score["speed"],
                            "score": score["score"]
                        }
                        user_scores.append(score_data)
                        
                        if song_info:
                            leaderboard = song_info.get("leaderboard", [])
                            if leaderboard is None:
                                leaderboard = []

                            leaderboard_entry = {
                                "user_id": user_id,
                                "username": username,
                                "score": score["score"],
                                "percent": score["percent"],
                                "is_fc": score["is_fc"],
                                "speed": score["speed"]
                            }
                            
                            user_entry = next((entry for entry in leaderboard if entry["user_id"] == user_id), None)
                            if user_entry:
                                if score["score"] > user_entry["score"]:
                                    leaderboard.remove(user_entry)
                                    leaderboard.append(leaderboard_entry)
                            else:
                                leaderboard.append(leaderboard_entry)
                            
                            leaderboard.sort(key=lambda x: x["score"], reverse=True)
                            
                            leaderboard_updates.append({
                                "md5": song["identifier"],
                                "leaderboard": leaderboard
                            })
            else:
                logger.info(f"Song with identifier {song['identifier']} not found in database. Skipping.")
        
        if len(leaderboard_updates) >= 50:
            try:
                logger.info(f"Updating leaderboards for {len(leaderboard_updates)} songs")
                for update in leaderboard_updates:
                    supabase.table("songs").update({"leaderboard": update["leaderboard"]}).eq("md5", update["md5"]).execute()
                leaderboard_updates = []
            except Exception as e:
                logger.error(f"Error updating leaderboards: {str(e)}")

        progress = (processed_songs / total_songs) * 100
        update_processing_status(user_id, "in_progress", progress, processed_songs, total_songs)
        socketio.emit("score_processing_progress", 
                      {"progress": progress, "processed": processed_songs, "total": total_songs}, 
                      room=str(user_id))
    
    if leaderboard_updates:
        try:
            logger.info("Updating leaderboards for rest of songs")
            for update in leaderboard_updates:
                supabase.table("songs").update({"leaderboard": update["leaderboard"]}).eq("md5", update["md5"]).execute()
            leaderboard_updates = []
        except Exception as e:
            logger.error(f"Error updating leaderboards: {str(e)}")

    existing_scores = supabase.table("users").select("scores").eq("id", user_id).execute().data
    existing_scores = existing_scores[0]["scores"] if existing_scores and existing_scores[0]["scores"] else []
    
    for new_score in user_scores:
        existing_score = next((score for score in existing_scores if score["identifier"] == new_score["identifier"]), None)
        if existing_score:
            if new_score["score"] > existing_score["score"]:
                existing_scores.remove(existing_score)
                existing_scores.append(new_score)
        else:
            existing_scores.append(new_score)
    
    existing_scores.sort(key=lambda x: x["score"], reverse=True)
    
    logger.info(f"Updating scores for user {user_id}")
    supabase.table("users").update({"scores": existing_scores}).eq("id", user_id).execute()

    update_processing_status(user_id, "completed", 100, total_songs, total_songs)
    socketio.emit("score_processing_complete", 
                  {"message": "Score processing completed"}, 
                  room=str(user_id))
    logger.info("Score processing completed successfully")

@bp.route("/api/upload_scoredata", methods=["POST"])
def upload_scoredata():
    """
    uploads a scoredata.bin file for processing

    params:
        file (file): scoredata.bin file
    
    returns:
        JSON: async message indicating the start of score processing
    """
    auth_header = request.headers.get("Authorization")
    logger = current_app.logger
    if not auth_header:
        return jsonify({"error": "No token provided"}), 401
    try:
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        user_id = payload["user_id"]
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    if file and allowed_file(file.filename):
        if file.filename != "scoredata.bin":
            return jsonify({"error": "File must be named scoredata.bin"}), 400
        if int(request.headers.get("Content-Length", 0)) > MAX_FILE_SIZE:
            return jsonify({"error": "File size exceeds 1 MB limit"}), 400
        
        filename = secure_filename(file.filename)
        upload_folder = Config.UPLOAD_FOLDER
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)
        
        try:
            with open(filepath, "rb") as f:
                # from process_songs.py, encoded and saved in env
                result = parse_score_data(f) # type: ignore
            
            if result["version"] != 20211009:
                return jsonify({"error": "Score data is outdated"}), 400
            
            socketio.start_background_task(process_and_save_scores, result, user_id)
            
            return jsonify({"message": "Score processing started", "total_songs": len(result["songs"])}), 202
        except ValueError as e:
            logger.error(f"Error parsing score data: {str(e)}")
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            logger.error(f"Unexpected error processing score data: {str(e)}", exc_info=True)
            return jsonify({"error": str(e)}), 500
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
    logger.warning("Invalid file in upload request")
    return jsonify({"error": "Invalid file"}), 400

@bp.route("/api/processing_status", methods=["GET"])
def processing_status():
    """
    Retrieves the current processing status for the user

    returns:
        JSON: Current processing status
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "No token provided"}), 401
    try:
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        user_id = payload["user_id"]
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    
    status: dict = redis.hgetall(f"processing_status:{user_id}")
    
    if status:
        return jsonify({
            "status": status.get(b"status", b"unknown").decode("utf-8"),
            "progress": float(status.get(b"progress", 0)),
            "processed": int(status.get(b"processed", 0)),
            "total": int(status.get(b"total", 0))
        }), 200
    else:
        return jsonify({"status": "no_active_processing"}), 404