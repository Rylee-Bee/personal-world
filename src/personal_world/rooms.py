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

Honesty posture: this module never raises out of :meth:`RoomsService
.snapshot`. A room that cannot be reached, times out, answers malformed
JSON, or speaks an unknown contract value is reported as such — never
``healthy``. ``unknown`` is not ``healthy`` and it is not failed; an
unreachable room renders as ``unreachable`` with its last-seen time.

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

#: The interface version this consumer understands (rule 14).
CONTRACT_VALUE = "room/0"

#: The four statuses a descriptor may declare (rule 2).
ROOM_STATUSES = frozenset({"healthy", "degraded", "unhealthy", "unknown"})

#: The card tones the contract names (rule 3). A tone outside this set is
#: treated as ``update`` by consumers — never as ``when_ready``.
CARD_TONES = frozenset({"good_news", "update", "when_ready"})

#: The front-door word for a room that did not answer (rule 12).
UNREACHABLE = "unreachable"

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

    ``last_seen``/``last_status`` are persisted per room id through
    ``state_path`` (a JSON file on the data dir) so an unreachable room
    still reports when it was last reached — across a restart, not just
    for the process lifetime. With no ``state_path`` the service keeps
    them in memory only (tests, and any embedding that wants no disk).
    Inject ``transport`` (an ``httpx`` transport) and ``clock`` in tests;
    production uses the network and ``time.monotonic``.
    """

    def __init__(self, transport=None, clock=None, state_path=None) -> None:
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

    def set_state_path(self, state_path) -> None:
        """Point the service at a persistent state file (app wiring).

        Idempotent; re-reads the file so a restart restores the estate's
        last-seen times rather than claiming "never reached".
        """
        self._state_path = Path(state_path) if state_path is not None else None
        self._load_persisted()

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
        self._persist()  # room health outlives this process
        return rows

    async def _probe(self, config: RoomConfig) -> dict[str, Any]:
        checked_at = _iso_now()
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
        if contract is not None and contract != CONTRACT_VALUE:
            # Rule 14: a consumer that does not understand a contract
            # value fails clearly rather than guessing. The room answered
            # — it is reachable — but its descriptor is not rendered.
            return self._row(
                config,
                reachable=True,
                room=None,
                cards=cards,
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
            self._last_status[config.id] = status
            self._dirty = True
        return {
            "id": config.id,
            "base_url": config.base_url,
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