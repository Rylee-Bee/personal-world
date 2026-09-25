"""Worlds briefing: what the world knows, composed from its sources.

Contract: ``worlds-briefing/1``. Six fixed systems (agents / estate /
records / interests / news / threads), each with a resident who reports
it. The Keeper (server key ``personal-world``) summarizes.

Design rules enforced here:

* **Failure isolation.** One failing source makes only its own system
  ``unavailable``; the briefing is still returned, never a 500.
* **Honesty.** Nothing is invented. Counts and titles come only from the
  sources; a missing configuration is ``not_configured``; an answer older
  than 24h is ``stale``.
* **Purity where possible.** No I/O of its own: sources are injected and
  each is asked only to observe. ``build_briefing`` also accepts ``now``
  and ``since``-bearing place data so it is deterministic in tests.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from .briefing_voice import keeper_line, resident_line
from .status import Status, worst

BRIEFING_SCHEMA = "worlds-briefing/1"

#: A read older than this is stale, not fresh (contract rule).
STALE_AFTER = timedelta(hours=24)
#: Only bookmarks touched inside this window count as arrivals.
ARRIVAL_WINDOW = timedelta(hours=72)
#: Project Home attention kinds that are "things to do".
HAVE_TO_KINDS = frozenset({"owner_decision", "tool_failure"})
#: Relative importance for the cross-system have_tos list (lower first).
HAVE_TO_RANK = {"owner_decision": 0, "tool_failure": 1}

#: Fixed systems and residents for v1 (contract table).
SYSTEM_SPECS: tuple[dict, ...] = (
    {
        "id": "agents", "name": "Workshop",
        "resident": {"key": "robot", "name": "Bolt",
                     "portrait": "/assets/characters/bolt.png"},
        "source_name": "Project Home",
    },
    {
        "id": "estate", "name": "Engine room",
        "resident": {"key": "hekek", "name": "Hekek",
                     "portrait": "/assets/characters/hekek.png"},
        "source_name": "Lab",
    },
    {
        "id": "records", "name": "Archive",
        "resident": {"key": "bruma", "name": "Bruma",
                     "portrait": "/assets/characters/bruma.png"},
        "source_name": "Journal",
    },
    {
        "id": "interests", "name": "Observatory",
        "resident": {"key": "mira", "name": "Mira",
                     "portrait": "/assets/characters/mira.png"},
        "source_name": "Discovery",
    },
    {
        "id": "news", "name": "Newsstand",
        "resident": {"key": "taco-news-truck", "name": "Burrito Journalism",
                     "portrait": "/assets/characters/burrito.png"},
        "source_name": "Media",
    },
    {
        "id": "threads", "name": "World tree",
        "resident": {"key": "world-tree-squirrel", "name": "Ratatoskr",
                     "portrait": "/assets/characters/ratatoskr.png"},
        "source_name": "Place",
    },
)

SYSTEM_IDS: frozenset[str] = frozenset(spec["id"] for spec in SYSTEM_SPECS)

KEEPER = {
    "key": "personal-world",
    "name": "Personal World",
    "portrait": "/assets/characters/personal-world.png",
}

#: statuses that mean "we looked and have an answer"
_OK_STATUSES = frozenset({"healthy", "warning", "needs_attention"})
_FRESH_STATUSES = frozenset({"healthy", "warning", "stale", "needs_attention"})

_FAILED = object()


# ── small helpers ────────────────────────────────────────────────────
def _get(obj, key, default=None):
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return str(value)


def _parse_dt(value) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str) or not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _clip(value, limit: int) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:limit]


def _sort_key(item: dict):
    dt = _parse_dt(item.get("at"))
    floor = datetime.min.replace(tzinfo=timezone.utc)
    return (dt is not None, dt or floor)


def _newest(items: list[dict]) -> list[dict]:
    return sorted(items, key=_sort_key, reverse=True)


def _mk_item(
    *,
    system: str,
    sid: str,
    kind: str,
    title,
    detail=None,
    at=None,
    link=None,
    rank: int | None = None,
) -> dict:
    item = {
        "id": f"{system}:{sid}",
        "system": system,
        "kind": kind,
        "title": _clip(title, 120) or "Untitled",
        "detail": _clip(detail, 600),
        "at": _iso(at),
        "new": False,
        "link": link,
    }
    if rank is not None:
        item["_rank"] = rank
    return item


def _resident(spec: dict) -> dict:
    return dict(spec["resident"])


@dataclass
class _System:
    spec: dict
    status: str
    source: dict
    items: list[dict] = field(default_factory=list)
    have_tos: list[dict] = field(default_factory=list)
    arrivals: list[dict] = field(default_factory=list)

    @property
    def counts(self) -> dict:
        return {"arrivals": len(self.arrivals), "have_tos": len(self.have_tos)}


def _spec(system_id: str) -> dict:
    for spec in SYSTEM_SPECS:
        if spec["id"] == system_id:
            return spec
    raise KeyError(system_id)


def _empty(system_id: str, status: str, observed=None) -> _System:
    spec = _spec(system_id)
    return _System(
        spec=spec,
        status=status,
        source={
            "name": spec["source_name"],
            "observed_at": _iso(observed),
            "freshness": _freshness(observed),
        },
    )


def _freshness(observed, now: datetime | None = None) -> str:
    if observed is None:
        return "unknown"
    now = now or datetime.now(timezone.utc)
    return "stale" if (now - observed) > STALE_AFTER else "fresh"


def _age_status(status: str, observed, now: datetime) -> str:
    """A healthy answer older than 24h is 'stale', not fresh."""
    if observed is not None and (now - observed) > STALE_AFTER:
        if status in _FRESH_STATUSES or status in _OK_STATUSES:
            return Status.STALE.value
    return status


def _observe(source):
    """Ask an injected source to observe. Returns its result or _FAILED."""
    if source is None:
        return _FAILED
    try:
        if hasattr(source, "observe"):
            return source.observe()
        if callable(source):
            return source()
    except Exception:  # noqa: BLE001 — one dead source must not break the briefing
        return _FAILED
    return _FAILED


# ── system builders ──────────────────────────────────────────────────
def _agents(source, now: datetime) -> _System:
    result = _observe(source)
    if result is _FAILED or result is None:
        return _empty("agents", Status.UNAVAILABLE.value)
    status = str(_get(result, "status") or "")
    if status == Status.NOT_CONFIGURED.value:
        return _empty("agents", Status.NOT_CONFIGURED.value)
    snapshot = _get(result, "snapshot")
    if status == Status.UNAVAILABLE.value or not isinstance(snapshot, dict):
        return _empty("agents", Status.UNAVAILABLE.value)

    observed = _parse_dt(_get(result, "observed_at")) or _parse_dt(
        snapshot.get("observed_at")
    )
    have_tos: list[dict] = []
    arrivals: list[dict] = []

    for a in snapshot.get("attention_items") or []:
        if not isinstance(a, dict):
            continue
        kind = str(a.get("kind") or "")
        title = a.get("title") or a.get("detail") or "Attention item"
        detail = a.get("consequence") or a.get("detail")
        sid = str(a.get("id") or f"attention-{len(have_tos) + len(arrivals)}")
        if kind in HAVE_TO_KINDS:
            have_tos.append(_mk_item(
                system="agents", sid=sid, kind="have_to", title=title,
                detail=detail, at=a.get("raised_at"),
                rank=HAVE_TO_RANK.get(kind, 9),
            ))
        elif kind == "maintenance" and not a.get("stale"):
            arrivals.append(_mk_item(
                system="agents", sid=sid, kind="arrival", title=title,
                detail=detail, at=a.get("raised_at"),
            ))

    for b in snapshot.get("bookmarks") or []:
        if not isinstance(b, dict):
            continue
        updated = _parse_dt(b.get("updated_at"))
        if updated is None or (now - updated) > ARRIVAL_WINDOW:
            continue
        pretty = _pretty_name(b.get("project_id"))
        working = str(b.get("working_on") or "").splitlines()
        first = working[0].strip() if working and working[0].strip() else ""
        title = f"{pretty}: {first}" if first else pretty
        arrivals.append(_mk_item(
            system="agents", sid=str(b.get("project_id") or f"bookmark-{len(arrivals)}"),
            kind="arrival", title=title, detail=b.get("next_action"),
            at=b.get("updated_at"),
        ))

    return _System(
        spec=_spec("agents"),
        status=_age_status(status, observed, now),
        source={
            "name": "Project Home",
            "observed_at": _iso(observed),
            "freshness": _freshness(observed, now),
        },
        items=_newest(have_tos + arrivals)[:8],
        have_tos=_newest(have_tos),
        arrivals=_newest(arrivals),
    )


def _pretty_name(project_id) -> str:
    raw = str(project_id or "").strip()
    if raw.lower().startswith("proj-"):
        raw = raw[5:]
    return raw.replace("-", " ").replace("_", " ").strip().title() or "Project"


def _rows_map(data: dict) -> dict:
    rows = data.get("rows")
    if isinstance(rows, dict):
        return rows
    if isinstance(rows, list):
        return {
            r.get("row"): r for r in rows
            if isinstance(r, dict) and r.get("row")
        }
    return {}


def _evidence_at(observation: dict):
    evidence = observation.get("evidence")
    if isinstance(evidence, list) and evidence and isinstance(evidence[0], dict):
        return evidence[0].get("observed_at")
    return None


def _observation_items(system: str, row_name: str, row, kind: str) -> list[dict]:
    observations = row.get("observations") if isinstance(row, dict) else None
    if not isinstance(observations, list):
        return []
    out = []
    for i, obs in enumerate(observations):
        if not isinstance(obs, dict):
            continue
        title = obs.get("concept") or obs.get("detail") or "Observation"
        at = obs.get("observed_at") or _evidence_at(obs)
        out.append(_mk_item(
            system=system, sid=f"{row_name}:{i}", kind=kind,
            title=title, detail=obs.get("detail"), at=at,
        ))
    return out


def _estate(source, now: datetime) -> _System:
    result = _observe(source)
    if result is _FAILED or result is None:
        return _empty("estate", Status.UNAVAILABLE.value)
    status = str(_get(result, "status") or "")
    if status == Status.NOT_CONFIGURED.value:
        return _empty("estate", Status.NOT_CONFIGURED.value)
    data = _get(result, "data")
    if status == Status.UNAVAILABLE.value or not isinstance(data, dict):
        return _empty("estate", Status.UNAVAILABLE.value)

    rows = _rows_map(data)
    overall = str(data.get("overall_state") or "").upper()
    have_tos = _observation_items("estate", "urgent", rows.get("urgent"), "have_to")
    arrivals = _observation_items("estate", "review", rows.get("review"), "arrival")
    observed = _parse_dt(data.get("generated_at"))
    if observed is None:
        observed = max(
            (_parse_dt(i.get("at")) for i in have_tos + arrivals
             if _parse_dt(i.get("at")) is not None),
            default=None,
        )
    if overall == "UNKNOWN":
        resolved = Status.UNKNOWN.value
    elif status in _OK_STATUSES or status == Status.STALE.value:
        resolved = _age_status(status, observed, now)
    else:
        resolved = Status.UNKNOWN.value

    return _System(
        spec=_spec("estate"),
        status=resolved,
        source={
            "name": "Lab",
            "observed_at": _iso(observed),
            "freshness": _freshness(observed, now),
        },
        items=_newest(have_tos + arrivals)[:8],
        have_tos=_newest(have_tos),
        arrivals=_newest(arrivals),
    )


def _interests(source, now: datetime) -> _System:
    result = _observe(source)
    if result is _FAILED or result is None:
        return _empty("interests", Status.UNAVAILABLE.value)
    status = str(_get(result, "status") or "")
    data = _get(result, "data")
    if not isinstance(data, dict):
        data = {}
    sources = data.get("sources")
    if status == Status.UNAVAILABLE.value:
        return _empty("interests", Status.UNAVAILABLE.value)
    # Zero configured sources is an honest "nothing connected", not health.
    if not sources:
        return _empty("interests", Status.NOT_CONFIGURED.value)

    items = []
    for i, entry in enumerate(data.get("items") or []):
        if not isinstance(entry, dict):
            continue
        items.append(_mk_item(
            system="interests",
            sid=str(entry.get("id") or f"item-{i}"),
            kind="interest",
            title=entry.get("title") or "Item",
            detail=entry.get("description"),
            at=entry.get("discovered_at"),
        ))
    resolved = status if status in _OK_STATUSES else Status.HEALTHY.value
    return _System(
        spec=_spec("interests"),
        status=resolved,
        source={"name": "Discovery", "observed_at": None, "freshness": "unknown"},
        items=_newest(items)[:8],
    )


def _news(now: datetime) -> _System:
    # Media capability is not wired in slice 1b: honest not_configured.
    return _empty("news", Status.NOT_CONFIGURED.value)


def _journal_events(journal):
    """(events, failed) from a Journal, an events() object, or a list."""
    if journal is None:
        return [], False
    try:
        if isinstance(journal, (list, tuple)):
            return list(journal), False
        if hasattr(journal, "current_events"):
            return list(journal.current_events(500)), False
        if hasattr(journal, "events"):
            return list(journal.events()), False
    except Exception:  # noqa: BLE001
        return [], True
    return [], True


def _event_source(event) -> str:
    return str(_get(_get(event, "provenance", {}), "source") or "")


def _event_ts(event):
    return _get(event, "ts")


def _personal_events(events) -> list:
    personal = [e for e in events if _event_source(e) == "user"]
    return sorted(
        personal,
        key=lambda e: _parse_dt(_event_ts(e))
        or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )


def _thread_item(event) -> dict:
    ts = _event_ts(event)
    return _mk_item(
        system="records", sid=str(_iso(ts) or "thread"), kind="thread",
        title=_get(event, "summary"), detail=None, at=ts,
    )


def _records(journal, now: datetime) -> tuple[_System, dict | None]:
    events, failed = _journal_events(journal)
    if failed:
        return _empty("records", Status.UNAVAILABLE.value), None
    personal = _personal_events(events)
    items = [_thread_item(e) for e in personal][:8]
    thread = items[0] if items else None
    observed = _parse_dt(_event_ts(personal[0])) if personal else None
    status = Status.HEALTHY.value if personal else Status.UNKNOWN.value
    return _System(
        spec=_spec("records"),
        status=status,
        source={
            "name": "Journal",
            "observed_at": _iso(observed),
            "freshness": _freshness(observed, now),
        },
        items=items,
    ), thread


def _threads(place, thread: dict | None, now: datetime) -> _System:
    items: list[dict] = []
    observed = None
    if isinstance(place, dict):
        observed = _parse_dt(place.get("updated_at"))
        system_id = place.get("system")
        item_id = place.get("item_id")
        title = f"Last place: {system_id}" if system_id else "Last place"
        items.append(_mk_item(
            system="threads",
            sid=f"{system_id or 'place'}:{item_id or 'last'}",
            kind="thread", title=title, detail=item_id,
            at=place.get("updated_at"),
        ))
    if thread is not None:
        items.append(thread)
    status = Status.HEALTHY.value if items else Status.UNKNOWN.value
    return _System(
        spec=_spec("threads"),
        status=status,
        source={
            "name": "Place",
            "observed_at": _iso(observed),
            "freshness": _freshness(observed, now),
        },
        items=_newest(items)[:8],
    )


# ── composition ──────────────────────────────────────────────────────
def _mark_new(data: dict, since: datetime | None) -> None:
    seen: set[int] = set()

    def visit(item):
        if not isinstance(item, dict):
            return
        if id(item) in seen:
            return
        seen.add(id(item))
        at = _parse_dt(item.get("at"))
        item["new"] = bool(since is not None and at is not None and at > since)

    for system in data.get("systems", []):
        for item in system.get("items", []):
            visit(item)
    for item in data.get("have_tos", []):
        visit(item)
    for item in data.get("arrivals", []):
        visit(item)
    visit(data.get("thread"))


def _strip_private(node) -> None:
    if isinstance(node, dict):
        for key in [k for k in node if isinstance(k, str) and k.startswith("_")]:
            del node[key]
        for value in node.values():
            _strip_private(value)
    elif isinstance(node, list):
        for value in node:
            _strip_private(value)


def _keeper_mood(
    now: datetime, have_tos_total: int, arrivals_total: int, since: datetime | None
) -> str:
    if now.hour >= 22 or now.hour < 5:
        return "sleepy"
    if have_tos_total > 0:
        return "busy"
    if arrivals_total > 0 and have_tos_total == 0:
        return "celebrating"
    if since is None:
        return "greeting"
    return "calm"


def build_briefing(
    *,
    project_home=None,
    lab=None,
    discovery=None,
    journal=None,
    place=None,
    now: datetime | None = None,
    name_hint: str | None = None,
) -> dict:
    """Compose the briefing. Returns the full ``{ok, status, data}`` body.

    Sources are injected so tests (and the route) can pass fakes or real
    providers; each is observed under its own failure isolation.
    """
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    systems = [
        _agents(project_home, now),
        _estate(lab, now),
        _interests(discovery, now),
        _news(now),
    ]
    records, thread = _records(journal, now)
    systems.insert(2, records)
    systems.append(_threads(place, thread, now))

    # Cross-system pools.
    have_tos_pool = [i for s in systems for i in s.have_tos]
    have_tos_pool.sort(key=_sort_key, reverse=True)          # newest first
    have_tos_pool.sort(key=lambda i: i.get("_rank", 9))       # importance (stable)
    arrivals_pool = _newest([i for s in systems for i in s.arrivals])

    have_tos_total = len(have_tos_pool)
    if have_tos_total > 0:
        overall = Status.NEEDS_ATTENTION.value
    else:
        considered = [s.status for s in systems
                      if s.status != Status.NOT_CONFIGURED.value]
        overall = worst(considered) if considered else Status.HEALTHY.value

    since_dt = _parse_dt(place.get("updated_at")) if isinstance(place, dict) else None
    since = _iso(since_dt) if since_dt is not None else None
    arrivals_total = len(arrivals_pool)
    mood = _keeper_mood(now, have_tos_total, arrivals_total, since_dt)

    system_rows = []
    for s in systems:
        counts = s.counts
        system_rows.append({
            "id": s.spec["id"],
            "name": s.spec["name"],
            "resident": _resident(s.spec),
            "status": s.status,
            "voice": resident_line(
                s.spec["id"], s.status, counts, since_dt is not None
            ),
            "counts": counts,
            "source": s.source,
            "items": s.items,
        })

    data = {
        "schema": BRIEFING_SCHEMA,
        "generated_at": _iso(now),
        "since": since,
        "keeper": {
            "line": keeper_line(
                mood,
                {"arrivals": arrivals_total, "have_tos": have_tos_total},
                name_hint,
            ),
            "mood": mood,
            "resident": dict(KEEPER),
        },
        "systems": system_rows,
        "have_tos": have_tos_pool[:3],
        "have_tos_total": have_tos_total,
        "arrivals": arrivals_pool[:5],
        "thread": thread,
    }

    _mark_new(data, since_dt)
    _strip_private(data)
    return {"ok": True, "status": overall, "data": data}


# Re-exported for the route's place validation.
def known_system(system_id) -> bool:
    return system_id in SYSTEM_IDS


def dumps_place(system, item_id, updated_at) -> str:
    return json.dumps(
        {"system": system, "item_id": item_id, "updated_at": updated_at}
    )