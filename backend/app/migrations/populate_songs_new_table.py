# Example song entry
# {
#   "folderIssues": [],
#   "metadataIssues": [],
#   "playable": true,
#   "md5": "eee32f039c22ded0a4d472191c75606c",
#   "chartHash": "AhY8MK01VwrTFZ88T4oEiVId-o1OQN7Nr1t6vtEllOA=",
#   "notesData": {
#     "instruments": [
#       "guitar",
#       "bass",
#       "drums"
#     ],
#     "drumType": 1,
#     "hasSoloSections": false,
#     "hasLyrics": true,
#     "hasVocals": false,
#     "hasForcedNotes": true,
#     "hasTapNotes": false,
#     "hasOpenNotes": false,
#     "has2xKick": false,
#     "hasFlexLanes": false,
#     "chartIssues": [],
#     "noteCounts": [
#       {
#         "instrument": "guitar",
#         "difficulty": "expert",
#         "count": 866
#       },
#       {
#         "instrument": "bass",
#         "difficulty": "expert",
#         "count": 758
#       },
#       {
#         "instrument": "drums",
#         "difficulty": "expert",
#         "count": 1420
#       }
#     ],
#     "maxNps": [
#       {
#         "instrument": "guitar",
#         "difficulty": "expert",
#         "nps": 11,
#         "time": 17309.463
#       },
#       {
#         "instrument": "bass",
#         "difficulty": "expert",
#         "nps": 7,
#         "time": 7852.941
#       },
#       {
#         "instrument": "drums",
#         "difficulty": "expert",
#         "nps": 13,
#         "time": 32635.55
#       }
#     ],
#     "trackHashes": [
#       {
#         "instrument": "guitar",
#         "difficulty": "expert",
#         "hash": "6DeEvPIuiPjxDQfg4tuArQuHvBWtwGKaMe82vtiFKBY="
#       },
#       {
#         "instrument": "bass",
#         "difficulty": "expert",
#         "hash": "OPzGq1Acf5J-J7JHVgaZEGn4azEupxbMaS08jX27EXE="
#       },
#       {
#         "instrument": "drums",
#         "difficulty": "expert",
#         "hash": "-vPYlozc2x81mcMZR592eSWuFS7nWS8rTEO9H4eY5_M="
#       }
#     ],
#     "tempoMapHash": "f36911ed16e24e985d93b4578300a134",
#     "tempoMarkerCount": 3,
#     "effectiveLength": 164211.637
#   },
#   "name": "Sleepers",
#   "artist": "Saosin",
#   "album": "Saosin",
#   "genre": "Emo",
#   "year": "2006",
#   "charter": "TDC,Sang Duta",
#   "song_length": 171455,
#   "diff_band": -1,
#   "diff_guitar": 3,
#   "diff_guitar_coop": -1,
#   "diff_rhythm": -1,
#   "diff_bass": 2,
#   "diff_drums": 4,
#   "diff_drums_real": -1,
#   "diff_keys": -1,
#   "diff_guitarghl": -1,
#   "diff_guitar_coop_ghl": -1,
#   "diff_rhythm_ghl": -1,
#   "diff_bassghl": -1,
#   "diff_vocals": -1,
#   "preview_start_time": 143170,
#   "icon": "duta",
#   "loading_phrase": "Multitrack",
#   "album_track": 16000,
#   "playlist_track": 16000,
#   "modchart": false,
#   "delay": 0,
#   "hopo_frequency": 0,
#   "eighthnote_hopo": false,
#   "multiplier_note": 0,
#   "sustain_cutoff_threshold": -1,
#   "chord_snap_threshold": 0,
#   "video_start_time": 0,
#   "five_lane_drums": false,
#   "pro_drums": false,
#   "end_events": true,
#   "chart_offset": 0,
#   "albumArt": null,
#   "hasVideoBackground": false,
#   "playlistPath": "cloneherosongs\\saosin\\saosin - sleepers (tdc & sang duta)"
# },

import json
from dotenv import load_dotenv
import os

load_dotenv()

from app.services.supabase_service import get_supabase

def load_json_data(file_path):
    with open(file_path, "r") as file:
        return json.load(file)

def prepare_song_data(song):
    try:
        year = int(song.get("year", ""))
    except ValueError:
        year = None

    difficulties = {
        key[5:]: value for key, value in song.items()
        if key.startswith("diff_") and value != -1
    }

    return {
        "md5": song.get("md5"),
        "name": song.get("name"),
        "artist": song.get("artist"),
        "album": song.get("album"),
        "genre": song.get("genre"),
        "year": year,
        "charter_refs": song.get("charter", "").split(","),
        "song_length": song.get("song_length"),
        "difficulties": difficulties,
        "loading_phrase": song.get("loading_phrase"),
        "track": None if song.get("album_track") == 16000 else song.get("album_track"),
        "playlist_path": song.get("playlistPath"),
        "has_2x_kick": song.get("notesData", {}).get("has2xKick", False),
        "note_counts": song.get("notesData", {}).get("noteCounts", []),
        "instruments": song.get("notesData", {}).get("instruments", [])
    }

def get_existing_md5s(supabase):
    existing_md5s = {}  # Changed to dict to store md5 -> name mapping
    offset = 0
    batch_size = 10000
    
    while True:
        result = (supabase.table("songs_new")
                 .select("md5,name")  # Also fetch name
                 .range(offset, offset + batch_size - 1)
                 .execute())
        
        if not result.data:
            break
            
        # Store md5 -> name mapping
        for row in result.data:
            existing_md5s[row["md5"]] = row["name"]
            
        offset += batch_size
        
        print(f"Fetched {len(existing_md5s)} existing md5s so far...")
        
    return existing_md5s

def populate_songs_new_table():
    supabase = get_supabase()
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    json_file_path = os.path.join(current_dir, "data", "songs_with_md5.json")
    songs_data = load_json_data(json_file_path)

    existing_md5s = get_existing_md5s(supabase)

    # Separate songs into categories
    new_songs = []
    update_songs = []
    skip_songs = []
    
    for song in songs_data:
        md5 = song["md5"]
        if md5 not in existing_md5s:
            # New song, insert it
            new_songs.append(song)
        elif existing_md5s[md5] != song["name"]:
            # MD5 exists but name is different, update it
            update_songs.append(song)
        else:
            # MD5 exists with same name, skip it
            skip_songs.append(song)
    
    # Prepare data for insertion and updates
    prepared_new_songs = [prepare_song_data(song) for song in new_songs]
    prepared_update_songs = [prepare_song_data(song) for song in update_songs]
    
    print(f"Found {len(songs_data)} total songs")
    print(f"Found {len(existing_md5s)} existing songs")
    print(f"Attempting to insert {len(prepared_new_songs)} new songs")
    print(f"Updating {len(prepared_update_songs)} songs with different names")
    print(f"Skipping {len(skip_songs)} songs with same MD5 and name")

    # Process new songs in batches - handle failures by moving to update list
    failed_inserts = []
    batch_size = 500
    for i in range(0, len(prepared_new_songs), batch_size):
        batch = prepared_new_songs[i:i+batch_size]
        
        try:
            # Use upsert with on_conflict=do_nothing for safety
            result = supabase.table("songs_new").upsert(batch, on_conflict="md5").execute()
            
            # Check if we had fewer inserts than expected
            if hasattr(result, "data") and len(result.data) < len(batch):
                print(f"Warning: Only inserted {len(result.data)} out of {len(batch)} songs in batch")
                
            # Find the songs that were successfully inserted
            inserted_md5s = set(item["md5"] for item in result.data) if hasattr(result, "data") else set()
            current_batch_original = new_songs[i:i+batch_size]
            
            # Identify successfully inserted songs for songs_extra table
            successful_inserts = []
            for j, song in enumerate(current_batch_original):
                if song["md5"] in inserted_md5s:
                    successful_inserts.append({
                        "md5": song["md5"],
                        "song_data": song
                    })
                else:
                    # Move failed inserts to the update list for retry
                    failed_inserts.append(song)
                    
            if successful_inserts:
                extra_result = supabase.table("songs_extra").upsert(successful_inserts, on_conflict="md5").execute()
                if hasattr(extra_result, "error") and extra_result.error:
                    print(f"Error inserting batch {i//batch_size + 1} into songs_extra: {extra_result.error}")
                else:
                    print(f"Successfully inserted/updated {len(successful_inserts)} songs in both tables")
            
        except Exception as e:
            print(f"Error processing batch {i//batch_size + 1}: {str(e)}")
            # Move all songs in this batch to failed_inserts for retry
            failed_inserts.extend(new_songs[i:i+batch_size])
    
    if failed_inserts:
        print(f"Moving {len(failed_inserts)} failed inserts to update list")
        update_songs.extend(failed_inserts)
        prepared_update_songs.extend([prepare_song_data(song) for song in failed_inserts])
    
    # Update songs with different names in batches - one at a time to avoid errors
    print(f"Processing {len(prepared_update_songs)} songs for update")
    for song in prepared_update_songs:
        try:
            # First, check if the song exists in songs_new
            check_result = supabase.table("songs_new").select("md5").eq("md5", song["md5"]).execute()
            song_exists = hasattr(check_result, "data") and len(check_result.data) > 0
            
            if not song_exists:
                # Song doesn't exist in songs_new, so we need to insert it first
                try:
                    insert_result = supabase.table("songs_new").insert(song).execute()
                    if hasattr(insert_result, "error") and insert_result.error:
                        print(f"Error inserting song {song['md5']} into songs_new: {insert_result.error}")
                        continue  # Skip to next song if insert fails
                    song_exists = True
                    print(f"Inserted new song {song['md5']} into songs_new")
                except Exception as e:
                    print(f"Error inserting song {song['md5']} into songs_new: {str(e)}")
                    continue  # Skip to next song if insert fails
            
            if song_exists:
                # Now update the song data if needed
                update_result = (supabase.table("songs_new")
                            .update({
                                "name": song["name"],
                                "artist": song["artist"],
                                "album": song["album"],
                                "genre": song["genre"],
                                "year": song["year"],
                                "charter_refs": song["charter_refs"],
                                "song_length": song["song_length"],
                                "difficulties": song["difficulties"],
                                "loading_phrase": song["loading_phrase"],
                                "track": song["track"],
                                "playlist_path": song["playlist_path"],
                                "has_2x_kick": song["has_2x_kick"],
                                "note_counts": song["note_counts"],
                                "instruments": song["instruments"]
                            })
                            .eq("md5", song["md5"])
                            .execute())
                
                if hasattr(update_result, "error") and update_result.error:
                    print(f"Error updating song {song['md5']} in songs_new: {update_result.error}")
                    continue
                
                # Only update songs_extra if the song exists in songs_new
                original_song = next((s for s in update_songs if s["md5"] == song["md5"]), None)
                if original_song:
                    extra_result = supabase.table("songs_extra").upsert({
                        "md5": song["md5"],
                        "song_data": original_song
                    }, on_conflict="md5").execute()
                    
                    if hasattr(extra_result, "error") and extra_result.error:
                        print(f"Error updating song {song['md5']} in songs_extra: {extra_result.error}")
        except Exception as e:
            print(f"Error processing update for {song['md5']}: {str(e)}")
    
    print("Song population completed.")