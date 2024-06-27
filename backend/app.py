import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
app = Flask(__name__)

allowed_origins = os.getenv('ALLOWED_ORIGINS', 'https://jpetersen5.github.io').split(',')
CORS(app, resources={r"/api/*": {
    "origins": allowed_origins,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY')
supabase: Client = create_client(supabase_url, supabase_key)

@app.route('/api/hello', methods=['GET'])
def hello():
    return jsonify({"message": "Functional"})

@app.route('/api/db-status', methods=['GET'])
def db_status():
    try:
        result = supabase.table('users').select('id').limit(1).execute()
        return jsonify({"status": "Connected", "message": "Database is functional"})
    except Exception as e:
        return jsonify({"status": "Error", "message": str(e)})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)