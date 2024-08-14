from flask import Flask
from flask_cors import CORS
from .extensions import Session, socketio
from .config import Config
from .api import auth, users, songs, charters, scores
from .services.supabase_service import init_supabase

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    CORS(app, resources={r"/api/*": {
        "origins": app.config["ALLOWED_ORIGINS"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }})
    Session(app)
    socketio.init_app(app, async_mode="eventlet", cors_allowed_origins="*")

    init_supabase(app)

    app.register_blueprint(auth.bp)
    app.register_blueprint(users.bp)
    app.register_blueprint(songs.bp)
    app.register_blueprint(charters.bp)
    app.register_blueprint(scores.bp)

    return app