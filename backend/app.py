import os
from flask import Flask, jsonify, request, redirect
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client
import requests

load_dotenv()
app = Flask(__name__)

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
    
    user_data_params = f"id={user_data['id']}&username={user_data['username']}&avatar={user_data.get('avatar', '')}"
    return redirect(f'{FRONTEND_URL}/auth/callback?{user_data_params}')

@app.route("/api/user")
def get_user():
    return jsonify({'id': '123', 'username': 'testuser', 'avatar': 'avatar_hash'})

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