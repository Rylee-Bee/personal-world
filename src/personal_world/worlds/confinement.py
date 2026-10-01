"""Outbound confinement: the ONLY way Worlds sends a request to a provider.

Contract: docs/rebuild/CONTRACTS.md (C1 provider limits, C2 error classes). Every outbound
request goes through ``confined_request``; nothing else in ``personal_world.worlds`` may open a
socket. What this module guarantees for each call:

* **Resolve, then connect pinned.** The host is resolved once; every answer is classified; the
  connection goes to one of the vetted addresses by IP literal (TLS still verifies the original
  hostname through SNI/verification), so a second DNS answer can never redirect the request.
* **Deny by address class.** Loopback, link-local, private (RFC1918, CGNAT, ULA), unspecified,
  multicast and reserved addresses are refused unless the provider is marked ``network.lan``.
  Cloud metadata addresses are refused even then. If ANY answer is denied, the call is denied.
* **No redirects, no retries, no proxies, no env trust.** A 3xx is ``redirect_refused``.
* **Size and time caps.** ``max_bytes`` (declared and streamed) and one total deadline per call.
* **URL safety.** The joined URL must keep the provider's scheme, host and port; hop-by-hop and
  framing headers and CR/LF in header values are refused; Authorization/Cookie are never taken
  from the request (only injected from the provider's secret reference).
* A read effect may not carry a mutating method.

Secret values are injected here and never put into errors, notes or logs.
"""

from __future__ import annotations

import base64
import ipaddress
import json
import socket
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Literal
from urllib.parse import quote, urlencode, urlsplit

import httpx

from .secrets import resolve_secret_ref

ErrorClass = Literal[
    "timeout",
    "connection",
    "http_4xx",
    "http_5xx",
    "malformed",
    "redirect_refused",
    "too_large",
    "confinement_denied",
    "auth_failed",
]


@dataclass(frozen=True)
class RawResponse:
    status_code: int
    headers: dict[str, str] = field(default_factory=dict)
    body: bytes = b""
    duration_ms: int = 0


@dataclass(frozen=True)
class ConfinementError:
    error_class: ErrorClass
    note: str = ""
    status_code: int | None = None
    duration_ms: int | None = None


_METADATA = {
    ipaddress.ip_address("169.254.169.254"),  # pw-safety: synthetic
    ipaddress.ip_address("169.254.170.2"),  # pw-safety: synthetic
    ipaddress.ip_address("100.100.100.200"),
    ipaddress.ip_address("fd00:ec2::254"),
}
_CGNAT = ipaddress.ip_network("100.64.0.0/10")
_NEVER = (ipaddress.ip_network("0.0.0.0/8"), ipaddress.ip_network("240.0.0.0/4"))
_FORBIDDEN_HEADERS = {
    "host", "content-length", "transfer-encoding", "connection", "upgrade", "te", "trailer",
    "keep-alive", "proxy-authorization", "proxy-connection", "authorization", "cookie", "set-cookie",
    "expect",
}
_MUTATING = {"POST", "PUT", "PATCH", "DELETE"}

Resolver = Callable[[str, int], list[str]]


def _system_resolver(host: str, port: int) -> list[str]:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    out: list[str] = []
    for info in infos:
        addr = info[4][0]
        if addr not in out:
            out.append(addr)
    return out


def classify_address(address: str, *, lan: bool) -> str | None:
    """Return None when allowed, else a short reason. Uses the RESOLVED address, never the text."""
    try:
        ip = ipaddress.ip_address(address.split("%", 1)[0])
    except ValueError:
        return "unparseable address"
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    if ip in _METADATA:
        return "cloud metadata address"
    if ip.is_unspecified or ip.is_multicast:
        return "unroutable address"
    if isinstance(ip, ipaddress.IPv4Address) and any(ip in n for n in _NEVER):
        return "unroutable address"
    internal = (
        ip.is_loopback
        or ip.is_link_local
        or ip.is_private
        or (isinstance(ip, ipaddress.IPv4Address) and ip in _CGNAT)
    )
    if ip.is_reserved and not internal:  # ::1 is "reserved" to ipaddress but is loopback
        return "unroutable address"
    if internal and not lan:
        return "internal address (provider is not marked lan)"
    return None


def _deny(note: str, started: float | None = None) -> ConfinementError:
    return ConfinementError("confinement_denied", note, duration_ms=_ms(started))


def _ms(started: float | None) -> int | None:
    return None if started is None else int((time.monotonic() - started) * 1000)


def build_url(provider: Any, request: Any) -> tuple[str, str, int, str] | str:
    """Return (scheme, host, port, path_and_query) or a refusal reason (str)."""
    base = urlsplit(provider.base_url)
    if base.scheme not in ("http", "https") or not base.hostname:
        return "provider base_url must be http(s) with a host"
    if base.username is not None or base.password is not None or base.fragment or base.query:
        return "provider base_url must not carry userinfo, query or fragment"
    try:
        port = base.port or (443 if base.scheme == "https" else 80)
    except ValueError:
        return "provider base_url has an invalid port"
    if port == 0:
        return "port 0 is not allowed"
    path = request.path
    if (
        not isinstance(path, str)
        or not path.startswith("/")
        or path.startswith("//")
        or "\\" in path
        or "@" in path.split("?")[0]
        or any(c in path for c in ("\r", "\n", "\t", " ", "#"))
        or "?" in path
    ):
        return "request path is not a plain relative path"
    segments = path.split("/")
    low = path.lower()
    if ".." in segments or "." in segments or "%2e" in low or "%2f" in low or "%5c" in low or "%00" in low:
        return "request path escapes its prefix"
    prefix = (provider.path_prefix or "").rstrip("/")
    if prefix and (".." in prefix.split("/") or "\\" in prefix or "://" in prefix):
        return "provider path_prefix is not safe"
    base_path = base.path.rstrip("/")
    full_path = f"{base_path}{prefix}{path}"
    query = urlencode(request.query, quote_via=quote) if request.query else ""
    joined = f"{base.scheme}://{base.netloc}{full_path}" + (f"?{query}" if query else "")
    check = urlsplit(joined)
    if (check.scheme, check.hostname, check.port or port) != (base.scheme, base.hostname, port):
        return "joined URL changed the provider destination"
    return base.scheme, base.hostname, port, full_path + (f"?{query}" if query else "")


def _auth_headers(provider: Any) -> dict[str, str] | ConfinementError:
    auth = provider.auth
    if auth.type == "none":
        return {}
    value = resolve_secret_ref(auth.secret_ref)
    if not value:
        return ConfinementError("auth_failed", "credential is not available")
    if auth.type == "bearer":
        return {"Authorization": f"Bearer {value}"}
    if auth.type == "header":
        return {auth.header_name: value}
    if auth.type == "basic":
        return {"Authorization": "Basic " + base64.b64encode(value.encode()).decode()}
    return ConfinementError("auth_failed", "unknown auth type")


def confined_request(
    provider: Any,
    request: Any,
    *,
    effect: Literal["read", "write"],
    resolver: Resolver | None = None,
) -> RawResponse | ConfinementError:
    """Send one request. Never retries, never follows redirects, never raises."""
    started = time.monotonic()
    try:
        return _send(provider, request, effect, resolver or _system_resolver, started)
    except Exception as exc:  # a bug here must fail closed, with no secret in the note
        return ConfinementError("connection", f"internal error: {type(exc).__name__}", duration_ms=_ms(started))


def _send(provider: Any, request: Any, effect: str, resolver: Resolver, started: float):
    method = request.method.upper()
    if effect not in ("read", "write"):
        return _deny("unknown effect", started)
    if effect == "read" and method in _MUTATING:
        return _deny("a read effect cannot send a mutating method", started)

    built = build_url(provider, request)
    if isinstance(built, str):
        return _deny(built, started)
    scheme, host, port, target = built

    headers: dict[str, str] = {}
    for name, value in request.headers.items():
        if name.lower() in _FORBIDDEN_HEADERS:
            return _deny(f"header {name!r} is not allowed", started)
        if any(c in f"{name}{value}" for c in ("\r", "\n", "\x00")):
            return _deny("header contains a control character", started)
        headers[name] = value

    try:
        addresses = resolver(host, port)
    except (OSError, UnicodeError):
        return ConfinementError("connection", "host did not resolve", duration_ms=_ms(started))
    if not addresses:
        return ConfinementError("connection", "host did not resolve", duration_ms=_ms(started))
    lan = bool(provider.network.lan)
    for address in addresses:
        reason = classify_address(address, lan=lan)
        if reason:
            return _deny(reason, started)
    pinned = addresses[0]

    auth = _auth_headers(provider)
    if isinstance(auth, ConfinementError):
        return auth
    headers.update(auth)

    body = None
    if request.body is not None and method not in ("GET", "HEAD"):
        body = json.dumps(request.body).encode()
        headers.setdefault("Content-Type", "application/json")
    host_text = f"[{host}]" if ":" in host else host
    headers["Host"] = f"{host_text}:{port}" if _nondefault(scheme, port) else host_text
    headers["Connection"] = "close"
    headers.setdefault("Accept", "application/json")

    literal = f"[{pinned}]" if ":" in pinned else pinned
    url = f"{scheme}://{literal}:{port}{target}"
    limit = int(provider.max_bytes)
    budget = float(request.timeout_s or provider.timeout_s)
    timeout = httpx.Timeout(budget, connect=min(budget, 5.0))
    extensions = {"sni_hostname": host} if scheme == "https" else {}
    chunks: list[bytes] = []
    size = 0
    try:
        # verify/limits belong on the transport: httpx ignores them on a Client given a transport.
        transport = httpx.HTTPTransport(
            verify=bool(provider.tls_verify),
            retries=0,
            limits=httpx.Limits(max_keepalive_connections=0),
        )
        with httpx.Client(
            trust_env=False, follow_redirects=False, timeout=timeout, transport=transport
        ) as client:
            with client.stream(method, url, headers=headers, content=body, extensions=extensions) as resp:
                status = resp.status_code
                if 300 <= status < 400:
                    return ConfinementError("redirect_refused", "provider answered with a redirect",
                                            status_code=status, duration_ms=_ms(started))
                declared = resp.headers.get("content-length")
                if declared and declared.isdigit() and int(declared) > limit:
                    return ConfinementError("too_large", "response larger than max_bytes",
                                            status_code=status, duration_ms=_ms(started))
                for chunk in resp.iter_bytes():
                    size += len(chunk)
                    if size > limit:
                        return ConfinementError("too_large", "response larger than max_bytes",
                                                status_code=status, duration_ms=_ms(started))
                    chunks.append(chunk)
                    if time.monotonic() - started > budget:
                        return ConfinementError("timeout", "total time budget exceeded",
                                                status_code=status, duration_ms=_ms(started))
                out_headers = {k.lower(): v for k, v in resp.headers.items()}
    except httpx.TimeoutException:
        return ConfinementError("timeout", "no answer in time", duration_ms=_ms(started))
    except httpx.HTTPError as exc:
        return ConfinementError("connection", f"transport failed: {type(exc).__name__}", duration_ms=_ms(started))
    return RawResponse(status_code=status, headers=out_headers, body=b"".join(chunks), duration_ms=_ms(started) or 0)


def _nondefault(scheme: str, port: int) -> bool:
    return (scheme == "http" and port != 80) or (scheme == "https" and port != 443)
