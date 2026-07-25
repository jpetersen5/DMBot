from flask import Blueprint, jsonify, request, current_app
from ..services.supabase_service import get_supabase, rows
from ..utils.helpers import allowed_file, get_process_songs_script
from ..extensions import socketio, redis
from datetime import datetime, UTC
import logging
import re
from typing import Any, BinaryIO, Callable, Dict, List, Optional
from ..utils.achievement_processor import achievement_processor
from ..utils.helpers import token_required
from ..utils.score_processing import (
    apply_score_to_leaderboard,
    evaluate_score_update,
    merge_unknown_scores,
)
from ..utils.user_stats import compute_user_stats
from ..types import FlaskResponse, LeaderboardUpdate

bp = Blueprint("scores", __name__)

LEADERBOARD_CHUNK_SIZE = 100
STATEMENT_TIMEOUT_CODE = "57014"

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

def _is_statement_timeout(exc: Exception) -> bool:
    """Whether ``exc`` is a Postgres statement timeout.

    postgrest surfaces the error as an ``APIError`` carrying the SQLSTATE, but
    exposes it as either a ``.code`` attribute or a plain dict depending on version,
    so check both rather than depending on one.
    """
    code = getattr(exc, "code", None)
    if code is None and isinstance(getattr(exc, "args", None), tuple) and exc.args:
        first = exc.args[0]
        if isinstance(first, dict):
            code = first.get("code")
    return str(code) == STATEMENT_TIMEOUT_CODE

def _push_leaderboard_updates(
    supabase: Any,
    updates: List[LeaderboardUpdate],
    chunk_size: int,
    logger: logging.Logger,
    on_progress: Optional[Callable[[int], None]] = None,
) -> List[LeaderboardUpdate]:
    """Write ``updates`` to songs_new via the bulk_update_leaderboards RPC."""
    failed: List[LeaderboardUpdate] = []

    for i in range(0, len(updates), chunk_size):
        chunk = updates[i:i + chunk_size]
        payload = [
            {
                "md5": update["md5"],
                "leaderboard": update["leaderboard"],
                "last_update": update["last_update"],
            }
            for update in chunk
        ]

        try:
            supabase.rpc("bulk_update_leaderboards", {"updates": payload}).execute()
        except Exception as e:
            if _is_statement_timeout(e) and len(chunk) > 1:
                logger.warning(
                    f"Leaderboard chunk of {len(chunk)} timed out, retrying in halves"
                )
                failed.extend(
                    _push_leaderboard_updates(
                        supabase, chunk, max(1, len(chunk) // 2), logger, on_progress
                    )
                )
            else:
                logger.error(
                    f"Error updating leaderboards for {len(chunk)} song(s): {str(e)}",
                    exc_info=True,
                )
                failed.extend(chunk)
            continue

        if on_progress:
            on_progress(len(chunk))

    return failed

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
    user_data = rows(supabase.table("users").select("username, scores, unknown_scores, stats, achievements").eq("id", user_id).execute().data)
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
    unknown_identifiers = [s["identifier"] for s in existing_unknown_scores if "identifier" in s]
    song_identifiers = list(dict.fromkeys(
        [song["identifier"] for song in result["songs"]] + unknown_identifiers
    ))

    logger.info(f"Fetching song data for {len(song_identifiers)} songs")
    for i in range(0, len(song_identifiers), batch_size):
        batch = song_identifiers[i:i+batch_size]
        logger.info(f"Fetching batch of {len(batch)} songs")
        socketio.emit("score_processing_fetching_songs",
                        {"message": f"Fetching user scores for songs {i+1} - {i+len(batch)}"},
                        to=user_id)
        batch_songs_info = rows(supabase.table("songs_new").select("md5,name,artist,charter_refs,leaderboard").in_("md5", batch).execute().data)
        songs_dict.update({song["md5"]: song for song in batch_songs_info})

    newly_known_scores, remaining_unknown_scores, unknown_leaderboard_updates = merge_unknown_scores(
        existing_unknown_scores, songs_dict, user_id, username, existing_scores_dict
    )
    leaderboard_updates.extend(unknown_leaderboard_updates)

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
                if song_info:
                    existing_user_score = existing_scores_dict.get(song["identifier"], None)

                    if existing_user_score and "charter_refs" not in existing_user_score:
                        existing_user_score["charter_refs"] = song_info.get("charter_refs", [])

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
                    
                    if evaluate_score_update(incoming_score_data, existing_user_score):
                       incoming_score_data["charter_refs"] = (existing_user_score.get("charter_refs") 
                                                             if existing_user_score and "charter_refs" in existing_user_score 
                                                             else song_info.get("charter_refs", []))
                       existing_scores_dict[song["identifier"]] = incoming_score_data

                    leaderboard = song_info.get("leaderboard", []) or []

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

                    leaderboard, should_update_leaderboard = apply_score_to_leaderboard(
                        leaderboard, leaderboard_entry_from_incoming, user_id
                    )
                    if should_update_leaderboard:
                        leaderboard_updates.append({
                            "md5": song["identifier"],
                            "name": song_info["name"],
                            "leaderboard": leaderboard,
                            "last_update": datetime.now(UTC).isoformat()
                        })

                    final_user_rank_on_leaderboard = next((entry.get("rank") for entry in leaderboard if entry["user_id"] == user_id), None)
                    
                    if song["identifier"] in existing_scores_dict:
                         existing_scores_dict[song["identifier"]]["rank"] = final_user_rank_on_leaderboard
                         
                else: # Song is unknown
                    existing_unknown_score = existing_unknown_scores_dict.get(song["identifier"], None)
                    
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

                    if evaluate_score_update(incoming_unknown_score_data, existing_unknown_score):
                        existing_unknown_scores_dict[song["identifier"]] = incoming_unknown_score_data

        progress = (processed_songs / total_songs) * 100
        update_processing_status(user_id, "in_progress", progress, processed_songs, total_songs)
        socketio.emit("score_processing_progress",
                        {"progress": progress, "processed": processed_songs, "total": total_songs},
                        to=user_id)

    failed_md5s: set[str] = set()
    if leaderboard_updates:
        total_updates = len(leaderboard_updates)
        logger.info(f"Updating leaderboards for {total_updates} songs")
        socketio.emit("score_processing_uploading",
                    {"message": f"Updating leaderboards for {total_updates} songs"},
                    to=user_id)
        socketio.sleep(1)

        pushed = 0

        def report_progress(written: int) -> None:
            nonlocal pushed
            pushed += written
            socketio.emit("score_processing_updating_progress",
                        {"message": f"Updating leaderboards {pushed} / {total_updates}",
                         "progress": (pushed / total_updates) * 100},
                        to=user_id)

        failed_updates = _push_leaderboard_updates(
            supabase, leaderboard_updates, LEADERBOARD_CHUNK_SIZE, logger, report_progress
        )
        failed_md5s = {update["md5"] for update in failed_updates}

        if failed_md5s:
            logger.error(
                f"Leaderboard updates incomplete: {len(failed_md5s)} of {total_updates} "
                f"song(s) could not be written for user {user_id}"
            )
            socketio.emit("score_processing_warning",
                          {"message": f"Could not update leaderboards for "
                                      f"{len(failed_md5s)} of {total_updates} songs"},
                          to=user_id)
        else:
            logger.info("Leaderboard updates completed")

    for identifier in failed_md5s:
        if identifier in existing_scores_dict:
            existing_scores_dict[identifier]["rank"] = None


    for identifier in list(existing_unknown_scores_dict):
        if identifier in existing_scores_dict:
            del existing_unknown_scores_dict[identifier]

    updated_scores = list(existing_scores_dict.values())
    updated_scores.sort(key=lambda x: x["score"], reverse=True)

    updated_unknown_scores = list(existing_unknown_scores_dict.values())
    updated_unknown_scores.sort(key=lambda x: x["score"], reverse=True)

    logger.info(f"Processing achievements for user {user_id}")
    socketio.emit("score_processing_processing_achievements",
                  {"message": f"Processing achievements for user {username}"},
                  to=user_id)
    
    previous_stats = (user_data[0].get("stats") or {}) if user_data else {}
    user_stats = compute_user_stats(updated_scores, updated_unknown_scores, previous_stats)

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
                      to=user_id)
        return

    existing_achievements = user_data[0].get("achievements", {}) or {}
    for achievement_id, timestamp in achievements.items():
        if achievement_id not in existing_achievements:
            client_achievement = achievement_processor.build_client_achievement(achievement_id, timestamp)
            if client_achievement:
                socketio.emit("new_achievement", {"achievement": client_achievement}, to=user_id)
                logger.info(f"User {user_id} earned new achievement: {client_achievement['name']}")

    update_data: Dict[str, Any] = {
        "scores": updated_scores,
        "unknown_scores": updated_unknown_scores,
        "achievements": achievements,
        "stats": user_stats
    }

    logger.info(f"Updating scores and achievements for user {user_id}")
    socketio.emit("score_processing_uploading",
                  {"message": f"Updating final scores and achievements for user {username}"},
                  to=user_id)

    try:
        supabase.table("users").update(update_data).eq("id", user_id).execute()
    except Exception as e:
        logger.error(f"Failed to update user profile for user {user_id}: {str(e)}", exc_info=True)
        update_processing_status(user_id, "error", 100, processed_songs, total_songs)
        socketio.emit("score_processing_error",
                      {"message": "Failed to save final scores/achievements to profile"},
                      to=user_id)
        return

    if achievement_errors and failed_md5s:
        final_message = "Score processing completed with achievement errors and incomplete leaderboard updates."
    elif achievement_errors:
        final_message = "Score processing completed with some achievement errors."
    elif failed_md5s:
        final_message = f"Score processing completed, but {len(failed_md5s)} leaderboard(s) could not be updated."
    else:
        final_message = "Score processing completed successfully."

    final_status = "completed_with_errors" if (achievement_errors or failed_md5s) else "completed"

    update_processing_status(user_id, final_status, 100, total_songs, total_songs)
    socketio.emit("score_processing_complete",
                  {"message": final_message, "status": final_status, "errors": achievement_errors},
                  to=user_id)
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
            socketio.emit("score_processing_start", to=user_id)
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

    logger.warning("Invalid file in upload request")
    return jsonify({"error": "Invalid file"}), 400