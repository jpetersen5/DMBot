from flask_cors import CORS
from flask_session import Session
from flask_socketio import SocketIO
import logging

cors = CORS()
session = Session()
socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet", logger=True, engineio_logger=True)
logger = logging.getLogger(__name__)