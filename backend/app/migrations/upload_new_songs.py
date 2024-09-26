import os
import sys
import json
from dotenv import load_dotenv
from datetime import datetime, UTC

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.supabase_service import get_supabase

load_dotenv()

def load_songs_data():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, "data", "songs_with_md5.json")
    with open(file_path, "r") as f:
        return json.load(f)

def fetch_existing_md5s_and_names(supabase):
    md5s_and_names = {}
    page = 0
    page_size = 1000

    while True:
        response = supabase.table("songs").select("md5", "name").range(page * page_size, (page + 1) * page_size - 1).execute()
        md5s_and_names.update({song["md5"]: song["name"] for song in response.data})

        if len(response.data) < page_size:
            break

        page += 1

    return md5s_and_names

def fetch_existing_charters(supabase):
    response = supabase.table("charters").select("id", "name").execute()
    return {charter["name"]: charter["id"] for charter in response.data}

def insert_new_songs(supabase, songs: list[dict[str, str]], existing_md5s_and_names: dict[str, str], existing_charters: dict[str, str]):
    new_songs = []
    update_songs = []
    new_charters = []
    for song in songs:
        if song["md5"] not in existing_md5s_and_names:
            charter_refs = song["charter_refs"].split(",") if song["charter_refs"] else []
            for charter in charter_refs:
                if charter and charter not in existing_charters and charter not in new_charters:
                    print(f"Adding new charter: {charter}")
                    new_charters.append({"name": charter})
            
            new_song = {
                "md5": song["md5"],
                "artist": song["artist"],
                "name": song["name"],
                "album": song["album"],
                "genre": song["genre"],
                "track": int(song["track"]) if song["track"].isdigit() else None,
                "year": song["year"],
                "difficulty": int(song["difficulty"]) if song["difficulty"].isdigit() else None,
                "song_length": int(song["song_length"]) if song["song_length"].isdigit() else None,
                "charter_refs": charter_refs,
                "last_update": datetime.now(UTC).isoformat()
            }
            new_songs.append(new_song)
        elif song["md5"] in existing_md5s_and_names:
            if "Unverified" in existing_md5s_and_names[song["md5"]]:
                update_songs.append({
                    "md5": song["md5"],
                    "name": song["name"],
                    "last_update": datetime.now(UTC).isoformat()
                })

    if update_songs:
        for song in update_songs:
            print(f"Updating unverified song: {song['name']} from {existing_md5s_and_names[song['md5']]}")
            response = supabase.table("songs").update(song).eq("md5", song["md5"]).execute()
    if new_songs:
        batch_size = 50
        for i in range(0, len(new_songs), batch_size):
            batch = new_songs[i:i + batch_size]
            response = supabase.table("songs").insert(batch).execute()
            if response and response.data:
                print(f"Inserted {len(batch)} new songs.")
            elif response:
                print("Insertion failed:", response.error)
        return new_charters, len(new_songs), response
    return [], 0, None

def upload_new_songs():
    supabase = get_supabase()
    songs = load_songs_data()
    existing_md5s_and_names = fetch_existing_md5s_and_names(supabase)
    existing_charters = fetch_existing_charters(supabase)

    new_charters, inserted_count, response = insert_new_songs(supabase, songs, existing_md5s_and_names, existing_charters)

    print(f"Inserted {inserted_count} new songs.")
    if response and response.data:
        print("Insertion successful.")
    elif response:
        print("Insertion failed:", response.error)
    
    if new_charters:
        new_charters_response = supabase.table("charters").insert(new_charters).execute()
        print(f"Inserted {len(new_charters)} new charters.")
        if new_charters_response and new_charters_response.data:
            print("Insertion successful.")
        elif new_charters_response:
            print("Insertion failed:", new_charters_response.error)