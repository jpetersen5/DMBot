from flask import Flask
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_session import Session
from flask_socketio import SocketIO, join_room
from flask_redis import FlaskRedis
import logging
import os

cors = CORS()
session = Session()
socketio = SocketIO(async_mode="gevent")
redis = FlaskRedis()
limiter = Limiter(
    get_remote_address,
    default_limits=["200 per minute"],
    storage_uri=os.getenv("REDIS_URL", "memory://"),
)

def setup_logging(app: Flask) -> logging.Logger:
    logger = logging.getLogger(app.name)
    logger.setLevel(logging.INFO)

    c_handler = logging.StreamHandler()
    c_handler.setLevel(logging.INFO)

    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    c_handler.setFormatter(formatter)

    logger.addHandler(c_handler)

    return logger

@socketio.on("connect")
def handle_connect():
    logging.getLogger("socketio").info("Client connected")

@socketio.on("join")
def on_join(user_id):
    join_room(user_id)
    logging.getLogger("socketio").info(f"User {user_id} joined")