import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.supabase_service import get_supabase, rows
from app.utils.leaderboard import sort_and_rank_leaderboard

load_dotenv()

def update_leaderboards():
    supabase = get_supabase()
    
    page = 0
    page_size = 1000
    total_updated = 0

    while True:
        response = supabase.table("songs") \
            .select("id", "name", "leaderboard") \
            .not_.is_("leaderboard", "null") \
            .range(page * page_size, (page + 1) * page_size - 1) \
            .execute()
        
        songs = rows(response.data)
        
        if not songs:
            break
        
        print(f"Processing batch {page + 1} ({len(songs)} songs)...")

        for i, song in enumerate(songs, 1):
            leaderboard = song["leaderboard"]
            if leaderboard:
                if all("rank" in entry for entry in leaderboard):
                    print(f"Skipping {song['name']} (ID: {song['id']}) - all entries already ranked")
                    continue

                updated_leaderboard = sort_and_rank_leaderboard(leaderboard)
                
                print(f"Updating {song['name']} {total_updated + i}/{total_updated + len(songs)} (ID: {song['id']})...")
                supabase.table("songs").update({"leaderboard": updated_leaderboard}).eq("id", song["id"]).execute()  # type: ignore[arg-type]

        total_updated += len(songs)
        page += 1
    
    print("Leaderboard rankings update completed.")

if __name__ == "__main__":
    update_leaderboards()