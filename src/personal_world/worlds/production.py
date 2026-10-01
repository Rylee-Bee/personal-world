"""Production assembly: Database + Auth + owner policy + ConfigStore + Runner + Dispatcher.

``create_app`` is the ONLY production entrypoint. It never accepts a sender override (every
outbound request goes through ``confinement.confined_request``), has no development bypass, and
fails closed: with no valid ``owner.yaml`` nobody can sign in and cookie-authenticated writes are
refused. Startup runs dispatcher recovery (INTENT/DISPATCHING become UNKNOWN; nothing is re-sent).
"""

from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from fastapi import FastAPI

from ..oidc import OIDCService
from .actions_routes import register_action_routes
from .auth_routes import register_auth_routes
from .authn import Auth, load_csrf_key, principal_dependency
from .db import Database
from .dispatcher import LEASE_TTL_S, Dispatcher
from .owner import load_owner_policy
from .server import build_app


def create_app(config_dir: str | os.PathLike[str], data_dir: str | os.PathLike[str], *, secret_values: tuple[str, ...] = (),
               maintenance_interval: float = LEASE_TTL_S / 3) -> FastAPI:
    config_dir, data_dir = Path(config_dir), Path(data_dir)
    policy = load_owner_policy(config_dir)
    db = Database.in_dir(data_dir)
    origins = frozenset({policy.public_origin}) if policy.public_origin else frozenset()
    # Sessions are bound to the owner identity: editing owner.yaml's issuer/subject ends them all.
    auth = Auth(db, load_csrf_key(data_dir), origins, binding=lambda: load_owner_policy(config_dir).binding())
    owner_dep = principal_dependency(auth, owner_only=True)
    anyone_dep = principal_dependency(auth, owner_only=False)

    holder: dict[str, Dispatcher] = {}

    def needs_you() -> list[dict[str, Any]]:
        d = holder["d"]
        d.expire_due()
        now = auth.clock()
        rows = db.conn().execute(
            "SELECT id, action_id, created_at, caller FROM authorizations WHERE state='pending' AND expires_at>? ORDER BY created_at",
            (now,))
        return [{"id": f"authorization:{r['id']}", "text": f"Approve '{r['action_id']}' requested by {r['caller']}",
                 "source": "actions", "created_at": r["created_at"],
                 "action": {"kind": "approve", "authorization_id": r["id"]}} for r in rows]

    hosts = [urlsplit(policy.public_origin).hostname] if policy.public_origin else []
    app = build_app(config_dir, principal_dependency=owner_dep, allowed_hosts=hosts or ["invalid.invalid"],
                    data_dir=data_dir, secret_values=secret_values, needs_you=needs_you)
    dispatcher = Dispatcher(db, app.state.store, secret_values=secret_values)
    holder["d"] = dispatcher
    # Recovery runs HERE, before create_app returns, so no route can be served first. Rows owned by a
    # live process (a lease renewed within LEASE_TTL_S) are left alone; the maintenance thread keeps
    # renewing this process's lease and retries recovery for rows whose owner has since died.
    recovered = dispatcher.recover()
    app.state.db, app.state.auth, app.state.dispatcher, app.state.recovered = db, auth, dispatcher, recovered
    stop = threading.Event()

    def maintain() -> None:
        while not stop.wait(maintenance_interval):
            try:
                dispatcher.heartbeat()
                dispatcher.recover()
                dispatcher.expire_due()
            except Exception:  # never let housekeeping kill the process
                pass

    threading.Thread(target=maintain, name="worlds-maintenance", daemon=True).start()
    app.router.on_shutdown.append(stop.set)

    oidc = {"svc": None}

    def oidc_service() -> Any:
        return oidc["svc"]

    class _Lazy:
        def client(self):
            if oidc["svc"] is None:
                oidc["svc"] = OIDCService(config_dir)
            return oidc["svc"].client()

    register_auth_routes(app, auth, lambda: load_owner_policy(config_dir), _Lazy())
    register_action_routes(app, auth, dispatcher, anyone=anyone_dep, owner=owner_dep)
    return app


def app_from_env() -> FastAPI:
    """``uvicorn personal_world.worlds.production:app_from_env --factory``. Both directories are required."""
    config, data = os.environ.get("PW_CONFIG_DIR"), os.environ.get("PW_DATA_DIR")
    if not config or not data:
        raise SystemExit("PW_CONFIG_DIR and PW_DATA_DIR must both be set")
    return create_app(config, data)
