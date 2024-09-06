from flask import Blueprint, jsonify, request, current_app
from ..services.supabase_service import get_supabase
from ..utils.helpers import allowed_file, get_process_songs_script
from ..config import Config
from ..extensions import socketio, redis
from werkzeug.utils import secure_filename
from datetime import datetime, UTC
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

def sort_and_rank_leaderboard(leaderboard):
    """
    sorts and ranks the leaderboard

    params:
        leaderboard (list): list of leaderboard entries
    
    returns:
        list: sorted and ranked leaderboard
    """
    def sort_key(entry):
        speed = entry.get("speed", 0)
        score = entry.get("score", 0)
        posted = entry.get("posted", "")
        
        if posted:
            try:
                posted_date = datetime.fromisoformat(posted)
            except ValueError:
                posted_date = datetime.now(UTC)
        else:
            posted_date = datetime.now(UTC)

        if speed < 100:
            return (0, speed, score, -posted_date.timestamp())
        else:
            return (1, score, speed, -posted_date.timestamp())

    sorted_leaderboard = sorted(leaderboard, key=sort_key, reverse=True)
    
    for i, entry in enumerate(sorted_leaderboard, 1):
        entry["rank"] = i
    
    return sorted_leaderboard

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
    total_songs = len(result["songs"])
    processed_songs = 0
    leaderboard_updates = []

    logger.info(f"Fetching user data for user {user_id}")
    user_data = supabase.table("users").select("username, scores").eq("id", user_id).execute().data
    username = user_data[0]["username"] if user_data else "Unknown User"

    existing_scores = user_data[0].get("scores", []) if user_data else []
    existing_scores_dict = {}
    if existing_scores:
        existing_scores_dict = {score["identifier"]: score for score in existing_scores}
    else:
        logger.info("No existing scores found for user")

    batch_size = 100
    songs_dict = {}
    song_identifiers = [song["identifier"] for song in result["songs"]]

    logger.info(f"Fetching song data for {len(song_identifiers)} songs")
    for i in range(0, len(song_identifiers), batch_size):
        batch = song_identifiers[i:i+batch_size]
        logger.info(f"Fetching batch of {len(batch)} songs")
        socketio.emit("score_processing_fetching_songs",
                        {"message": f"Fetching user scores for songs {i+1} - {i+len(batch)}"},
                        room=str(user_id))
        batch_songs_info = supabase.table("songs").select("*").in_("md5", batch).execute().data
        songs_dict.update({song["md5"]: song for song in batch_songs_info})

    for song in result["songs"]:
        processed_songs += 1
        song_info = songs_dict.get(song["identifier"])
    
        if song_info:
            for score in song["scores"]:
                if score["instrument"] == 9:  # drums
                    existing_score = existing_scores_dict.get(song["identifier"])
                    play_count = song["play_count"]
                    
                    if existing_score and score["score"] <= existing_score["score"] and play_count <= existing_score.get("play_count", 0):
                        logger.info(f"Score for song {song['identifier']} doesn't need to be updated. Skipping.")
                        continue

                    score_data = {
                        "identifier": song["identifier"],
                        "song_name": song_info["name"] if song_info else f"Unknown Song: {song['identifier']}",
                        "artist": song_info["artist"] if song_info else "Unknown Artist",
                        "percent": score["percent"],
                        "is_fc": score["is_fc"],
                        "speed": score["speed"],
                        "score": score["score"],
                        "play_count": play_count,
                        "posted": datetime.now(UTC).isoformat()
                    }

                    existing_scores_dict[song["identifier"]] = score_data
                    
                    leaderboard = song_info.get("leaderboard", []) or []
                    leaderboard_entry = {
                        "user_id": user_id,
                        "username": username,
                        "score": score["score"],
                        "percent": score["percent"],
                        "is_fc": score["is_fc"],
                        "speed": score["speed"],
                        "play_count": play_count,
                        "posted": score_data["posted"]
                    }
                    
                    user_entry = next((entry for entry in leaderboard if entry["user_id"] == user_id), None)
                    if user_entry:
                        if score["score"] < user_entry["score"]:
                            continue
                        elif score["score"] > user_entry["score"] or play_count > user_entry.get("play_count", 0) or user_entry.get("posted", "") == "":
                            leaderboard.remove(user_entry)
                            leaderboard.append(leaderboard_entry)
                    else:
                        leaderboard.append(leaderboard_entry)
                    
                    leaderboard = sort_and_rank_leaderboard(leaderboard)
                    
                    leaderboard_updates.append({
                        "md5": song["identifier"],
                        "name": song_info["name"],
                        "leaderboard": leaderboard,
                        "last_update": datetime.now(UTC).isoformat()
                    })
        else:
            logger.info(f"Song with identifier {song['identifier']} not found in database. Skipping.")
        
        progress = (processed_songs / total_songs) * 100
        update_processing_status(user_id, "in_progress", progress, processed_songs, total_songs)
        socketio.emit("score_processing_progress",
                        {"progress": progress, "processed": processed_songs, "total": total_songs},
                        room=str(user_id))

    if leaderboard_updates:
        try:
            logger.info(f"Updating leaderboards for {len(leaderboard_updates)} songs")
            socketio.emit("score_processing_uploading",
                        {"message": f"Updating leaderboards for {len(leaderboard_updates)} songs"},
                        room=str(user_id))
            socketio.sleep(1)
            
            for update, i in zip(leaderboard_updates, range(len(leaderboard_updates))):
                progress = (i / len(leaderboard_updates)) * 100
                socketio.emit("score_processing_updating_progress",
                            {"message": f"Updating leaderboard for {i+1} / {len(leaderboard_updates)}: {update['name']}", "progress": progress},
                            room=str(user_id))
                supabase.table("songs").update({
                    "leaderboard": update["leaderboard"],
                    "last_update": update["last_update"]
                }).eq("md5", update["md5"]).execute()
            
            logger.info("Leaderboard updates completed")
        except Exception as e:
            logger.error(f"Error updating leaderboards: {str(e)}")
    
    updated_scores = list(existing_scores_dict.values())
    updated_scores.sort(key=lambda x: x["score"], reverse=True)

    total_scores = 0
    total_fcs = 0
    total_score = 0
    total_percent = 0

    for score in updated_scores:
        total_scores += 1
        total_fcs += 1 if score["is_fc"] else 0
        total_score += score["score"]
        total_percent += score["percent"]
    
    avg_percent = total_percent / total_scores if total_scores > 0 else 0
    user_stats = {
        "total_scores": total_scores,
        "total_fcs": total_fcs,
        "total_score": total_score,
        "avg_percent": avg_percent
    }
    
    logger.info(f"Updating scores for user {user_id}")
    socketio.emit("score_processing_uploading",
                  {"message": f"Updating scores for user {username}"},
                  room=str(user_id))
    supabase.table("users").update({
        "scores": updated_scores,
        "stats": user_stats
    }).eq("id", user_id).execute()

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
                socketio.emit("score_processing_start",
                                room=str(user_id))
                # from process_songs.py, encoded and saved in env
                result = parse_score_data(f) # type: ignore
            
            if not result:
                return jsonify({"error": "Invalid score data"}), 400

            if result["version"] != 20211009:
                return jsonify({"error": "Score data is outdated"}), 400
            
            app = current_app._get_current_object()
            def run_with_app_context(app, result, user_id):
                with app.app_context():
                    process_and_save_scores(result, user_id)
            
            socketio.start_background_task(run_with_app_context, app, result, user_id)
            
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