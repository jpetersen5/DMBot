from typing import Optional
from flask import Flask
from supabase import create_client, Client

supabase: Optional[Client] = None

def init_supabase(app: Flask):
    global supabase
    supabase = create_client(app.config["SUPABASE_URL"], app.config["SUPABASE_SERVICE_KEY"])

def get_supabase() -> Client:
    if supabase is None:
        raise RuntimeError("Supabase client is not initialized")
    return supabase