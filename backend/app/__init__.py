from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from .extensions import Session, limiter, socketio, redis, setup_logging
from .config import Config
from .api import auth, users, songs, charters, scores, status, leaderboards, spotify, achievements
from .cli import register_cli
from .services.supabase_service import init_supabase

def create_app(config_class: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    _ = setup_logging(app)

    CORS(app, resources={r"/api/*": {
        "origins": app.config["ALLOWED_ORIGINS"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }})
    Session(app)
    socketio.init_app(app, cors_allowed_origins=app.config["ALLOWED_ORIGINS"])
    redis.init_app(app)
    limiter.init_app(app)

    register_cli(app)
    init_supabase(app)

    app.register_blueprint(auth.bp)
    app.register_blueprint(users.bp)
    app.register_blueprint(songs.bp)
    app.register_blueprint(charters.bp)
    app.register_blueprint(scores.bp)
    app.register_blueprint(status.bp)
    app.register_blueprint(leaderboards.bp)
    app.register_blueprint(spotify.bp)
    app.register_blueprint(achievements.bp)

    @app.errorhandler(Exception)
    def handle_unexpected_error(e: Exception):
        if isinstance(e, HTTPException):
            return e
        app.logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
        return jsonify({"error": "An unexpected error occurred"}), 500

    return app