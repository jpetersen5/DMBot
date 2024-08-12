import multiprocessing

workers = multiprocessing.cpu_count() * 2 + 1
worker_class = 'eventlet'
bind = "0.0.0.0:10000"
timeout = 300
keepalive = 2