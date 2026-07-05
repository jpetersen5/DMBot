from gevent import monkey
monkey.patch_all()

from app import create_app
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler

app = create_app()

if __name__ == "__main__":
    WSGIServer(("", 5000), app, handler_class=WebSocketHandler).serve_forever()