from flask import Flask
from supabase import create_client, Client

supabase: Client = None

def init_supabase(app: Flask):
    global supabase
    supabase = create_client(app.config["SUPABASE_URL"], app.config["SUPABASE_SERVICE_KEY"])

def get_supabase():
    return supabase