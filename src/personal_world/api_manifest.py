"""The endpoint manifest: one curated table, verified against live routes.

Product decision #17 (`docs/PRODUCT-VISION-HANDOFF.md`, round-2 answers)
makes the API a fully-exposed "Lego box": UI, agent templates and
settings compose against it, so a client needs a machine-readable answer
to "what can I call, and what does calling it cost me in
authorization?". This module is the single curated source for that
answer. `GET /api/manifest` serves it under the `endpoints` key; nothing
else duplicates the table.

Curation source: `docs/surfaces/UI-API-MATRIX.md` +
`docs/surfaces/MASTER-SURFACE-REGISTRY.md` + `docs/surfaces/AUTH-MATRIX.md`
semantics (ids, capability grouping, read/write, gate). Those documents
are prose and drift; the code does not. Every curated row is therefore
**verified against the live FastAPI route table at request time** and
carries `present: false` when the route it names is not registered, so
the manifest can never advertise an endpoint that does not exist.
Routes that exist but are not curated are reported under `uncurated`
with a gate derived from the code — completeness is stated, never
implied.

Vocabulary (deliberately small):

* `kind`: `read` | `write`.
* `gate`: `none` | `step-up` | `proposal` — the *elevation* required
  beyond authentication. `none` means "no elevation gate"; it never
  means "unauthenticated" (see `auth`).
* `auth`: `public` | `authenticated` — whether a credential is required
  at all. `authenticated` is the single `require_auth` seam (bearer,
  browser session, or the opt-in loopback dev bypass).
* `present`: the route is registered in the running app.

Honesty note on the enum: a few real writes (`POST /api/vault/set`,
`DELETE /api/vault/{name}`, `POST /api/chat`, `POST /api/setup`) are
gated by `require_auth` only — `docs/surfaces/AUTH-MATRIX.md` records
the Vault ones as a documented divergence from step-up. The three-value
`gate` enum cannot express "authenticated write without elevation", and
claiming `step-up` for them would be a fabrication that sends clients
chasing a grant they do not need. They keep `gate: "none"` and are
listed explicitly, by name, in `writes_without_elevation` — visible
rather than quietly normalized. Credential-lifecycle rows (sign-in and
first-run bootstrap: capability `auth`/`setup`, or a `/api/auth/` or
`/api/setup` path) are excluded from that list because they mutate
session/marker state, not world state; they stay fully visible in
`endpoints`/`uncurated` with their real gate and `auth`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

GATES = ("none", "step-up", "proposal")
KINDS = ("read", "write")
AUTH_LEVELS = ("public", "authenticated")

#: Strictness order, used to combine the curated gate with the gate the
#: code actually enforces (see `_effective_gate`).
_GATE_RANK = {gate: rank for rank, gate in enumerate(GATES)}

_READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

# Capabilities whose "writes" are credential lifecycle rather than
# world-state mutation (see `endpoint_manifest`).
_CREDENTIAL_CAPABILITIES = frozenset({"auth", "setup"})
_CREDENTIAL_PATH_PREFIXES = ("/api/auth/", "/api/setup")


@dataclass(frozen=True)
class Endpoint:
    """One curated (method, path) row of the endpoint manifest."""

    id: str
    method: str
    path: str
    capability: str
    kind: str
    gate: str
    auth: str = "authenticated"
    note: str | None = None

    def __post_init__(self) -> None:
        # Fail at import, loudly, rather than serve a malformed manifest.
        if self.kind not in KINDS:
            raise ValueError(f"{self.id}: kind must be one of {KINDS}")
        if self.gate not in GATES:
            raise ValueError(f"{self.id}: gate must be one of {GATES}")
        if self.auth not in AUTH_LEVELS:
            raise ValueError(f"{self.id}: auth must be one of {AUTH_LEVELS}")
        if self.method.upper() in _READ_METHODS and self.kind == "write":
            raise ValueError(f"{self.id}: a {self.method} cannot be a write")
        if (
            self.method.upper() not in _READ_METHODS
            and self.kind == "read"
            and not self.note
        ):
            # A mutating verb may be curated as a read only when the row
            # says why (an outbound probe that changes no local state).
            # An accidental one fails at import instead of shipping.
            raise ValueError(
                f"{self.id}: {self.method} is a write method; declare it "
                "kind='write', or justify kind='read' with a note"
            )


def _e(
    id: str,
    method: str,
    path: str,
    capability: str,
    kind: str,
    gate: str,
    auth: str = "authenticated",
    note: str | None = None,
) -> Endpoint:
    return Endpoint(
        id=id,
        method=method.upper(),
        path=path,
        capability=capability,
        kind=kind,
        gate=gate,
        auth=auth,
        note=note,
    )


# ── The curated table ────────────────────────────────────────────────
# Ordered by capability, mirroring the UI-API-MATRIX grouping. `id`
# reuses the surface-registry id; a suffix is added only where one
# registry id covers several (method, path) pairs.
ENDPOINTS: tuple[Endpoint, ...] = (
    # Bootstrap / liveness — the only genuinely public rows.
    _e("API-001", "GET", "/healthz", "health", "read", "none", "public"),
    _e("API-002-status", "GET", "/api/setup/status", "setup", "read", "none", "public"),
    _e(
        "API-002-run",
        "POST",
        "/api/setup",
        "setup",
        "write",
        "none",
        "public",
        "first-run bootstrap; 409 once the setup-complete marker exists",
    ),
    # Browser session (auth_routes.py; registry family AUTH-009).
    _e(
        "AUTH-009-login",
        "POST",
        "/api/auth/login",
        "auth",
        "write",
        "none",
        "public",
        "exchanges a credential for a session cookie",
    ),
    _e(
        "AUTH-009-logout", "POST", "/api/auth/logout", "auth", "write", "none", "public"
    ),
    _e(
        "AUTH-009-session", "GET", "/api/auth/session", "auth", "read", "none", "public"
    ),
    _e(
        "AUTH-009-step-up",
        "POST",
        "/api/auth/step-up",
        "auth",
        "write",
        "none",
        "public",
        "mints the time-bounded, principal-bound elevation that "
        "gate='step-up' routes consume",
    ),
    _e(
        "AUTH-009-oidc-config",
        "GET",
        "/api/auth/oidc/config",
        "auth",
        "read",
        "none",
        "public",
    ),
    _e(
        "AUTH-009-oidc-login",
        "GET",
        "/api/auth/oidc/login",
        "auth",
        "read",
        "none",
        "public",
    ),
    _e(
        "AUTH-009-oidc-callback",
        "GET",
        "/api/auth/oidc/callback",
        "auth",
        "read",
        "none",
        "public",
    ),
    # World / daily loop.
    _e("API-003", "GET", "/api/status", "world", "read", "none"),
    _e(
        "API-004-get",
        "GET",
        "/api/daily",
        "daily",
        "read",
        "none",
        note="read-only digest; never mutates",
    ),
    _e(
        "API-004-post",
        "POST",
        "/api/daily",
        "daily",
        "write",
        "none",
        note="runs the daily loop: journals observations, records facts, "
        "saves world.json — authenticated, not elevation-gated",
    ),
    _e("API-014", "GET", "/api/actors", "world", "read", "none"),
    _e(
        "API-015",
        "GET",
        "/api/manifest",
        "manifest",
        "read",
        "none",
        note="data = capability/provider manifest; endpoints = this table",
    ),
    _e("API-075", "POST", "/api/world/intent", "world", "write", "step-up"),
    _e("API-076-fact", "POST", "/api/world/fact", "world", "write", "step-up"),
    _e(
        "API-076-policy",
        "POST",
        "/api/world/policy",
        "world",
        "write",
        "step-up",
        note="cemented policies still refuse (409)",
    ),
    # Journal.
    _e(
        "API-005",
        "GET",
        "/api/journal",
        "journal",
        "read",
        "none",
        note="current version of each chain; person principals only",
    ),
    _e(
        "API-006",
        "POST",
        "/api/journal",
        "journal",
        "write",
        "none",
        note="personal note append; authenticated, not elevation-gated",
    ),
    _e(
        "API-007",
        "POST",
        "/api/journal/supersede",
        "journal",
        "write",
        "step-up",
        note="append-only correction",
    ),
    _e("API-008", "GET", "/api/journal/history", "journal", "read", "none"),
    # journal drafts — lining rescue (D15 "kept safe, synced"); no elevation
    # by design: a draft mutates nothing a publish doesn't already change.
    _e("API-080", "PUT", "/api/journal/draft", "journal", "write", "none",
       note="debounced client drafts; response never echoes text"),
    _e("API-081", "GET", "/api/journal/draft", "journal", "read", "none",
       note="resume-on-any-device read of the caller's own draft"),
    _e("API-082", "DELETE", "/api/journal/draft", "journal", "write", "none",
       note="cleared after confirmed publish"),
    _e("API-009", "GET", "/api/journal/audit", "journal", "read", "none"),
    _e("API-016", "GET", "/api/memory/search", "memory", "read", "none"),
    # Chat / brain.
    _e(
        "API-010",
        "POST",
        "/api/chat",
        "chat",
        "write",
        "none",
        note="read-only over a world snapshot, but can journal a "
        "recommendation event and create proposals",
    ),
    _e("API-011", "GET", "/api/chat/providers", "chat", "read", "none"),
    _e(
        "API-010-history",
        "GET",
        "/api/chat/history",
        "chat",
        "read",
        "none",
        note="the caller's own persisted transcript, oldest first "
        "(per-user, decision #13)",
    ),
    _e(
        "API-012",
        "POST",
        "/api/chat/test",
        "chat",
        "read",
        "none",
        note="POST verb, but a provider probe: it changes no local state "
        "(it does spend provider quota)",
    ),
    _e("API-013", "GET", "/api/tools", "tools", "read", "none"),
    _e("API-077-templates", "GET", "/api/brain/templates", "brain", "read", "none"),
    _e("API-077-provenance", "GET", "/api/brain/provenance", "brain", "read", "none"),
    # Proposals — the propose → approve → act lifecycle. The registry
    # has no API-nnn id for this family; PROP-* is minted here and is
    # the canonical machine id.
    _e("PROP-list", "GET", "/api/proposals", "proposals", "read", "none"),
    _e("PROP-get", "GET", "/api/proposals/{proposal_id}", "proposals", "read", "none"),
    _e(
        "PROP-approve",
        "POST",
        "/api/proposals/{proposal_id}/approve",
        "proposals",
        "write",
        "step-up",
        note="owner approval; evidence is server-held and persisted",
    ),
    _e(
        "PROP-reject",
        "POST",
        "/api/proposals/{proposal_id}/reject",
        "proposals",
        "write",
        "step-up",
    ),
    _e(
        "PROP-execute",
        "POST",
        "/api/proposals/{proposal_id}/execute",
        "proposals",
        "write",
        "proposal",
        note="acts only on a proposal already approved through "
        "PROP-approve; a model cannot invoke it",
    ),
    # Preferences / layout / apps / themes.
    _e("API-030-get", "GET", "/api/prefs", "prefs", "read", "none"),
    _e("API-030-put", "PUT", "/api/prefs", "prefs", "write", "step-up"),
    _e("API-031", "GET", "/api/prefs/schema", "prefs", "read", "none"),
    _e("API-032-get", "GET", "/api/sections", "sections", "read", "none"),
    _e("API-032-put", "PUT", "/api/sections", "sections", "write", "step-up"),
    _e("API-066-get", "GET", "/api/apps", "apps", "read", "none"),
    _e("API-066-put", "PUT", "/api/apps", "apps", "write", "step-up"),
    _e("API-065-list", "GET", "/api/themes", "themes", "read", "none"),
    _e("API-065-get", "GET", "/api/themes/{name}", "themes", "read", "none"),
    # Reminders / scheduler.
    _e("API-067-get", "GET", "/api/reminders", "reminders", "read", "none"),
    _e("API-067-add", "POST", "/api/reminders", "reminders", "write", "step-up"),
    _e(
        "API-067-toggle",
        "PATCH",
        "/api/reminders/{rid}",
        "reminders",
        "write",
        "step-up",
    ),
    _e(
        "API-067-delete",
        "DELETE",
        "/api/reminders/{rid}",
        "reminders",
        "write",
        "step-up",
    ),
    # Connections & providers.
    _e("API-017", "GET", "/api/connections/schemas", "connections", "read", "none"),
    _e(
        "API-018",
        "GET",
        "/api/connections/schema/{capability}",
        "connections",
        "read",
        "none",
    ),
    _e("API-019", "GET", "/api/connections/config", "connections", "read", "none"),
    _e("API-020", "GET", "/api/connections/overview", "connections", "read", "none"),
    _e("API-021-list", "GET", "/api/connections", "connections", "read", "none"),
    _e("API-021-save", "PUT", "/api/connections", "connections", "write", "step-up"),
    _e(
        "API-021-delete",
        "DELETE",
        "/api/connections/{name}",
        "connections",
        "write",
        "step-up",
    ),
    _e(
        "API-022",
        "POST",
        "/api/connections/config/{key}",
        "connections",
        "write",
        "step-up",
    ),
    _e(
        "API-023",
        "POST",
        "/api/connections/test",
        "connections",
        "read",
        "none",
        note="POST verb, but a live outbound probe: it changes no local state",
    ),
    _e(
        "API-024",
        "POST",
        "/api/connections/validate",
        "connections",
        "read",
        "none",
        note="POST verb, but a live outbound probe: it changes no local state",
    ),
    # Source control / projects / ingress.
    _e(
        "API-033", "GET", "/api/source-control/status", "source_control", "read", "none"
    ),
    _e(
        "API-034",
        "GET",
        "/api/source-control/history",
        "source_control",
        "read",
        "none",
    ),
    _e(
        "API-035",
        "POST",
        "/api/source-control/refresh",
        "source_control",
        "write",
        "step-up",
        note="the propose→approve→act refresh workflow; the elevation "
        "gate is require_step_up in code",
    ),
    _e(
        "API-036",
        "GET",
        "/api/source-control/enrichment",
        "source_control",
        "read",
        "none",
    ),
    _e("API-079", "GET", "/api/projects/status", "projects", "read", "none"),
    _e("API-078", "GET", "/api/ingress/rollups", "ingress", "read", "none"),
    # Lab (external CLI packets + native lab).
    _e("API-037", "GET", "/api/lab/state", "lab", "read", "none"),
    _e("API-038", "GET", "/api/lab/settings", "lab", "read", "none"),
    _e("API-039", "GET", "/api/lab/settings/inspect/{service}", "lab", "read", "none"),
    _e("API-040", "GET", "/api/lab/settings/diff/{service}", "lab", "read", "none"),
    _e("API-041", "GET", "/api/lab/health", "lab", "read", "none"),
    _e("API-042", "GET", "/api/lab/deploy", "lab", "read", "none"),
    _e(
        "API-043",
        "GET",
        "/api/lab/secrets",
        "lab",
        "read",
        "none",
        note="secret names/metadata only; never resolved values",
    ),
    _e("API-044", "GET", "/api/lab/resources", "lab", "read", "none"),
    _e("API-045", "GET", "/api/native-lab/inventory", "native_lab", "read", "none"),
    _e("API-046", "GET", "/api/native-lab/health", "native_lab", "read", "none"),
    _e("API-047", "GET", "/api/native-lab/settings", "native_lab", "read", "none"),
    _e("API-048", "GET", "/api/native-lab/resources", "native_lab", "read", "none"),
    _e("API-058", "GET", "/api/reconciler/status", "reconciler", "read", "none"),
    _e(
        "API-059", "GET", "/api/reconciler/diff/{service}", "reconciler", "read", "none"
    ),
    _e(
        "API-060",
        "GET",
        "/api/reconciler/propose/{service}",
        "reconciler",
        "read",
        "none",
        note="propose only; never applies",
    ),
    # Discovery / media.
    _e("API-049", "GET", "/api/discovery/status", "discovery", "read", "none"),
    _e("API-050-get", "GET", "/api/discovery/sources", "discovery", "read", "none"),
    _e(
        "API-050-add", "POST", "/api/discovery/sources", "discovery", "write", "step-up"
    ),
    _e("API-051-get", "GET", "/api/discovery/interests", "discovery", "read", "none"),
    _e(
        "API-051-add",
        "POST",
        "/api/discovery/interests",
        "discovery",
        "write",
        "step-up",
    ),
    _e(
        "API-052",
        "GET",
        "/api/discovery/discover",
        "discovery",
        "read",
        "none",
        note="fetches sources and may persist discovery feedback",
    ),
    _e("API-053", "GET", "/api/media/status", "media", "read", "none"),
    _e("API-054", "GET", "/api/media/library", "media", "read", "none"),
    _e("API-055", "GET", "/api/media/recent", "media", "read", "none"),
    _e("API-056", "GET", "/api/media/activity", "media", "read", "none"),
    _e("API-057", "GET", "/api/media/search", "media", "read", "none"),
    # Vault — see the AUTH-MATRIX divergence note in this docstring.
    _e("API-061", "GET", "/api/vault/status", "vault", "read", "none"),
    _e(
        "API-062-unlock",
        "POST",
        "/api/vault/unlock",
        "vault",
        "write",
        "none",
        note="requires the master passphrase in the body",
    ),
    _e("API-062-lock", "POST", "/api/vault/lock", "vault", "write", "none"),
    _e(
        "API-063-names",
        "GET",
        "/api/vault/names",
        "vault",
        "read",
        "none",
        note="names only; requires an unlocked vault",
    ),
    _e(
        "API-063-set",
        "POST",
        "/api/vault/set",
        "vault",
        "write",
        "none",
        note="documented divergence: bearer/session auth, not step-up",
    ),
    _e(
        "API-064-get",
        "GET",
        "/api/vault/{name}",
        "vault",
        "read",
        "none",
        note="value read; additionally peer-address restricted and journaled name-only",
    ),
    _e(
        "API-064-delete",
        "DELETE",
        "/api/vault/{name}",
        "vault",
        "write",
        "none",
        note="documented divergence: bearer/session auth, not step-up",
    ),
    # Identity / ownership.
    _e(
        "API-068-list",
        "GET",
        "/api/identity/users",
        "identity",
        "read",
        "none",
        note="admin-gated in handler",
    ),
    _e(
        "API-069",
        "POST",
        "/api/identity/users",
        "identity",
        "write",
        "step-up",
        note="admin-gated in handler",
    ),
    _e(
        "API-070",
        "DELETE",
        "/api/identity/users/{user_id}",
        "identity",
        "write",
        "step-up",
        note="admin-gated in handler",
    ),
    _e(
        "API-071-get",
        "GET",
        "/api/identity/agents",
        "identity",
        "read",
        "none",
        note="ownership-filtered",
    ),
    _e(
        "API-071-create", "POST", "/api/identity/agents", "identity", "write", "step-up"
    ),
    _e(
        "API-072",
        "DELETE",
        "/api/identity/agents/{agent_id}",
        "identity",
        "write",
        "step-up",
    ),
    _e("API-073", "GET", "/api/identity/principal", "identity", "read", "none"),
    _e("API-074", "PUT", "/api/identity/principal", "identity", "write", "step-up"),
    # Exports / backup / updates.
    _e(
        "API-025",
        "GET",
        "/api/exports/settings",
        "exports",
        "read",
        "none",
        note="shareable blueprint; never personal data",
    ),
    _e(
        "API-026",
        "GET",
        "/api/exports/world",
        "exports",
        "read",
        "none",
        note="portable personal config; never secrets or private lore",
    ),
    _e("API-027", "GET", "/api/exports/story", "exports", "read", "none"),
    _e(
        "API-028",
        "GET",
        "/api/backup",
        "exports",
        "read",
        "none",
        note="includes private state; encrypt externally, never share",
    ),
    _e(
        "API-029",
        "GET",
        "/api/updates",
        "updates",
        "read",
        "none",
        note="read-only update state; apply/rollback is CLI-only",
    ),
)


def _route_index(routes: Iterable[Any]) -> dict[tuple[str, str], set[str]]:
    """(METHOD, path) → the auth dependency names the code declares."""
    index: dict[tuple[str, str], set[str]] = {}
    for route in routes:
        methods = getattr(route, "methods", None)
        path = getattr(route, "path", None)
        if not methods or not path:
            continue
        names: set[str] = set()

        def walk(dependant: Any) -> None:
            call = getattr(dependant, "call", None)
            if call is not None:
                names.add(getattr(call, "__name__", ""))
            for sub in getattr(dependant, "dependencies", []) or ():
                walk(sub)

        dependant = getattr(route, "dependant", None)
        if dependant is not None:
            try:
                walk(dependant)
            except Exception:  # introspection must never break the manifest
                pass
        for method in methods:
            index.setdefault((method.upper(), path), set()).update(names)
    return index


def _effective_gate(row: Endpoint, deps: set[str]) -> str:
    """The stricter of what the code declares and what curation declares.

    A dependency-level `require_step_up` outranks a curated `none`: code
    is truth, and curation can never advertise a write as ungated. A
    curated `proposal` outranks a code-declared `step-up`, because the
    proposal lifecycle *includes* that elevation and adds the
    approved-proposal evidence check on top — reporting only `step-up`
    would understate what the caller needs. Curation is also the only
    place an in-handler step-up check can be expressed.
    """
    declared = "step-up" if "require_step_up" in deps else "none"
    return declared if _GATE_RANK[declared] > _GATE_RANK[row.gate] else row.gate


def _effective_auth(row: Endpoint, deps: set[str]) -> str:
    if deps & {"require_auth", "require_step_up"}:
        return "authenticated"
    return row.auth


def _serialize(
    row: Endpoint, *, present: bool, gate: str, auth: str, curated: bool
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": row.id if curated else None,
        "method": row.method,
        "path": row.path,
        "capability": row.capability,
        "kind": row.kind,
        "gate": gate,
        "auth": auth,
        "present": present,
    }
    if row.note:
        out["note"] = row.note
    return out


def _kind_for(method: str) -> str:
    return "read" if method.upper() in _READ_METHODS else "write"


def endpoint_manifest(routes: Iterable[Any]) -> dict[str, Any]:
    """Build the endpoint manifest, verified against `routes`.

    `routes` is any iterable of Starlette routes (pass `app.routes`).
    The result is JSON-serializable and carries no credential material,
    no filesystem paths and no configuration values — only route
    shapes and authorization labels.
    """
    index = _route_index(routes)

    endpoints: list[dict[str, Any]] = []
    writes_without_elevation: list[str] = []
    missing: list[str] = []
    curated_keys: set[tuple[str, str]] = set()

    for row in ENDPOINTS:
        key = (row.method, row.path)
        curated_keys.add(key)
        deps = index.get(key, set())
        present = key in index
        gate = _effective_gate(row, deps)
        auth = _effective_auth(row, deps) if present else row.auth
        endpoints.append(
            _serialize(row, present=present, gate=gate, auth=auth, curated=True)
        )
        label = f"{row.method} {row.path}"
        if not present:
            missing.append(label)
        # Credential-lifecycle rows (sign in/out, first-run bootstrap) are
        # mutating verbs but not world-state writes; listing them here
        # would drown the rows that actually matter. They remain fully
        # visible in `endpoints` with gate="none", auth="public".
        if (
            row.kind == "write"
            and gate == "none"
            and row.capability not in _CREDENTIAL_CAPABILITIES
        ):
            writes_without_elevation.append(label)

    # Live routes that this table does not curate. Reported with a
    # code-derived gate so the manifest states its own coverage instead
    # of implying completeness. Non-API machinery (docs, static assets,
    # the SPA fallback) is excluded: it is not part of the Lego box.
    uncurated: list[dict[str, Any]] = []
    for (method, path), deps in sorted(index.items()):
        if (method, path) in curated_keys:
            continue
        if method in ("HEAD", "OPTIONS"):
            continue
        if not path.startswith("/api/"):
            continue
        gate = "step-up" if "require_step_up" in deps else "none"
        auth = (
            "authenticated" if deps & {"require_auth", "require_step_up"} else "public"
        )
        kind = _kind_for(method)
        row = Endpoint(
            id="",
            method=method,
            path=path,
            capability="uncurated",
            kind=kind,
            gate=gate,
            auth=auth,
        )
        uncurated.append(
            _serialize(row, present=True, gate=gate, auth=auth, curated=False)
        )
        if (
            kind == "write"
            and gate == "none"
            and not path.startswith(_CREDENTIAL_PATH_PREFIXES)
        ):
            writes_without_elevation.append(f"{method} {path}")

    return {
        "source": "src/personal_world/api_manifest.py (curated from "
        "docs/surfaces/UI-API-MATRIX.md + MASTER-SURFACE-REGISTRY"
        ".md + AUTH-MATRIX.md), verified against the live route "
        "table",
        "vocabulary": {
            "kind": list(KINDS),
            "gate": list(GATES),
            "auth": list(AUTH_LEVELS),
            "gate_meaning": {
                "none": "no elevation beyond authentication (see 'auth')",
                "step-up": "requires a require_step_up elevation: a "
                "time-bounded session grant, true loopback, or "
                "the delegated X-PW-StepUp header (only with "
                "X-PW-Proxy-StepUp-Secret matching "
                "PW_PROXY_STEPUP_SECRET)",
                "proposal": "requires an approved proposal from the "
                "propose → approve → act lifecycle",
            },
        },
        "endpoints": endpoints,
        "uncurated": uncurated,
        "coverage": {
            "curated": len(endpoints),
            "curated_present": sum(1 for e in endpoints if e["present"]),
            "uncurated": len(uncurated),
            "complete": not uncurated and not missing,
        },
        # Visible, named, never silently normalized. See module docstring.
        "writes_without_elevation": sorted(set(writes_without_elevation)),
        "curated_but_not_registered": missing,
    }
