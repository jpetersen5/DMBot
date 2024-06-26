import struct
import io

def read_int(file):
    return struct.unpack("I", file.read(4))[0]

def read_bytes(file, length):
    return file.read(length)

def read_byte(file):
    return struct.unpack("B", file.read(1))[0]

def read_ushort(file):
    return struct.unpack("H", file.read(2))[0]

def bytes_to_hex(bytes_data):
    return "".join(f"{byte:02x}" for byte in bytes_data)

def parse_score_data(file_object, song_data):
    output = io.StringIO()
    
    version = read_int(file_object)
    song_count = read_int(file_object)
    unknown_data = read_bytes(file_object, 36)

    output.write(f"Version: {version}\n")
    output.write(f"Song Count: {song_count}\n")
    output.write(f"Unknown Data: {bytes_to_hex(unknown_data)}\n\n")

    songs_info = []

    for i in range(song_count):
        try:
            identifier = read_bytes(file_object, 16)
            identifier_hex = bytes_to_hex(identifier)
            score_count = read_byte(file_object)
            play_count = read_ushort(file_object)
            unknown1 = read_bytes(file_object, 1)
            
            song_info = next((song for song in song_data if song['md5'] == identifier_hex), None)
            
            scores = []
            for j in range(score_count):
                instrument = read_ushort(file_object)
                unknown2 = read_bytes(file_object, 1)
                percent = read_byte(file_object)
                is_fc = read_byte(file_object)
                speed = read_ushort(file_object)
                stars = read_byte(file_object)
                modifiers = read_byte(file_object)
                unknown3 = read_bytes(file_object, 3)
                score = read_int(file_object)
                
                scores.append({
                    'instrument': instrument,
                    'unknown2': unknown2,
                    'percent': percent,
                    'is_fc': is_fc,
                    'speed': speed,
                    'stars': stars,
                    'modifiers': modifiers,
                    'unknown3': unknown3,
                    'score': score
                })

            songs_info.append({
                'number': i + 1,
                'identifier': identifier_hex,
                'song_info': song_info,
                'score_count': score_count,
                'play_count': play_count,
                'unknown1': unknown1,
                'scores': scores
            })

        except Exception as e:
            output.write(f"Failed to read song {i+1}: {str(e)}\n")
            break

    # Sort songs: known songs first, then unknown songs
    sorted_songs = sorted(songs_info, key=lambda x: (x['song_info'] is None, x['number']))

    # Write sorted song information
    for song in sorted_songs:
        output.write(f"Song {song['number']}:\n")
        output.write(f"  Identifier: {song['identifier']}\n")

        if song['song_info']:
            output.write(f"    {song['song_info']['artist']} - {song['song_info']['name']}\n")
            output.write(f"    Charter: {song['song_info']['charter']}\n")
        else:
            output.write("    Unknown Artist - Unknown Song\n")
            output.write("    Charter: Unknown\n")

        output.write(f"  Score Count: {song['score_count']}\n")
        output.write(f"  Play Count: {song['play_count']}\n")
        output.write(f"  Unknown Data: {bytes_to_hex(song['unknown1'])}\n")

        for j, score in enumerate(song['scores'], 1):
            output.write(f"    Score {j}:\n")
            output.write(f"      Instrument: {score['instrument']}\n")
            output.write(f"      Unknown Data: {bytes_to_hex(score['unknown2'])}\n")
            output.write(f"      Percent: {score['percent']}\n")
            output.write(f"      Is FC: {score['is_fc']}\n")
            output.write(f"      Speed: {score['speed']}\n")
            output.write(f"      Stars: {score['stars']}\n")
            output.write(f"      Modifiers: {score['modifiers']}\n")
            output.write(f"      Unknown Data: {bytes_to_hex(score['unknown3'])}\n")
            output.write(f"      Score: {score['score']}\n")

        output.write("\n")

    return output.getvalue()