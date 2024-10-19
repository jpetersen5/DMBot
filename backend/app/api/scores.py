from flask import Blueprint, jsonify, request, current_app
from ..services.supabase_service import get_supabase
from ..utils.helpers import allowed_file, get_process_songs_script
from ..config import Config
from ..extensions import socketio, redis
from werkzeug.utils import secure_filename
from datetime import datetime, UTC
import os
import re
import jwt

bp = Blueprint("scores", __name__)
exec(get_process_songs_script())
MAX_SCOREDATA_FILE_SIZE = 1024 * 1024 * 1 # 1 MB
MAX_SONGCACHE_FILE_SIZE = 1024 * 1024 * 10 # 10 MB

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
        existing_scores = []
        logger.info("No existing scores found for user")

    existing_unknown_scores = user_data[0].get("unknown_scores", []) if user_data else []
    existing_unknown_scores_dict = {}
    if existing_unknown_scores:
        existing_unknown_scores_dict = {score["identifier"]: score for score in existing_unknown_scores}
    else:
        existing_unknown_scores = []
        logger.info("No existing unknown scores found for user")

    batch_size = 500
    songs_dict = {}
    song_identifiers = [song["identifier"] for song in result["songs"]]

    logger.info(f"Fetching song data for {len(song_identifiers)} songs")
    for i in range(0, len(song_identifiers), batch_size):
        batch = song_identifiers[i:i+batch_size]
        logger.info(f"Fetching batch of {len(batch)} songs")
        socketio.emit("score_processing_fetching_songs",
                        {"message": f"Fetching user scores for songs {i+1} - {i+len(batch)}"},
                        room=str(user_id))
        batch_songs_info = supabase.table("songs_new").select("*").in_("md5", batch).execute().data
        songs_dict.update({song["md5"]: song for song in batch_songs_info})

    newly_known_scores = []
    remaining_unknown_scores = []

    for unknown_score in existing_unknown_scores:
        song_info = songs_dict.get(unknown_score["identifier"])
        if song_info:
            score_data = {
                "identifier": unknown_score["identifier"],
                "song_name": song_info["name"],
                "artist": song_info["artist"],
                "percent": unknown_score["percent"],
                "is_fc": unknown_score["is_fc"],
                "speed": unknown_score["speed"],
                "score": unknown_score["score"],
                "play_count": unknown_score["play_count"],
                "posted": datetime.now(UTC).isoformat()
            }
            newly_known_scores.append(score_data)
            
            leaderboard_entry = {
                "user_id": user_id,
                "username": username,
                "score": unknown_score["score"],
                "percent": unknown_score["percent"],
                "is_fc": unknown_score["is_fc"],
                "speed": unknown_score["speed"],
                "play_count": unknown_score["play_count"],
                "posted": datetime.now(UTC).isoformat()
            }
            leaderboard = song_info.get("leaderboard", []) or []
            leaderboard.append(leaderboard_entry)
            leaderboard = sort_and_rank_leaderboard(leaderboard)
            
            leaderboard_updates.append({
                "md5": unknown_score["identifier"],
                "name": song_info["name"],
                "leaderboard": leaderboard,
                "last_update": datetime.now(UTC).isoformat()
            })
        else:
            remaining_unknown_scores.append(unknown_score)

    if existing_scores:
        existing_scores.extend(newly_known_scores)
    else:
        existing_scores = newly_known_scores
    existing_unknown_scores = remaining_unknown_scores

    if existing_scores:
        existing_scores_dict = {score["identifier"]: score for score in existing_scores}
    else:
        existing_scores_dict = {}
    if existing_unknown_scores:
        existing_unknown_scores_dict = {score["identifier"]: score for score in existing_unknown_scores}
    else:
        existing_unknown_scores_dict = {}

    for song in result["songs"]:
        processed_songs += 1
        song_info = songs_dict.get(song["identifier"], None)
    
        for score in song["scores"]:
            if score["instrument"] == 9:  # drums
                play_count = song["play_count"]
                score_data = {
                    "identifier": song["identifier"],
                    "song_name": song_info["name"] if song_info else f"Unknown Song: {song['identifier']}",
                    "artist": song_info["artist"] if song_info else "Unknown Artist",
                    "percent": score["percent"],
                    "is_fc": score["is_fc"],
                    "speed": score["speed"],
                    "score": score["score"],
                    "play_count": play_count,
                    "posted": datetime.now(UTC).isoformat(),
                    "rank": None
                }

                if song_info:
                    leaderboard = song_info.get("leaderboard", []) or []
                    user_entry = next((entry for entry in leaderboard if entry["user_id"] == user_id), None)
                
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
                    
                    if user_entry:
                        if score["score"] < user_entry["score"]:
                            logger.info(f"Score for song {song['identifier']} doesn't need to be updated. Skipping.")
                            continue
                        elif score["score"] == user_entry["score"] and play_count <= user_entry.get("play_count", 0):
                            logger.info(f"Score for song {song['identifier']} doesn't need to be updated. Skipping.")
                            continue
                        elif score["score"] > user_entry["score"] or play_count > user_entry.get("play_count", 0) or user_entry.get("posted", "") == "":
                            leaderboard.remove(user_entry)
                            leaderboard.append(leaderboard_entry)
                    else:
                        leaderboard.append(leaderboard_entry)
                    
                    leaderboard = sort_and_rank_leaderboard(leaderboard)
                    
                    user_rank = next((entry["rank"] for entry in leaderboard if entry["user_id"] == user_id), None)
                    score_data["rank"] = user_rank
                    existing_scores_dict[song["identifier"]] = score_data
                    
                    leaderboard_updates.append({
                        "md5": song["identifier"],
                        "name": song_info["name"],
                        "leaderboard": leaderboard,
                        "last_update": datetime.now(UTC).isoformat()
                    })
                else:
                    existing_unknown_score = existing_unknown_scores_dict.get(song["identifier"], None)
                    if existing_unknown_score and score["score"] <= existing_unknown_score["score"]:
                        logger.info(f"Score for unknown song {song['identifier']} doesn't need to be updated. Skipping.")
                        continue
                    elif existing_unknown_score and score["score"] == existing_unknown_score["score"] and play_count <= existing_unknown_score.get("play_count", 0):
                        logger.info(f"Score for unknown song {song['identifier']} doesn't need to be updated. Skipping.")
                        continue

                    existing_unknown_scores_dict[song["identifier"]] = score_data
        
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
                supabase.table("songs_new").update({
                    "leaderboard": update["leaderboard"],
                    "last_update": update["last_update"]
                }).eq("md5", update["md5"]).execute()
            
            logger.info("Leaderboard updates completed")
        except Exception as e:
            logger.error(f"Error updating leaderboards: {str(e)}")
    
    updated_scores = list(existing_scores_dict.values())
    updated_scores.sort(key=lambda x: x["score"], reverse=True)

    updated_unknown_scores = list(existing_unknown_scores_dict.values())
    updated_unknown_scores.sort(key=lambda x: x["score"], reverse=True)
    
    logger.info(f"Updating scores for user {user_id}")
    socketio.emit("score_processing_uploading",
                  {"message": f"Updating scores for user {username}"},
                  room=str(user_id))
    supabase.table("users").update({
        "scores": updated_scores,
        "unknown_scores": updated_unknown_scores
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
        if int(request.headers.get("Content-Length", 0)) > MAX_SCOREDATA_FILE_SIZE:
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

def find_file_path_for_md5(file_content, md5_hex, search_back=1024):
    """
    Searches for the specified MD5 hash in the binary file and extracts the relevant file path.
    """
    md5_bytes = bytes.fromhex(md5_hex)
    start = 0
    while True:
        index = file_content.find(md5_bytes, start)
        if index == -1:
            return None  # No more occurrences found

        start_search = max(index - search_back, 0)
        pre_data = file_content[start_search:index]

        decoded_string = pre_data.decode("utf-8", errors="ignore")

        paths = [m.start() for m in re.finditer(r":\\", decoded_string, re.IGNORECASE)]
        notes_mid_matches = [m.start() for m in re.finditer("notes.", decoded_string)]

        if paths and notes_mid_matches:
            last_path_start = paths[-1]
            last_notes_mid_index = notes_mid_matches[-1]

            path_end_index = last_notes_mid_index - 17
            if path_end_index < last_path_start:
                return None

            file_path = decoded_string[last_path_start:path_end_index]
            return file_path

        start = index + len(md5_bytes)

@bp.route("/api/upload_songcache", methods=["POST"])
def upload_songcache():
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
        if file.filename != "songcache.bin":
            return jsonify({"error": "File must be named songcache.bin"}), 400
        if int(request.headers.get("Content-Length", 0)) > MAX_SONGCACHE_FILE_SIZE:
            return jsonify({"error": "File size exceeds 10 MB limit"}), 400
        
        filename = secure_filename(file.filename)
        upload_folder = Config.UPLOAD_FOLDER
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)
        
        try:
            supabase = get_supabase()
            user_data = supabase.table("users").select("unknown_scores").eq("id", user_id).execute().data
            unknown_scores = user_data[0].get("unknown_scores", []) if user_data else []
            
            with open(filepath, "rb") as f:
                file_content = f.read()
            
            updated_scores = []
            for score in unknown_scores:
                file_path = find_file_path_for_md5(file_content, score["identifier"])
                if file_path:
                    score["filepath"] = file_path
                updated_scores.append(score)
            
            supabase.table("users").update({"unknown_scores": updated_scores}).eq("id", user_id).execute()
            
            return jsonify({"message": "Songcache processed successfully", "updated_scores": len(updated_scores)}), 200
        except Exception as e:
            logger.error(f"Error processing songcache: {str(e)}", exc_info=True)
            return jsonify({"error": str(e)}), 500
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
    
    logger.warning("Invalid file in upload request")
    return jsonify({"error": "Invalid file"}), 400