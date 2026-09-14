"""Auth HTTP routes: login, logout, callback, session management."""

import os
import secrets
import urllib.parse
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from .auth import AuthManager


def register_auth_routes(app: FastAPI, auth: AuthManager):

    @app.post("/api/auth/login")
    async def auth_login(request: Request):
        """Local/bootstrap login."""
        body = await request.json()
        token = (body or {}).get("token", "").strip()
        if not token:
            raise HTTPException(400, "token required")
        session = auth.login_local(token)
        if not session:
            raise HTTPException(401, "invalid token")
        response = JSONResponse({"ok": True, "data": {
            "session_id": session.id,
            "auth_method": session.auth_method,
        }})
        response.set_cookie(
            "pw_session", session.id,
            httponly=True, secure=True, samesite="lax", max_age=86400,
        )
        return response

    @app.get("/api/auth/oidc/config")
    async def auth_oidc_config():
        """Return OIDC config for frontend redirect."""
        config = auth.get_oidc_config()
        if not config:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["no OIDC provider configured"]}
        return {"ok": True, "data": {
            "authorization_endpoint": config.authorization_endpoint,
            "client_id": config.client_id,
            "scopes": config.scopes,
            "display_name": config.display_name,
        }}

    @app.get("/api/auth/oidc/login")
    async def auth_oidc_login(request: Request):
        """Redirect to OIDC provider."""
        config = auth.get_oidc_config()
        if not config:
            raise HTTPException(404, "OIDC not configured")
        state = secrets.token_urlsafe(16)
        params = {
            "response_type": "code",
            "client_id": config.client_id,
            "scope": " ".join(config.scopes),
            "redirect_uri": str(request.base_url) + "api/auth/oidc/callback",
            "state": state,
        }
        url = f"{config.authorization_endpoint}?{urllib.parse.urlencode(params)}"
        response = RedirectResponse(url)
        response.set_cookie(
            "pw_oidc_state", state,
            httponly=True, secure=True, samesite="lax", max_age=600,
        )
        return response

    @app.get("/api/auth/oidc/callback")
    async def auth_oidc_callback(request: Request, code: str = "", state: str = ""):
        """Handle OIDC callback: exchange code, fetch userinfo, create session."""
        config = auth.get_oidc_config()
        if not config:
            raise HTTPException(404, "OIDC not configured")
        expected_state = request.cookies.get("pw_oidc_state")
        if not expected_state or not secrets.compare_digest(state, expected_state):
            raise HTTPException(400, "invalid state parameter")
        client_secret = os.environ.get(config.client_secret_env, "")
        if not client_secret:
            raise HTTPException(500, "OIDC client secret not configured")
        redirect_uri = str(request.base_url) + "api/auth/oidc/callback"
        # Exchange authorization code for tokens
        token_data = urllib.parse.urlencode({
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": config.client_id,
            "client_secret": client_secret,
        }).encode()
        import urllib.request as _urlreq
        token_req = _urlreq.Request(
            config.token_endpoint,
            data=token_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with _urlreq.urlopen(token_req, timeout=10) as resp:
                import json
                tokens = json.loads(resp.read())
        except Exception as exc:
            raise HTTPException(502, f"token exchange failed: {exc}")
        access_token = tokens.get("access_token", "")
        if not access_token:
            raise HTTPException(502, "no access_token in response")
        # Fetch userinfo
        userinfo_req = _urlreq.Request(
            config.userinfo_endpoint,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        try:
            with _urlreq.urlopen(userinfo_req, timeout=10) as resp:
                userinfo = json.loads(resp.read())
        except Exception as exc:
            raise HTTPException(502, f"userinfo fetch failed: {exc}")
        sub = userinfo.get("sub", "")
        if not sub:
            raise HTTPException(502, "no sub in userinfo")
        display = userinfo.get("preferred_username") or userinfo.get("name") or sub
        session = auth.login_oidc(display)
        response = RedirectResponse("/")
        response.set_cookie(
            "pw_session", session.id,
            httponly=True, secure=True, samesite="lax", max_age=86400,
        )
        response.delete_cookie("pw_oidc_state")
        return response

    @app.post("/api/auth/logout")
    async def auth_logout(request: Request):
        """Logout: invalidate session."""
        session_id = request.cookies.get("pw_session")
        if session_id:
            auth.logout(session_id)
        response = JSONResponse({"ok": True})
        response.delete_cookie("pw_session")
        return response

    @app.get("/api/auth/session")
    async def auth_session(request: Request):
        """Check current session."""
        session_id = request.cookies.get("pw_session")
        if not session_id:
            return {"ok": False, "status": "unauthenticated"}
        session = auth.validate_session(session_id)
        if not session:
            return {"ok": False, "status": "expired"}
        return {"ok": True, "data": {
            "principal_id": session.principal_id,
            "auth_method": session.auth_method,
            "has_step_up": session.has_step_up(),
        }}

    @app.post("/api/auth/step-up")
    async def auth_step_up(request: Request):
        """Request step-up authentication."""
        session_id = request.cookies.get("pw_session")
        if not session_id:
            raise HTTPException(401, "no session")
        session = auth.request_step_up(session_id)
        if not session:
            raise HTTPException(401, "invalid session")
        return {"ok": True, "data": {"has_step_up": True, "expires_in": 300}}
