from flask_cors import CORS
from flask_session import Session
from flask_socketio import SocketIO, join_room
from flask_redis import FlaskRedis
import logging

cors = CORS()
session = Session()
socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet", logger=True, engineio_logger=True)
redis = FlaskRedis()
logger = logging.getLogger(__name__)

@socketio.on("connect")
def handle_connect():
    logger.info("Client connected")

@socketio.on("join")
def on_join(user_id):
    join_room(user_id)
    logger.info(f"User {user_id} joined")