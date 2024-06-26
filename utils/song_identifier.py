import os
import re
import json

def parse_score_data(score_data_path):
    """
    Parses the scoredata.txt to extract song numbers and their corresponding MD5 identifiers.
    """
    with open(score_data_path, "r") as file:
        content = file.read()

    song_data = re.findall(r"Song (\d+):\s+Identifier: (\w+)", content)
    return song_data

def find_file_path_for_md5(file_content, md5_hex, search_back=1024):
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

        decoded_string = pre_data.decode("ansi", errors="ignore")

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

def process_cache(score_data_path, binary_file_path, output_path):
    """
    Process the songcache.bin file and create songidentifiers.txt
    """
    if not os.path.isfile(binary_file_path):
        print("Binary file does not exist.")
        return

    with open(binary_file_path, "rb") as bin_file:
        bin_file_content = bin_file.read()

    song_data = parse_score_data(score_data_path)
    results = []

    for song_number, md5_hex in song_data:
        file_path = find_file_path_for_md5(bin_file_content, md5_hex)
        if file_path:
            result_line = f"Song {song_number}: {md5_hex} Path: {file_path}\n"
        else:
            result_line = f"Song {song_number}: {md5_hex} Path: Not found\n"
        results.append(result_line)

    # Write the results to songidentifiers.txt
    with open(output_path, "w", encoding="utf-8") as output_file:
        output_file.writelines(results)
    print(f"Results written to {output_path}.")

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
        # Attempt to open and read the file with cp1252 encoding
        with open(ini_path, "r", encoding="cp1252") as file:
            lines = file.readlines()
    except UnicodeDecodeError:
        # If cp1252 fails, attempt to read with "utf-8"
        try:
            with open(ini_path, "r", encoding="utf-8") as file:
                lines = file.readlines()
        except UnicodeDecodeError:
            print(f"Failed to decode {ini_path}. Skipping.")
            return data
    except FileNotFoundError:
        print(f"song.ini not found in: {ini_path}")
        return data

    # Process lines only if file was successfully read
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

def process_song_identifiers(identifier_file, drive_letter="C"):
    """
    Process songidentifiers.txt to extract song data from song.ini files.
    """
    songs = []
    with open(identifier_file, "r", encoding="utf-8") as file:
        for line in file:
            parts = line.split(" Path: ")
            path = parts[1].strip()
            if len(parts) < 2 or path.endswith(".sng") or path.startswith("Not found"):
                continue  # Skip if path ends with .sng or is malformed
            
            song_number, md5_hex = parts[0].split(": ")
            song_number = song_number.split(" ")[1]
            md5_hex = md5_hex.strip()

            if path.startswith(":\\"):
                path = f"{drive_letter}{path}"
            ini_path = os.path.join(path, "song.ini")

            song_data = parse_ini_file(ini_path)
            if "song_length" in song_data:
                song_data["song_length"] = format_song_length(song_data["song_length"])

            song_info = {
                "song_number": int(song_number),
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
    return songs

def identify_songs(identifier_file, output_file):
    """
    Process songidentifiers.txt and save the extracted data to songs.txt.
    """
    songs = process_song_identifiers(identifier_file)
    with open(output_file, "w", encoding="utf-8") as file:
        json.dump(songs, file, indent=2)
    print(f"Processed data saved to {output_file}.")