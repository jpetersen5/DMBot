import eventlet
import eventlet.wsgi
eventlet.monkey_patch()

from app import create_app, socketio

app = create_app()

if __name__ == "__main__":
    eventlet.wsgi.server(eventlet.listen(("", 5000)), app)