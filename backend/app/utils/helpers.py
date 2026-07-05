import os
import base64
import jwt
from functools import wraps
from typing import Callable, Concatenate, ParamSpec
from flask import request, jsonify
from ..config import Config
from ..types import FlaskResponse

P = ParamSpec("P")

# token_required injects user_id (str) as the wrapped view's first positional arg,
# so the returned view drops that leading parameter from the caller's perspective.
AuthedView = Callable[Concatenate[str, P], FlaskResponse]
View = Callable[P, FlaskResponse]


def get_process_songs_script() -> str:
    """
    retrieve and decode the process songs script from environment variables

    returns:
        str: decoded process songs script (run with exec to use, i.e. exec(get_process_songs_script()) )
    """
    encoded_script = os.getenv("PROCESS_SONGS_SCRIPT")
    if not encoded_script:
        return """
def parse_score_data(file_object):
    print("This is a dummy implementation of parse_score_data")
    print("The actual implementation is not available in this environment")
    return {}
"""
    return base64.b64decode(encoded_script).decode("utf-8")

def allowed_file(filename: str) -> bool:
    """
    check if the file extension is allowed

    params:
        filename (str): name of the file

    returns:
        bool: True if the file extension is allowed, False otherwise
    """
    return "." in filename and filename.rsplit(".", 1)[1].lower() in Config.ALLOWED_EXTENSIONS

def token_required(f: AuthedView[P]) -> View[P]:
    """Require a valid Bearer JWT; injects user_id as the first argument."""
    @wraps(f)
    def decorated(*args: P.args, **kwargs: P.kwargs) -> FlaskResponse:
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split(" ")
        if len(parts) != 2 or parts[0] != "Bearer":
            return jsonify({"error": "No token provided"}), 401
        jwt_secret = Config.JWT_SECRET
        if not jwt_secret:
            return jsonify({"error": "Server misconfigured"}), 500
        try:
            payload = jwt.decode(parts[1], jwt_secret, algorithms=["HS256"])
            user_id = payload["user_id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except (jwt.PyJWTError, KeyError):
            return jsonify({"error": "Invalid token"}), 401
        return f(user_id, *args, **kwargs)
    return decorated
