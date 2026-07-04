import os
import pytest

os.environ.setdefault("SECRET_KEY", "test")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test")
os.environ.setdefault("DISCORD_CLIENT_ID", "test")
os.environ.setdefault("DISCORD_CLIENT_SECRET", "test")
os.environ.setdefault("DISCORD_REDIRECT_URI", "http://localhost/callback")

@pytest.fixture
def jwt_secret():
    return os.environ["JWT_SECRET"]