import datetime
import jwt
import pytest
from flask import Flask, jsonify
from app.utils.helpers import token_required

@pytest.fixture
def client(jwt_secret):
    app = Flask(__name__)

    @app.route("/protected")
    @token_required
    def protected(user_id):
        return jsonify({"user_id": user_id})

    return app.test_client()

def make_token(secret, user_id=42, delta_days=1):
    return jwt.encode(
        {"user_id": user_id,
         "exp": datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=delta_days)},
        secret, algorithm="HS256",
    )

def test_valid_token_injects_user_id(client, jwt_secret):
    r = client.get("/protected", headers={"Authorization": f"Bearer {make_token(jwt_secret)}"})
    assert r.status_code == 200
    assert r.get_json()["user_id"] == 42

def test_missing_header_rejected(client):
    assert client.get("/protected").status_code == 401

def test_malformed_header_rejected(client):
    assert client.get("/protected", headers={"Authorization": "garbage"}).status_code == 401

def test_expired_token_rejected(client, jwt_secret):
    r = client.get("/protected",
                   headers={"Authorization": f"Bearer {make_token(jwt_secret, delta_days=-1)}"})
    assert r.status_code == 401
    assert "expired" in r.get_json()["error"].lower()

def test_wrong_secret_rejected(client):
    r = client.get("/protected",
                   headers={"Authorization": f"Bearer {make_token('other-secret')}"})
    assert r.status_code == 401