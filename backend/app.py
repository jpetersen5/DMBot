import os
from flask import Flask, Blueprint, jsonify, request, redirect, session
from flask_cors import CORS
from flask_session import Session
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError
from werkzeug.utils import secure_filename
import requests
import jwt
import datetime
import base64
import secrets
import warnings
import logging
import re

load_dotenv()
app = Flask(__name__)
app.logger.setLevel(logging.INFO)
logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    warnings.warn("SECRET_KEY not set. Using a random value. This is insecure in a production environment.", RuntimeWarning)
    SECRET_KEY = secrets.token_hex(16)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)

JWT_SECRET = os.getenv('JWT_SECRET')
if not JWT_SECRET:
    warnings.warn("JWT_SECRET not set. Using a random value. This is insecure in a production environment.", RuntimeWarning)
    JWT_SECRET = secrets.token_hex(32)
app.config['JWT_SECRET'] = JWT_SECRET

allowed_origins = os.getenv("ALLOWED_ORIGINS", "https://jpetersen5.github.io").split(",")
CORS(app, resources={r"/api/*": {
    "origins": allowed_origins,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

supabase_url = os.getenv("SUPABASE_URL")
# supabase_key = os.getenv("SUPABASE_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_service_key)

DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET")
DISCORD_REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://jpetersen5.github.io/DMBot")
DISCORD_API_ENDPOINT = "https://discord.com/api/v10"

songs = Blueprint('songs', __name__)
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

ALLOWED_FIELDS = {'name', 'artist', 'album', 'year', 'genre', 'difficulty', 'charter', 'song_length'}

##################################################
###################### AUTH ######################
##################################################
@app.route("/api/auth/login")
def login():
    """
    initiates Discord OAuth2 login process
    
    returns:
        redirect to the Discord authorization page
    """
    return redirect(f"{DISCORD_API_ENDPOINT}/oauth2/authorize?client_id={DISCORD_CLIENT_ID}&redirect_uri={DISCORD_REDIRECT_URI}&response_type=code&scope=identify")

@app.route("/api/auth/callback")
def callback():
    """
    handles OAuth2 callback from Discord, creates or updates user data,
    issues a JWT token for authentication
    
    params:
        code (str): The authorization code returned by Discord
    
    returns:
        redirect to the frontend with the JWT token
    """
    try:
        code = request.args.get("code")
        data = {
            "client_id": DISCORD_CLIENT_ID,
            "client_secret": DISCORD_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": DISCORD_REDIRECT_URI
        }
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        response = requests.post(f"{DISCORD_API_ENDPOINT}/oauth2/token", data=data, headers=headers)
        response.raise_for_status()
        credentials = response.json()
        access_token = credentials["access_token"]

        user_response = requests.get(f"{DISCORD_API_ENDPOINT}/users/@me", headers={
            "Authorization": f"Bearer {access_token}"
        })
        user_response.raise_for_status()
        user_data = user_response.json()

        user_data = {
            "id": user_data["id"],
            "username": user_data["username"],
            "avatar": user_data.get("avatar", ""),
            "last_login": datetime.datetime.utcnow().isoformat()
        }

        result = supabase.table("users").upsert(user_data).execute()

        if not result.data:
            raise APIError("Failed to upsert user data")
    
        token = jwt.encode({
            'user_id': user_data['id'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=30)
        }, JWT_SECRET, algorithm='HS256')
    
        return redirect(f"{FRONTEND_URL}/auth?token={token}")
    
    except requests.RequestException as e:
        app.logger.error(f"Error during Discord API request: {str(e)}")
        return jsonify({"error": "Failed to authenticate with Discord"}), 500
    except APIError as e:
        app.logger.error(f"Supabase API error: {str(e)}")
        return jsonify({"error": "Database operation failed"}), 500
    except Exception as e:
        app.logger.error(f"Unexpected error in callback: {str(e)}")
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route("/api/auth/logout")
def logout():
    """
    log out the current user by clearing their session
    
    returns:
        JSON: message confirming successful logout
    """
    session.pop('user', None)
    return jsonify({"message": "Logged out successfully"})

##################################################
###################### USER ######################
##################################################
@app.route("/api/user")
def get_user():
    """
    retrieves current user's information based on their JWT token
    
    returns:
        JSON: User information; id, username, and avatar
    
    authentication:
        requires valid JWT token in the Authorization header
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "No token provided"}), 401
    try:
        token = auth_header.split(' ')[1]
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        user_id = payload['user_id']
        return get_user_by_id(user_id)
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/user/<string:user_id>")
def get_user_by_id(user_id):
    """
    Retrieves user information based on the provided user ID
    
    Args:
        user_id (str): The Discord ID of the user
    
    Returns:
        JSON: User information; id, username, and avatar
    """
    try:
        response = supabase.table("users").select("*").eq("id", user_id).execute()
        
        if response.data:
            user = response.data[0]
            return jsonify({
                "id": str(user["id"]),
                "username": user["username"],
                "avatar": user["avatar"]
            })
        else:
            return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/users")
def get_users():
    """
    retrieves list of all users in the system
    
    returns:
        JSON: list of user objects; ids, usernames, and avatars
    """
    try:
        result = supabase.table("users").select("id", "username", "avatar").execute()
        app.logger.info(f"Fetched users from database: {result.data}")
        for user in result.data:
            user['id'] = str(user['id'])
        app.logger.info(f"Sending users to frontend: {result.data}")
        return jsonify(result.data)
    except Exception as e:
        app.logger.error(f"Error fetching users: {str(e)}")
        return jsonify({"error": "An error occurred while fetching users"}), 500

##################################################
##################### SONGS ######################
##################################################
def sanitize_input(input_string):
    """Remove any potentially dangerous characters"""
    return re.sub(r'[^\w\s-]', '', input_string)

@songs.route('/api/songs', methods=['GET'])
def get_songs():
    """
    retrieves paginated, sorted, and optionally filtered list of songs
    
    params:
        page (int): page number (default: 1)
        per_page (int): items per page (default: 20, min: 10, max: 100)
        sort_by (str): field to sort by (default: 'name')
        sort_order (str): sort order 'asc' or 'desc' (default: 'asc')
        search (str): search term to filter songs
        filter (str): field to apply the search filter
    
    returns:
        JSON: Paginated list of songs and metadata.
    """
    try:
        page = max(1, request.args.get('page', 1, type=int))
        per_page = min(max(request.args.get('per_page', 20, type=int), 10), 100)
        sort_by = sanitize_input(request.args.get('sort_by', 'name'))
        sort_order = 'desc' if request.args.get('sort_order', 'asc').lower() == 'desc' else 'asc'
        search = sanitize_input(request.args.get('search', ''))
        filter_field = sanitize_input(request.args.get('filter', ''))

        if sort_by not in ALLOWED_FIELDS:
            sort_by = 'name'
        if filter_field and filter_field not in ALLOWED_FIELDS:
            filter_field = ''
        
        start = (page - 1) * per_page
        end = start + per_page - 1

        logger.info(f"Querying songs with parameters: page={page}, per_page={per_page}, sort_by={sort_by}, sort_order={sort_order}, search={search}, filter={filter_field}")

        query = supabase.table('songs').select('*', count='exact')
        
        if search:
            search_lower = search.lower()
            if filter_field == 'charter':
                charters_query = supabase.table('charters').select('name').ilike('name', f'%{search_lower}%')
                charters_response = charters_query.execute()
                matching_charters = [charter['name'] for charter in charters_response.data]
                
                if matching_charters:
                    query = query.filter('charter_refs', 'cs', '{' + ','.join(matching_charters) + '}')
                else:
                    return jsonify({
                        'songs': [],
                        'total': 0,
                        'page': page,
                        'per_page': per_page,
                        'sort_by': sort_by,
                        'sort_order': sort_order
                    }), 200
            elif filter_field:
                query = query.ilike(filter_field, f'%{search}%')
            else:
                search_fields = ['name', 'artist', 'album', 'year', 'genre']
                or_conditions = [f"{field}.ilike.%{search}%" for field in search_fields]
                charters_query = supabase.table('charters').select('name').ilike('name', f'%{search_lower}%')
                charters_response = charters_query.execute()
                matching_charters = [charter['name'] for charter in charters_response.data]
                if matching_charters:
                    or_conditions.append(f"charter_refs.cs.{{{','.join(matching_charters)}}}")
                
                query = query.or_(','.join(or_conditions))

        count_response = query.execute()
        total_songs = count_response.count

        query = query.order(sort_by, desc=(sort_order == 'desc')).range(start, end)
        response = query.execute()
        songs = response.data

        charter_names = set()
        for song in songs:
            if song.get('charter_refs'):
                charter_names.update(song.get('charter_refs', []))
            else:
                logger.warning(f"Song {song.get('id', 'unknown')} has no charter_refs")

        charters_query = supabase.table('charters').select('name', 'colorized_name').in_('name', list(charter_names))
        charters_response = charters_query.execute()
        charters_data = {charter['name']: charter['colorized_name'] for charter in charters_response.data if charter['colorized_name']}

        for song in songs:
            if song.get('charter_refs'):
                song['charters'] = [charters_data.get(charter, charter) for charter in song.get('charter_refs', [])]
            else:
                song['charters'] = []
                logger.warning(f"Song {song.get('id', 'unknown')} has no charters")

        logger.info(f"Total songs matching query: {total_songs}")
        logger.info(f"Retrieved {len(songs)} songs")

        return jsonify({
            'songs': songs,
            'total': total_songs,
            'page': page,
            'per_page': per_page,
            'sort_by': sort_by,
            'sort_order': sort_order
        }), 200
    except APIError as e:
        logger.error(f"Supabase API error: {str(e)}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception("An unexpected error occurred")
        return jsonify({'error': str(e)}), 500
    
app.register_blueprint(songs)

@app.route('/api/related-songs', methods=['GET'])
def get_related_songs():
    """
    retrieves songs related by album, artist, genre, or charter
    
    params:
        album, artist, genre, or charter (str): relation type and value
    
    returns:
        JSON: list of related songs
    """
    relation_types = ['album', 'artist', 'genre', 'charter']
    relation_type = next((param for param in relation_types if param in request.args), None)
    if not relation_type:
        return jsonify({'error': 'Invalid relation type'}), 400

    value = request.args.get(relation_type)
    if not value:
        return jsonify({'error': 'Missing relation value'}), 400

    query = supabase.table('songs').select('*')

    if relation_type == 'charter':
        charter_names = [name.strip() for name in value.split(',')]
        if len(charter_names) == 1:
            query = query.contains('charter_refs', [charter_names[0]])
        else:
            charter_conditions = [
                f"charter_refs.cs.{{'{charter_name}'}}"
                for charter_name in charter_names
            ]
            query = query.or_(','.join(charter_conditions))
    else:
        query = query.eq(relation_type, value)

    if relation_type == 'album':
        query = query.order('track', desc=False)
    else:
        query = query.limit(10)
        
    response = query.execute()

    return jsonify({
        'songs': response.data
    })

##################################################
#################### CHARTER #####################
##################################################
@app.route("/api/charter-colors", methods=["GET"])
def get_charters():
    """
    retrieves colorized names for a list of charters

    params:
        names (str): comma-separated list of charter names

    returns:
        JSON: dictionary of charter names and their colorized versions
    """
    try:
        names = request.args.get('names', '').split(',')
        names = [name.strip() for name in names if name.strip()]
        
        if not names:
            return jsonify({"error": "No charter names provided"}), 400

        query = supabase.table('charters').select('name', 'colorized_name').in_('name', names)
        response = query.execute()
        
        charters_data = {charter['name']: charter['colorized_name'] or charter['name'] for charter in response.data}
        
        return jsonify(charters_data), 200
    except Exception as e:
        app.logger.error(f"Error fetching charter data: {str(e)}")
        return jsonify({"error": "An error occurred while fetching charter data"}), 500

##################################################
##################### SCORES #####################
##################################################
ALLOWED_EXTENSIONS = {'bin'}
MAX_FILE_SIZE = 1024 * 1024 * 1  # 1 MB

def get_process_songs_script():
    encoded_script = os.getenv("PROCESS_SONGS_SCRIPT")
    if not encoded_script:
        raise ValueError("PROCESS_SONGS_SCRIPT environment variable is not set")
    return base64.b64decode(encoded_script).decode('utf-8')

exec(get_process_songs_script())

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_and_save_scores(result, user_id):
    user_scores = []
    
    for song in result['songs']:
        song_info = supabase.table('songs').select('*').eq('md5', song['identifier']).execute().data
        song_info = song_info[0] if song_info else None
        
        for score in song['scores']:
            if score['instrument'] == 9:  # drums
                score_data = {
                    'identifier': song['identifier'],
                    'song_name': song_info.name if song_info else f"Unknown Song: {song['identifier']}",
                    'artist': song_info.artist if song_info else "Unknown Artist",
                    'percent': score['percent'],
                    'is_fc': score['is_fc'],
                    'speed': score['speed'],
                    'score': score['score']
                }
                user_scores.append(score_data)
                
                if song_info:
                    leaderboard = song_info.get('leaderboard', [])
                    user_data = supabase.table('users').select('username').eq('id', user_id).execute().data
                    username = user_data[0]['username'] if user_data else "Unknown User"

                    leaderboard_entry = {
                        'user_id': user_id,
                        'username': username,
                        'score': score['score'],
                        'percent': score['percent'],
                        'is_fc': score['is_fc'],
                        'speed': score['speed']
                    }
                    
                    user_entry = next((entry for entry in leaderboard if entry['user_id'] == user_id), None)
                    if user_entry:
                        if score['score'] > user_entry['score']:
                            leaderboard.remove(user_entry)
                            leaderboard.append(leaderboard_entry)
                    else:
                        leaderboard.append(leaderboard_entry)
                    
                    leaderboard.sort(key=lambda x: x['score'], reverse=True)
                    
                    supabase.table('songs').update({'leaderboard': leaderboard}).eq('md5', song['identifier']).execute()
    
    existing_scores = supabase.table('users').select('scores').eq('id', user_id).execute().data
    existing_scores = existing_scores[0]['scores'] if existing_scores and existing_scores[0]['scores'] else []
    
    for new_score in user_scores:
        existing_score = next((score for score in existing_scores if score['identifier'] == new_score['identifier']), None)
        if existing_score:
            if new_score['score'] > existing_score['score']:
                existing_scores.remove(existing_score)
                existing_scores.append(new_score)
        else:
            existing_scores.append(new_score)
    
    existing_scores.sort(key=lambda x: x['score'], reverse=True)
    
    supabase.table('users').update({'scores': existing_scores}).eq('id', user_id).execute()

@app.route('/api/upload_scoredata', methods=['POST'])
def upload_scoredata():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "No token provided"}), 401
    try:
        token = auth_header.split(' ')[1]
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        user_id = payload['user_id']
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if file and allowed_file(file.filename):
        if file.filename != 'scoredata.bin':
            return jsonify({"error": "File must be named scoredata.bin"}), 400
        if int(request.headers.get('Content-Length', 0)) > MAX_FILE_SIZE:
            return jsonify({"error": "File size exceeds 1 MB limit"}), 400
        
        filename = secure_filename(file.filename)
        if not os.path.exists(app.config['UPLOAD_FOLDER']):
            os.makedirs(app.config['UPLOAD_FOLDER'])
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            with open(filepath, 'rb') as f:
                # from process_songs.py, encoded and saved in env
                result = parse_score_data(f) # type: ignore
            
            if result['version'] != 20211009:
                return jsonify({"error": "Score data is outdated"}), 400
            
            process_and_save_scores(result, user_id)
            
            return jsonify({"message": "Score data processed successfully", "songs_processed": result['song_count']}), 200
        except ValueError as e:
            logging.error(f"Error parsing score data: {str(e)}")
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            logging.error(f"Unexpected error processing score data: {str(e)}", exc_info=True)
            return jsonify({"error": str(e)}), 500
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
    logging.warning("Invalid file in upload request")
    return jsonify({"error": "Invalid file"}), 400

##################################################
##################### STATUS #####################
##################################################
@app.route("/api/hello", methods=["GET"])
def hello():
    """
    health check endpoint
    
    returns:
        JSON: message indicating the API is functional
    """
    return jsonify({"message": "Functional"})

@app.route("/api/db-status", methods=["GET"])
def db_status():
    """
    checks status of the database connection
    
    returns:
        JSON: status of the database connection
    """
    try:
        result = supabase.table("users").select("id").limit(1).execute()
        return jsonify({"status": "Connected", "message": "Functional"})
    except Exception as e:
        return jsonify({"status": "Error", "message": str(e)})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)