import os
import re

def find_md5_and_print_path(file_path, md5_hex, search_back=1024):
    """
    Searches for the specified MD5 hash in the binary file and attempts to decode any potential file paths before the hash,
    and prints the character count between the end of the found path and the start of 'notes.mid'.
    
    :param file_path: Path to the binary file.
    :param md5_hex: MD5 hash in hexadecimal format to find.
    :param search_back: Number of bytes to search backwards from the hash for potential paths.
    """
    md5_bytes = bytes.fromhex(md5_hex)

    if not os.path.isfile(file_path):
        print("File does not exist.")
        return

    with open(file_path, 'rb') as file:
        file_content = file.read()  # Read the whole file into memory

    start = 0
    while True:
        index = file_content.find(md5_bytes, start)
        if index == -1:
            break  # No more occurrences found

        # Look for potential paths before the hash
        start_search = max(index - search_back, 0)
        pre_data = file_content[start_search:index]  # Data before the hash

        decoded_string = pre_data.decode('ansi', errors='ignore')

        # Find all instances of paths starting with 'c:\'
        paths = [m.start() for m in re.finditer(r'c:\\', decoded_string, re.IGNORECASE)]
        notes_mid_matches = [m.start() for m in re.finditer('notes.mid', decoded_string)]

        if paths and notes_mid_matches:
            # Choose the last path and the last 'notes.mid' occurrence
            last_path_start = paths[-1]
            last_notes_mid_index = notes_mid_matches[-1]
            print(decoded_string[last_path_start:last_notes_mid_index])

            # Set the end of the path to be 7 characters before 'notes.mid'
            path_end_index = last_notes_mid_index - 17
            if path_end_index < last_path_start:
                print("Invalid path end index; 'notes.mid' found too close to start of path.")
                continue

            file_path = decoded_string[last_path_start:path_end_index]

            characters_to_notes_mid = last_notes_mid_index - path_end_index
            print(f"File path found at offset {start_search + last_path_start} to {start_search + path_end_index}: {file_path}")
            print(f"Characters from end of path to 'notes.mid': {characters_to_notes_mid}")
        else:
            print("No valid path and 'notes.mid' sequence found.")

        start = index + len(md5_bytes)

if __name__ == "__main__":
    file_path = "songcache.bin"
    md5_hex = "4976300e91d44fa8f9e54e942bfca5a9"
    find_md5_and_print_path(file_path, md5_hex)
