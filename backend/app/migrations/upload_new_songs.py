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

def fetch_existing_md5s(supabase):
    all_md5s = set()
    page = 0
    page_size = 1000

    while True:
        response = supabase.table("songs").select("md5").range(page * page_size, (page + 1) * page_size - 1).execute()
        md5s = set(song["md5"] for song in response.data)
        all_md5s.update(md5s)

        if len(response.data) < page_size:
            break

        page += 1

    return all_md5s

def fetch_existing_charters(supabase):
    response = supabase.table("charters").select("id", "name").execute()
    return {charter["name"]: charter["id"] for charter in response.data}

def insert_new_songs(supabase, songs, existing_md5s, existing_charters):
    new_songs = []
    new_charters = []
    for song in songs:
        if song["md5"] not in existing_md5s:
            charter_refs = song["charter_refs"].split(",") if song["charter_refs"] else []
            for charter in charter_refs:
                if charter and charter not in existing_charters:
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

    if new_songs:
        response = supabase.table("songs").insert(new_songs).execute()
        return new_charters, len(new_songs), response
    return [], 0, None

def upload_new_songs():
    supabase = get_supabase()
    songs = load_songs_data()
    existing_md5s = fetch_existing_md5s(supabase)
    existing_charters = fetch_existing_charters(supabase)

    new_charters, inserted_count, response = insert_new_songs(supabase, songs, existing_md5s, existing_charters)

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