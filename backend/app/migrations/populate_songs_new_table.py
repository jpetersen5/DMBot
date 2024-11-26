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
    existing_md5s = set()
    offset = 0
    batch_size = 10000
    
    while True:
        result = (supabase.table("songs_new")
                 .select("md5")
                 .range(offset, offset + batch_size - 1)
                 .execute())
        
        if not result.data:
            break
            
        existing_md5s.update(row["md5"] for row in result.data)
        offset += batch_size
        
        print(f"Fetched {len(existing_md5s)} existing md5s so far...")
        
    return existing_md5s

def populate_songs_new_table():
    supabase = get_supabase()
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    json_file_path = os.path.join(current_dir, "data", "songs_with_md5.json")
    songs_data = load_json_data(json_file_path)

    existing_md5s = get_existing_md5s(supabase)

    new_songs = [song for song in songs_data if song["md5"] not in existing_md5s]
    prepared_songs = [prepare_song_data(song) for song in new_songs]
    
    print(f"Found {len(songs_data)} total songs")
    print(f"Found {len(existing_md5s)} existing songs")
    print(f"Inserting {len(prepared_songs)} new songs")

    batch_size = 500
    for i in range(0, len(prepared_songs), batch_size):
        batch = prepared_songs[i:i+batch_size]
        result = supabase.table("songs_new").insert(batch).execute()
        
        if hasattr(result, "error") and result.error:
            print(f"Error inserting batch {i//batch_size + 1} into songs_new: {result.error}")
            continue

        extra_batch = [
            {
                "md5": new_songs[i+j]["md5"],
                "song_data": new_songs[i+j]
            }
            for j in range(len(batch))
        ]
        
        extra_result = supabase.table("songs_extra").insert(extra_batch).execute()
        
        if hasattr(extra_result, "error") and extra_result.error:
            print(f"Error inserting batch {i//batch_size + 1} into songs_extra: {extra_result.error}")
        else:
            print(f"Successfully inserted batch {i//batch_size + 1} into both tables")