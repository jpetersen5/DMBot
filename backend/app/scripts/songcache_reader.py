import os
import re
import json
import logging
from typing import List

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")

def clean_up_songs_data(songs):
    md5_groups = {}
    cleaned_songs = []
    deleted_songs = []

    # Group songs by MD5
    for song in songs:
        md5 = song["md5"]
        if md5 not in md5_groups:
            md5_groups[md5] = []
        md5_groups[md5].append(song)

    # Process each MD5 group
    for md5, group in md5_groups.items():
        if len(group) == 1 or not any(song["is_duplicate"] for song in group):
            cleaned_songs.extend(group)
        else:
            # Find the song with the longest name
            longest_name_song = max(group, key=lambda x: len(x["name"]))
            cleaned_songs.append(longest_name_song)
            logging.info(f"Longest name song: {longest_name_song['name']} - {longest_name_song['artist']} (MD5: {longest_name_song['md5']})")
            
            # Log deletions
            for song in group:
                if song != longest_name_song:
                    deleted_songs.append({
                        "md5": song["md5"],
                        "name": song["name"],
                        "artist": song["artist"],
                        "album": song["album"]
                    })
                    logging.info(f"Deleted duplicate song: {song['name']} - {song['artist']} (MD5: {song['md5']})")

    logging.info(f"Cleaned up {len(deleted_songs)} duplicate songs")
    return cleaned_songs, deleted_songs

def strip_color_tags(text: str) -> str:
    return re.sub(r'<color=[^>]+>(.*?)</color>', r'\1', text)

def strip_tags(text: str) -> str:
    return re.sub(r'</?b>', '', text)

def split_charters(charter_string: str) -> List[str]:
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

def process_charter_name(charter: str) -> str:
    return strip_tags(strip_color_tags(charter.strip())).strip()

def map_song_paths(base_path):
    """
    Map all valid song paths by searching for song.ini files.
    """
    song_paths = []
    for root, dirs, files in os.walk(base_path):
        if "song.ini" in files:
            song_paths.append(os.path.normpath(root).lower().replace("/", "\\"))
    logging.info(f"Found {len(song_paths)} song paths")
    return song_paths

def is_valid_md5(hash_string):
    """
    Check if a string is a valid MD5 hash.
    """
    return re.match(r"^[a-fA-F0-9]{32}$", hash_string) is not None

def find_md5_for_path(file_content, path):
    """
    Searches for the MD5 hash associated with the specified path in the binary file.
    """
    path_bytes = path.lower().encode("utf-8")
    start = 0
    md5_hashes = []

    while True:
        index = file_content.find(path_bytes, start)
        if index == -1:
            break

        # Find the start of the next path
        next_path_start = file_content.find(b"c:\\users\\jason\\documents\\clone hero\\songs", index + len(path_bytes))
        if next_path_start == -1:
            next_path_start = len(file_content)

        # Extract the data chunk between the current path and the next path
        data_chunk = file_content[index + len(path_bytes):next_path_start]
        
        # Extract the MD5 hash (first 32 characters of the last 36 characters)
        if len(data_chunk) >= 36:
            if data_chunk[-18] == 0:
                md5_hex = data_chunk[-17:-1].hex()
            else:
                md5_hex = data_chunk[-18:-2].hex()
            
            if is_valid_md5(md5_hex):
                md5_hashes.append(md5_hex)
                logging.info(f"Possible MD5 hash: {md5_hex}\nFor path: {path}")

        start = index + len(path_bytes)

    if not md5_hashes:
        logging.warning(f"No valid MD5 hash found for path: {path}")
    
    return md5_hashes

def process_songs(base_path, binary_file_path, output_file):
    """
    Process songs by mapping paths, finding MD5 hashes, and extracting song.ini data.
    """
    song_paths = map_song_paths(base_path)
    
    with open(binary_file_path, "rb") as bin_file:
        bin_file_content = bin_file.read()

    songs = []
    for path in song_paths:
        md5_hashes = find_md5_for_path(bin_file_content, path)
        if md5_hashes:
            ini_path = os.path.join(path, "song.ini")
            song_data = parse_ini_file(ini_path)

            charter_string = song_data.get("charter", "")
            charters = split_charters(charter_string)
            charter_refs = [process_charter_name(charter) for charter in charters]
            
            for md5_hex in md5_hashes:
                duplicate_songs = [song for song in songs if song["md5"] == md5_hex]
                if duplicate_songs:
                    is_duplicate = True
                    if duplicate_songs[0]["artist"] == song_data.get("artist", "") and duplicate_songs[0]["name"] == song_data.get("name", "") and duplicate_songs[0]["album"] == song_data.get("album", "") and duplicate_songs[0]["track"] == song_data.get("track", ""):
                        continue
                else:
                    is_duplicate = False
                song_info = {
                    "md5": md5_hex,
                    "artist": song_data.get("artist", ""),
                    "name": song_data.get("name", ""),
                    "album": song_data.get("album", ""),
                    "track": song_data.get("track", ""),
                    "year": song_data.get("year", ""),
                    "genre": song_data.get("genre", ""),
                    "difficulty": song_data.get("diff_drums", ""),
                    "song_length": song_data.get("song_length", ""),
                    "charter_refs": ",".join(charter_refs),
                    "is_duplicate": is_duplicate
                }
                songs.append(song_info)
        else:
            logging.warning(f"MD5 not found for path: {path}")

    cleaned_songs, deleted_songs = clean_up_songs_data(songs)

    with open(output_file, "w", encoding="utf-8") as file:
        json.dump(cleaned_songs, file, indent=2)
    logging.info(f"Processed data saved to {output_file}.")

    deleted_log_file = output_file.replace(".json", "_deleted_log.json")
    with open(deleted_log_file, "w", encoding="utf-8") as file:
        json.dump(deleted_songs, file, indent=2)
    logging.info(f"Deleted songs log saved to {deleted_log_file}.")

def parse_ini_file(ini_path):
    """
    Parse the song.ini file to extract required fields, attempting to handle different encodings.
    """
    data = {}
    required_fields = [
        "artist", "name", "album", "track", "year",
        "genre", "diff_drums", "song_length", "charter"
    ]
    try:
        with open(ini_path, "r", encoding="utf-8") as file:
            lines = file.readlines()
    except UnicodeDecodeError:
        try:
            with open(ini_path, "r", encoding="cp1252") as file:
                lines = file.readlines()
        except UnicodeDecodeError:
            logging.error(f"Failed to decode {ini_path}. Skipping.")
            return data

    for line in lines:
        key, _, value = line.partition("=")
        key = key.strip().lower()
        value = value.strip()
        if key in required_fields:
            data[key] = value
    return data

def format_song_length(milliseconds):
    """
    Convert song length from milliseconds to HH:MM:SS format.
    """
    seconds = int(milliseconds) // 1000
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02}"

if __name__ == "__main__":
    base_path = "C:\\Users\\jason\\Documents\\Clone Hero\\Songs"
    binary_file_path = "C:\\Users\\jason\\AppData\\LocalLow\\srylain Inc_\Clone Hero\\songcache.bin"
    output_file = "data\\songs_with_md5.json"
    
    process_songs(base_path, binary_file_path, output_file)