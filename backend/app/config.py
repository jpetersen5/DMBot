import os
from dotenv import load_dotenv

FLASK_ENV = os.getenv("FLASK_ENV", "development")
if FLASK_ENV == "production":
    load_dotenv(".env")
else:
    load_dotenv(".env.dev")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY")
    JWT_SECRET = os.getenv("JWT_SECRET")
    SESSION_TYPE = "filesystem"
    ALLOWED_EXTENSIONS = {"bin", "ini"}
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID")
    DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET")
    DISCORD_REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
    DISCORD_API_ENDPOINT = "https://discord.com/api/v10"
    REDIS_URL = os.getenv("REDIS_URL")
    SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
    SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

    REQUIRED_VARS = (
        "SECRET_KEY",
        "JWT_SECRET",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_KEY",
        "DISCORD_CLIENT_ID",
        "DISCORD_CLIENT_SECRET",
        "DISCORD_REDIRECT_URI",
    )

    @classmethod
    def init_app(cls, app):
        missing = [v for v in cls.REQUIRED_VARS if not getattr(cls, v)]
        if missing:
            raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")
        app.config.from_object(cls)