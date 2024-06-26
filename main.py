from bot.dm_bot import DMBot
from utils.song_identifier import process_cache, identify_songs
import logging

logging.basicConfig(level=logging.DEBUG)

def main():
    # score_data_path = "data/scoredata.txt"
    # binary_file_path = "data/bin/songcache.bin"
    # songidentifiers_path = "data/songidentifiers.txt"
    # songs_output_path = "data/songs.json"

    # process_cache(score_data_path, binary_file_path, songidentifiers_path)
    # identify_songs(songidentifiers_path, songs_output_path)

    bot = DMBot()
    bot.run()

if __name__ == "__main__":
    main()
