import os

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

def process_song_identifiers(identifier_file):
    """
    Process songidentifiers.txt to extract song data from song.ini files.
    """
    results = []
    with open(identifier_file, "r", encoding="utf-8") as file:
        for line in file:
            parts = line.split(" Path: ")
            if len(parts) < 2 or parts[1].strip().endswith(".sng"):
                continue  # Skip if path ends with .sng or is malformed
            path = parts[1].strip()
            ini_path = os.path.join(path, "song.ini")
            song_data = parse_ini_file(ini_path)
            if "song_length" in song_data:
                song_data["song_length"] = format_song_length(song_data["song_length"])
            results.append(f"{song_data.get("artist", "")}, {song_data.get("name", "")}, {song_data.get("album", "")}, "
                           f"{song_data.get("track", "")}, {song_data.get("year", "")}, {song_data.get("genre", "")}, "
                           f"{song_data.get("diff_drums_real", "")}, {song_data.get("song_length", "")}, {song_data.get("charter", "")}")
    return results

def save_results_to_file(results, output_file):
    """
    Save the extracted data to songs.txt.
    """
    with open(output_file, "w", encoding="utf-8") as file:
        for result in results:
            file.write(result + "\n")

if __name__ == "__main__":
    identifier_file = "songidentifiers.txt"
    output_file = "songs.txt"
    results = process_song_identifiers(identifier_file)
    save_results_to_file(results, output_file)
    print(f"Processed data saved to {output_file}.")
