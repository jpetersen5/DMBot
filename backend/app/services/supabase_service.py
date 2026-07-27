from typing import Any, Dict, List, Optional, Type, TypeVar, cast
from flask import Flask
from supabase import ClientOptions, create_client, Client
import httpx
import logging
import time

logger = logging.getLogger(__name__)

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
\
UNSENT_ERRORS = (
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.WriteError,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    httpx.RemoteProtocolError,
)
POST_SEND_ERRORS = (httpx.ReadError, httpx.ReadTimeout)

MAX_TRANSPORT_RETRIES = 2
RETRY_BACKOFF = (0.1, 0.5)

class RetryTransport(httpx.BaseTransport):
    """Replay Supabase requests that failed below the HTTP layer."""

    def __init__(self, transport: httpx.BaseTransport) -> None:
        self.transport = transport

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        for attempt in range(MAX_TRANSPORT_RETRIES + 1):
            try:
                return self.transport.handle_request(request)
            except httpx.TransportError as e:
                retryable = isinstance(e, UNSENT_ERRORS) or (
                    isinstance(e, POST_SEND_ERRORS) and request.method in ("GET", "HEAD")
                )
                if not retryable or attempt == MAX_TRANSPORT_RETRIES:
                    raise
                logger.warning(
                    f"Supabase transport error ({type(e).__name__}) on "
                    f"{request.method} {request.url.path}, "
                    f"retry {attempt + 1}/{MAX_TRANSPORT_RETRIES}"
                )
                time.sleep(RETRY_BACKOFF[attempt])
        raise AssertionError("unreachable")

    def close(self) -> None:
        self.transport.close()

supabase: Optional[Client] = None

def init_supabase(app: Flask):
    global supabase
    http_client = httpx.Client(
        transport=RetryTransport(httpx.HTTPTransport(http2=False)),
        timeout=httpx.Timeout(120.0, connect=10.0, pool=10.0),
        follow_redirects=True,
    )
    supabase = create_client(
        app.config["SUPABASE_URL"],
        app.config["SUPABASE_SERVICE_KEY"],
        options=ClientOptions(httpx_client=http_client),
    )

def get_supabase() -> Client:
    if supabase is None:
        raise RuntimeError("Supabase client is not initialized")
    return supabase