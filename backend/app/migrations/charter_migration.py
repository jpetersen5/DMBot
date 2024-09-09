import re
from typing import List, Tuple, Dict
from postgrest import AsyncPostgrestClient
import asyncio
import httpx
from dotenv import load_dotenv
import os

load_dotenv("../.env")

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
postgrest = AsyncPostgrestClient(f"{url}/rest/v1", headers={"apikey": key, "Authorization": f"Bearer {key}"})

COLOR_DICT = {
    "black": "#000000",
    "white": "#FFFFFF",
    "red": "#FF0000",
    "green": "#00FF00",
    "blue": "#0000FF",
    "yellow": "#FFFF00",
    "cyan": "#00FFFF",
    "magenta": "#FF00FF",
    "silver": "#C0C0C0",
    "gray": "#808080",
    "maroon": "#800000",
    "olive": "#808000",
    "purple": "#800080",
    "teal": "#008080",
    "navy": "#000080",
    "orange": "#FFA500",
    "pink": "#FFC0CB",
    "brown": "#A52A2A",
    "violet": "#EE82EE",
    "indigo": "#4B0082",
}

def strip_color_tags(text: str) -> str:
    """Remove color tags from text."""
    text = re.sub(r'<color=[^>]+>(.*?)</color>', r'\1', text)
    return text

def strip_tags(text: str) -> str:
    """Remove tags from text."""
    text = re.sub(r'</?b>', '', text)
    return text

def process_color_tags(content: str) -> str:
    """Process color tags to HTML span elements."""
    def replace_color(match):
        color, text = match.groups()
        if color.startswith("#"):
            full_color = color if len(color) == 7 else f"#{color[1]*2}{color[2]*2}{color[3]*2}"
        else:
            full_color = COLOR_DICT.get(color.lower(), "#000000")
        return f'<span style="color:{full_color}">{text}</span>'

    return re.sub(r'<color=([^>]+)>(.*?)</color>', replace_color, content)

def split_charters(charter_string: str) -> List[str]:
    """Split charter string into individual charter names, preserving color tags."""
    char_delimiters = [",", "/", "&"]
    multichar_delimiters = [" - ", " + ", " and "]

    def is_in_color_tag(pos, text):
        open_tags = [m.start() for m in re.finditer(r'<color=', text[:pos])]
        close_tags = [m.start() for m in re.finditer(r'color>', text[:pos])]
        return len(open_tags) > len(close_tags)

    result = []
    current = []
    i = 0
    while i < len(charter_string):
        if any(charter_string.startswith(delim, i) for delim in multichar_delimiters) and not is_in_color_tag(i, charter_string):
            if current:
                result.append("".join(current).strip())
                current = []
            i += len(next(delim for delim in multichar_delimiters if charter_string.startswith(delim, i)))
        elif charter_string[i] in char_delimiters and not is_in_color_tag(i, charter_string):
            if current:
                result.append("".join(current).strip())
                current = []
            i += 1
        else:
            current.append(charter_string[i])
            i += 1

    if current:
        result.append("".join(current).strip())

    return [charter.strip() for charter in result if charter.strip()]

def process_charter_name(charter: str) -> Tuple[str, str]:
    """Process charter name to get sanitized and colorized versions."""
    sanitized = strip_tags(strip_color_tags(charter.strip())).strip()
    colorized = process_color_tags(strip_tags(charter.strip())).strip()
    return sanitized, colorized

async def upsert_charter(name: str, colorized_name: str, existing_charters: Dict[str, str]):
    """Upsert a charter into the charters table."""
    if name in existing_charters:
        if existing_charters[name] != colorized_name and colorized_name != name:
            await postgrest.from_("charters").update({"colorized_name": colorized_name}).eq("name", name).execute()
            existing_charters[name] = colorized_name
    else:
        data = {"name": name}
        if colorized_name != name:
            data["colorized_name"] = colorized_name
        await postgrest.from_("charters").insert(data).execute()
        existing_charters[name] = colorized_name

async def fetch_existing_charters() -> Dict[str, str]:
    """Fetch existing charters from the database."""
    response = await postgrest.from_("charters").select("name", "colorized_name").execute()
    charters = response.data
    return {charter["name"]: charter.get("colorized_name", charter["name"]) for charter in charters}

async def main():
    existing_charters = await fetch_existing_charters()
    print(f"Fetched {len(existing_charters)} existing charters.")

    response = await postgrest.from_("songs").select("id", "charter").is_("charter_refs", "null").execute()
    songs = response.data

    total_songs = len(songs)
    print(f"Found {total_songs} songs to process.")

    for index, song in enumerate(songs, 1):
        charter_string = song.get("charter")
        if charter_string:
            charters = split_charters(charter_string)
            charter_refs = []
            for charter in charters:
                sanitized, colorized = process_charter_name(charter)
                await upsert_charter(sanitized, colorized, existing_charters)
                charter_refs.append(sanitized)
            await postgrest.from_("songs").update({"charter_refs": charter_refs}).eq("id", song["id"]).execute()
        if index % 100 == 0:
            print(f"Processed {index}/{total_songs} songs.")

    print("Charter data migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())