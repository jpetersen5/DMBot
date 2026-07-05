# TODO: Configure Redis message queue to scale workers > 1
# workers = multiprocessing.cpu_count() * 2 + 1
workers = 1
worker_class = "geventwebsocket.gunicorn.workers.GeventWebSocketWorker"
bind = "0.0.0.0:10000"
timeout = 300
keepalive = 2