import os
import re
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

def map_song_paths(base_path):
    """
    Map all valid song paths by searching for song.ini files.
    """
    song_paths = []
    for root, dirs, files in os.walk(base_path):
        if 'song.ini' in files:
            song_paths.append(os.path.normpath(root).lower().replace('/', '\\'))
    logging.info(f"Found {len(song_paths)} song paths")
    return song_paths

def is_valid_md5(hash_string):
    """
    Check if a string is a valid MD5 hash.
    """
    return re.match(r'^[a-fA-F0-9]{32}$', hash_string) is not None

def find_md5_for_path(file_content, path):
    """
    Searches for the MD5 hash associated with the specified path in the binary file.
    """
    path_bytes = path.lower().encode('utf-8')
    index = file_content.find(path_bytes)
    if index == -1:
        logging.warning(f"Path not found in binary file: {path}")
        return None

    # Find the start of the next path
    next_path_start = file_content.find(b'c:\\users\\jason\\documents\\clone hero\\songs', index + len(path_bytes))
    if next_path_start == -1:
        next_path_start = len(file_content)

    # Extract the data chunk between the current path and the next path
    data_chunk = file_content[index + len(path_bytes):next_path_start]
    
    # Extract the MD5 hash (first 32 characters of the last 36 characters)
    if len(data_chunk) >= 36:
        if data_chunk[-18] == 0:
            md5_hex = data_chunk[-17:-1].hex()
            logging.info(f"Possible MD5 hash: {md5_hex}\nFor path: {path}")
            return md5_hex
        md5_hex = data_chunk[-18:-2].hex()
        logging.info(f"Possible MD5 hash: {md5_hex}")
        return md5_hex

    logging.warning(f"No valid MD5 hash found for path: {path}")
    return None

def process_songs(base_path, binary_file_path, output_file):
    """
    Process songs by mapping paths, finding MD5 hashes, and extracting song.ini data.
    """
    song_paths = map_song_paths(base_path)
    
    with open(binary_file_path, "rb") as bin_file:
        bin_file_content = bin_file.read()

    songs = []
    for path in song_paths:
        md5_hex = find_md5_for_path(bin_file_content, path)
        if md5_hex:
            ini_path = os.path.join(path, "song.ini")
            song_data = parse_ini_file(ini_path)
            
            song_info = {
                "md5": md5_hex,
                "file_path": path,
                "artist": song_data.get('artist', ''),
                "name": song_data.get('name', ''),
                "album": song_data.get('album', ''),
                "track": song_data.get('track', ''),
                "year": song_data.get('year', ''),
                "genre": song_data.get('genre', ''),
                "diff_drums_real": song_data.get('diff_drums_real', ''),
                "song_length": song_data.get('song_length', ''),
                "charter": song_data.get('charter', '')
            }
            songs.append(song_info)
        else:
            logging.warning(f"MD5 not found for path: {path}")

    with open(output_file, "w", encoding="utf-8") as file:
        json.dump(songs, file, indent=2)
    logging.info(f"Processed data saved to {output_file}.")

def process_songs(base_path, binary_file_path, output_file):
    """
    Process songs by mapping paths, finding MD5 hashes, and extracting song.ini data.
    """
    song_paths = map_song_paths(base_path)
    
    with open(binary_file_path, "rb") as bin_file:
        bin_file_content = bin_file.read()

    songs = []
    for path in song_paths:
        md5_hex = find_md5_for_path(bin_file_content, path)
        if md5_hex:
            ini_path = os.path.join(path, "song.ini")
            song_data = parse_ini_file(ini_path)
            
            song_info = {
                "md5": md5_hex,
                "file_path": path,
                "artist": song_data.get('artist', ''),
                "name": song_data.get('name', ''),
                "album": song_data.get('album', ''),
                "track": song_data.get('track', ''),
                "year": song_data.get('year', ''),
                "genre": song_data.get('genre', ''),
                "diff_drums_real": song_data.get('diff_drums_real', ''),
                "song_length": song_data.get('song_length', ''),
                "charter": song_data.get('charter', '')
            }
            songs.append(song_info)
        else:
            logging.warning(f"MD5 not found for path: {path}")

    with open(output_file, "w", encoding="utf-8") as file:
        json.dump(songs, file, indent=2)
    logging.info(f"Processed data saved to {output_file}.")

def parse_ini_file(ini_path):
    """
    Parse the song.ini file to extract required fields, attempting to handle different encodings.
    """
    data = {}
    required_fields = [
        "artist", "name", "album", "track", "year",
        "genre", "diff_drums_real", "song_length", "charter"
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
    base_path = r"C:\Users\jason\Documents\Clone Hero\Songs"
    binary_file_path = r"C:\Users\jason\AppData\LocalLow\srylain Inc_\Clone Hero\songcache.bin"
    output_file = r"..\data\songs_with_md5.json"
    
    process_songs(base_path, binary_file_path, output_file)