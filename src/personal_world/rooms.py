"""Rooms — the front door renders other small backends (contract: room/0).

Worlds shows rooms; it never copies their code. A *room* is any service
that serves the five ``/room`` endpoints defined by the canonical Room
contract (``room/0``). This module is the front-door half: it learns
each room's address from the operator's environment, reads the two
read-only endpoints (``GET /room`` and ``GET /room/needs-you``)
concurrently, and reports an honest row per room. It owns no room's code
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

Honesty posture: this module never raises out of :meth:`RoomsService
.snapshot`. A room that cannot be reached, times out, answers malformed
JSON, or speaks an unknown contract value is reported as such — never
``healthy``. ``unknown`` is not ``healthy`` and it is not failed; an
unreachable room renders as ``unreachable`` with its last-seen time.
"""

from __future__ import annotations

import asyncio
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx

#: Env var holding the room list (``id=baseURL`` comma-separated).
ROOMS_ENV = "PW_ROOMS"

#: Per-room env var suffixes. ``<ID>`` is the room id upper-cased with
#: every non-alphanumeric character folded to ``_`` (so ``my-room``
#: reads ``PW_ROOM_MY_ROOM_TOKEN_ENV``). ``*_TOKEN_ENV`` holds the
#: *name* of the env var carrying the token; ``*_INSECURE_TLS`` is "1"
#: to accept a self-signed LAN certificate.
TOKEN_ENV_SUFFIX = "_TOKEN_ENV"
INSECURE_TLS_SUFFIX = "_INSECURE_TLS"

#: Paths stay exactly these — there is no per-version path (rule 1).
ROOM_PATH = "/room"
NEEDS_YOU_PATH = "/room/needs-you"

#: The interface version this consumer understands (rule 14).
CONTRACT_VALUE = "room/0"

#: The four statuses a descriptor may declare (rule 2).
ROOM_STATUSES = frozenset({"healthy", "degraded", "unhealthy", "unknown"})

#: The front-door word for a room that did not answer (rule 12).
UNREACHABLE = "unreachable"

#: Hard timeout per outbound request — a dead room degrades, never hangs.
TIMEOUT_SECONDS = 2.0

#: How long one snapshot is served before the estate is re-checked.
CACHE_TTL_SECONDS = 15.0

_ID_UNSAFE = re.compile(r"[^A-Za-z0-9]")


def _iso_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


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


@dataclass(frozen=True)
class RoomConfig:
    """One configured room, resolved from the environment.

    ``invalid_reason`` is set when the entry could not be used as
    configured (a missing/relative URL). Such a room is reported as
    unreachable with that reason rather than silently dropped.
    """

    id: str
    base_url: str
    token: str | None = None
    insecure_tls: bool = False
    invalid_reason: str | None = None


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
            )
        )
    return rooms


def _reason(exc: BaseException) -> str:
    """A short failure class only — never a URL, token, or payload."""
    if isinstance(exc, httpx.TimeoutException):
        return "timeout"
    if isinstance(exc, httpx.ConnectError):
        return "connect error"
    if isinstance(exc, httpx.HTTPError):
        return f"http error ({type(exc).__name__})"
    return f"request failed ({type(exc).__name__})"


class RoomsService:
    """Reads every configured room; caches one snapshot for 15 s.

    ``last_seen`` is kept in memory per room id for the process
    lifetime, so an unreachable room can still say when it was last
    reached. Inject ``transport`` (an ``httpx`` transport) and ``clock``
    in tests; production uses the network and ``time.monotonic``.
    """

    def __init__(self, transport=None, clock=None) -> None:
        self._transport = transport
        self._clock = clock or time.monotonic
        self._cache: list[dict[str, Any]] | None = None
        self._cache_at: float = float("-inf")
        self._last_seen: dict[str, str] = {}

    def invalidate(self) -> None:
        """Drop the cached snapshot (tests and explicit refresh)."""
        self._cache = None
        self._cache_at = float("-inf")

    async def snapshot(self, env: dict | None = None) -> list[dict[str, Any]]:
        """One honest row per configured room. Never raises."""
        now = self._clock()
        if self._cache is not None and (now - self._cache_at) < CACHE_TTL_SECONDS:
            return self._cache
        configs = parse_rooms(env)
        rows = list(await asyncio.gather(*(self._probe(c) for c in configs)))
        self._cache = rows
        self._cache_at = now
        return rows

    async def _probe(self, config: RoomConfig) -> dict[str, Any]:
        checked_at = _iso_now()
        if config.invalid_reason is not None:
            return self._row(
                config,
                reachable=False,
                room=None,
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
                descriptor_resp, needs_resp = await asyncio.gather(
                    client.get(base + ROOM_PATH, headers=headers),
                    client.get(base + NEEDS_YOU_PATH, headers=headers),
                    return_exceptions=True,
                )
        except Exception as exc:  # noqa: BLE001 — a dead room must not break the estate
            return self._unreachable(config, _reason(exc), checked_at)

        needs_you, needs_error = _parse_needs_you(needs_resp)

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
        if contract is not None and contract != CONTRACT_VALUE:
            # Rule 14: a consumer that does not understand a contract
            # value fails clearly rather than guessing. The room answered
            # — it is reachable — but its descriptor is not rendered.
            return self._row(
                config,
                reachable=True,
                room=None,
                needs_you=needs_you,
                error=f"unexpected contract {contract!r}",
                status="unknown",
                checked_at=checked_at,
            )

        raw_status = descriptor.get("status")
        status = raw_status if raw_status in ROOM_STATUSES else "unknown"
        return self._row(
            config,
            reachable=True,
            room=descriptor,
            needs_you=needs_you,
            error=needs_error,
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
        needs_you: list,
        error: str | None,
        status: str,
        checked_at: str,
    ) -> dict[str, Any]:
        if reachable:
            self._last_seen[config.id] = checked_at
        return {
            "id": config.id,
            "base_url": config.base_url,
            "reachable": reachable,
            "status": status,
            "room": room,
            "needs_you": needs_you,
            "error": error,
            "checked_at": checked_at,
            "last_seen": self._last_seen.get(config.id),
        }


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