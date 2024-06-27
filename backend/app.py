import os
from flask import Flask, jsonify, request, redirect, session
from flask_cors import CORS
from flask_session import Session
from dotenv import load_dotenv
from supabase import create_client, Client
import requests
import jwt
import datetime
import secrets
import warnings

load_dotenv()
app = Flask(__name__)

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
supabase_key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET")
DISCORD_REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://jpetersen5.github.io/DMBot")
DISCORD_API_ENDPOINT = "https://discord.com/api/v10"

@app.route("/api/auth/login")
def login():
    return redirect(f"{DISCORD_API_ENDPOINT}/oauth2/authorize?client_id={DISCORD_CLIENT_ID}&redirect_uri={DISCORD_REDIRECT_URI}&response_type=code&scope=identify email")

@app.route("/api/auth/callback")
def callback():
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
    credentials = response.json()
    access_token = credentials["access_token"]

    user_response = requests.get(f"{DISCORD_API_ENDPOINT}/users/@me", headers={
        "Authorization": f"Bearer {access_token}"
    })
    user_data = user_response.json()

    supabase.table("users").upsert({
        "id": user_data["id"],
        "username": user_data["username"],
        "email": user_data["email"],
        "avatar": user_data["avatar"]
    }).execute()
    
    session['user'] = user_data
    
    token = jwt.encode({
        'user_id': user_data['id'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, JWT_SECRET, algorithm='HS256')
    
    return redirect(f"{FRONTEND_URL}/#/auth?token={token}")

@app.route("/api/auth/logout")
def logout():
    session.pop('user', None)
    return jsonify({"message": "Logged out successfully"})

@app.route("/api/user")
def get_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "No token provided"}), 401
    try:
        token = auth_header.split(' ')[1]
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        user_id = payload['user_id']
        response = supabase.table("users").select("*").eq("id", user_id).execute()
        
        if response.data:
            user = response.data[0]
            return jsonify({
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "avatar": user["avatar"]
            })
        else:
            return jsonify({"error": "User not found"}), 404
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/hello", methods=["GET"])
def hello():
    return jsonify({"message": "Functional"})

@app.route("/api/db-status", methods=["GET"])
def db_status():
    try:
        result = supabase.table("users").select("id").limit(1).execute()
        return jsonify({"status": "Connected", "message": "Functional"})
    except Exception as e:
        return jsonify({"status": "Error", "message": str(e)})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)