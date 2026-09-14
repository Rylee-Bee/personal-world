"""Native auth: provider-neutral OIDC + local bootstrap.

Project Worlds owns identity mapping, browser sessions, authorization,
step-up requirements, and session expiry. External OIDC providers
(Authelia, future providers) authenticate identity; Worlds owns the session.
"""

import json
import os
import secrets
import time
from pathlib import Path
from typing import Any
from dataclasses import dataclass, field


@dataclass
class Session:
    """A browser session."""
    id: str
    principal_id: str
    created_at: float
    last_active: float
    step_up_until: float | None = None
    auth_method: str = "local"  # "local" or "oidc"

    def is_valid(self, max_age: int = 86400) -> bool:
        return (time.time() - self.last_active) < max_age

    def has_step_up(self) -> bool:
        return self.step_up_until is not None and time.time() < self.step_up_until

    def touch(self):
        self.last_active = time.time()


@dataclass
class OIDCConfig:
    """OIDC provider configuration."""
    issuer: str
    client_id: str
    client_secret_env: str  # env var name, not the value
    scopes: list[str] = field(default_factory=lambda: ["openid", "profile"])
    display_name: str = "SSO"

    @property
    def authorization_endpoint(self) -> str:
        return f"{self.issuer}/api/oidc/authorization"

    @property
    def token_endpoint(self) -> str:
        return f"{self.issuer}/api/oidc/token"

    @property
    def userinfo_endpoint(self) -> str:
        return f"{self.issuer}/api/oidc/userinfo"


class SessionStore:
    """Server-side session storage."""

    def __init__(self, data_dir: Path):
        self._sessions: dict[str, Session] = {}
        self._data_dir = data_dir
        self._load()

    def create(self, principal_id: str, auth_method: str = "local") -> Session:
        session = Session(
            id=secrets.token_urlsafe(32),
            principal_id=principal_id,
            created_at=time.time(),
            last_active=time.time(),
            auth_method=auth_method,
        )
        self._sessions[session.id] = session
        self._save()
        return session

    def get(self, session_id: str) -> Session | None:
        session = self._sessions.get(session_id)
        if session and session.is_valid():
            session.touch()
            return session
        if session:
            del self._sessions[session_id]
            self._save()
        return None

    def invalidate(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        self._save()

    def grant_step_up(self, session_id: str, duration: int = 300) -> Session | None:
        session = self.get(session_id)
        if session:
            session.step_up_until = time.time() + duration
            self._save()
        return session

    def _load(self):
        path = self._data_dir / "sessions.json"
        if path.exists():
            try:
                data = json.loads(path.read_text())
                for sid, s in data.items():
                    self._sessions[sid] = Session(**s)
            except Exception:
                pass

    def _save(self):
        path = self._data_dir / "sessions.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {sid: {
            "id": s.id, "principal_id": s.principal_id,
            "created_at": s.created_at, "last_active": s.last_active,
            "step_up_until": s.step_up_until, "auth_method": s.auth_method,
        } for sid, s in self._sessions.items()}
        path.write_text(json.dumps(data, indent=2))


class AuthManager:
    """Manages authentication flows."""

    def __init__(self, data_dir: Path, config_dir: Path):
        self.sessions = SessionStore(data_dir)
        self._config_dir = config_dir
        self._oidc_config: OIDCConfig | None = None
        self._bootstrap_token: str | None = None
        self._load_config()

    def _load_config(self):
        oidc_path = self._config_dir / "oidc.json"
        if oidc_path.exists():
            try:
                data = json.loads(oidc_path.read_text())
                self._oidc_config = OIDCConfig(**data)
            except Exception:
                pass
        self._bootstrap_token = os.environ.get("PW_API_TOKEN")

    def login_local(self, token: str) -> Session | None:
        """Login with bootstrap/local token."""
        if self._bootstrap_token and secrets.compare_digest(token, self._bootstrap_token):
            return self.sessions.create("owner", "local")
        return None

    def get_oidc_config(self) -> OIDCConfig | None:
        return self._oidc_config

    def login_oidc(self, principal_id: str) -> Session:
        """Login after OIDC callback verification."""
        return self.sessions.create(principal_id, "oidc")

    def validate_session(self, session_id: str) -> Session | None:
        return self.sessions.get(session_id)

    def logout(self, session_id: str) -> None:
        self.sessions.invalidate(session_id)

    def request_step_up(self, session_id: str) -> Session | None:
        return self.sessions.grant_step_up(session_id, duration=300)
