import json
from typing import List, Optional

import httpx
import pytest

from app import create_app
from app.services import supabase_service
from app.services.supabase_service import MAX_TRANSPORT_RETRIES, RetryTransport


class _StubTransport(httpx.BaseTransport):
    """Raises the queued exceptions in order, then returns 200."""

    def __init__(self, errors: List[Optional[Exception]]):
        self.errors = errors
        self.calls = 0
        self.closed = False

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        self.calls += 1
        error = self.errors.pop(0) if self.errors else None
        if error:
            raise error
        return httpx.Response(200, json={"ok": True}, request=request)

    def close(self) -> None:
        self.closed = True


@pytest.fixture(autouse=True)
def no_backoff_sleep(monkeypatch):
    monkeypatch.setattr(supabase_service.time, "sleep", lambda _: None)


def _request(method: str = "GET") -> httpx.Request:
    return httpx.Request(method, "https://example.supabase.co/rest/v1/users")


def test_retries_write_error_then_succeeds():
    stub = _StubTransport([httpx.WriteError("EOF occurred in violation of protocol")])
    transport = RetryTransport(stub)

    response = transport.handle_request(_request())

    assert response.status_code == 200
    assert stub.calls == 2


def test_gives_up_after_max_retries():
    stub = _StubTransport([httpx.WriteError("boom")] * (MAX_TRANSPORT_RETRIES + 1))
    transport = RetryTransport(stub)

    with pytest.raises(httpx.WriteError):
        transport.handle_request(_request())

    assert stub.calls == MAX_TRANSPORT_RETRIES + 1


def test_read_error_on_write_method_is_not_replayed():
    """The request already reached PostgREST, so replaying a POST could double-apply it."""
    stub = _StubTransport([httpx.ReadError("connection reset")])
    transport = RetryTransport(stub)

    with pytest.raises(httpx.ReadError):
        transport.handle_request(_request("POST"))

    assert stub.calls == 1


def test_read_error_on_get_is_replayed():
    stub = _StubTransport([httpx.ReadError("connection reset")])
    transport = RetryTransport(stub)

    assert transport.handle_request(_request("GET")).status_code == 200
    assert stub.calls == 2


def test_write_error_on_write_method_is_replayed():
    """A failed write means nothing was delivered, so any method is safe to replay."""
    stub = _StubTransport([httpx.WriteError("EOF")])
    transport = RetryTransport(stub)

    assert transport.handle_request(_request("PATCH")).status_code == 200
    assert stub.calls == 2


def test_close_is_delegated():
    stub = _StubTransport([])
    RetryTransport(stub).close()
    assert stub.closed


def _client_with_route(exc: Exception):
    app = create_app()

    @app.route("/api/_boom")
    def boom():
        raise exc

    return app.test_client()


def test_transport_error_returns_503():
    client = _client_with_route(httpx.WriteError("EOF occurred in violation of protocol"))
    r = client.get("/api/_boom")
    assert r.status_code == 503
    assert "temporarily unreachable" in json.loads(r.data)["error"]


def test_other_exceptions_still_return_500():
    client = _client_with_route(ValueError("something else"))
    r = client.get("/api/_boom")
    assert r.status_code == 500
    assert json.loads(r.data)["error"] == "An unexpected error occurred"
