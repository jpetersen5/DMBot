from typing import Any, Dict, List, Optional, Type, TypeVar, cast
from flask import Flask
from supabase import create_client, Client

Row = Dict[str, Any]
_T = TypeVar("_T")

def rows(data: Any) -> List[Row]:
    """Narrow postgrest's recursive JSON-typed response.data to plain dict rows.

    Supabase table queries always return a list of JSON objects at runtime;
    postgrest's JSON type alias is too broad for static analysis to follow.
    """
    return cast(List[Row], data)

def rows_as(data: Any, shape: Type[_T]) -> List[_T]:
    """Like :func:`rows`, but narrow to a specific TypedDict/row shape.

    ``shape`` is only used for static typing (e.g. ``rows_as(resp.data, UserRow)``);
    no runtime validation is performed — the rows are cast, matching how the rest
    of the code trusts the DB schema.
    """
    return cast(List[_T], data)

supabase: Optional[Client] = None

def init_supabase(app: Flask):
    global supabase
    supabase = create_client(app.config["SUPABASE_URL"], app.config["SUPABASE_SERVICE_KEY"])

def get_supabase() -> Client:
    if supabase is None:
        raise RuntimeError("Supabase client is not initialized")
    return supabase