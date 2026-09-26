"""Rooms — the front door renders other small backends (contract: room/0).

Worlds shows rooms; it never copies their code. A *room* is any service
that serves the five ``/room`` endpoints defined by the canonical Room
contract (``room/0``). This module is the front-door half: it learns
each room's address from the operator's environment, reads the
read-only endpoints (``GET /room``, ``GET /room/cards`` and
``GET /room/needs-you``) concurrently, and reports an honest row per
room. It owns no room's code
and adds no new listening port to Worlds — rooms are reached outbound,
same-origin behind the estate's own auth proxy in production.

Configuration (read at request time, never written anywhere):

* ``PW_ROOMS`` — a comma list of ``id=baseURL`` entries, e.g.
  ``studio=http://127.0.0.1:8940,workshop=https://127.0.0.1:8961``.
* ``PW_ROOM_<ID>_TOKEN_ENV`` — the **name** of the env var that holds
  that room's bearer token (same indirection as
  ``providers/project_home.py``'s ``PW_PH_TOKEN_ENV``). The token value
  is never logged and never appears in a returned field.
* ``PW_ROOM_<ID>_INSECURE_TLS=1`` — accept a self-signed certificate on
  a LAN room's HTTPS address.

Runtime room list (Gap 1 / ROOM clause 15): when
``PW_ROOMS_REGISTRY_URL`` names Project Home's ``GET
/api/rooms/registry``, Worlds reads its room list from that registry at
snapshot time instead of static env — adding or removing a room takes
effect on the next refresh, with no restart. The registry payload is
cached 60 s; a bearer token is read from the env var named by
``PW_ROOMS_REGISTRY_TOKEN_ENV`` (same indirection, never a value in a
returned field), and ``PW_ROOMS_REGISTRY_INSECURE_TLS=1`` accepts a
self-signed registry certificate. On a successful fetch the enabled
rooms are used and persisted as last-known-good (``rooms-registry.json``
under the data dir, the same atomic seam as ``rooms-state.json``); on a
fetch failure the last-known-good is served and the problem is surfaced
honestly in the snapshot's registry report. Only when neither a
successful registry read nor a last-known-good exists does the module
fall back to ``PW_ROOMS`` — today's behaviour, unchanged.

Honesty posture: this module never raises out of :meth:`RoomsService
.snapshot`. A room that cannot be reached, times out, answers malformed
JSON, or speaks an unsupported contract value is reported as such —
never ``healthy``. ``unknown`` is not ``healthy`` and it is not failed;
an unreachable room renders as ``unreachable`` with its last-seen time,
and a room whose contract this front door does not support renders as
``incompatible`` with the reason — its cards and needs are never
counted.

A registry entry may also name an optional ``public_url``: a
browser-reachable ``http(s)`` address (no userinfo) for the room. It
rides each row as ``public_url`` and is an honest ``null`` when absent
or invalid; consumers then fall back to ``base_url``. The entry itself
is never dropped for a bad ``public_url``.

:meth:`RoomsService.secrets_overview` is the Worlds side of the
read-only Secrets board: it finds the room named ``workshop`` and reads
its ``GET /api/secrets/summary`` with that room's token/TLS policy (3 s
timeout, cached 60 s). It reports names and health only — never a value
— and any failure is an honest ``unknown`` station with a plain-words
detail, never an invented key and never a raised exception.

``last_seen``/``last_status`` persist to ``rooms-state.json`` under the
data dir (rule 12's "persists last-seen timestamps"), so an unreachable
room still reports its real last-seen time after a restart; ``null``
means the room has truly never answered. Per-person visit state lives
elsewhere (``rooms_visits.py``) — this module owns global estate health
only and never learns who is looking.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

_logger = logging.getLogger("personal_world.rooms")

#: Env var holding the room list (``id=baseURL`` comma-separated).
ROOMS_ENV = "PW_ROOMS"

#: Registry env (Gap 1): the full URL of Project Home's
#: ``GET /api/rooms/registry``, the env var NAME holding the registry
#: bearer token (same indirection as ``PW_ROOM_<ID>_TOKEN_ENV``), and an
#: optional "1" to accept a self-signed registry certificate.
REGISTRY_URL_ENV = "PW_ROOMS_REGISTRY_URL"
REGISTRY_TOKEN_ENV_ENV = "PW_ROOMS_REGISTRY_TOKEN_ENV"
REGISTRY_INSECURE_TLS_ENV = "PW_ROOMS_REGISTRY_INSECURE_TLS"

#: Registry HTTP cache (rule: 60 s) and hard timeout (rule: 3 s).
REGISTRY_CACHE_TTL_SECONDS = 60.0
REGISTRY_TIMEOUT_SECONDS = 3.0

#: Per-room env var suffixes. ``<ID>`` is the room id upper-cased with
#: every non-alphanumeric character folded to ``_`` (so ``my-room``
#: reads ``PW_ROOM_MY_ROOM_TOKEN_ENV``). ``*_TOKEN_ENV`` holds the
#: *name* of the env var carrying the token; ``*_INSECURE_TLS`` is "1"
#: to accept a self-signed LAN certificate.
TOKEN_ENV_SUFFIX = "_TOKEN_ENV"
INSECURE_TLS_SUFFIX = "_INSECURE_TLS"

#: Paths stay exactly these — there is no per-version path (rule 1).
ROOM_PATH = "/room"
CARDS_PATH = "/room/cards"
NEEDS_YOU_PATH = "/room/needs-you"

#: The Secrets overview reads the room the shared interface fixes by id
#: (``workshop``), at its read-only summary path, with that room's own
#: token/TLS policy. A 3 s timeout and a 60 s cache match the other
#: front-door reads.
SECRETS_ROOM_ID = "workshop"
SECRETS_SUMMARY_PATH = "/api/secrets/summary"
SECRETS_TIMEOUT_SECONDS = 3.0
SECRETS_CACHE_TTL_SECONDS = 60.0

#: The interface version this consumer understands (rule 14). An entry
#: (registry) or descriptor contract outside this set is ``incompatible``
#: — never rendered, never healthy, and never guessed.
CONTRACT_VALUE = "room/0"
SUPPORTED_CONTRACTS = frozenset({CONTRACT_VALUE})

#: The four statuses a descriptor may declare (rule 2).
ROOM_STATUSES = frozenset({"healthy", "degraded", "unhealthy", "unknown"})

#: The card tones the contract names (rule 3). A tone outside this set is
#: treated as ``update`` by consumers — never as ``when_ready``.
CARD_TONES = frozenset({"good_news", "update", "when_ready"})

#: The front-door word for a room that did not answer (rule 12).
UNREACHABLE = "unreachable"

#: The front-door word for a room whose contract (registry entry or its
#: own descriptor) this consumer does not support — a distinct fact from
#: "unreachable": it answered, or was refused before it was loaded.
INCOMPATIBLE = "incompatible"

#: Hard timeout per outbound request — a dead room degrades, never hangs.
TIMEOUT_SECONDS = 2.0

#: How long one snapshot is served before the estate is re-checked.
CACHE_TTL_SECONDS = 15.0

#: Where per-room health (last-seen / last-declared-status) is persisted
#: under the data dir. Plain JSON on the same atomic-write seam every
#: other Worlds state file uses: rooms are global estate health, not
#: per-person state, so this is deliberately one shared file (not a
#: per-principal scoped kind).
STATE_FILENAME = "rooms-state.json"

#: Last-known-good registry payload (rooms + updated_at) persisted under
#: the data dir on the same atomic seam — so a registry outage still
#: serves the estate the registry last named.
REGISTRY_STATE_FILENAME = "rooms-registry.json"

_ID_UNSAFE = re.compile(r"[^A-Za-z0-9]")

#: A registry room id: lower-case letter/digit start, then letters,
#: digits and hyphens (the shared interface's ``^[a-z0-9][a-z0-9-]*$``).
_VALID_ROOM_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def _iso_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


#: Registry token_env must name a room token, e.g. PW_ROOM_WORKSHOP_TOKEN.
_ROOM_TOKEN_ENV_RE = re.compile(r"^PW_ROOM_[A-Z0-9_]+_TOKEN$")

def env_name(room_id: str, suffix: str) -> str:
    """``("studio", "_TOKEN_ENV") -> "PW_ROOM_STUDIO_TOKEN_ENV"``.

    Room ids are operator-chosen; the env mapping is deterministic and
    reversible enough for a human to read, so no lookup table is needed.
    """
    folded = _ID_UNSAFE.sub("_", room_id).upper()
    return f"PW_ROOM_{folded}{suffix}"


def _valid_absolute_http_url(url: str) -> bool:
    try:
        parts = httpx.URL(url)
    except (httpx.InvalidURL, ValueError):
        return False
    return parts.scheme in ("http", "https") and bool(parts.host)


def _valid_public_url(url: str) -> bool:
    """A browser-reachable ``public_url``: absolute http(s), no userinfo.

    Stricter than :func:`_valid_absolute_http_url`: a public URL is shown
    to browsers, so credentials embedded in it (``https://user:pass@…``)
    are refused. An invalid value never drops the room — the entry is
    kept with ``public_url`` null, and consumers fall back to
    ``base_url``.
    """
    if not _valid_absolute_http_url(url):
        return False
    try:
        parts = httpx.URL(url)
    except (httpx.InvalidURL, ValueError):
        return False
    return not parts.userinfo


@dataclass(frozen=True)
class RoomConfig:
    """One configured room, resolved from the environment or a registry.

    ``invalid_reason`` is set when the entry could not be used as
    configured (a missing/relative URL). Such a room is reported as
    unreachable with that reason rather than silently dropped.
    ``contract`` is the interface version the source claimed (``room/0``
    for env entries); a value outside :data:`SUPPORTED_CONTRACTS` makes
    the row ``incompatible``. ``token_env`` is the **name** of the env
    var the token was read from (or ``None``) — carried so a
    last-known-good can re-read the token on a later boot; the token
    value itself is never persisted or returned. ``public_url`` is the
    browser-reachable address a registry entry may name (http(s), no
    userinfo); it is ``None`` when absent or invalid, and consumers then
    fall back to ``base_url``.
    """

    id: str
    base_url: str
    token: str | None = None
    insecure_tls: bool = False
    invalid_reason: str | None = None
    contract: str = CONTRACT_VALUE
    token_env: str | None = None
    public_url: str | None = None


def parse_rooms(env: dict | None = None) -> list[RoomConfig]:
    """Resolve the configured rooms from ``PW_ROOMS`` and its per-room vars.

    Duplicate ids keep the first entry. An entry with no id is skipped
    (there is nothing to address it by); an entry with an id but an
    unusable URL is kept, so the front door can report it honestly.
    """
    env = os.environ if env is None else env
    raw = (env.get(ROOMS_ENV) or "").strip()
    if not raw:
        return []

    rooms: list[RoomConfig] = []
    seen: set[str] = set()
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        room_id, sep, base = entry.partition("=")
        room_id = room_id.strip()
        base = base.strip()
        if not room_id or room_id in seen:
            continue
        seen.add(room_id)

        token_env_name = (env.get(env_name(room_id, TOKEN_ENV_SUFFIX)) or "").strip()
        token = (env.get(token_env_name) or "").strip() if token_env_name else ""
        insecure = (
            env.get(env_name(room_id, INSECURE_TLS_SUFFIX)) or ""
        ).strip() == "1"

        reason: str | None = None
        if not sep or not base:
            reason = "missing base URL"
        elif not _valid_absolute_http_url(base):
            reason = "base URL must be an absolute http(s) address"

        rooms.append(
            RoomConfig(
                id=room_id,
                base_url=base,
                token=token or None,
                insecure_tls=insecure,
                invalid_reason=reason,
                token_env=token_env_name or None,
            )
        )
    return rooms


def _parse_registry_entries(
    entries: Any, env: dict
) -> tuple[list[RoomConfig], int]:
    """``(configs, dropped)`` from a registry ``rooms`` list.

    Malformed entries are dropped, never guessed: a missing/bad id, a
    non-http(s) ``base_url``, a non-string ``contract``, or a non-string
    ``token_env``. An ``enabled: false`` entry is skipped (the registry
    returns it; consumers do not load it) and is not counted as dropped.
    A ``contract`` outside :data:`SUPPORTED_CONTRACTS` is kept as an
    ``incompatible`` row so the person can see why it is not loaded.
    """
    if not isinstance(entries, list):
        return [], 0
    configs: list[RoomConfig] = []
    dropped = 0
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            dropped += 1
            continue
        room_id = entry.get("id")
        if (
            not isinstance(room_id, str)
            or not _VALID_ROOM_ID.match(room_id)
            or room_id in seen
        ):
            dropped += 1
            continue
        if entry.get("enabled") is False:
            continue  # returned by the registry, deliberately not loaded
        base = entry.get("base_url")
        if not isinstance(base, str) or not _valid_absolute_http_url(base):
            dropped += 1
            continue
        contract = entry.get("contract")
        if not isinstance(contract, str) or not contract:
            dropped += 1
            continue
        token_env_name = entry.get("token_env")
        if token_env_name is not None and not isinstance(token_env_name, str):
            dropped += 1
            continue
        token_env_name = (token_env_name or "").strip()
        # The registry names WHICH env var holds a room's token, and that token
        # is then sent to the room's base_url. Only room-token names are
        # honoured, so an entry can never make Worlds send PW_API_TOKEN or a
        # provider key to an arbitrary URL; anything else is ignored.
        if token_env_name and not _ROOM_TOKEN_ENV_RE.match(token_env_name):
            token_env_name = ""
        token = (env.get(token_env_name) or "").strip() if token_env_name else ""
        # A public_url is optional and never drops the entry: a missing,
        # non-string, non-http(s) or userinfo-bearing value is simply not
        # trusted, and consumers fall back to base_url.
        public_url = entry.get("public_url")
        if public_url is not None and (
            not isinstance(public_url, str) or not _valid_public_url(public_url)
        ):
            public_url = None
        seen.add(room_id)
        configs.append(
            RoomConfig(
                id=room_id,
                base_url=base,
                token=token or None,
                insecure_tls=entry.get("insecure_tls") is True,
                contract=contract,
                token_env=token_env_name or None,
                public_url=public_url or None,
            )
        )
    return configs, dropped


def _parse_registry_payload(
    payload: Any, env: dict
) -> tuple[list[RoomConfig], int] | None:
    """``(configs, dropped)`` from a registry payload, or ``None`` when the
    payload as a whole is malformed (not an object, or no ``rooms`` list) —
    the caller treats that as a failed fetch, not an empty registry."""
    if not isinstance(payload, dict):
        return None
    rooms = payload.get("rooms")
    if not isinstance(rooms, list):
        return None
    return _parse_registry_entries(rooms, env)


def _lkg_entries(configs: list[RoomConfig]) -> list[dict]:
    """The sanitized, persistable last-known-good entries: only the known
    registry fields, and never a token value (only its env var NAME)."""
    return [
        {
            "id": c.id,
            "base_url": c.base_url,
            "contract": c.contract,
            "token_env": c.token_env,
            "insecure_tls": c.insecure_tls,
            "public_url": c.public_url,
        }
        for c in configs
    ]


def _reason(exc: BaseException) -> str:
    """A short failure class only — never a URL, token, or payload."""
    if isinstance(exc, httpx.TimeoutException):
        return "timeout"
    if isinstance(exc, httpx.ConnectError):
        return "connect error"
    if isinstance(exc, httpx.HTTPError):
        return f"http error ({type(exc).__name__})"
    return f"request failed ({type(exc).__name__})"


def _registry_report(
    source: str,
    status: str,
    checked_at: str | None,
    error: str | None,
    updated_at: str | None,
    dropped: int,
) -> dict[str, Any]:
    """The registry half of the snapshot, stated plainly.

    ``source`` is where the room list came from (``registry`` |
    ``last_known_good`` | ``env``); ``status`` is the registry read
    itself (``ok`` | ``unreachable`` | ``not_configured``); ``error`` is a
    short failure class only — never a URL, token, or payload.
    """
    return {
        "source": source,
        "status": status,
        "checked_at": checked_at,
        "error": error,
        "updated_at": updated_at,
        "dropped": dropped,
    }


#: The closed station statuses the Secrets summary may declare. Anything
#: else is reported honestly as ``unknown`` — never guessed healthy.
_STATION_STATUSES = frozenset({"ok", "unreachable", "not_configured"})

#: The fields copied off a summary's ``requests`` / ``recent_ops`` rows.
#: Built by allow-list so a station that (wrongly) includes a secret
#: value can never leak it into the board.
_REQUEST_KEYS = ("id", "key_path", "reason", "requested_at", "link")
_OP_KEYS = ("key_path", "state", "deploy_state", "actor", "created_at")


def _empty_secrets_summary() -> dict[str, Any]:
    """The honest empty summary — the shape every overview response keeps."""
    return {
        "station": {"configured": False, "status": "not_configured", "detail": None},
        "namespaces": [],
        "key_count": 0,
        "bundle_last_change": None,
        "requests": [],
        "recent_ops": [],
        "links": {"trusted_form": "/secrets"},
    }


def _open_secrets_url(config: RoomConfig, trusted_form: str) -> str | None:
    """``(public_url or base_url) + links.trusted_form`` for the board.

    ``public_url`` is preferred (browser-reachable); ``base_url`` is the
    documented fallback. ``trusted_form`` must be a same-origin path, or
    the default ``/secrets`` is used — never a station-supplied absolute
    URL.
    """
    if not isinstance(trusted_form, str) or not trusted_form.startswith("/"):
        trusted_form = "/secrets"
    base = (config.public_url or config.base_url).rstrip("/")
    return base + trusted_form


def _unknown_secrets_overview(
    detail: str, config: RoomConfig | None = None
) -> dict[str, Any]:
    """The honest "cannot read it" overview: unknown station, empty rest.

    Never invents a namespace, key, request or op. ``room_id`` is always
    stated; ``open_url`` is stated only when a usable room address is
    known (``None`` otherwise), so the board can link when it can.
    """
    data = _empty_secrets_summary()
    data["station"] = {"configured": False, "status": "unknown", "detail": detail}
    data["room_id"] = SECRETS_ROOM_ID
    data["open_url"] = (
        _open_secrets_url(config, data["links"]["trusted_form"])
        if config is not None
        else None
    )
    return data


def _sanitize_secrets_summary(
    payload: dict, config: RoomConfig
) -> dict[str, Any]:
    """The station summary in the known shape, and nothing else.

    Built from an allow-list of known fields, so a station that (wrongly)
    includes a ``value`` key can never leak it, and consumers can rely on
    the shape. Namespace and key names come only from the station; none
    are invented here.
    """
    data = _empty_secrets_summary()

    station = payload.get("station")
    if isinstance(station, dict):
        status = station.get("status")
        detail = station.get("detail")
        data["station"] = {
            "configured": station.get("configured") is True,
            "status": status if status in _STATION_STATUSES else "unknown",
            "detail": detail if isinstance(detail, str) else None,
        }

    namespaces = payload.get("namespaces")
    if isinstance(namespaces, list):
        cleaned: list[dict[str, Any]] = []
        for ns in namespaces:
            if not isinstance(ns, dict) or not isinstance(ns.get("name"), str):
                continue
            keys = ns.get("keys")
            cleaned.append(
                {
                    "name": ns["name"],
                    "keys": (
                        [k for k in keys if isinstance(k, str)]
                        if isinstance(keys, list)
                        else []
                    ),
                }
            )
        data["namespaces"] = cleaned

    key_count = payload.get("key_count")
    if isinstance(key_count, int) and not isinstance(key_count, bool) and key_count >= 0:
        data["key_count"] = key_count

    change = payload.get("bundle_last_change")
    if isinstance(change, str):
        data["bundle_last_change"] = change

    requests = payload.get("requests")
    if isinstance(requests, list):
        data["requests"] = [
            {key: row.get(key) for key in _REQUEST_KEYS}
            for row in requests
            if isinstance(row, dict)
        ]

    recent_ops = payload.get("recent_ops")
    if isinstance(recent_ops, list):
        data["recent_ops"] = [
            {key: row.get(key) for key in _OP_KEYS}
            for row in recent_ops
            if isinstance(row, dict)
        ]

    links = payload.get("links")
    if isinstance(links, dict):
        trusted = links.get("trusted_form")
        if isinstance(trusted, str) and trusted.startswith("/"):
            data["links"] = {"trusted_form": trusted}

    data["room_id"] = SECRETS_ROOM_ID
    data["open_url"] = _open_secrets_url(config, data["links"]["trusted_form"])
    return data


class RoomsService:
    """Reads every configured room; caches one snapshot for 15 s.

    ``last_seen``/``last_status`` are persisted per room id through
    ``state_path`` (a JSON file on the data dir) so an unreachable room
    still reports when it was last reached — across a restart, not just
    for the process lifetime. With no ``state_path`` the service keeps
    them in memory only (tests, and any embedding that wants no disk).

    The room list itself is resolved per snapshot: from a configured
    registry (``PW_ROOMS_REGISTRY_URL``, cached 60 s) with last-known-good
    persisted through ``registry_state_path``, falling back to
    ``PW_ROOMS`` only when the registry yields nothing. Inject
    ``transport`` (an ``httpx`` transport) and ``clock`` in tests;
    production uses the network and ``time.monotonic``.
    """

    def __init__(
        self,
        transport=None,
        clock=None,
        state_path=None,
        registry_state_path=None,
    ) -> None:
        self._transport = transport
        self._clock = clock or time.monotonic
        self._cache: list[dict[str, Any]] | None = None
        self._cache_at: float = float("-inf")
        self._state_path: Path | None = (
            Path(state_path) if state_path is not None else None
        )
        self._last_seen: dict[str, str] = {}
        self._last_status: dict[str, str] = {}
        self._dirty = False
        self._load_persisted()

        # Registry state (Gap 1): the last-known-good payload, the cached
        # resolution (60 s), and the honest report served as a sibling of
        # ``data`` in GET /api/rooms.
        self._registry_state_path: Path | None = (
            Path(registry_state_path) if registry_state_path is not None else None
        )
        self._lkg: dict[str, Any] | None = None
        self._resolved: tuple[list[RoomConfig], dict[str, Any]] | None = None
        self._resolved_at: float = float("-inf")
        self._last_configs: list[RoomConfig] | None = None
        self._registry_report: dict[str, Any] = _registry_report(
            "env", "not_configured", None, None, None, 0
        )
        self._load_registry_lkg()

        # The Secrets overview (Worlds side) is one outbound read of the
        # ``workshop`` room, cached 60 s like the registry.
        self._secrets_cache: dict[str, Any] | None = None
        self._secrets_cache_at: float = float("-inf")

    # -- app wiring ------------------------------------------------------

    def set_state_path(self, state_path) -> None:
        """Point the service at a persistent state file (app wiring).

        Idempotent; re-reads the file so a restart restores the estate's
        last-seen times rather than claiming "never reached".
        """
        self._state_path = Path(state_path) if state_path is not None else None
        self._load_persisted()

    def set_registry_state_path(self, registry_state_path) -> None:
        """Point the service at the last-known-good registry file.

        Idempotent; re-reads it so a restart can serve the registry's
        last room list while the registry is unreachable.
        """
        self._registry_state_path = (
            Path(registry_state_path) if registry_state_path is not None else None
        )
        self._load_registry_lkg()

    def registry_report(self) -> dict[str, Any]:
        """The honest registry state behind the last snapshot."""
        return dict(self._registry_report)

    def known_ids(self) -> list[str]:
        """The ids of the last resolved room list (registry or env).

        The synchronous seam the api's room-id validators use; before any
        snapshot it falls back to the configured ``PW_ROOMS``.
        """
        if self._last_configs is not None:
            return [c.id for c in self._last_configs]
        return [c.id for c in parse_rooms()]

    def _load_persisted(self) -> None:
        """Best-effort restore. A missing/corrupt file is an honest
        empty state, never a fabricated last-seen."""
        self._last_seen = {}
        self._last_status = {}
        if self._state_path is None or not self._state_path.exists():
            return
        try:
            stored = json.loads(self._state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        rooms = stored.get("rooms") if isinstance(stored, dict) else None
        if not isinstance(rooms, dict):
            return
        for room_id, entry in rooms.items():
            if not isinstance(room_id, str) or not isinstance(entry, dict):
                continue
            seen = entry.get("last_seen")
            status = entry.get("last_status")
            if isinstance(seen, str) and seen:
                self._last_seen[room_id] = seen
            if isinstance(status, str) and status in ROOM_STATUSES:
                self._last_status[room_id] = status

    def _persist(self) -> None:
        """Persist room health atomically; a write failure is logged and
        never breaks a snapshot (remote loss must not break Worlds)."""
        if self._state_path is None or not self._dirty:
            return
        payload = {
            "rooms": {
                room_id: {
                    "last_seen": self._last_seen.get(room_id),
                    "last_status": self._last_status.get(room_id),
                }
                for room_id in sorted(set(self._last_seen) | set(self._last_status))
            }
        }
        try:
            self._state_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._state_path.with_suffix(".tmp")
            tmp.write_text(json.dumps(payload), encoding="utf-8")
            tmp.chmod(0o600)
            os.replace(tmp, self._state_path)  # atomic: no half state
            self._dirty = False
        except OSError as exc:
            _logger.warning("rooms state persist failed: %s", exc)

    # -- registry (Gap 1) ------------------------------------------------

    def _load_registry_lkg(self) -> None:
        """Best-effort restore of the last-known-good registry payload.

        A missing/corrupt file is an honest "no last-known-good", never a
        fabricated room list. Only the sanitized fields are kept.
        """
        self._lkg = None
        if self._registry_state_path is None or not self._registry_state_path.exists():
            return
        try:
            stored = json.loads(self._registry_state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if not isinstance(stored, dict) or not isinstance(stored.get("rooms"), list):
            return
        updated_at = stored.get("updated_at")
        self._lkg = {
            "updated_at": updated_at if isinstance(updated_at, str) else None,
            "fetched_at": (
                stored.get("fetched_at")
                if isinstance(stored.get("fetched_at"), str)
                else None
            ),
            "rooms": stored["rooms"],
        }

    def _persist_registry_lkg(self) -> None:
        """Persist the last-known-good atomically (0600); a write failure
        is logged and never breaks a snapshot."""
        if self._registry_state_path is None or self._lkg is None:
            return
        try:
            self._registry_state_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._registry_state_path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self._lkg), encoding="utf-8")
            tmp.chmod(0o600)
            os.replace(tmp, self._registry_state_path)  # atomic: no half state
        except OSError as exc:
            _logger.warning("rooms registry persist failed: %s", exc)

    def _configs_from_lkg(self, env: dict) -> tuple[list[RoomConfig], int]:
        if self._lkg is None:
            return [], 0
        return _parse_registry_entries(self._lkg.get("rooms"), env)

    def _resolve_without_registry(
        self, env: dict
    ) -> tuple[list[RoomConfig], dict[str, Any]]:
        """No registry URL configured: serve the last-known-good if one
        exists (the operator paused the registry, not the estate), else
        today's ``PW_ROOMS`` env — unchanged."""
        checked_at = _iso_now()
        if self._lkg is not None:
            configs, dropped = self._configs_from_lkg(env)
            return configs, _registry_report(
                "last_known_good",
                "not_configured",
                checked_at,
                "registry not configured; serving last-known-good",
                self._lkg.get("updated_at"),
                dropped,
            )
        return (
            parse_rooms(env),
            _registry_report("env", "not_configured", checked_at, None, None, 0),
        )

    def _registry_failure(
        self, reason: str, checked_at: str, env: dict
    ) -> tuple[list[RoomConfig], dict[str, Any]]:
        """A failed registry read: last-known-good if present, else env."""
        if self._lkg is not None:
            configs, dropped = self._configs_from_lkg(env)
            return configs, _registry_report(
                "last_known_good",
                "unreachable",
                checked_at,
                reason,
                self._lkg.get("updated_at"),
                dropped,
            )
        return (
            parse_rooms(env),
            _registry_report("env", "unreachable", checked_at, reason, None, 0),
        )

    async def _fetch_registry(
        self, env: dict
    ) -> tuple[list[RoomConfig], dict[str, Any]]:
        """Fetch the registry once. Never raises; a failure falls back."""
        url = (env.get(REGISTRY_URL_ENV) or "").strip()
        checked_at = _iso_now()
        token_env_name = (env.get(REGISTRY_TOKEN_ENV_ENV) or "").strip()
        token = (env.get(token_env_name) or "").strip() if token_env_name else ""
        insecure = (env.get(REGISTRY_INSECURE_TLS_ENV) or "").strip() == "1"
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(REGISTRY_TIMEOUT_SECONDS),
                verify=not insecure,
                transport=self._transport,
                follow_redirects=False,
            ) as client:
                resp = await client.get(url, headers=headers)
        except Exception as exc:  # noqa: BLE001 — a dead registry must not break the estate
            return self._registry_failure(_reason(exc), checked_at, env)
        if not (200 <= resp.status_code < 300):
            return self._registry_failure(f"HTTP {resp.status_code}", checked_at, env)
        try:
            payload = resp.json()
        except (ValueError, UnicodeDecodeError):
            return self._registry_failure("malformed JSON", checked_at, env)
        parsed = _parse_registry_payload(payload, env)
        if parsed is None:
            return self._registry_failure(
                "registry payload has no rooms list", checked_at, env
            )
        configs, dropped = parsed
        updated_at = payload.get("updated_at")
        self._lkg = {
            "updated_at": updated_at if isinstance(updated_at, str) else None,
            "fetched_at": checked_at,
            "rooms": _lkg_entries(configs),
        }
        self._persist_registry_lkg()
        return configs, _registry_report(
            "registry", "ok", checked_at, None, self._lkg["updated_at"], dropped
        )

    async def _resolve_configs(
        self, env: dict
    ) -> tuple[list[RoomConfig], dict[str, Any]]:
        """Resolve this snapshot's rooms: registry (cached 60 s) with
        last-known-good and env fallbacks. Never raises."""
        url = (env.get(REGISTRY_URL_ENV) or "").strip()
        if not url:
            return self._resolve_without_registry(env)
        now = self._clock()
        if (
            self._resolved is not None
            and (now - self._resolved_at) < REGISTRY_CACHE_TTL_SECONDS
        ):
            return self._resolved
        resolved = await self._fetch_registry(env)
        self._resolved = resolved  # cache the attempt too: no hammering
        self._resolved_at = now
        return resolved

    def invalidate(self) -> None:
        """Drop the cached snapshot (tests and explicit refresh)."""
        self._cache = None
        self._cache_at = float("-inf")
        self._secrets_cache = None
        self._secrets_cache_at = float("-inf")

    async def resolved_config(
        self, room_id: str, env: dict | None = None
    ) -> RoomConfig | None:
        """The resolved config for one room id, or ``None`` when unconfigured.

        Uses the same cached resolution a snapshot uses (registry 60 s,
        last-known-good, env fallback), so this never triggers a second
        registry round inside the cache window.
        """
        env = os.environ if env is None else env
        configs, _ = await self._resolve_configs(env)
        for config in configs:
            if config.id == room_id:
                return config
        return None

    async def secrets_overview(self, env: dict | None = None) -> dict[str, Any]:
        """The Secrets board's read-only data source. Never raises.

        Finds the room named ``workshop`` and reads its
        ``GET /api/secrets/summary`` with that room's token and TLS policy
        (3 s timeout, cached 60 s). Names and health only — never a secret
        value. Any failure — the room missing, unreachable, refusing the
        read (401), or answering malformed — is reported as
        ``station.status: "unknown"`` with a plain-words detail and empty
        lists; the response never invents namespaces or keys and never
        carries a token or a value.
        """
        env = os.environ if env is None else env
        now = self._clock()
        if (
            self._secrets_cache is not None
            and (now - self._secrets_cache_at) < SECRETS_CACHE_TTL_SECONDS
        ):
            return self._secrets_cache
        data = await self._fetch_secrets_overview(env)
        self._secrets_cache = data
        self._secrets_cache_at = now
        return data

    async def _fetch_secrets_overview(self, env: dict) -> dict[str, Any]:
        config = await self.resolved_config(SECRETS_ROOM_ID, env)
        if config is None:
            return _unknown_secrets_overview(
                f"the room {SECRETS_ROOM_ID!r} is not in the registry"
            )
        if config.contract not in SUPPORTED_CONTRACTS:
            return _unknown_secrets_overview(
                f"the {SECRETS_ROOM_ID} room speaks an unsupported "
                f"contract {config.contract!r}",
                config,
            )
        if config.invalid_reason is not None:
            return _unknown_secrets_overview(
                f"the {SECRETS_ROOM_ID} room's address is unusable "
                f"({config.invalid_reason})",
                config,
            )

        base = config.base_url.rstrip("/")
        headers = {"Accept": "application/json"}
        if config.token:
            headers["Authorization"] = f"Bearer {config.token}"
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(SECRETS_TIMEOUT_SECONDS),
                verify=not config.insecure_tls,
                transport=self._transport,
                follow_redirects=False,
            ) as client:
                resp = await client.get(base + SECRETS_SUMMARY_PATH, headers=headers)
        except Exception as exc:  # noqa: BLE001 — a dead station must not break the board
            return _unknown_secrets_overview(_reason(exc), config)
        if resp.status_code == 401:
            return _unknown_secrets_overview(
                "the room refused the read (401 unauthorized)", config
            )
        if not (200 <= resp.status_code < 300):
            return _unknown_secrets_overview(
                f"the room answered HTTP {resp.status_code}", config
            )
        try:
            payload = resp.json()
        except (ValueError, UnicodeDecodeError):
            return _unknown_secrets_overview(
                "the room answered malformed JSON", config
            )
        if not isinstance(payload, dict):
            return _unknown_secrets_overview(
                "the room's summary is not an object", config
            )
        return _sanitize_secrets_summary(payload, config)

    async def snapshot(self, env: dict | None = None) -> list[dict[str, Any]]:
        """One honest row per resolved room. Never raises."""
        env = os.environ if env is None else env
        now = self._clock()
        if self._cache is not None and (now - self._cache_at) < CACHE_TTL_SECONDS:
            return self._cache
        configs, report = await self._resolve_configs(env)
        self._registry_report = report
        self._last_configs = configs
        rows = list(await asyncio.gather(*(self._probe(c) for c in configs)))
        self._cache = rows
        self._cache_at = now
        self._persist()  # room health outlives this process
        return rows

    async def _probe(self, config: RoomConfig) -> dict[str, Any]:
        checked_at = _iso_now()
        if config.contract not in SUPPORTED_CONTRACTS:
            # A registry entry this front door cannot understand: never
            # loaded, never healthy, and its cards/needs are nothing.
            return self._row(
                config,
                reachable=False,
                room=None,
                cards=[],
                needs_you=[],
                error=f"unsupported contract {config.contract!r}",
                status=INCOMPATIBLE,
                checked_at=checked_at,
            )
        if config.invalid_reason is not None:
            return self._row(
                config,
                reachable=False,
                room=None,
                cards=[],
                needs_you=[],
                error=config.invalid_reason,
                status=UNREACHABLE,
                checked_at=checked_at,
            )

        base = config.base_url.rstrip("/")
        headers: dict[str, str] = {}
        if config.token:
            headers["Authorization"] = f"Bearer {config.token}"

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(TIMEOUT_SECONDS),
                verify=not config.insecure_tls,
                transport=self._transport,
                follow_redirects=False,
            ) as client:
                descriptor_resp, cards_resp, needs_resp = await asyncio.gather(
                    client.get(base + ROOM_PATH, headers=headers),
                    client.get(base + CARDS_PATH, headers=headers),
                    client.get(base + NEEDS_YOU_PATH, headers=headers),
                    return_exceptions=True,
                )
        except Exception as exc:  # noqa: BLE001 — a dead room must not break the estate
            return self._unreachable(config, _reason(exc), checked_at)

        needs_you, needs_error = _parse_needs_you(needs_resp)
        cards, cards_error = _parse_cards(cards_resp)

        if isinstance(descriptor_resp, BaseException):
            return self._unreachable(config, _reason(descriptor_resp), checked_at)
        if not (200 <= descriptor_resp.status_code < 300):
            return self._unreachable(
                config, f"HTTP {descriptor_resp.status_code}", checked_at
            )
        try:
            descriptor = descriptor_resp.json()
        except (ValueError, UnicodeDecodeError):
            return self._unreachable(config, "malformed JSON", checked_at)
        if not isinstance(descriptor, dict):
            return self._unreachable(config, "descriptor is not an object", checked_at)

        contract = descriptor.get("contract")
        if contract is not None and contract not in SUPPORTED_CONTRACTS:
            # Rule 14: a consumer that does not understand a contract
            # value fails clearly rather than guessing. The room answered
            # — it is reachable — but its descriptor, cards and needs are
            # not rendered and never counted.
            return self._row(
                config,
                reachable=True,
                room=None,
                cards=[],
                needs_you=[],
                error=f"unexpected contract {contract!r}",
                status=INCOMPATIBLE,
                checked_at=checked_at,
            )

        raw_status = descriptor.get("status")
        status = raw_status if raw_status in ROOM_STATUSES else "unknown"
        return self._row(
            config,
            reachable=True,
            room=descriptor,
            cards=cards,
            needs_you=needs_you,
            error=needs_error or cards_error,
            status=status,
            checked_at=checked_at,
        )

    def _unreachable(
        self, config: RoomConfig, error: str, checked_at: str
    ) -> dict[str, Any]:
        return self._row(
            config,
            reachable=False,
            room=None,
            cards=[],
            needs_you=[],
            error=error,
            status=UNREACHABLE,
            checked_at=checked_at,
        )

    def _row(
        self,
        config: RoomConfig,
        *,
        reachable: bool,
        room: dict | None,
        cards: list,
        needs_you: list,
        error: str | None,
        status: str,
        checked_at: str,
    ) -> dict[str, Any]:
        if reachable:
            self._last_seen[config.id] = checked_at
            # Only a declared, understood status is remembered; an
            # incompatible descriptor declares no usable status, so the
            # last real one is kept.
            if status in ROOM_STATUSES:
                self._last_status[config.id] = status
            self._dirty = True
        return {
            "id": config.id,
            "base_url": config.base_url,
            "public_url": config.public_url,
            "reachable": reachable,
            "status": status,
            "room": room,
            "cards": cards,
            "needs_you": needs_you,
            "error": error,
            "checked_at": checked_at,
            "last_seen": self._last_seen.get(config.id),
            # The last status this room declared when it answered; null
            # only when it has truly never answered. Distinct from
            # ``status``, which is "unreachable" for a room that is down.
            "last_status": self._last_status.get(config.id),
        }


def _parse_cards(resp: Any) -> tuple[list, str | None]:
    """``(cards, error)`` from a cards response or exception.

    Same posture as ``_parse_needs_you``: a reachable room whose cards
    list is unreadable is still reachable; the failure is named and
    ``cards`` stays empty — never invented. Malformed individual cards
    are dropped rather than crashing the estate; a card the contract
    would treat as ``update`` (no/unknown tone) is still a card.
    """
    if isinstance(resp, BaseException):
        return [], _reason(resp)
    if not (200 <= resp.status_code < 300):
        return [], f"cards HTTP {resp.status_code}"
    try:
        payload = resp.json()
    except (ValueError, UnicodeDecodeError):
        return [], "cards malformed JSON"
    if not isinstance(payload, list):
        return [], "cards is not a list"
    return [c for c in payload if isinstance(c, dict)], None


def _parse_needs_you(resp: Any) -> tuple[list, str | None]:
    """``(needs, error)`` from a needs-you response or exception.

    A reachable room whose needs list is unreadable is still reachable;
    the failure is named in the row's ``error`` and ``needs_you`` stays
    empty — never invented.
    """
    if isinstance(resp, BaseException):
        return [], _reason(resp)
    if not (200 <= resp.status_code < 300):
        return [], f"needs-you HTTP {resp.status_code}"
    try:
        payload = resp.json()
    except (ValueError, UnicodeDecodeError):
        return [], "needs-you malformed JSON"
    if not isinstance(payload, list):
        return [], "needs-you is not a list"
    return payload, None