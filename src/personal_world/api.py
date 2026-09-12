"""Secure API. One core; CLI, dashboard, and AI tools all consume it.

Auth: bearer token (private-notes Pattern C). Fail-closed: no token
configured -> protected routes 503; wrong token -> 401. The token is
compared with hmac.compare_digest and never logged.
"""

import json
import logging
import secrets
import os
import time
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, FileResponse
from starlette.concurrency import run_in_threadpool

from . import export, prefs
from . import sections as sections_mod
from .app import build_registry, load_world, save_world
from .chat import chat_once, build_chat_messages, extract_proposal
from .chat_context import build_world_context, build_ui_context
from .envelope import Result
from .journal import AuditRenderer, Journal
from .loop import daily
from .providers.lab_state import DEFAULT_LAB, LabState
from .providers.registry import Registry
from .source_control import (
    discover_repositories,
    repository_history,
    repository_status,
    status_all,
)
from .world import MutationDenied, World



_logger = logging.getLogger("personal_world.api")


def _cached_file(request: Request, path: Path, media_type: str | None,
                 cache_private: bool = False) -> Response:
    """Serve a static file with explicit revalidation, no `immutable`.

    UAT contract (owner directive, 2026-09-12): the browser must never
    hold an asset it cannot revalidate. The ETag is computed from the
    file's own stat (mtime+size, matching Starlette's formula) so
    If-None-Match can be answered synchronously with an explicit 304 —
    this starlette version sets the header only at send time and has
    no native If-None-Match handling. A file that vanishes or becomes
    unreadable mid-request is answered 404 with a logged error rather
    than a half-response or a crash.
    """
    try:
        stat_result = path.stat()
        response = FileResponse(path, media_type=media_type,
                                stat_result=stat_result, headers={
            "Cache-Control": ("private" if cache_private else "public")
            + ", max-age=0, must-revalidate",
        })
    except OSError as exc:
        _logger.error("static file unreadable %s: %s", path.name, exc)
        raise HTTPException(status_code=404, detail="file unavailable")
    etag = response.headers.get("etag")
    if_none_match = request.headers.get("if-none-match")
    if etag and if_none_match:
        candidates = [
            tag.strip().removeprefix("W/") for tag in if_none_match.split(",")
        ]
        if etag in candidates:
            return Response(status_code=304, headers={"ETag": etag})
    return response


def _token() -> str | None:
    return os.environ.get("PW_API_TOKEN")


def _step_up_authorized(request: Request) -> bool:
    """Write path semantics. Loopback OR non-forwarded Header X-PW-StepUp: 1.

    Loopback in Docker bridge mode passes automatically (mirrors the
    vault GET). External requests must send the step-up header
    (step-up login keeps sessions) - documented contract; consumers
    that need to write from remote browsers add `X-PW-StepUp: 1` when
    they're past Authelia."""
    client = request.client.host if request.client else "?"
    if client in ("127.0.0.1", "::1", "localhost", "testclient"):
        return True
    if request.headers.get("X-PW-StepUp") == "1":
        return True
    import ipaddress as _ipa
    try:
        ip = _ipa.ip_address(client)
    except ValueError:
        ip = None
    if ip is not None and (ip.is_loopback or ip.is_private):
        return True
    return False


async def require_step_up(request: Request) -> None:
    await require_auth(request)
    if not _step_up_authorized(request):
        raise HTTPException(
            status_code=403, detail="write requires step-up auth")


async def require_auth(request: Request) -> None:
    """Gate + principal resolution (the single seam).

    On success the resolved principal lands on request.state.principal
    for sub-dependencies and handlers. In "single" mode the bootstrap
    "primary" person is the only principal; "multi" resolves hashed
    user tokens from the local identity store.
    """
    from .identity import resolve_principal, NoPrincipalError
    uma = getattr(request.app.state, "identity", None)
    token = _token()
    if not token:
        raise HTTPException(status_code=503, detail="auth not configured")
    header = request.headers.get("Authorization", "")
    supplied = header.removeprefix("Bearer ").strip()
    if not supplied:
        raise HTTPException(status_code=401, detail="unauthorized")
    identity = getattr(request.app.state, "identity", None)
    mode = identity["mode"] if identity else "single"
    store = identity["store"] if identity else None
    try:
        principal = resolve_principal(supplied, store, mode, token)
    except NoPrincipalError:
        raise HTTPException(status_code=401, detail="unauthorized")
    request.state.principal = principal


def create_app(data_dir: Path | None = None, config_dir: Path | None = None) -> FastAPI:
    data_dir = Path(data_dir or os.environ.get("PW_DATA_DIR", "./data"))
    config_dir = Path(config_dir or os.environ.get("PW_CONFIG_DIR", "./config"))
    # Serving boundary (T15 cutover): the React SPA is the ONE product
    # frontend. The legacy server-rendered pages were deleted with the
    # cutover; there is no fallback UI — a missing dist answers the
    # honest 503 page. Dist is never echoed into a browser response —
    # private paths stay private.
    frontend_dist = Path(os.environ.get("PW_FRONTEND_DIST") or
                         (Path(__file__).resolve().parents[2] / "frontend" / "dist"))

    def _spa_index() -> HTMLResponse:
        index = frontend_dist / "index.html"
        if index.is_file():
            return HTMLResponse(index.read_text(encoding="utf-8"),
                                headers={"Cache-Control": "no-cache"})
        return HTMLResponse(
            SPA_NOT_BUILT_HTML,
            status_code=503,
            headers={"Cache-Control": "no-store"},
        )

    # Identity seam state (issue #8 phase 0/1, per multi-user review
    # 2026-09-09): local users as trust root, PW_IDENTITY_MODE picks
    # single (bootstrap-primary bypass) or multi (hashed-token users).
    from .identity import IdentityStore
    _identity_mode = os.environ.get("PW_IDENTITY_MODE", "single")
    _identity_store = IdentityStore(data_dir)
    _app_instance_token = _token()
    world_path = data_dir / "world.json"
    journal = Journal(data_dir / "journal.ndjson")

    from .model import JournalKind
    app = FastAPI(title="Project Worlds", version="0.2.0")
    # issue #8, phase 0: the identity seam state lives on app.state so
    # single-mode behavior is byte-identical and multi-mode lights up
    # without changing how the client calls the API.
    # Multi-mode bootstrap: the instance token remains the primary
    # person's credential so enabling multi mode never locks the
    # operator out. First-run in multi continues to work.
    if _identity_mode == "multi":
        try:
            _identity_store.legacy_primary(_token())
        except Exception:
            pass

    app.state.identity = {"mode": _identity_mode,
                          "store": _identity_store,
                          "instance_token": _app_instance_token}
    app.state.frontend_dist = frontend_dist

    # --- Setup & Login ---

    @app.get("/healthz")
    async def healthz() -> dict:
        token = _token()
        setup_needed = not (data_dir / "setup-complete").exists()
        return {
            "ok": True,
            "auth_configured": token is not None,
            "setup_needed": setup_needed,
        }

    @app.get("/api/setup/status")
    async def setup_status() -> dict:
        """Check if first-run setup is needed."""
        complete = (data_dir / "setup-complete").exists()
        return {"ok": True, "data": {"complete": complete}}

    @app.post("/api/setup")
    async def setup(request: Request) -> dict:
        """First-run setup: create API token and vault passphrase."""
        if (data_dir / "setup-complete").exists():
            raise HTTPException(status_code=409, detail="setup already complete")
        body = await request.json()
        token = body.get("token", "").strip()
        if not token or len(token) < 8:
            raise HTTPException(status_code=400, detail="token must be >= 8 chars")
        # Write token to env file for the container to pick up
        env_path = data_dir / ".env"
        env_path.write_text(f"PW_API_TOKEN={token}\n")
        # Also set in current process so it works immediately
        os.environ["PW_API_TOKEN"] = token
        # Mark setup complete
        (data_dir / "setup-complete").write_text("ok")
        # Initialize vault if passphrase provided
        vault_pass = body.get("vault_passphrase", "").strip()
        if vault_pass:
            _vault.unlock(vault_pass)
            _vault._save()  # write the encrypted file immediately
        return {"ok": True, "data": {"token_set": True, "vault_initialized": bool(vault_pass)}}

    def _state() -> tuple[World, Registry]:
        world = load_world(world_path)
        registry = build_registry(world, Registry(), config_dir)
        return world, registry

    def _principal(request: Request):
        from .identity import Principal
        return getattr(request.state, 'principal', None)

    def _user_paths(request: Request) -> tuple[Path, Path]:
        """Per-user world/journal paths for the caller (multi mode).

        Returns the _global_ paths in single mode: the bootstrap
        person's state remains the instance state until multi mode is
        enabled (PW_IDENTITY_MODE multi), keeping single-user behavior
        byte-identical.
        """
        identity = getattr(request.app.state, 'identity', {})
        if identity.get('mode') != 'multi':
            return world_path, journal.path
        from .user import User
        principal = getattr(request.state, 'principal', None)
        if principal is None:
            raise HTTPException(status_code=409,
                                detail='principal not resolved')
        user = User(id=principal.id, name=principal.id, root=data_dir)
        return user.world_path, user.journal_path

    def _state_for(request: Request) -> tuple[World, Registry, Path]:
        """World + registry + the caller's own journal. Multi mode
        loads the caller-person's tree; single mode uses the
        bootstrap-shared paths (byte-identical legacy behavior)."""
        uw, uj = _user_paths(request)
        world = load_world(uw)
        registry = build_registry(world, Registry(), config_dir)
        return world, registry, uj

    @app.get("/api/status", dependencies=[Depends(require_auth)])
    async def status() -> dict:
        world, registry = _state()
        s = world.summary()
        s["capabilities"] = registry.status_map()
        s["actors"] = [a.model_dump(mode="json") for a in registry.actors()]
        return {"ok": True, "status": "healthy", "data": s}

    @app.get("/api/daily", dependencies=[Depends(require_auth)])
    async def daily_view() -> dict:
        """Present the daily digest. Read-only: a page view never
        journals observations or records facts (that is the POST)."""
        world, registry = _state()
        result = daily(world, registry, journal, record=False)
        return result.model_dump(mode="json")

    @app.post("/api/daily", dependencies=[Depends(require_auth)])
    async def daily_run() -> dict:
        """Run the daily loop for real: journal observations, record
        capability facts, flag drift, save the world."""
        world, registry = _state()
        result = daily(world, registry, journal, record=True)
        save_world(world, world_path)
        return result.model_dump(mode="json")

    @app.get("/api/journal", dependencies=[Depends(require_auth)])
    async def journal_view(request: Request, n: int = 20) -> dict:
        _require_person(getattr(request.state, "principal", None))
        _, _, uj = _state_for(request)
        target = journal if uj == journal.path else Journal(uj)
        # Calm view: each chain's CURRENT version only (superseded
        # originals stay in history + audit; the correction workflow
        # links them).
        events = target.current_events(n)
        return {"ok": True,
                "data": [e.model_dump(mode="json") for e in events]}

    @app.post("/api/journal", dependencies=[Depends(require_auth)])
    async def journal_note(request: Request) -> dict:
        _require_person(getattr(request.state, "principal", None))
        """Write a personal note to the caller's own journal.

        Body: {"text": "<1-2000 chars>"}. Stored when the user is in
        multi mode; shared journal in single mode.
        """
        body = await request.json()
        text = (body or {}).get("text", "").strip()
        if not text or len(text) > 2000:
            raise HTTPException(status_code=422, detail="text must be 1-2000 chars")
        _, _, uj = _state_for(request)
        target = journal if uj == journal.path else Journal(uj)
        target.record(kind=JournalKind.OBSERVATION, summary=text, source="user")
        return {"ok": True, "data": {"written": len(text)}}

    # ── Journal correction workflow (second propose→approve→act
    # workflow; same trust model as the repository-status refresh).
    # The UI proposes + explains + collects explicit approval BEFORE
    # this endpoint is called; the endpoint is the ACT (step-up
    # gated, same as every write). Append-only: the original entry is
    # never rewritten — the corrected entry links back via
    # `supersedes` and readers derive currency from those links.
    # Idempotency: a retry carrying the same target and the same
    # corrected text returns the ALREADY-CURRENT entry instead of
    # appending a duplicate (double-click/retry/refresh safe). ──
    @app.post("/api/journal/supersede", dependencies=[Depends(require_step_up)])
    async def journal_supersede(request: Request) -> dict:
        _require_person(getattr(request.state, "principal", None))
        try:
            body = await request.json()
        except ValueError:
            raise HTTPException(status_code=400, detail="body must be JSON")
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="body must be an object")
        target_ts = str(body.get("supersedes") or "").strip()
        corrected = str(body.get("text") or "").strip()
        reason = str(body.get("reason") or "").strip()
        # Provenance only: how this correction was DRAFTED. The value
        # is rendered in the audit event; it never grants or widens
        # authority (this endpoint stays step-up gated; the approval is
        # always the explicit human action behind the step-up call).
        drafted_by = str(body.get("drafted_by") or "").strip() or "the Journal screen"
        if drafted_by not in (
            "the Journal screen",
            "Personal World (assistant draft)",
        ):
            drafted_by = "the Journal screen"
        if not target_ts or not corrected:
            raise HTTPException(
                status_code=422,
                detail="supersedes (entry timestamp) and text are required",
            )
        if len(corrected) > 2000:
            raise HTTPException(status_code=422, detail="text must be 1-2000 chars")
        _, _, uj = _state_for(request)
        target = journal if uj == journal.path else Journal(uj)
        old = target.by_ts(target_ts)
        if old is None:
            # Missing/invalid entry: nothing changes; say so honestly.
            return {
                "ok": False,
                "status": "not_configured",
                "warnings": [f"no journal entry found at {target_ts}"],
            }
        # Idempotent retry: the target's current replacement already
        # says exactly this → return it; no duplicate append.
        for later in target.events():
            if later.supersedes == old.ts:
                if later.summary == corrected:
                    return {
                        "ok": True,
                        "status": "healthy",
                        "data": {
                            "current": later.model_dump(mode="json"),
                            "superseded": old.model_dump(mode="json"),
                            "already_applied": True,
                        },
                    }
                break  # a different correction owns it → conflict below
        try:
            current, audit = target.supersede(
                target_ts, corrected, reason or None,
                proposed_by=drafted_by,
            )
        except ValueError as exc:
            return {
                "ok": False,
                "status": "unavailable",
                "warnings": [str(exc)],
            }
        return {
            "ok": True,
            "status": "healthy",
            "data": {
                "current": current.model_dump(mode="json"),
                "superseded": old.model_dump(mode="json"),
                "audit": audit.model_dump(mode="json"),
                "already_applied": False,
            },
        }

    @app.get("/api/journal/history", dependencies=[Depends(require_auth)])
    async def journal_history(request: Request, ts: str) -> dict:
        """Full correction chain for one entry (progressive disclosure
        backing store): oldest → newest, with reasons."""
        _, _, uj = _state_for(request)
        target = journal if uj == journal.path else Journal(uj)
        entry = target.by_ts(ts)
        if entry is None:
            return {
                "ok": False,
                "status": "not_configured",
                "warnings": [f"no journal entry found at {ts}"],
            }
        chain = target.history_of(entry)
        return {
            "ok": True,
            "status": "healthy",
            "data": {"entries": [e.model_dump(mode="json") for e in chain]},
        }

    @app.get("/api/journal/audit", dependencies=[Depends(require_auth)])
    async def journal_audit(request: Request) -> dict:
        _, _, uj = _state_for(request)
        target = journal if uj == journal.path else Journal(uj)
        return {"ok": True, "data": {"text": AuditRenderer().render(target)}}

    @app.get("/api/memory/search", dependencies=[Depends(require_auth)])
    async def memory_search(q: str, top_k: int = 5) -> dict:
        """Semantic recall through the memory provider. Private data
        class: results are personal context, never settings-exportable."""
        from .model import Capability  # noqa: F401  (capability exists)
        _, registry = _state()
        provider = registry.provider_for("memory")
        if provider is None:
            return {"ok": False, "status": "unavailable",
                    "warnings": ["no memory provider"]}
        impl = registry.impl(provider.name)
        if not hasattr(impl, "search"):
            return {"ok": False, "status": "unavailable",
                    "warnings": [f"provider '{provider.name}' cannot search"]}
        result = impl.search(q, top_k=top_k)
        return result.model_dump(mode="json")

    @app.post("/api/chat", dependencies=[Depends(require_auth)])
    async def chat(request: Request) -> dict:
        """Conversational interface to Project Worlds.

        Read-only: the model observes a rendered world snapshot and
        returns text. No tool execution, no mutations. With no chat
        provider configured the endpoint answers 'not_configured' so
        the dashboard can degrade honestly."""
        body: dict
        try:
            body = await request.json()
        except ValueError:
            raise HTTPException(status_code=400, detail="body must be JSON")
        message = (body.get("message") or "").strip() if isinstance(body, dict) else ""
        if not message:
            raise HTTPException(status_code=400, detail="message is required")
        history = body.get("history") if isinstance(body, dict) else None
        if not isinstance(history, list):
            history = []
        history = [
            {"role": m.get("role"), "content": m.get("content")}
            for m in history[-6:]
            if isinstance(m, dict) and m.get("content")
        ]
        world, registry = _state()
        provider = registry.provider_for("reasoning")
        if provider is None:
            return {
                "ok": False,
                "status": "not_configured",
                "warnings": [
                    "no chat provider configured — add an ollama or "
                    "openai_compat connection to config"
                ],
            }
        impl = registry.impl(provider.name)
        context = await run_in_threadpool(
            build_world_context, world, registry, journal, True, config_dir
        )
        # Contextual chat (Finish Line "Contextual chat and model
        # routing"): the caller may describe WHERE in the UI the person
        # is. Provenance, not truth: an unknown section_id degrades to
        # an honest "unknown" block rather than being trusted or
        # rejected — a stale tab must not break conversation.
        ui = body.get("context") if isinstance(body, dict) else None
        ui_block = None
        if isinstance(ui, dict):
            route = str(ui.get("route") or "") or None
            sid = str(ui.get("section_id") or "") or None
            spec = sections_mod.BY_ID.get(sid) if sid else None
            entity = str(ui.get("entity") or "") or None
            ui_block = build_ui_context(
                route=route,
                section_id=sid,
                section_label=(spec.label if spec else str(ui.get("label") or "") or None),
                section_status=(
                    sections_mod.section_status(
                        spec, registry.status_map()
                    ) if spec else None
                ),
                section_capabilities=(list(spec.capabilities) if spec else None),
                entity=entity,
            )
        if ui_block:
            context = context + "\n\n" + ui_block
        messages = build_chat_messages(message, context, history)
        result = await run_in_threadpool(chat_once, impl, messages)
        if not result.ok:
            return result.model_dump(mode="json")
        # Assistant-drafted correction proposals (Play-Nice:
        # participation, not authority): strictly validate the extracted
        # block against the REAL journal — the entry must exist and not
        # already be superseded. A stale/imagined/malformed proposal
        # degrades to nothing; the visible reply always works.
        reply_text = (result.data or {}).get("reply", "")
        proposal_json, visible_reply = extract_proposal(reply_text)
        if proposal_json is not None:
            proposal = json.loads(proposal_json)
            _, _, uj = _state_for(request)
            target = journal if uj == journal.path else Journal(uj)
            entry = target.by_ts(proposal["entry_ts"])
            if entry is None or any(
                later.supersedes == entry.ts for later in target.events()
            ):
                proposal = None
        else:
            proposal = None
        if visible_reply != reply_text:
            result = result.model_copy(update={
                "data": {**(result.data or {}),
                         "reply": visible_reply or reply_text,
                         **({"proposal": proposal} if proposal else {})},
            })
        journal.record(
            "recommendation",
            f"chat exchange with {provider.name} ({len(message)} chars in)",
            source="chat",
        )
        return result.model_dump(mode="json")

    @app.get("/api/chat/providers", dependencies=[Depends(require_auth)])
    def chat_providers() -> dict:
        """List available chat providers and which is active."""
        _, registry = _state()
        providers = []
        active_name = None
        for p in registry._providers.values():
            if p.capability == "reasoning":
                impl = registry.impl(p.name)
                r = impl.observe() if impl else None
                providers.append({
                    "name": p.name,
                    "display_name": getattr(impl, "display_name", p.name),
                    "status": r.status if r else "unknown",
                    "ok": r.ok if r else False,
                })
                if active_name is None and (r and r.ok):
                    active_name = p.name
        # If there's a provider_for, it's the active one
        active = registry.provider_for("reasoning")
        return {
            "ok": True,
            "data": {
                "providers": providers,
                "active": active.name if active else None,
            },
        }

    @app.post("/api/chat/test", dependencies=[Depends(require_auth)])
    async def chat_test() -> dict:
        """Quick chat test — sends a simple message to verify the provider
        works. Authenticated: it spends provider quota and reveals which
        provider is wired, so it is never a public probe."""
        _, registry = _state()
        provider = registry.provider_for("reasoning")
        if provider is None:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["no chat provider"]}
        impl = registry.impl(provider.name)
        if impl is None:
            return {"ok": False, "status": "unavailable"}
        result = chat_once(impl, [
            {"role": "system", "content": "Reply with exactly one word: hello"},
            {"role": "user", "content": "hello"},
        ])
        return {"ok": result.ok, "status": result.status,
                "data": result.data, "warnings": result.warnings}

    @app.get("/api/actors", dependencies=[Depends(require_auth)])
    async def actors() -> dict:
        _, registry = _state()
        return {
            "ok": True,
            "data": [a.model_dump(mode="json") for a in registry.actors()],
        }

    @app.get("/api/manifest", dependencies=[Depends(require_auth)])
    async def manifest() -> dict:
        """Machine-readable capability manifest (framework contract:
        see docs/NATIVE-BASELINE-AND-ENRICHMENT.md)."""
        _, registry = _state()
        return {"ok": True, "data": registry.manifest()}

    @app.get("/api/exports/settings", dependencies=[Depends(require_auth)])
    async def settings_export() -> dict:
        world, _ = _state()
        return {"ok": True, "data": export.settings_export(world)}

    @app.get("/api/exports/world", dependencies=[Depends(require_auth)])
    async def world_export() -> dict:
        world, _ = _state()
        return {"ok": True, "data": export.world_export(world)}

    @app.get("/api/exports/story", dependencies=[Depends(require_auth)])
    async def story_export() -> dict:
        return {"ok": True, "data": {"text": export.story_export(journal)}}

    @app.get("/api/backup", dependencies=[Depends(require_auth)])
    async def backup() -> dict:
        world, _ = _state()
        return {"ok": True, "data": export.backup_payload(world, journal)}

    @app.get("/api/updates", dependencies=[Depends(require_auth)])
    async def updates_view() -> dict:
        """Read-only check + status overview. API is check/status only:
        apply/rollback are CLI-only, deliberately -- destructive actions
        need the explicit-confirm CLI path with its visible exit codes."""
        from .updates import UpdateManager, build_provider

        provider = build_provider(
            config_dir=config_dir,
            project_dir=os.environ.get("PW_UPDATES_PROJECT_DIR") or None,
        )
        if provider is None:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["no update target configured"]}
        manager = UpdateManager(
            provider,
            journal,
            session_path=data_dir / "updates-session.json",
        )
        checks = manager.check()
        return {
            "ok": True,
            "status": "healthy",
            "data": {
                "provider": provider.name,
                "checks": {
                    t: c.model_dump(mode="json") for t, c in checks.items()
                },
                "session": manager.status(live=False),
            },
        }

    @app.get("/api/prefs", dependencies=[Depends(require_auth)])
    async def prefs_get(request: Request) -> dict:
        _require_person(getattr(request.state, "principal", None))
        world, _, _ = _state_for(request)
        return {"ok": True, "data": prefs.get_prefs(world)}

    @app.put("/api/prefs", dependencies=[Depends(require_step_up)])
    async def prefs_put(request: Request) -> dict:
        _require_person(getattr(request.state, "principal", None))
        world, _, uj = _state_for(request)
        try:
            updates = await request.json()
        except ValueError:
            raise HTTPException(status_code=400, detail="body must be JSON")
        try:
            data = prefs.set_prefs(world, updates)
        except prefs.PrefsValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        uw, _uj = _user_paths(request)
        save_world(world, uw)
        return {"ok": True, "data": data}

    @app.get("/api/prefs/schema", dependencies=[Depends(require_auth)])
    async def prefs_schema() -> dict:
        """Read-only preference vocabulary (spec §2.5): the Settings
        surface can only offer values the server accepts."""
        out: dict[str, dict] = {}
        for key, spec in prefs.PREFS.items():
            if isinstance(spec, prefs.NumberPref):
                out[key] = {
                    "type": "number",
                    "default": spec.default,
                    "floor": spec.floor,
                    "allowed": (list(spec.allowed)
                                if spec.allowed is not None else None),
                    "integer": spec.integer,
                    "unit": spec.unit,
                }
            else:
                out[key] = {
                    "type": "enum",
                    "default": spec.default,
                    "floor": spec.floor,
                    "allowed": list(spec.allowed),
                }
        return {"ok": True, "data": out}

    # -- sections: per-person navigation layout (spec §2) ---------------
    def _sections_payload(world: World, registry: Registry) -> dict:
        status_map = registry.status_map()
        stored = world.layout.get(sections_mod.LAYOUT_KEY)
        return {
            "ok": True,
            "data": {
                "schema": sections_mod.SCHEMA,
                "sections": sections_mod.resolve_sections(stored, status_map),
            },
        }

    @app.get("/api/sections", dependencies=[Depends(require_auth)])
    async def sections_get(request: Request) -> dict:
        _require_person(getattr(request.state, "principal", None))
        world, registry, _ = _state_for(request)
        return _sections_payload(world, registry)

    @app.put("/api/sections", dependencies=[Depends(require_step_up)])
    async def sections_put(request: Request) -> dict:
        _require_person(getattr(request.state, "principal", None))
        world, registry, uj = _state_for(request)
        try:
            body = await request.json()
        except ValueError:
            raise HTTPException(status_code=400, detail="body must be JSON")
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="body must be an object")
        current = world.layout.get(sections_mod.LAYOUT_KEY) or {}
        new_layout, errors = sections_mod.validate_layout_update(body, current)
        if errors:
            raise HTTPException(status_code=400, detail="; ".join(errors))
        world.layout[sections_mod.LAYOUT_KEY] = new_layout
        uw, _uj = _user_paths(request)
        save_world(world, uw)
        # Whose state is this? The caller's. The event goes to the
        # caller's own journal (shared journal in single mode).
        target = journal if uj == journal.path else Journal(uj)
        target.record(kind=JournalKind.SETTINGS_CHANGE,
                      summary="sections layout updated", source="api")
        return _sections_payload(world, registry)

    # -- source_control: native git baseline (zero providers required) --
    def _sc_paths() -> list[str]:
        from .source_control import configured_search_paths
        return configured_search_paths(config_dir)

    @app.get("/api/source-control/status", dependencies=[Depends(require_auth)])
    async def source_control_status() -> dict:
        paths = _sc_paths()
        if not paths:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["no source_control search paths configured"]}
        repos = [
            r for r in status_all(paths)
            if r.get("error") is None or r.get("branch") is not None
        ]
        if not repos:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["no git repositories found in configured "
                                 "search paths"]}
        return {"ok": True, "status": "healthy", "data": {"repos": repos}}

    @app.get("/api/source-control/history", dependencies=[Depends(require_auth)])
    async def source_control_history(repo: str, limit: int = 20) -> dict:
        paths = _sc_paths()
        if not paths:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["no source_control search paths configured"]}
        matches = [
            e for e in discover_repositories(paths)
            if e["is_repository"] and e["name"] == repo
        ]
        if not matches:
            return {"ok": False, "status": "not_configured",
                    "warnings": [f"repository '{repo}' not found in "
                                 "configured search paths"]}
        commits = repository_history(matches[0]["path"], limit)
        return {"ok": True, "status": "healthy",
                "data": {"repo": repo, "commits": commits}}

    # ── First propose→approve→act workflow (Finish Line "Actions,
    # approvals, and trusted automation"). The FIRST action is
    # intentionally low-risk: re-run the native read-only git status
    # for ONE repository. Agreement is not authorization: the client
    # must show what/why/tool/risk/expected and collect an explicit
    # approval BEFORE this endpoint is called; the endpoint itself is
    # the act (step-up gated). The audit answer — who proposed (the UI
    # proposal), what was approved (the named repo refresh), what
    # happened, which tool (the native git baseline), what came back,
    # and when (provenance timestamp) — is journaled as a
    # PROVIDER_ACTION; no secrets, no paths beyond the repo name. ──
    @app.post("/api/source-control/refresh", dependencies=[Depends(require_step_up)])
    async def source_control_refresh(request: Request) -> dict:
        try:
            body = await request.json()
        except ValueError:
            raise HTTPException(status_code=400, detail="body must be JSON")
        repo = (body.get("repo") or "").strip() if isinstance(body, dict) else ""
        if not repo:
            raise HTTPException(status_code=400, detail="repo is required")
        paths = _sc_paths()
        matches = [
            e for e in discover_repositories(paths)
            if e["is_repository"] and e["name"] == repo
        ]
        if not matches:
            journal.record(
                JournalKind.FAILURE,
                f"proposed repository status refresh rejected: "
                f"repository '{repo}' not found in configured search paths",
                source="projects",
            )
            return {
                "ok": False,
                "status": "not_configured",
                "warnings": [
                    f"repository '{repo}' not found in "
                    "configured search paths"
                ],
            }
        status = repository_status(matches[0]["path"])
        if status.get("error"):
            journal.record(
                JournalKind.FAILURE,
                f"repository status refresh ran for '{repo}' but git "
                f"reported: {status['error']}",
                source="projects",
            )
            return {
                "ok": False,
                "status": "unavailable",
                "warnings": [str(status["error"])],
            }
        state_bits = [
            f"branch {status.get('branch') or 'unknown'}",
            "uncommitted changes" if status.get("dirty") else "clean",
        ]
        if status.get("ahead") or status.get("behind"):
            state_bits.append(
                f"{status.get('ahead') or 0} ahead / "
                f"{status.get('behind') or 0} behind"
            )
        journal.record(
            JournalKind.PROVIDER_ACTION,
            f"approved action: repository status refresh for '{repo}' "
            f"(proposed by the Projects screen, approved explicitly, "
            f"executed by the native git baseline) — "
            f"{', '.join(state_bits)}",
            source="projects",
        )
        return {"ok": True, "status": "healthy", "data": {"repo": repo, "status": status}}

    @app.get("/api/lab/state", dependencies=[Depends(require_auth)])
    async def lab_state() -> dict:
        """Operator packet from the homelab Lab CLI (lab-lowbw/1).

        Presentation-only: the packet is produced by the lab layer;
        this route never derives homelab state itself.
        """
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        r = provider.observe()
        payload = {
            "ok": r.ok,
            "status": r.status,
            "data": r.data or {"rows": [], "reason": r.status},
        }
        if r.warnings:
            payload["warnings"] = r.warnings
        return payload

    @app.get("/api/lab/settings", dependencies=[Depends(require_auth)])
    async def lab_settings() -> dict:
        """Settings Reconciler status via lab CLI."""
        from .providers.lab_settings import LabSettings
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        settings = LabSettings(lab_path=provider.lab_path)
        r = settings.observe()
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.get("/api/lab/settings/inspect/{service}", dependencies=[Depends(require_auth)])
    async def lab_settings_inspect(service: str) -> dict:
        """Inspect desired state for a specific service."""
        from .providers.lab_settings import LabSettings
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        settings = LabSettings(lab_path=provider.lab_path)
        r = settings.inspect(service)
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.get("/api/lab/settings/diff/{service}", dependencies=[Depends(require_auth)])
    async def lab_settings_diff(service: str) -> dict:
        """Drift between desired and live state for a service."""
        from .providers.lab_settings import LabSettings
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        settings = LabSettings(lab_path=provider.lab_path)
        r = settings.diff(service)
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.get("/api/lab/health", dependencies=[Depends(require_auth)])
    async def lab_health() -> dict:
        """Health check across all services via lab CLI."""
        from .providers.lab_health import LabHealth
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        health = LabHealth(lab_path=provider.lab_path)
        r = health.observe()
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.get("/api/lab/deploy", dependencies=[Depends(require_auth)])
    async def lab_deploy() -> dict:
        """Deploy status and history via lab CLI."""
        from .providers.lab_deploy import LabDeploy
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        deploy = LabDeploy(lab_path=provider.lab_path)
        r = deploy.observe()
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.get("/api/lab/secrets", dependencies=[Depends(require_auth)])
    async def lab_secrets() -> dict:
        """Secret audit (names only, no values) via lab CLI."""
        from .providers.lab_secrets import LabSecrets
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        secrets = LabSecrets(lab_path=provider.lab_path)
        r = secrets.observe()
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.get("/api/lab/resources", dependencies=[Depends(require_auth)])
    async def lab_resources() -> dict:
        """VM resource usage via lab CLI."""
        from .providers.lab_resources import LabResources
        provider = LabState(lab_path=os.environ.get("PW_LAB_CLI", DEFAULT_LAB))
        resources = LabResources(lab_path=provider.lab_path)
        r = resources.observe()
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    # --- Vault endpoints ---

    # --- Vault: one instance per app, survives across requests ---
    # (fresh Vault per request would forget unlock state and secrets)
    from .vault import Vault
    _vault = Vault(data_dir / "vault.enc")

    @app.get("/api/vault/status", dependencies=[Depends(require_auth)])
    async def vault_status() -> dict:
        """Vault status: locked/unlocked, secret count. Never values."""
        return {"ok": True,
                "data": {"locked": not _vault.is_unlocked,
                         "encrypted": True}}

    @app.post("/api/vault/unlock", dependencies=[Depends(require_auth)])
    async def vault_unlock(request: Request) -> dict:
        """Unlock the vault with a master passphrase."""
        body = await request.json()
        passphrase = body.get("passphrase", "")
        if not passphrase:
            raise HTTPException(status_code=400, detail="passphrase required")
        r = _vault.unlock(passphrase)
        return {"ok": r.ok, "status": r.status, "data": r.data, "warnings": r.warnings}

    @app.post("/api/vault/lock", dependencies=[Depends(require_auth)])
    async def vault_lock() -> dict:
        """Lock the vault, clearing secrets from memory."""
        _vault.lock()
        return {"ok": True, "data": {"locked": True}}

    @app.get("/api/vault/names", dependencies=[Depends(require_auth)])
    async def vault_names() -> dict:
        """List secret names (never values). Requires unlocked vault."""
        try:
            return {"ok": True, "data": {"names": _vault.list_names()}}
        except RuntimeError:
            raise HTTPException(status_code=409, detail="vault is locked")

    @app.post("/api/vault/set", dependencies=[Depends(require_auth)])
    async def vault_set(request: Request) -> dict:
        """Store a secret. Body: {name, value}."""
        body = await request.json()
        name = body.get("name")
        value = body.get("value")
        if not name or value is None:
            raise HTTPException(status_code=400, detail="name and value required")
        r = _vault.set(name, value)
        if not r.ok:
            return {"ok": r.ok, "status": r.status, "warnings": r.warnings}
        return {"ok": True, "data": {"name": name}}

    @app.get("/api/vault/{name}", dependencies=[Depends(require_auth)])
    async def vault_get(name: str, request: Request) -> dict:
        """Read a single secret value. Loopback-host-only:
        requests from non-loopback Remote-Addr are refused even with a
        valid bearer, keeping secret-value extraction a local-only
        operation (browser/keys never cross the wire).
        Each retrieval audited to the journal with the NAME only."""
        client = request.client.host if request.client else "?"
        # Docker port-forward can show the container gateway (172.16-31.x)
        # for the same host; accept either loopback or private bridge.
        import ipaddress
        try:
            ip = ipaddress.ip_address(client)
        except ValueError:
            ip = None
        loopback = client in ("127.0.0.1", "::1", "localhost", "testclient") or (
            ip is not None and (ip.is_loopback or ip.is_private))
        if not loopback:
            raise HTTPException(
                status_code=403,
                detail=f"vault GET is loopback-only (client={client})")
        try:
            value = _vault.get(name)
        except RuntimeError:
            raise HTTPException(status_code=409, detail="vault is locked")
        if value is None:
            raise HTTPException(status_code=404, detail=f"{name} not found")
        journal.record(
            kind=JournalKind.OBSERVATION,
            summary=f"vault get (name-only): {name}",
            source="api",
        )

        return {"ok": True, "data": {"name": name, "value": value}}

    @app.delete("/api/vault/{name}", dependencies=[Depends(require_auth)])
    async def vault_delete(name: str) -> dict:
        """Delete a secret by name."""
        r = _vault.delete(name)
        if not r.ok:
            return {"ok": r.ok, "status": r.status, "warnings": r.warnings}
        return {"ok": True, "data": {"name": name}}

    # --- Theme pack endpoints ---

    @app.get("/api/themes", dependencies=[Depends(require_auth)])
    async def themes_list() -> dict:
        """List available theme packs."""
        from .theme_pack import ThemePackRegistry
        registry = ThemePackRegistry(data_dir / "theme-packs")
        packs = registry.list_packs()
        return {
            "ok": True,
            "data": [p.model_dump(mode="json") for p in packs],
        }

    @app.get("/api/themes/{name}", dependencies=[Depends(require_auth)])
    async def themes_get(name: str) -> dict:
        """Get a specific theme pack manifest."""
        from .theme_pack import ThemePackRegistry
        registry = ThemePackRegistry(data_dir / "theme-packs")
        pack = registry.get(name)
        return {"ok": True, "data": pack.model_dump(mode="json")}

    # --- Scheduler / Reminders ---

    # One scheduler lives per app (background thread + shared state);
    # per-request Scheduler instances would silently double-fire or
    # miss entirely. Started with the app; stops at FastAPI shutdown.
    from .scheduler import Scheduler, Reminder
    _reminders = Scheduler(data_dir / "reminders.json", journal=journal)

    @app.on_event("startup")
    async def start_scheduler() -> None:
        _reminders.start()

    @app.on_event("shutdown")
    async def stop_scheduler() -> None:
        _reminders.stop()

    # -- identity admin (issue #8 phase 2/3) -----------------------------
    def _is_admin(principal) -> bool:
        """Admin = the bootstrap principal (primary), or a person
        explicitly carrying the admin scope record. Kept deliberately
        small: no roles tree, just this gate."""
        return principal is not None and principal.kind == "person" \
            and (principal.id == "primary" or "admin" in principal.scopes)

    def _require_person(principal) -> None:
        """Person-only surfaces: prefs, journal, notes. Agents are
        refused even with valid tokens — narrow scope model, fail
        closed."""
        if principal is not None and principal.kind == "agent":
            raise HTTPException(status_code=403, detail="person-only surface")

    @app.get("/api/identity/users", dependencies=[Depends(require_auth)])
    async def users_list(request: Request) -> dict:
        principal = getattr(request.state, "principal", None)
        if not _is_admin(principal):
            raise HTTPException(status_code=403, detail="admin only")
        return {"ok": True,
                "data": _identity_store.list_users()}

    @app.post("/api/identity/users", dependencies=[Depends(require_step_up)])
    async def users_create(request: Request) -> dict:
        """Provision a person without touching internals.

        Body: {"user_id", "display_name"?, "token"?"}. Token is
        optional; if omitted the server generates one and returns it
        exactly once. Never stored in the clear.
        """
        principal = getattr(request.state, "principal", None)
        if not _is_admin(principal):
            raise HTTPException(status_code=403, detail="admin only")
        body = await request.json()
        user_id = ((body or {}).get("user_id") or "").strip()
        if not user_id or len(user_id) > 64 or not user_id.replace("-", "").replace("_", "").isalnum():
            raise HTTPException(status_code=422, detail="user_id invalid")
        display = (body or {}).get("display_name") or user_id
        plain = (body or {}).get("token") or secrets.token_urlsafe(24)
        try:
            u = _identity_store.create_user(user_id, display,
                                            initial_plain_token=plain)
        except ValueError as e:
            raise HTTPException(status_code=409, detail=str(e))
        journal.record(kind=JournalKind.SETTINGS_CHANGE,
                       summary=f"user provisioned: {user_id}",
                       source="admin")
        return {"ok": True,
                "data": {"user_id": u["user_id"],
                         "display_name": u.get("display_name"),
                         "token": plain}}

    @app.delete("/api/identity/users/{user_id}",
                dependencies=[Depends(require_step_up)])
    async def users_disable(request: Request, user_id: str) -> dict:
        """Revoke access (disable). Data is preserved, not deleted."""
        principal = getattr(request.state, "principal", None)
        if not _is_admin(principal):
            raise HTTPException(status_code=403, detail="admin only")
        ok = _identity_store.disable_user(user_id)
        if not ok:
            raise HTTPException(status_code=404, detail="no such user")
        journal.record(kind=JournalKind.SETTINGS_CHANGE,
                       summary=f"user disabled: {user_id}",
                       source="admin")
        return {"ok": True, "data": {"user_id": user_id, "disabled": True}}

    @app.get("/api/identity/agents", dependencies=[Depends(require_auth)])
    async def agents_list(request: Request) -> dict:
        """Mine (list) — agents owned by the caller; admins see all."""
        principal = getattr(request.state, "principal", None)
        if principal and _is_admin(principal):
            return {"ok": True, "data": _identity_store.list_agents()}
        owner = principal.owner_id if (principal and principal.kind == "agent") else (principal.id if principal else None)
        return {"ok": True, "data": _identity_store.list_agents(owner_id=owner)}

    @app.post("/api/identity/agents", dependencies=[Depends(require_step_up)])
    async def agents_create(request: Request) -> dict:
        """Register an agent principal owned by the caller.

        Body: {"agent_id", "display_name"?, "scopes"?}. Scopes subset
        of read/write/journal/apps. Returns the token exactly once.
        """
        ALLOWED = {"read", "write", "journal", "apps"}
        principal = getattr(request.state, "principal", None)
        if principal is None:
            raise HTTPException(status_code=403, detail="principal required")
        body = await request.json()
        agent_id = ((body or {}).get("agent_id") or "").strip()
        if not agent_id or len(agent_id) > 64 or not agent_id.replace("-", "").replace("_", "").isalnum():
            raise HTTPException(status_code=422, detail="agent_id invalid")
        scopes = [s for s in
                  ((body or {}).get("scopes") or ["read"])
                  if s in ALLOWED] or ["read"]
        plain = secrets.token_urlsafe(24)
        try:
            a = _identity_store.create_agent(agent_id, principal.id,
                                             tuple(scopes),
                                             plain_token=plain)
        except ValueError as e:
            raise HTTPException(status_code=409, detail=str(e))
        journal.record(kind=JournalKind.SETTINGS_CHANGE,
                       summary="agent registered: " + agent_id + " scopes=" + ",".join(scopes),
                       source="admin")
        return {"ok": True,
                "data": {"agent_id": a["user_id"], "owner_id": principal.id,
                         "scopes": scopes, "token": plain}}

    @app.delete("/api/identity/agents/{agent_id}",
                dependencies=[Depends(require_step_up)])
    async def agents_disable(request: Request, agent_id: str) -> dict:
        principal = getattr(request.state, "principal", None)
        ok = _identity_store.disable_agent(agent_id, principal.id)
        if not ok:
            raise HTTPException(status_code=404, detail="no such agent")
        journal.record(kind=JournalKind.SETTINGS_CHANGE,
                       summary=f"agent disabled: {agent_id}",
                       source="admin")
        return {"ok": True, "data": {"agent_id": agent_id, "disabled": True}}

    @app.get("/api/apps", dependencies=[Depends(require_auth)])
    async def apps_list(request: Request) -> dict:
        """Services launcher registry (config/data/apps.json).

        Each entry: {id, name, url, icon?, category?}. User-editable,
        optional; absent file = empty list.
        """
        _, _, _uj = _state_for(request)
        path = data_dir / "apps.json"
        if not path.exists():
            return {"ok": True, "data": []}
        try:
            items = json.loads(path.read_text())
        except Exception:
            return {"ok": True, "data": []}
        return {"ok": True, "data": items}

    @app.put("/api/apps", dependencies=[Depends(require_step_up)])
    async def apps_put(request: Request) -> dict:
        """Replace the services registry (step-up gated, like prefs)."""
        _, _, _uj = _state_for(request)
        body = await request.json()
        items = body.get("apps") if isinstance(body, dict) else None
        if not isinstance(items, list):
            raise HTTPException(status_code=422, detail="apps must be a list")
        path = data_dir / "apps.json"
        path.write_text(json.dumps(items, indent=2))
        journal.record(
            kind=JournalKind.SETTINGS_CHANGE,
            summary=f"apps registry updated: {len(items)} services",
            source="api",
        )
        return {"ok": True, "data": items}

    @app.get("/api/reminders", dependencies=[Depends(require_auth)])
    async def reminders_list() -> dict:
        """List all reminders."""
        reminders = _reminders.list_reminders()
        return {"ok": True, "data": [r.model_dump(mode="json") for r in reminders]}

    @app.post("/api/reminders", dependencies=[Depends(require_step_up)])
    async def reminders_add(request: Request) -> dict:
        """Add a reminder. Body: {id, text, cron_hour, cron_minute, cron_day}."""
        body = await request.json()
        rid = body.get("id") or f"r-{int(time.time())}"
        text = body.get("text", "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="text required")
        reminder = Reminder(
            id=rid, text=text,
            cron_hour=body.get("cron_hour"),
            cron_minute=body.get("cron_minute"),
            cron_day=body.get("cron_day"),
        )
        r = _reminders.add(reminder)
        return {"ok": r.ok, "data": r.data, "warnings": r.warnings}

    @app.delete("/api/reminders/{rid}", dependencies=[Depends(require_step_up)])
    async def reminders_delete(rid: str) -> dict:
        """Delete a reminder."""
        r = _reminders.remove(rid)
        return {"ok": r.ok, "data": r.data, "warnings": r.warnings}

    @app.patch("/api/reminders/{rid}", dependencies=[Depends(require_step_up)])
    async def reminders_toggle(rid: str, request: Request) -> dict:
        """Toggle a reminder. Body: {enabled: bool}."""
        from .scheduler import Scheduler
        body = await request.json()
        r = _reminders.toggle(rid, body.get("enabled", True))
        return {"ok": r.ok, "data": r.data, "warnings": r.warnings}

    # --- Source control enrichment ---

    @app.get("/api/source-control/enrichment", dependencies=[Depends(require_auth)])
    async def source_control_enrichment(repo: str = "") -> dict:
        """GitHub enrichment for ONE repository (remote-side facts
        local Git cannot know: canonical identity, open PRs, open
        issues, default branch, last remote push).

        Local Git stays canonical — this only ADDS remote facts; the
        native status shape is unchanged. Quiet degradation is the
        contract: gh missing / unauthenticated / offline / non-GitHub
        remote each return their own honest status ('unavailable',
        'not_github', 'not_configured'), never a crash and never a
        guessed field. Read-only; no credentials are read, stored, or
        logged here — the gh CLI's own session is used as-is."""
        from .providers.github import GitHubEnrichment
        paths = _sc_paths()
        if not repo:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["repo query parameter is required"]}
        matches = [
            e for e in discover_repositories(paths)
            if e["is_repository"] and e["name"] == repo
        ]
        if not matches:
            return {"ok": False, "status": "not_configured",
                    "warnings": [f"repository '{repo}' not found in "
                                 "configured search paths"]}
        status = repository_status(matches[0]["path"])
        r = GitHubEnrichment().enrich_repo(status.get("remote"))
        return {"ok": r.ok, "status": r.status, "data": r.data,
                "warnings": r.warnings}

    @app.get("/api/projects/status", dependencies=[Depends(require_auth)])
    async def projects_status() -> dict:
        """Project-estate status from the agent-sync sensor (read-only).

        agent-sync (the pickle project's adapter layer) is
        AUTHORITATIVE for repository publication state: it invokes
        this one `agent-sync status --all --format json` observation
        per call and normalizes the documented
        `play-nice/repo-status-v1` records. Project Worlds adds no
        Git-state computation of its own. Quiet degradation is the
        contract: command absent / timeout / malformed output each
        return an honest 'unavailable' envelope — Project Worlds
        stays fully useful without the sensor. The observation carries
        agent-sync's own `observed_at` so it stays visibly a dated
        observation, never timeless truth."""
        from .providers.agent_sync import AgentSyncProjectSensor
        r = AgentSyncProjectSensor().observe_projects()
        return {"ok": r.ok, "status": r.status, "data": r.data,
                "warnings": r.warnings}

    @app.get("/api/identity/principal", dependencies=[Depends(require_auth)])
    async def identity_principal(request: Request) -> dict:
        """Read-only: who is calling. Useful for diagnostics and for a
        future onboarding / profiles surface."""
        p = getattr(request.state, "principal", None)
        if p is None:
            raise HTTPException(status_code=409,
                                detail="principal not resolved")
        stored = _identity_store.get_display_name(p.id) if p.kind == "person" else None
        return {"ok": True,
                "data": {"id": p.id, "kind": p.kind,
                         "display_name": stored or p.display_name,
                         "scopes": list(p.scopes),
                         "source": p.source}}

    @app.put("/api/identity/principal", dependencies=[Depends(require_step_up)])
    async def identity_principal_update(request: Request) -> dict:
        """Set the caller's own display name. Persisted in private runtime
        state (data/users.json), never in tracked config. Persons only."""
        p = getattr(request.state, "principal", None)
        if p is None:
            raise HTTPException(status_code=409, detail="principal not resolved")
        _require_person(p)
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="JSON body required")
        name = str((body or {}).get("display_name", "")).strip()
        if not name or len(name) > 80:
            raise HTTPException(status_code=400,
                                detail="display_name must be 1-80 characters")
        _identity_store.set_display_name(p.id, name)
        journal.record(JournalKind.SETTINGS_CHANGE,
                       f"display name updated for {p.id}", source="api")
        return {"ok": True,
                "data": {"id": p.id, "kind": p.kind, "display_name": name,
                         "scopes": list(p.scopes), "source": p.source}}

    @app.get("/api/ingress/rollups", dependencies=[Depends(require_auth)])
    async def ingress_rollups() -> dict:
        """Traefik ingress route rollups (read-only over LAN)."""
        try:
            from .providers.traefik_ingress import TraefikIngress
        except ImportError:
            return {"ok": False, "status": "not_configured",
                    "warnings": ["traefik provider missing"]}
        r = TraefikIngress().observe()
        return {"ok": r.ok, "status": r.status, "data": r.data,
                "warnings": r.warnings}

    # --- Quick actions ---

    @app.post("/api/world/intent", dependencies=[Depends(require_step_up)])
    async def set_intent(request: Request) -> dict:
        """Set an intent. Body: {key, value}."""
        body = await request.json()
        key = body.get("key", "").strip()
        value = body.get("value")
        if not key:
            raise HTTPException(status_code=400, detail="key required")
        world, registry = _state()
        from .model import Intent, Provenance
        intent = Intent(
            key=key, value=value,
            provenance=Provenance(source="dashboard-quick-action"),
        )
        world.set_intent(intent)
        save_world(world, world_path)
        return {"ok": True, "data": {"key": key}}

    @app.post("/api/world/fact", dependencies=[Depends(require_step_up)])
    async def record_fact(request: Request) -> dict:
        """Record a fact. Body: {key, value}."""
        body = await request.json()
        key = body.get("key", "").strip()
        value = body.get("value")
        if not key:
            raise HTTPException(status_code=400, detail="key required")
        world, registry = _state()
        from .model import Fact, Provenance
        fact = Fact(
            key=key, value=value,
            provenance=Provenance(source="dashboard-quick-action"),
        )
        world.record_fact(fact)
        save_world(world, world_path)
        return {"ok": True, "data": {"key": key}}

    @app.post("/api/world/policy", dependencies=[Depends(require_step_up)])
    async def add_policy(request: Request) -> dict:
        """Add a policy. Body: {key, effect}."""
        body = await request.json()
        key = body.get("key", "").strip()
        effect = body.get("effect", "allow")
        if not key:
            raise HTTPException(status_code=400, detail="key required")
        world, registry = _state()
        from .model import Policy, PolicyEffect, Provenance
        try:
            policy = Policy(
                key=key,
                effect=PolicyEffect(effect),
                provenance=Provenance(source="dashboard-quick-action"),
            )
        except ValueError:
            raise HTTPException(status_code=400,
                                detail="effect must be 'allow' or 'deny'")
        try:
            world.set_policy(policy)
        except MutationDenied as exc:
            # a cemented policy is only changeable by an explicit user
            # action through the CLI; the API reports the boundary, it
            # does not crash on it
            raise HTTPException(status_code=409, detail=str(exc))
        save_world(world, world_path)
        return {"ok": True, "data": {"key": key, "effect": effect}}

    # --- Setup page ---
    # First-run, /setup-wizard, /setup and /login are React SPA
    # routes (App.tsx); there is no server-rendered HTML anymore.


    @app.get("/", response_class=HTMLResponse)
    async def spa_root() -> HTMLResponse:
        """The one product frontend: the React SPA (T15 cutover)."""
        return _spa_index()

    companion_dir = Path(__file__).parent / "static" / "companions"
    _COMPANION_FILES = {
        "personal-world": "personal-world.svg",
        "mermaid": "mermaid.svg",
        "robot": "robot.svg",
        "world-tree-squirrel": "world-tree-squirrel.svg",
        "taco-news-truck": "taco-news-truck.svg",
    }

    @app.get("/companions/{name}.svg")
    async def companion_svg(name: str) -> Response:
        # Approved companion source rigs, byte-identical copies of the
        # design-owned artwork (see design/assets/companions/). Public:
        # decorative identity, carries no world state.
        filename = _COMPANION_FILES.get(name)
        if filename is None or not companion_dir.exists():
            raise HTTPException(status_code=404, detail="unknown companion")
        path = companion_dir / filename
        if not path.exists():
            raise HTTPException(status_code=404, detail="companion art missing")
        return FileResponse(path, media_type="image/svg+xml")

    static_dir = Path(__file__).parent / "static"

    @app.get("/icons/sprite.svg")
    async def icon_sprite() -> Response:
        # 72-glyph production icon system (design/assets/icons/). Public:
        # decorative geometry, stroke=currentColor, carries no world state.
        path = static_dir / "icons" / "sprite.svg"
        if not path.exists():
            raise HTTPException(status_code=404, detail="sprite missing")
        return FileResponse(path, media_type="image/svg+xml")

    @app.get("/fonts/{name}")
    async def webfont(name: str, request: Request) -> Response:
        # Self-hosted Figma-export families (design/tokens.json
        # font.expressive / font.interface). Public: OFL-licensed
        # font binaries, no world state.
        allowed = {
            "young-serif-latin.woff2": "font/woff2",
            "instrument-sans-var-latin.woff2": "font/woff2",
        }
        ctype = allowed.get(name)
        if ctype is None or "/" in name or ".." in name:
            raise HTTPException(status_code=404, detail="unknown font")
        path = static_dir / "fonts" / name
        if not path.exists():
            raise HTTPException(status_code=404, detail="font missing")
        return _cached_file(request, path, ctype)

    # SPA fallback: registered LAST so /api/*, /healthz, /companions/*,
    # /icons/* and /fonts/* keep winning by registration order.
    # Allowlist built once at app start: every file actually in the
    # dist, keyed by relative POSIX path → resolved absolute Path.
    # No user-controlled value ever constructs a filesystem path, so
    # traversal simply misses the dict (CodeQL path-injection fix).
    _spa_files: dict[str, Path] = {}
    if frontend_dist.is_dir():
        for candidate in frontend_dist.rglob("*"):
            if candidate.is_file():
                _spa_files[candidate.relative_to(
                    frontend_dist).as_posix()] = candidate.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str, request: Request):
        if full_path == "healthz" or full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="not found")
        allowed = _spa_files.get(full_path)
        if allowed is not None and allowed.is_file():
            ctype = "text/css" if full_path.endswith(".css") else None
            return _cached_file(request, allowed, ctype,
                                cache_private=full_path.startswith("assets/"))
        return _spa_index()

    return app


# 503 body when the dist directory has no index.html. There is no
# legacy fallback UI behind it — this page IS the missing-frontend
# state. Static by design: no environment values, no filesystem paths —
# a private dist path must never be echoed to a browser.
SPA_NOT_BUILT_HTML = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Project Worlds — interface not built</title></head>
<body>
<main id="main-content">
<h1>Project Worlds' interface is not built</h1>
<p>The web interface files were not found. Build the frontend (<code>npm run build</code> in <code>frontend/</code>) or point <code>PW_FRONTEND_DIST</code> at a built <code>dist/</code> directory, then restart.</p>
<p>The API is still available; nothing else is affected.</p>
</main>
</body>
</html>"""
