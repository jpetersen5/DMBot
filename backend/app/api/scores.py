from flask import Blueprint, jsonify, request, current_app
from ..services.supabase_service import get_supabase, rows
from ..utils.helpers import allowed_file, get_process_songs_script
from ..extensions import socketio, redis
from datetime import datetime, UTC
import re
from typing import Any, BinaryIO, Callable, Dict, List, Optional
from ..utils.achievement_processor import achievement_processor
from ..utils.helpers import token_required
from ..types import FlaskResponse, LeaderboardEntry

bp = Blueprint("scores", __name__)

# parse_score_data is a proprietary parser injected into module globals at import
# time by exec()-ing the base64 script from PROCESS_SONGS_SCRIPT (see helpers.py).
# Declare its shape so downstream `result[...]` access is typed instead of Unknown.
parse_score_data: Callable[[BinaryIO], Dict[str, Any]]
exec(get_process_songs_script())

def update_processing_status(
    user_id: str, status: str, progress: float, processed: int, total: int
) -> None:
    """
    updates the processing status in redis
    """
    redis.hset(f"processing_status:{user_id}", mapping={
        "status": status,
        "progress": progress,
        "processed": processed,
        "total": total
    })

def sort_and_rank_leaderboard(leaderboard: List[LeaderboardEntry]) -> List[LeaderboardEntry]:
    """
    sorts and ranks the leaderboard

    params:
        leaderboard (list): list of leaderboard entries

    returns:
        list: sorted and ranked leaderboard
    """
    def sort_key(entry: LeaderboardEntry) -> tuple:
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

def process_and_save_scores(result: Dict[str, Any], user_id: str) -> None:
    """
    Process scoredata.bin content and save scores to the database
    
    Args:
        result: Result from PSDF.parse()
        user_id: Discord ID of the user
        
    Returns:
        count: Number of scores processed
    """
    supabase = get_supabase()
    logger = current_app.logger
    total_songs = len(result["songs"])
    processed_songs = 0
    leaderboard_updates = []

    logger.info(f"Fetching user data for user {user_id}")
    user_data = rows(supabase.table("users").select("username, scores, achievements").eq("id", user_id).execute().data)
    username = user_data[0]["username"] if user_data else "Unknown User"

    existing_scores = user_data[0].get("scores", []) if user_data else []
    existing_scores_dict = {}
    if existing_scores:
        existing_scores_dict = {score["identifier"]: score for score in existing_scores if "identifier" in score}
    else:
        existing_scores = []
        logger.info("No existing scores found for user")

    existing_unknown_scores = user_data[0].get("unknown_scores", []) if user_data else []
    existing_unknown_scores_dict = {}
    if existing_unknown_scores:
        existing_unknown_scores_dict = {score["identifier"]: score for score in existing_unknown_scores if "identifier" in score}
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
                        to=str(user_id))
        batch_songs_info = rows(supabase.table("songs_new").select("*").in_("md5", batch).execute().data)
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
        existing_scores_dict = {score["identifier"]: score for score in existing_scores if "identifier" in score}
    else:
        existing_scores_dict = {}
    if existing_unknown_scores:
        existing_unknown_scores_dict = {score["identifier"]: score for score in existing_unknown_scores if "identifier" in score}
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
                    "charter_refs": song_info["charter_refs"] if song_info else [],
                    "percent": score["percent"],
                    "is_fc": score["is_fc"],
                    "speed": score["speed"],
                    "score": score["score"],
                    "play_count": play_count,
                    "posted": datetime.now(UTC).isoformat(),
                    "rank": None
                }

                if song_info:
                    # Get the user's existing score for this song, if any
                    existing_user_score = existing_scores_dict.get(song["identifier"], None)

                    # Add charter refs if missing in existing score (do this early)
                    if existing_user_score and "charter_refs" not in existing_user_score:
                        existing_user_score["charter_refs"] = song_info.get("charter_refs", []) # Use .get for safety

                    # Prepare the incoming score data
                    incoming_score_data = {
                        "identifier": song["identifier"],
                        "song_name": song_info["name"],
                        "artist": song_info["artist"],
                        "charter_refs": song_info.get("charter_refs", []),
                        "percent": score["percent"],
                        "is_fc": score["is_fc"],
                        "speed": score["speed"],
                        "score": score["score"],
                        "play_count": play_count,
                        "posted": datetime.now(UTC).isoformat(),
                        "rank": None
                    }
                    
                    # Decide if the user's personal score list needs updating
                    should_update_user_score = False
                    if not existing_user_score:
                        should_update_user_score = True
                        logger.info(f"New score for known song {song['identifier']} being added to user's list.")
                    elif incoming_score_data["score"] > existing_user_score["score"]:
                        should_update_user_score = True
                        logger.info(f"Higher score {incoming_score_data['score']} > {existing_user_score['score']} for song {song['identifier']} found. Updating user's list.")
                    elif incoming_score_data["score"] == existing_user_score["score"] and incoming_score_data["play_count"] > existing_user_score.get("play_count", 0):
                         should_update_user_score = True
                         logger.info(f"Same score but higher playcount {incoming_score_data['play_count']} > {existing_user_score.get('play_count', 0)} for song {song['identifier']} found. Updating user's list.")
                         
                    if should_update_user_score:
                       # Update user's personal score list
                       # Ensure charter_refs are preserved/added if the score is being overwritten
                       incoming_score_data["charter_refs"] = (existing_user_score.get("charter_refs") 
                                                             if existing_user_score and "charter_refs" in existing_user_score 
                                                             else song_info.get("charter_refs", []))
                       existing_scores_dict[song["identifier"]] = incoming_score_data

                    leaderboard = song_info.get("leaderboard", []) or []
                    user_entry_on_leaderboard = next((entry for entry in leaderboard if entry["user_id"] == user_id), None)

                    # Use the incoming score data to create the potential leaderboard entry
                    leaderboard_entry_from_incoming = {
                        "user_id": user_id,
                        "username": username,
                        "score": incoming_score_data["score"],
                        "percent": incoming_score_data["percent"],
                        "is_fc": incoming_score_data["is_fc"],
                        "speed": incoming_score_data["speed"],
                        "play_count": incoming_score_data["play_count"],
                        "posted": incoming_score_data["posted"]
                    }

                    should_update_leaderboard = False
                    if not user_entry_on_leaderboard:
                        should_update_leaderboard = True
                        logger.info(f"User {user_id} not on leaderboard for {song['identifier']}. Adding.")
                    # Compare incoming score with the one on the leaderboard
                    elif leaderboard_entry_from_incoming["score"] > user_entry_on_leaderboard["score"]:
                        should_update_leaderboard = True
                        logger.info(f"Higher score {leaderboard_entry_from_incoming['score']} > {user_entry_on_leaderboard['score']} for song {song['identifier']} found. Updating leaderboard.")
                    elif leaderboard_entry_from_incoming["score"] == user_entry_on_leaderboard["score"] and leaderboard_entry_from_incoming["play_count"] > user_entry_on_leaderboard.get("play_count", 0):
                        should_update_leaderboard = True
                        logger.info(f"Same score but higher playcount {leaderboard_entry_from_incoming['play_count']} > {user_entry_on_leaderboard.get('play_count', 0)} for song {song['identifier']} found. Updating leaderboard.")
                    elif user_entry_on_leaderboard.get("posted", "") == "": # Handle case where leaderboard entry has no timestamp
                         should_update_leaderboard = True
                         logger.info(f"Existing leaderboard entry for {song['identifier']} has no timestamp. Updating.")

                    if should_update_leaderboard:
                        # Remove old entry if it exists before adding/re-adding
                        if user_entry_on_leaderboard:
                           try:
                               leaderboard.remove(user_entry_on_leaderboard)
                           except ValueError:
                               logger.warning(f"Could not find user_entry_on_leaderboard to remove for user {user_id} on song {song['identifier']}, appending new entry anyway.")
                        leaderboard.append(leaderboard_entry_from_incoming)
                        
                        leaderboard = sort_and_rank_leaderboard(leaderboard)
                        leaderboard_updates.append({
                            "md5": song["identifier"],
                            "name": song_info["name"],
                            "leaderboard": leaderboard,
                            "last_update": datetime.now(UTC).isoformat()
                        })

                    final_user_rank_on_leaderboard = next((entry.get("rank") for entry in leaderboard if entry["user_id"] == user_id), None)
                    
                    # Update rank in the user's personal score dict (if the entry exists)
                    if song["identifier"] in existing_scores_dict:
                         existing_scores_dict[song["identifier"]]["rank"] = final_user_rank_on_leaderboard
                         
                else: # Song is unknown
                    existing_unknown_score = existing_unknown_scores_dict.get(song["identifier"], None)
                    
                    # Prepare incoming score data for unknown song
                    incoming_unknown_score_data = {
                        "identifier": song["identifier"],
                        "song_name": f"Unknown Song: {song['identifier']}",
                        "artist": "Unknown Artist",
                        "charter_refs": [],
                        "percent": score["percent"],
                        "is_fc": score["is_fc"],
                        "speed": score["speed"],
                        "score": score["score"],
                        "play_count": play_count,
                        "posted": datetime.now(UTC).isoformat(),
                        "rank": None
                    }

                    should_update_unknown_score = False
                    if not existing_unknown_score:
                        should_update_unknown_score = True
                        logger.info(f"New score for unknown song {song['identifier']} being added.")
                    elif incoming_unknown_score_data["score"] > existing_unknown_score["score"]:
                        should_update_unknown_score = True
                        logger.info(f"Higher score {incoming_unknown_score_data['score']} > {existing_unknown_score['score']} for unknown song {song['identifier']} found.")
                    elif incoming_unknown_score_data["score"] == existing_unknown_score["score"] and incoming_unknown_score_data["play_count"] > existing_unknown_score.get("play_count", 0):
                         should_update_unknown_score = True
                         logger.info(f"Same score but higher playcount {incoming_unknown_score_data['play_count']} > {existing_unknown_score.get('play_count', 0)} for unknown song {song['identifier']} found.")

                    if should_update_unknown_score:
                        existing_unknown_scores_dict[song["identifier"]] = incoming_unknown_score_data

        progress = (processed_songs / total_songs) * 100
        update_processing_status(user_id, "in_progress", progress, processed_songs, total_songs)
        socketio.emit("score_processing_progress",
                        {"progress": progress, "processed": processed_songs, "total": total_songs},
                        to=str(user_id))

    if leaderboard_updates:
        try:
            logger.info(f"Updating leaderboards for {len(leaderboard_updates)} songs")
            socketio.emit("score_processing_uploading",
                        {"message": f"Updating leaderboards for {len(leaderboard_updates)} songs"},
                        to=str(user_id))
            socketio.sleep(1)
            
            for i, update in enumerate(leaderboard_updates):
                progress = (i / len(leaderboard_updates)) * 100
                socketio.emit("score_processing_updating_progress",
                            {"message": f"Updating leaderboard for {i+1} / {len(leaderboard_updates)}: {update['name']}", "progress": progress},
                            to=str(user_id))
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

    logger.info(f"Processing achievements for user {user_id}")
    socketio.emit("score_processing_processing_achievements",
                  {"message": f"Processing achievements for user {username}"},
                  to=str(user_id))
    
    user_stats_response = supabase.table("users").select("stats").eq("id", user_id).execute()
    if user_stats_response.data and len(user_stats_response.data) > 0:
        user_stats = rows(user_stats_response.data)[0].get("stats", {})
    else:
        user_stats = {}

    achievement_filtered_scores = [s for s in updated_scores if s["speed"] >= 100]

    user_achievement_data = {
        "id": user_id,
        "scores": achievement_filtered_scores,
        "unknown_scores": updated_unknown_scores,
        "stats": user_stats,
        "achievements": user_data[0].get("achievements", {}) or {},
    }

    try:
        achievements, achievement_errors = achievement_processor.process_achievements(user_achievement_data)
    except Exception as e:
        logger.error(f"Fatal error during achievement processing for user {user_id}: {str(e)}", exc_info=True)
        update_processing_status(user_id, "error", 100, processed_songs, total_songs)
        socketio.emit("score_processing_error",
                      {"message": "A fatal error occurred during achievement processing"},
                      to=str(user_id))
        return

    existing_achievements = user_data[0].get("achievements", {}) or {}
    for achievement_id, timestamp in achievements.items():
        if achievement_id not in existing_achievements:
            achievement_def = next((a for a in achievement_processor.achievements if a["id"] == achievement_id), None)
            if achievement_def:
                client_achievement = {
                    "id": achievement_id,
                    "name": achievement_def["name"],
                    "description": achievement_def["description"],
                    "rank": achievement_def["rank"],
                    "category": achievement_def["category"],
                    "achieved": True,
                    "timestamp": timestamp,
                    "group": achievement_def.get("group"),
                    "song_md5": achievement_def.get("song_md5")
                }
                socketio.emit("new_achievement", {"achievement": client_achievement}, to=str(user_id))
                logger.info(f"User {user_id} earned new achievement: {achievement_def['name']}")

    update_data = {
        "scores": updated_scores,
        "unknown_scores": updated_unknown_scores,
        "achievements": achievements
    }

    logger.info(f"Updating scores and achievements for user {user_id}")
    socketio.emit("score_processing_uploading",
                  {"message": f"Updating final scores and achievements for user {username}"},
                  to=str(user_id))

    try:
        supabase.table("users").update(update_data).eq("id", user_id).execute()
    except Exception as e:
        logger.error(f"Failed to update user profile for user {user_id}: {str(e)}", exc_info=True)
        update_processing_status(user_id, "error", 100, processed_songs, total_songs)
        socketio.emit("score_processing_error",
                      {"message": "Failed to save final scores/achievements to profile"},
                      to=str(user_id))
        return

    final_status = "completed_with_errors" if achievement_errors else "completed"
    final_message = "Score processing completed with some achievement errors." if achievement_errors else "Score processing completed successfully."

    update_processing_status(user_id, final_status, 100, total_songs, total_songs)
    socketio.emit("score_processing_complete",
                  {"message": final_message, "status": final_status, "errors": achievement_errors},
                  to=str(user_id))
    logger.info(final_message)

@bp.route("/api/upload_scoredata", methods=["POST"])
@token_required
def upload_scoredata(user_id: str) -> FlaskResponse:
    """
    uploads a scoredata.bin file for processing

    params:
        file (file): scoredata.bin file
    
    returns:
        JSON: async message indicating the start of score processing
    """
    logger = current_app.logger
    
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files["file"]
    if file.filename == "" or file.filename is None:
        return jsonify({"error": "No selected file"}), 400
    if file and allowed_file(file.filename):
        if file.filename != "scoredata.bin":
            return jsonify({"error": "File must be named scoredata.bin"}), 400
        
        try:
            socketio.emit("score_processing_start", to=str(user_id))
            # from process_songs.py, encoded and saved in env
            result = parse_score_data(file.stream)  # type: ignore
            
            if not result:
                return jsonify({"error": "Invalid score data"}), 400

            if result["version"] != 20211009:
                return jsonify({"error": "Score data is outdated"}), 400
            
            def run_with_app_context(app: Any, result: Dict[str, Any], user_id: str) -> None:
                with app.app_context():
                    process_and_save_scores(result, user_id)
            
            app = current_app._get_current_object()  # type: ignore[attr-defined]
            socketio.start_background_task(run_with_app_context, app, result, user_id)
            
            return jsonify({"message": "Score processing started", "total_songs": len(result["songs"])}), 202
        except ValueError as e:
            logger.error(f"Error parsing score data: {str(e)}", exc_info=True)
            return jsonify({"error": "Invalid or corrupted score data file"}), 400
        except Exception as e:
            logger.error(f"Unexpected error processing score data: {str(e)}", exc_info=True)
            return jsonify({"error": "An error occurred while processing score data"}), 500
    logger.warning("Invalid file in upload request")
    return jsonify({"error": "Invalid file"}), 400

@bp.route("/api/processing_status", methods=["GET"])
@token_required
def processing_status(user_id: str) -> FlaskResponse:
    """
    Retrieves the current processing status for the user

    returns:
        JSON: Current processing status
    """
    status: dict = redis.hgetall(f"processing_status:{user_id}")
    
    if status:
        return jsonify({
            "status": status.get(b"status", b"unknown").decode("utf-8"),
            "progress": float(status.get(b"progress", 0)),
            "processed": int(status.get(b"processed", 0)),
            "total": int(status.get(b"total", 0))
        }), 200
    else:
        return jsonify({"status": "no_active_processing"}), 200

def find_file_path_for_md5(file_content: bytes, md5_hex: str, search_back: int = 1024) -> Optional[str]:
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
@token_required
def upload_songcache(user_id: str) -> FlaskResponse:
    logger = current_app.logger
    
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files["file"]
    if file.filename == "" or file.filename is None:
        return jsonify({"error": "No selected file"}), 400
    if file and allowed_file(file.filename):
        if file.filename != "songcache.bin":
            return jsonify({"error": "File must be named songcache.bin"}), 400
        
        try:
            supabase = get_supabase()
            user_data = rows(supabase.table("users").select("unknown_scores").eq("id", user_id).execute().data)
            unknown_scores = user_data[0].get("unknown_scores", []) if user_data else []

            file_content = file.read()
            
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
            return jsonify({"error": "An error occurred while processing the song cache"}), 500
    
    logger.warning("Invalid file in upload request")
    return jsonify({"error": "Invalid file"}), 400