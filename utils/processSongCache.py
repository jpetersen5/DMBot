import os
import re

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

if __name__ == "__main__":
    score_data_path = "scoredata.txt"
    binary_file_path = "songcache.bin"

    if not os.path.isfile(binary_file_path):
        print("Binary file does not exist.")
        exit()

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
    with open("songidentifiers.txt", "w", encoding="utf-8") as output_file:
        output_file.writelines(results)
    print("Results written to songidentifiers.txt.")
