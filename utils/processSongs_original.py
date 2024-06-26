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

    for i in range(song_count):
        try:
            identifier = read_bytes(file_object, 16)
            identifier_hex = bytes_to_hex(identifier)
            score_count = read_byte(file_object)
            play_count = read_ushort(file_object)
            unknown1 = read_bytes(file_object, 1)
            
            output.write(f"Song {i+1}:\n")
            output.write(f"  Identifier: {bytes_to_hex(identifier)}\n")

            song_info = next((song for song in song_data if song['md5'] == identifier_hex), None)
            if song_info:
                output.write(f"    {song_info['artist']} - {song_info['name']}\n")
                output.write(f"    Charter: {song_info['charter']}\n")
            else:
                output.write("    Unknown Artist - Unknown Song\n")
                output.write("    Charter: Unknown\n")

            output.write(f"  Score Count: {score_count}\n")
            output.write(f"  Play Count: {play_count}\n")
            output.write(f"  Unknown Data: {bytes_to_hex(unknown1)}\n")

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
                
                output.write(f"    Score {j+1}:\n")
                output.write(f"      Instrument: {instrument}\n")
                output.write(f"      Unknown Data: {bytes_to_hex(unknown2)}\n")
                output.write(f"      Percent: {percent}\n")
                output.write(f"      Is FC: {is_fc}\n")
                output.write(f"      Speed: {speed}\n")
                output.write(f"      Stars: {stars}\n")
                output.write(f"      Modifiers: {modifiers}\n")
                output.write(f"      Unknown Data: {bytes_to_hex(unknown3)}\n")
                output.write(f"      Score: {score}\n")

            output.write("\n")
        except Exception as e:
            output.write(f"Failed to read song {i+1}: {str(e)}\n")
            break

    return output.getvalue()