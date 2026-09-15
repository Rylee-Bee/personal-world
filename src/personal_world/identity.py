"""Principal resolution: the single identity seam.

Every protected route sees only a Principal (id, kind, owner_id,
scopes, auth_level, source). The trust root is local users
(Phase 1, Option B in the multi-user review 2026-09-09); OIDC is a
later authentication source that maps onto the same records. Perimeter
headers are never authorization, only possible login convenience.

Identity modes via PW_IDENTITY_MODE ("single" | "multi"):
- "single" (default): the legacy single-token gate continues to work.
  The principal is the instance bootstrap person, id "primary".
- "multi": tokens live in data/users.json (hashed); each token maps
  to exactly one local user (or agent principal).

The single-user install remains byte-identical after every phase.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

Kind = Literal["person", "agent", "service"]


@dataclass(frozen=True)
class Principal:
    """The identity that reached the handler. Scope model per issue #8."""
    id: str
    kind: Kind = "person"
    owner_id: str | None = None   # set when kind == "agent"
    display_name: str | None = None
    scopes: tuple[str, ...] = ()  # subset of owner scopes for agents
    auth_level: int = 1           # 1 bearer/session, 2 recent, 3 fresh-2fa
    source: str = "token"         # token | oidc | header | scheduler


def _token_fingerprint(token: str) -> str:
    """sha256 for high-entropy tokens; constant-time compare upstream."""
    return hashlib.sha256(token.encode()).hexdigest()


class NoPrincipalError(Exception):
    """Raised when no token / no matching hashed token is present."""


class IdentityStore:
    """Local users + per-user hashed token records.

    Storage shape (data root):
      users.json       — list of {user_id, display_name, hashed_tokens,
                          token_prefixes, enabled, created_at}
    Single-writer: the FastAPI process. Read-only for CLI helpers.
    """

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = Path(data_dir)
        self.path = self.data_dir / "users.json"

    # -- load/save ------------------------------------------------------
    def _load(self) -> dict:
        if self.path.exists():
            import json
            try:
                return json.loads(self.path.read_text())
            except Exception:
                pass
        return {"users": []}

    def _save(self, payload: dict) -> None:
        import json
        self.data_dir.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, indent=2))
        os.replace(tmp, self.path)

    # -- operations ------------------------------------------------------
    def create_user(self, user_id: str, display_name: str | None,
                    initial_plain_token: str | None = None) -> dict:
        payload = self._load()
        if any(u.get("user_id") == user_id for u in payload["users"]):
            raise ValueError(f"user exists: {user_id}")
        u = {"user_id": user_id, "display_name": display_name,
             "hashed_tokens": [], "token_prefixes": [],
             "enabled": True,
             "created_at": time.time()}
        if initial_plain_token:
            self._attach_token(u, initial_plain_token)
        payload["users"].append(u)
        self._save(payload)
        return u

    def attach_token(self, user_id: str, plain_token: str) -> None:
        payload = self._load()
        for u in payload["users"]:
            if u.get("user_id") == user_id:
                self._attach_token(u, plain_token)
                self._save(payload)
                return
        raise ValueError(f"no such user: {user_id}")

    def disable_user(self, user_id: str) -> bool:
        payload = self._load()
        for u in payload["users"]:
            if u.get("user_id") == user_id:
                u["enabled"] = False
                self._save(payload)
                return True
        return False

    def list_users(self) -> list[dict]:
        return self._load().get("users", [])

    # -- profile ----------------------------------------------------------
    def get_display_name(self, user_id: str) -> str | None:
        """Stored display name for a person, or None if never set."""
        for u in self._load().get("users", []):
            if u.get("user_id") == user_id:
                return u.get("display_name")
        return None

    def set_display_name(self, user_id: str, display_name: str) -> dict:
        """Upsert a person's display name in private runtime state
        (data/users.json). In single mode the "primary" record is created
        without any token so it can never authenticate by itself."""
        payload = self._load()
        for u in payload["users"]:
            if u.get("user_id") == user_id:
                u["display_name"] = display_name
                self._save(payload)
                return u
        u = {"user_id": user_id, "display_name": display_name,
             "hashed_tokens": [], "token_prefixes": [],
             "enabled": True, "created_at": time.time()}
        payload["users"].append(u)
        self._save(payload)
        return u

    def _attach_token(self, user: dict, plain_token: str) -> None:
        user.setdefault("hashed_tokens", []).append(
            _token_fingerprint(plain_token))
        user.setdefault("token_prefixes", []).append(plain_token[:8])

    # -- resolution -------------------------------------------------------
    def match_token(self, token: str) -> dict | None:
        """Find the enabled user or agent whose hashed token matches."""
        fp = _token_fingerprint(token)
        payload = self._load()
        for u in payload.get("users", []) + payload.get("agents", []):
            if not u.get("enabled", False):
                continue
            if any(hmac.compare_digest(fp, h) for h in u.get("hashed_tokens", [])):
                return u
        return None

    def get_principal_record(self, principal_id: str) -> dict | None:
        """Look up an enabled user or agent record by principal id.

        Used by the session/OIDC resolver: a browser session stores the
        resolved principal id, never a raw credential, so re-resolving
        it must go through the same enabled-records store the bearer
        path uses. Disabled records resolve to nothing (fail closed).
        """
        if not principal_id:
            return None
        payload = self._load()
        for u in payload.get("users", []) + payload.get("agents", []):
            if u.get("user_id") == principal_id and u.get("enabled", False):
                return u
        return None

    # -- agent principals (phase 3) --------------------------------------
    def create_agent(self, agent_id: str, owner_id: str,
                     scopes: tuple[str, ...],
                     plain_token: str | None = None,
                     display_name: str | None = None) -> dict:
        """An agent is a first-class principal owned by a person.

        Scopes are a subset language from the owner: "read", "write",
        "journal", "apps". Agents never inherit owner rights beyond
        the listed scopes.
        """
        payload = self._load()
        if any(a.get("user_id") == agent_id for a in payload.get("agents", [])):
            raise ValueError(f"agent exists: {agent_id}")
        a = {"user_id": agent_id, "kind": "agent", "owner_id": owner_id,
             "display_name": display_name or agent_id,
             "scopes": list(scopes), "hashed_tokens": [],
             "token_prefixes": [], "enabled": True,
             "created_at": time.time()}
        if plain_token:
            self._attach_token(a, plain_token)
        payload.setdefault("agents", []).append(a)
        self._save(payload)
        return a

    def list_agents(self, owner_id: str | None = None) -> list[dict]:
        payload = self._load()
        agents = [a for a in payload.get("agents", []) if a.get("enabled")]
        if owner_id:
            agents = [a for a in agents if a.get("owner_id") == owner_id]
        return agents

    def disable_agent(self, agent_id: str, owner_id: str) -> bool:
        payload = self._load()
        for a in payload.get("agents", []):
            if a.get("user_id") == agent_id and a.get("owner_id") == owner_id:
                a["enabled"] = False
                self._save(payload)
                return True
        return False

    def legacy_primary(self, instance_token: str) -> dict:
        """The bootstrap person in single mode (id "primary")."""
        payload = self._load()
        users = payload.get("users", [])
        for u in users:
            if u.get("user_id") == "primary":
                if not u.get("hashed_tokens"):
                    # record created tokenless (e.g. display-name set in
                    # single mode) — attach the instance credential so a
                    # mode switch never locks the owner out.
                    self._attach_token(u, instance_token)
                    self._save(payload)
                return u
        return self.create_user("primary", "Primary person",
                                initial_plain_token=instance_token)


DEV_BYPASS_ENV = "PW_DEV_AUTH_BYPASS"


def dev_bypass_enabled() -> bool:
    """Temporary local-development ergonomics (loopback-only).

    Explicit opt-in via PW_DEV_AUTH_BYPASS=1. Default OFF; when off,
    nothing about auth changes. See api.py for the loopback-only gate
    that consumes this flag.
    """
    return os.environ.get(DEV_BYPASS_ENV, "").strip() in ("1", "true", "yes")


def dev_bypass_principal() -> Principal:
    """The principal the dev bypass resolves to: the bootstrap primary
    person, visibly marked with its own auth source."""
    return Principal(id="primary", kind="person",
                     display_name="Primary person",
                     auth_level=1, source="dev-bypass")


def principal_from_record(record: dict, source: str = "token") -> Principal:
    """Canonical record → Principal. Agents keep owner_id and scopes;
    persons carry their stored display name. Session and OIDC
    resolution reuse this so every credential path lands on the same
    Principal shape."""
    if record.get("kind") == "agent":
        return Principal(id=record["user_id"], kind="agent",
                         owner_id=record.get("owner_id"),
                         display_name=record.get("display_name"),
                         scopes=tuple(record.get("scopes") or ()),
                         auth_level=1, source=source)
    return Principal(id=record["user_id"], kind="person",
                     display_name=record.get("display_name"),
                     auth_level=1, source=source)


def resolve_principal(token: str | None,
                      store: IdentityStore | None,
                      mode: str,
                      instance_token: str | None) -> Principal:
    """The single seam. No handler ever sees the raw token."""
    if mode == "multi" and store is not None:
        found = store.match_token(token or "")
        if not found:
            raise NoPrincipalError("no principal for token")
        return principal_from_record(found, source="token")
    # single mode: bootstrap "primary" directly from the instance token
    if not instance_token or not token or not hmac.compare_digest(
        token, instance_token):
        raise NoPrincipalError()
    return Principal(id="primary", kind="person",
                     display_name="Primary person", auth_level=1,
                     source="token")


def resolve_session_principal(session_principal_id: str | None,
                              store: IdentityStore | None,
                              mode: str,
                              auth_method: str = "local") -> Principal:
    """Resolve a browser session through the same canonical seam.

    A session stores only the id of the principal it was created for;
    it carries no credential. Resolution therefore re-reads the current
    enabled record (multi mode) so disabling a user revokes their
    browser session on the next request, exactly like their bearer
    token. Single mode resolves every in-app login to the bootstrap
    "primary" person — the one person that install has.
    """
    source = "oidc" if auth_method == "oidc" else "session"
    if mode == "multi" and store is not None:
        record = store.get_principal_record(session_principal_id or "")
        if record is None:
            raise NoPrincipalError("no principal for session")
        return principal_from_record(record, source=source)
    if not session_principal_id:
        raise NoPrincipalError("empty session principal")
    return Principal(id="primary", kind="person",
                     display_name="Primary person", auth_level=1,
                     source=source)


def resolve_oidc_principal(sub: str | None,
                           store: IdentityStore | None,
                           mode: str,
                           display_name: str | None = None) -> Principal:
    """Map a verified OIDC identity onto a local principal.

    Single mode has exactly one person, so a verified external identity
    resolves to the bootstrap primary person (OIDC is an alternate
    sign-in for the owner). Multi mode requires an existing enabled
    local record whose id matches the provider subject (or the display
    fallback); an unmapped identity resolves to nothing so external
    sign-in can never silently mint an account. Fail closed.
    """
    if mode == "multi" and store is not None:
        for candidate in (sub, display_name):
            record = store.get_principal_record(candidate or "")
            if record is not None:
                return principal_from_record(record, source="oidc")
        raise NoPrincipalError("oidc identity has no local account")
    if not sub:
        raise NoPrincipalError("empty oidc subject")
    return Principal(id="primary", kind="person",
                     display_name="Primary person", auth_level=1,
                     source="oidc")
