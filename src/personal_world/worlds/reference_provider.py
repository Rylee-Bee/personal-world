"""Reference provider: an in-process HTTP server plus a TEST-ONLY sender.

Contract: docs/rebuild/CONTRACTS.md (C1 providers, C2 ``error_class``).

``ReferenceServer`` is a stdlib :class:`~http.server.ThreadingHTTPServer` bound to
127.0.0.1 on an ephemeral port, serving in a daemon thread. It speaks a small,
deliberately awkward HTTP dialect so the runner's failure paths can be exercised
for real instead of mocked:

* happy JSON (``/items``, ``/status``, ``/empty``, ``/echo-query``),
* a stateful POST that counts (``/actions/ping``, ``/lost``),
* the whole ``error_class`` surface (``/slow``, ``/boom``, ``/validate``,
  ``/malformed``, ``/redirect``, ``/oversize``, ``/secret``),
* credential shapes (``/echo-auth``, ``/secret-echo``).

``reference_send`` is **test-only**. It is *not* the confinement module and it is
*not* the production outbound path: it makes no SSRF, DNS, redirect or
credential-store decision beyond what these acceptance tests need. Production
outbound traffic goes through
:func:`personal_world.worlds.confinement.confined_request`, which refuses to send
until L-authority replaces the stub. What ``reference_send`` does guarantee is
the *shape* the runner may rely on: exactly one network attempt, redirects never
followed, a byte ceiling enforced while streaming, and the C2 ``error_class``
vocabulary -- and never a secret value in a note.
"""

from __future__ import annotations

import base64
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable, Literal
from urllib.parse import parse_qsl, urlsplit

import httpx

from .confinement import ConfinementError, RawResponse
from .models import Provider, Request

__all__ = ["ReferenceServer", "reference_send"]

ITEMS: dict[str, Any] = {
    "items": [
        {"id": 1, "name": "alpha", "size": 1024},
        {"id": 2, "name": "beta", "size": 2048},
    ],
    "total": 2,
}
STATUS: dict[str, Any] = {
    "state": "ok",
    "uptime": 3725,
    "cpu": 0.256,
    "disk": {"used": 512, "total": 1024},
}
EMPTY: dict[str, Any] = {"items": []}
OVERSIZE_BYTES = 3 * 1024 * 1024


def _encode(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload).encode()


class _Server(ThreadingHTTPServer):
    """Threading server that knows the :class:`ReferenceServer` that owns it."""

    daemon_threads = True
    owner: "ReferenceServer"

    def handle_error(self, request: Any, client_address: Any) -> None:
        """Stay quiet: a client hanging up mid-answer is one of the tests."""


class _Handler(BaseHTTPRequestHandler):
    """Routes one request on the reference server. Owner is the ReferenceServer."""

    server_version = "pw-reference/1.0"
    protocol_version = "HTTP/1.0"  # one request per connection; no keep-alive state

    # -- plumbing ---------------------------------------------------------

    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: A003 - stdlib name
        """Silence stderr: the reference server must not pollute test output."""

    @property
    def _owner(self) -> "ReferenceServer":
        return self.server.owner  # type: ignore[attr-defined]

    def _record(self) -> tuple[str, str]:
        split = urlsplit(self.path)
        self._owner.record(self.command, split.path, dict(self.headers))
        return split.path, split.query

    def _json(self, status: int, payload: Any, headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload).encode()
        self._respond(status, body, "application/json", headers)

    def _respond(
        self,
        status: int,
        body: bytes,
        content_type: str = "application/json",
        headers: dict[str, str] | None = None,
    ) -> None:
        try:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            for key, value in (headers or {}).items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(body)
        except OSError:
            # The client hung up early (timeout, size ceiling, lost response).
            # That is the point of those tests, not a server fault.
            self.close_connection = True

    def _authorized(self) -> bool:
        expected = self._owner.token
        received = self.headers.get("Authorization")
        if expected is None:
            return True  # no token configured: the endpoints stay open
        return received == f"Bearer {expected}"

    def _drop(self) -> None:
        """Take effect, then close the socket without answering at all."""
        self.close_connection = True
        try:
            self.connection.close()
        except OSError:
            pass

    # -- routes -----------------------------------------------------------

    def do_GET(self) -> None:  # noqa: N802 - stdlib name
        path, query = self._record()
        if path == "/items":
            self._json(200, ITEMS)
        elif path == "/status":
            self._json(200, STATUS)
        elif path == "/empty":
            self._json(200, EMPTY)
        elif path == "/echo-query":
            self._json(200, dict(parse_qsl(query, keep_blank_values=True)))
        elif path == "/slow":
            time.sleep(float(dict(parse_qsl(query)).get("delay", "1")))
            self._json(200, {"slept": True})
        elif path == "/boom":
            self._json(500, {"error": "boom"})
        elif path == "/malformed":
            self._respond(200, b"not json {", "application/json")
        elif path == "/redirect":
            self._respond(302, b"", "application/json", {"Location": "/items"})
        elif path == "/oversize":
            self._respond(200, b"x" * OVERSIZE_BYTES, "application/octet-stream")
        elif path == "/secret":
            if not self._authorized():
                self._json(401, {"error": "unauthorized"})
            else:
                self._json(200, {"ok": True})
        elif path == "/secret-echo":
            if not self._authorized():
                self._json(401, {"error": "unauthorized"})
            else:
                self._json(200, {"authorization": self.headers.get("Authorization")})
        elif path == "/echo-auth":
            self._json(
                200,
                {
                    "authorization": self.headers.get("Authorization"),
                    "x-api-key": self.headers.get("X-Api-Key"),
                },
            )
        else:
            self._json(404, {"error": "not_found"})

    def do_HEAD(self) -> None:  # noqa: N802 - stdlib name
        self._record()
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:  # noqa: N802 - stdlib name
        path, _ = self._record()
        if path == "/actions/ping":
            key = self.headers.get("Idempotency-Key")
            replay = self._owner.replay(key) if key else None
            if replay is None:
                replay = _encode({"ok": True, "count": self._owner.bump("ping")})
                if key:
                    self._owner.remember(key, replay)
            self._respond(200, replay)
        elif path == "/validate":
            self._json(422, {"error": "validation_failed"})
        elif path == "/lost":
            self._owner.bump("lost")  # the effect really happens ...
            self._drop()  # ... but the answer never does
        else:
            self._json(404, {"error": "not_found"})


class ReferenceServer:
    """A loopback HTTP server with the endpoints the acceptance tests need.

    ``with ReferenceServer(token="s3cret-value") as srv:`` starts a daemon thread
    and, on exit, shuts the server down and closes the listening socket (so a
    later connect to the same port is refused -- that is how the ``connection``
    case is provoked).
    """

    def __init__(self, token: str | None = None) -> None:
        self.token = token
        self.counters: dict[str, int] = {}
        self.calls: list[tuple[str, str, dict[str, str]]] = []
        self._idempotent: dict[str, bytes] = {}
        self._lock = threading.Lock()
        self._httpd = _Server(("127.0.0.1", 0), _Handler)
        self._httpd.owner = self
        self._thread: threading.Thread | None = None
        host, port = self._httpd.server_address[:2]
        self.base_url = f"http://{host}:{port}"

    # -- lifecycle --------------------------------------------------------

    def start(self) -> "ReferenceServer":
        if self._thread is not None:
            return self
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        return self

    def stop(self) -> None:
        self._httpd.shutdown()
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        self._httpd.server_close()

    def __enter__(self) -> "ReferenceServer":
        return self.start()

    def __exit__(self, *exc: object) -> None:
        self.stop()

    # -- observability ----------------------------------------------------

    def calls_to(self, path: str) -> int:
        """How many requests reached ``path`` (query string not counted)."""
        return sum(1 for _, seen, _ in self.calls if seen == path)

    # -- counters (called from handler threads) ---------------------------

    def bump(self, name: str) -> int:
        with self._lock:
            self.counters[name] = self.counters.get(name, 0) + 1
            return self.counters[name]

    def remember(self, key: str, body: bytes) -> None:
        with self._lock:
            self._idempotent[key] = body

    def replay(self, key: str) -> bytes | None:
        with self._lock:
            return self._idempotent.get(key)

    def record(self, method: str, path: str, headers: dict[str, str]) -> None:
        with self._lock:
            self.calls.append((method, path, headers))


Sender = Callable[[Provider, Request], RawResponse | ConfinementError]


def _build_url(provider: Provider, request: Request) -> str:
    base = provider.base_url.rstrip("/")
    prefix = provider.path_prefix.rstrip("/")
    return f"{base}{prefix}{request.path}"


def _auth_headers(auth: Any, secrets: dict[str, str]) -> tuple[dict[str, str] | None, str | None]:
    """Headers to add for ``auth``, or ``(None, note)`` when the secret is missing.

    The note never contains a secret value -- only the name of what was missing.
    """
    if auth.type == "none" or not auth.secret_ref:
        return {}, None
    _, _, name = auth.secret_ref.partition(":")
    value = secrets.get(name)
    if value is None:
        return None, f"secret not available for {auth.secret_ref}"
    if auth.type == "bearer":
        return {"Authorization": f"Bearer {value}"}, None
    if auth.type == "header":
        return {auth.header_name or "X-Api-Key": value}, None
    encoded = base64.b64encode(value.encode()).decode()
    return {"Authorization": f"Basic {encoded}"}, None


def reference_send(secrets: dict[str, str]) -> Sender:
    """Build the TEST-ONLY sender used by the reference-provider tests.

    TEST ONLY. This is **not** the confinement module and not the production
    outbound path -- see the module docstring. It performs exactly one attempt
    per call, never follows a redirect, enforces ``provider.max_bytes`` while
    streaming, maps transport failures onto the C2 ``error_class`` vocabulary,
    and never puts a secret value into a note.

    Returns ``RawResponse`` for any completed exchange -- including 4xx/5xx and
    undecodable bodies: whether a status is a failure is the runner's call.
    """

    def send(provider: Provider, request: Request, *, effect: Literal["read", "write"]) -> RawResponse | ConfinementError:
        started = time.monotonic()

        def elapsed_ms() -> int:
            return int((time.monotonic() - started) * 1000)

        headers: dict[str, str] = dict(request.headers)
        auth_headers, missing = _auth_headers(provider.auth, secrets)
        if auth_headers is None:
            # Nothing is sent at all: an unreachable credential fails closed.
            return ConfinementError("auth_failed", missing or "", duration_ms=elapsed_ms())
        headers.update(auth_headers)

        timeout_s = request.timeout_s or provider.timeout_s
        client = httpx.Client(follow_redirects=False, trust_env=False, timeout=timeout_s)
        try:
            with client.stream(
                request.method,
                _build_url(provider, request),
                params=request.query or None,
                headers=headers,
                json=request.body if request.body is not None else None,
            ) as response:
                if 300 <= response.status_code < 400:
                    return ConfinementError(
                        "redirect_refused",
                        f"refused redirect to {response.headers.get('Location', '?')}",
                        status_code=response.status_code,
                        duration_ms=elapsed_ms(),
                    )
                body = bytearray()
                for chunk in response.iter_bytes():
                    body.extend(chunk)
                    if len(body) > provider.max_bytes:
                        return ConfinementError(
                            "too_large",
                            f"body over max_bytes={provider.max_bytes}",
                            status_code=response.status_code,
                            duration_ms=elapsed_ms(),
                        )
                return RawResponse(
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    body=bytes(body),
                    duration_ms=elapsed_ms(),
                )
        except httpx.TimeoutException:
            return ConfinementError("timeout", f"no answer within {timeout_s}s", duration_ms=elapsed_ms())
        except httpx.TransportError as exc:
            return ConfinementError(
                "connection",
                f"transport failure: {type(exc).__name__}",
                duration_ms=elapsed_ms(),
            )
        finally:
            client.close()

    return send
