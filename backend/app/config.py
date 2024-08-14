import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY")
    JWT_SECRET = os.getenv("JWT_SECRET")
    SESSION_TYPE = "filesystem"
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
    ALLOWED_EXTENSIONS = {"bin"}
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://jpetersen5.github.io").split(",")
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID")
    DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET")
    DISCORD_REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "https://jpetersen5.github.io/DMBot")
    DISCORD_API_ENDPOINT = "https://discord.com/api/v10"