from flask_cors import CORS
from flask_session import Session
from flask_socketio import SocketIO

cors = CORS()
session = Session()
socketio = SocketIO()