from flask import Flask
from flask_cors import CORS
from .extensions import Session, socketio, redis, setup_logging
from .config import Config
from .api import auth, users, songs, charters, scores, status, leaderboards, spotify
from .services.supabase_service import init_supabase
# from .migrations.update_leaderboard_rankings import update_leaderboards
# from .migrations.upload_new_songs import upload_new_songs
# from .migrations.populate_songs_new_table import populate_songs_new_table

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    logger = setup_logging(app)

    CORS(app, resources={r"/api/*": {
        "origins": app.config["ALLOWED_ORIGINS"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }})
    Session(app)
    socketio.init_app(app, cors_allowed_origins="*")
    redis.init_app(app)

    init_supabase(app)

    # Uncomment when running migrations
    # with app.app_context():
        # populate_songs_new_table()
        # update_leaderboards()
        # upload_new_songs()

    app.register_blueprint(auth.bp)
    app.register_blueprint(users.bp)
    app.register_blueprint(songs.bp)
    app.register_blueprint(charters.bp)
    app.register_blueprint(scores.bp)
    app.register_blueprint(status.bp)
    app.register_blueprint(leaderboards.bp)
    app.register_blueprint(spotify.bp)
    
    return app