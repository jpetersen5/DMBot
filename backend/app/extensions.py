from flask import Flask
from flask_cors import CORS
from flask_session import Session
from flask_socketio import SocketIO, join_room
from flask_redis import FlaskRedis
import logging

cors = CORS()
session = Session()
socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet", logger=True, engineio_logger=True)
redis = FlaskRedis()

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