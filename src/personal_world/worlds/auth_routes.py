"""Sign-in, sign-out, step-up and session routes for the single owner (fail closed).

* The redirect URI and cookie origin come from ``owner.yaml`` ``public_origin``, never from the
  Host header (no host-header poisoning of the OIDC redirect).
* OIDC sign-in succeeds only for the allow-listed ``issuer`` + ``subject``. A verified identity
  that is not the owner gets 403 and no session.
* Local bootstrap sign-in uses a secret from a ``secret_ref``; failures are rate limited.
* Step-up needs a FRESH proof: an OIDC re-login with ``auth_time`` inside the window for the same
  subject, or the bootstrap secret again. A token never confers step-up.
* Every POST here also requires an allowed Origin (login CSRF), even with no session yet.
"""

from __future__ import annotations

import time
from collections import deque
from typing import Any, Callable
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse

from ..oidc import FLOW_COOKIE, OIDCError, OIDCLoginError
from .authn import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, Auth
from .owner import OwnerPolicy

FRESH_AUTH_SECONDS = 120
MAX_FAILURES = 5
FAILURE_WINDOW = 600


class _Limiter:
    def __init__(self, clock: Callable[[], float]):
        self._clock, self._fails = clock, deque()

    def blocked(self) -> bool:
        now = self._clock()
        while self._fails and now - self._fails[0] > FAILURE_WINDOW:
            self._fails.popleft()
        return len(self._fails) >= MAX_FAILURES

    def fail(self) -> None:
        self._fails.append(self._clock())

    def clear(self) -> None:
        self._fails.clear()


def _safe_return(path: str | None) -> str:
    if not path or not path.startswith("/") or path.startswith("//") or "\\" in path or "\n" in path or "\r" in path:
        return "/"
    return path


def register_auth_routes(app: FastAPI, auth: Auth, policy_loader: Callable[[], OwnerPolicy], oidc_service: Any | None = None) -> None:
    limiter = _Limiter(auth.clock)

    def policy() -> OwnerPolicy:
        return policy_loader()

    def require_origin(request: Request) -> None:
        origin = request.headers.get("origin")
        if origin is None or origin.rstrip("/") not in auth.allowed_origins:
            raise HTTPException(status_code=403, detail="origin not allowed")

    def start_session(response: JSONResponse | RedirectResponse, method: str) -> str:
        sid = auth.sessions.create("owner", method)
        response.set_cookie(SESSION_COOKIE, sid, httponly=True, secure=True, samesite="lax", max_age=7 * 24 * 3600, path="/")
        response.set_cookie(CSRF_COOKIE, auth.csrf_token(sid), httponly=False, secure=True, samesite="strict", max_age=7 * 24 * 3600, path="/")
        return sid

    def redirect_uri(pol: OwnerPolicy) -> str:
        if not pol.public_origin:
            raise HTTPException(status_code=503, detail="owner policy is not configured")
        return f"{pol.public_origin}/api/auth/oidc/callback"

    @app.get("/api/auth/session")
    def session_info(request: Request) -> JSONResponse:
        sid = request.cookies.get(SESSION_COOKIE)
        row = auth.sessions.get(sid)
        pol = policy()
        base = {"oidc_available": bool(pol.file and pol.file.oidc), "bootstrap_available": bool(pol.file and pol.file.bootstrap.enabled)}
        if row is None:
            return JSONResponse({"authenticated": False, **base}, headers={"Cache-Control": "no-store"})
        step = row["step_up_at"] is not None and auth.clock() - row["step_up_at"] <= 300
        body = {"authenticated": True, "principal": row["principal"], "step_up": step, "csrf_token": auth.csrf_token(sid), **base}
        resp = JSONResponse(body, headers={"Cache-Control": "no-store"})
        resp.set_cookie(CSRF_COOKIE, auth.csrf_token(sid), httponly=False, secure=True, samesite="strict", path="/")
        return resp

    @app.post("/api/auth/bootstrap")
    async def bootstrap(request: Request) -> JSONResponse:
        require_origin(request)
        if limiter.blocked():
            raise HTTPException(status_code=429, detail="too many attempts; wait and try again")
        body = await _json(request)
        if not policy().bootstrap_matches(str(body.get("token", ""))):
            limiter.fail()
            raise HTTPException(status_code=401, detail="that did not work")
        limiter.clear()
        resp = JSONResponse({"ok": True})
        start_session(resp, "bootstrap")
        return resp

    @app.post("/api/auth/step-up")
    async def step_up(request: Request) -> JSONResponse:
        principal = auth.authenticate(request)  # session + CSRF checked here
        if not principal.is_owner or principal.via != "session":
            raise HTTPException(status_code=403, detail="owner session required")
        if limiter.blocked():
            raise HTTPException(status_code=429, detail="too many attempts; wait and try again")
        body = await _json(request)
        if not policy().bootstrap_matches(str(body.get("token", ""))):
            limiter.fail()
            raise HTTPException(status_code=401, detail="that did not work")
        limiter.clear()
        sid = request.cookies.get(SESSION_COOKIE) or ""
        auth.sessions.mark_step_up(sid)
        return JSONResponse({"ok": True})

    @app.post("/api/auth/logout")
    def logout(request: Request) -> JSONResponse:
        principal = auth.authenticate(request)
        sid = request.cookies.get(SESSION_COOKIE)
        if sid and principal.via == "session":
            auth.sessions.invalidate(sid)
        resp = JSONResponse({"ok": True})
        resp.delete_cookie(SESSION_COOKIE, path="/")
        resp.delete_cookie(CSRF_COOKIE, path="/")
        return resp

    def _flow_redirect(url: str, cookie: str) -> RedirectResponse:
        resp = RedirectResponse(url, status_code=303, headers={"Cache-Control": "no-store"})
        resp.set_cookie(FLOW_COOKIE, cookie, httponly=True, secure=True, samesite="lax", max_age=600, path="/")
        return resp

    def _oidc_client(pol: OwnerPolicy):
        if oidc_service is None or not (pol.file and pol.file.oidc):
            raise HTTPException(status_code=503, detail="OIDC sign-in is not configured")
        try:
            return oidc_service.client()
        except OIDCError as exc:
            raise HTTPException(status_code=503, detail=f"OIDC unavailable: {exc.error_code}") from None

    @app.get("/api/auth/oidc/login")
    def oidc_login() -> RedirectResponse:
        pol = policy()
        client = _oidc_client(pol)
        url, _pending, cookie = client.start_login(redirect_uri(pol))
        return _flow_redirect(url, cookie)

    @app.get("/api/auth/oidc/step-up")
    def oidc_step_up(request: Request, return_to: str = "/") -> RedirectResponse:
        row = auth.sessions.get(request.cookies.get(SESSION_COOKIE))
        if row is None:
            raise HTTPException(status_code=401, detail="sign in first")
        pol = policy()
        client = _oidc_client(pol)
        url, _pending, cookie = client.start_login(redirect_uri(pol), step_up_for=row["principal"], return_to=_safe_return(return_to))
        return _flow_redirect(url, cookie)

    @app.get("/api/auth/oidc/callback")
    def oidc_callback(request: Request, code: str = "", state: str = "", error: str = "") -> Any:
        pol = policy()
        if error:
            raise HTTPException(status_code=403, detail="the identity provider refused the sign-in")
        client = _oidc_client(pol)
        try:
            import secrets as _s

            pending = client.read_pending(request.cookies.get(FLOW_COOKIE))
            if not state or not _s.compare_digest(state, pending.state):
                raise OIDCLoginError("sign-in response does not match this browser's attempt", error_code="oidc_state_mismatch")
            identity = client.complete_login(code, pending)
        except OIDCError as exc:
            raise HTTPException(status_code=exc.http_status if hasattr(exc, "http_status") and exc.http_status in (400, 401, 403) else 403,
                                detail=f"sign-in failed ({exc.error_code})") from None
        if not pol.is_owner_identity(identity.issuer, identity.sub):
            raise HTTPException(status_code=403, detail="this identity is not the owner")
        if pending.step_up_for:
            sid = request.cookies.get(SESSION_COOKIE)
            row = auth.sessions.get(sid)
            fresh = identity.auth_time is not None and 0 <= auth.clock() - identity.auth_time <= FRESH_AUTH_SECONDS
            if row is None or row["principal"] != pending.step_up_for or not fresh:
                raise HTTPException(status_code=403, detail="step-up needs a fresh sign-in by the owner")
            auth.sessions.mark_step_up(sid)
            resp = RedirectResponse(_safe_return(pending.return_to), status_code=303, headers={"Cache-Control": "no-store"})
            resp.delete_cookie(FLOW_COOKIE, path="/")
            return resp
        resp = RedirectResponse("/", status_code=303, headers={"Cache-Control": "no-store"})
        start_session(resp, "oidc")
        resp.delete_cookie(FLOW_COOKIE, path="/")
        return resp


async def _json(request: Request) -> dict:
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="body must be JSON") from None
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="body must be a JSON object")
    return data
