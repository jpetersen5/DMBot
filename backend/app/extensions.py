from flask_cors import CORS
from flask_session import Session
from flask_socketio import SocketIO
import logging

cors = CORS()
session = Session()
socketio = SocketIO()
logger = logging.getLogger(__name__)