import re
import os
import base64
import jwt
from functools import wraps
from flask import request, jsonify, current_app
from ..config import Config

def sanitize_input(input_string):
    """
    remove dangerous SQL characters from input string

    params:
        input_string (str): string to sanitize
    
    returns:
        str: sanitized string
    """
    return re.sub(r"[^\w\s-]", "", input_string)

def get_process_songs_script():
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

            # Add any other necessary dummy functions here
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

def token_required(f):
    """
    decorator to require a valid JWT token for a route
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            token = request.headers["Authorization"].split(" ")[1]
        if not token:
            return jsonify({"message": "Token is missing!"}), 401
        try:
            data = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
            current_user = data["user_id"]
        except:
            return jsonify({"message": "Token is invalid!"}), 401
        return f(current_user, *args, **kwargs)
    return decorated
