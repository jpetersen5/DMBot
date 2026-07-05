from typing import Any, Dict, List, Optional, cast
from flask import Flask
from supabase import create_client, Client

Row = Dict[str, Any]

def rows(data) -> List[Row]:
    """Narrow postgrest's recursive JSON-typed response.data to plain dict rows.

    Supabase table queries always return a list of JSON objects at runtime;
    postgrest's JSON type alias is too broad for static analysis to follow.
    """
    return cast(List[Row], data)

supabase: Optional[Client] = None

def init_supabase(app: Flask):
    global supabase
    supabase = create_client(app.config["SUPABASE_URL"], app.config["SUPABASE_SERVICE_KEY"])

def get_supabase() -> Client:
    if supabase is None:
        raise RuntimeError("Supabase client is not initialized")
    return supabase