"""Trakt list search source adapter (Phase B supplement: film/TV)."""

import json
import logging
import os
import re
import time
import urllib.parse

from personal_world.discovery.arr_dedup import radarr_tmdb_ids, sonarr_tmdb_ids
from personal_world.discovery.http import http_get
from personal_world.discovery.notifier import _notify_batch
from personal_world.discovery.scheduler import should_poll, mark_polled

log = logging.getLogger("candy-dispenser")

TRAKT_CLIENT_ID = os.environ.get(
    "TRAKT_CLIENT_ID",
    "64508a8bf370cee550dde4806469922fd7cd70afb2d5690e3ee7f75ae784b70e",
)
TRAKT_POLL_INTERVAL = int(os.environ.get("TRAKT_POLL_INTERVAL", "604800"))  # 7d
TRAKT_ENABLED = os.environ.get("TRAKT_ENABLED", "false").lower() in (
    "true",
    "1",
    "yes",
)
TRAKT_QUERIES = [
    q.strip()
    for q in os.environ.get("TRAKT_QUERIES", "transfem,transgender").split(",")
    if q.strip()
]
TRAKT_LIST_MAX_ITEMS = int(os.environ.get("TRAKT_LIST_MAX_ITEMS", "300"))
TRAKT_MAX_LISTS_PER_QUERY = int(os.environ.get("TRAKT_MAX_LISTS_PER_QUERY", "5"))
USER_AGENT = os.environ.get(
    "DISCOVERY_USER_AGENT", "candy-dispenser/1.0 (+homelab; contact rylee)"
)


def trakt_headers():
    """Trakt request headers.

    The User-Agent is load-bearing, not cosmetic: api.trakt.tv sits behind
    Cloudflare, which rejects urllib's default `Python-urllib/3.12` UA with
    `403 error code: 1010` before the request ever reaches Trakt. Verified
    2026-08-30 -- the identical request via curl returned 200. Without an
    explicit UA the whole Trakt poller silently returns zero lists forever
    and looks like "no public lists matched".
    """
    return {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": TRAKT_CLIENT_ID,
        "User-Agent": USER_AGENT,
    }


# Trakt's list search is a prefix/substring match, so query=transfem
# happily returns every "Transformers" collection on the site (verified
# 2026-08-30: 5 of the 7 surviving lists were Transformers). This is the
# relevance gate. Word boundaries do the heavy lifting -- \btrans\b does
# not match "Transformers", "Transylvania", "Translation" or "Transit",
# so no denylist is needed.
_TRANS_RELEVANT = re.compile(
    r"\btrans(gender|fem|femme|feminine|masc|sexual)\w*\b"
    r"|\btrans\b"
    r"|\bmtf\b|\bftm\b"
    r"|\btravesti\b"
    r"|\bnon-?binary\b"
    r"|\bgender[- ]?queer\b"
    r"|\btravestis\b",
    re.IGNORECASE,
)


def is_trans_relevant(*texts):
    """True if any of `texts` mentions trans identity as a real word.

    Guards against Trakt's substring list search -- see _TRANS_RELEVANT.
    """
    return any(_TRANS_RELEVANT.search(t or "") for t in texts)


def search_trakt_lists(query):
    """Return [{name, trakt_id, item_count}] for public lists matching query.

    Two filters, both learned the hard way:

    1. Drops any list with more than TRAKT_LIST_MAX_ITEMS items. The top
       hit for query=transgender is a 2,439-item catch-all ("THE BIGGEST
       LIST ON TRAKT", verified 2026-08-30) -- exactly the shape of list
       that produced the 2,184-movie flood. Focused lists are the signal;
       catch-alls are noise wearing a keyword.
    2. Drops lists whose name and description never mention trans identity
       as a whole word. Trakt matches substrings, so query=transfem
       returns Transformers collections.
    """
    url = f"https://api.trakt.tv/search/list?query={urllib.parse.quote(query)}&limit=20"
    status, body = http_get(url, trakt_headers(), timeout=20)
    if status != 200:
        log.warning(f"Trakt list search {query!r} failed ({status}): {body[:160]}")
        return []
    try:
        results = json.loads(body)
    except Exception as e:  # noqa: BLE001 - keep running if this fails
        log.warning(f"Trakt list search parse failed: {e}")
        return []

    out = []
    for r in results if isinstance(results, list) else []:
        lst = r.get("list") or {}
        count = lst.get("item_count") or 0
        ids = lst.get("ids") or {}
        if not ids.get("trakt"):
            continue
        if count > TRAKT_LIST_MAX_ITEMS:
            log.info(
                f"Trakt: skipping {lst.get('name', '')[:60]!r} "
                f"({count} items > cap {TRAKT_LIST_MAX_ITEMS}) -- "
                "broad catch-all list"
            )
            continue
        if count == 0:
            continue
        if not is_trans_relevant(lst.get("name"), lst.get("description")):
            log.info(
                f"Trakt: skipping {lst.get('name', '')[:60]!r} -- keyword "
                "matched as a substring only (no whole-word trans term in "
                "name or description)"
            )
            continue
        out.append(
            {
                "name": lst.get("name", ""),
                "trakt_id": ids["trakt"],
                "slug": ids.get("slug", ""),
                "item_count": count,
            }
        )
    return out[:TRAKT_MAX_LISTS_PER_QUERY]


def fetch_trakt_list_items(trakt_list_id):
    """Items of a public Trakt list. Lists go private without warning, so
    404/401 is an expected outcome, not an error."""
    url = f"https://api.trakt.tv/lists/{trakt_list_id}/items/movie,show"
    status, body = http_get(url, trakt_headers(), timeout=25)
    if status in (401, 403, 404):
        log.info(f"Trakt list {trakt_list_id} not public any more ({status})")
        return []
    if status != 200:
        log.warning(f"Trakt list {trakt_list_id} failed ({status})")
        return []
    try:
        items = json.loads(body)
    except Exception:  # noqa: BLE001 - keep running if this fails
        return []
    return items if isinstance(items, list) else []


def _render_trakt(entry):
    kind = entry["_kind"]
    tmdb_id = entry.get("_tmdb_id")
    name = entry.get("_title") or "(untitled)"
    year = entry.get("_year") or "?"
    label = "Film" if kind == "movie" else "TV"
    body = "\n".join(
        [
            f"{name} ({year})",
            "",
            f"From the Trakt list: {entry.get('_list_name', '')}",
            "",
            f"TMDB {label} #{tmdb_id} | not in your library",
        ]
    )
    return (
        f"{kind}:{tmdb_id}",
        f"Trakt {label}: {name}",
        body,
        f"https://www.themoviedb.org/{kind}/{tmdb_id}" if tmdb_id else None,
        None,  # Trakt list items carry no poster path; TMDB poller does art
    )


class TraktSource:
    """Trakt list search poller (Phase B supplement)."""

    name = "trakt"
    enabled = TRAKT_ENABLED
    interval = TRAKT_POLL_INTERVAL

    def __init__(self, *, ntfy_config, ntfy_max_per_poll):
        self._ntfy_config = ntfy_config
        self._ntfy_max_per_poll = ntfy_max_per_poll

    def poll(self, state):
        """Weekly: find currently-public focused transfem Trakt lists, notify on
        members     not already in Radarr/Sonarr. Notify-only.

        Disabled by default -- see the TRAKT_ENABLED comment for the measured
        reason. `--once --source trakt --force` still runs it, so the source
        stays verifiable without flipping the env var.
        """
        if not TRAKT_ENABLED and not state.get("_force_trakt"):
            log.info(
                "TRAKT_ENABLED=false, skipping Trakt (Phase B supplement). "
                "Low signal as of 2026-08-30; TMDB keyword 290527 is the "
                "primary film/TV source."
            )
            return
        if not should_poll(state, "trakt", TRAKT_POLL_INTERVAL):
            return

        log.info(f"polling Trakt list search for {TRAKT_QUERIES}...")
        lists = []
        seen_ids = set()
        for q in TRAKT_QUERIES:
            for lst in search_trakt_lists(q):
                if lst["trakt_id"] in seen_ids:
                    continue
                seen_ids.add(lst["trakt_id"])
                lists.append(lst)
            time.sleep(1)  # Trakt sustained limit is 1 req/s

        if not lists:
            log.info("Trakt: no focused public lists matched; nothing to do")
            mark_polled(state, "trakt")
            return

        log.info(
            "Trakt: " + "; ".join(f"{l['name'][:40]!r} ({l['item_count']})" for l in lists)
        )

        have_movies = radarr_tmdb_ids()
        have_shows = sonarr_tmdb_ids()

        candidates = []
        for lst in lists:
            for item in fetch_trakt_list_items(lst["trakt_id"]):
                kind = item.get("type")
                if kind not in ("movie", "show"):
                    continue
                payload = item.get(kind) or {}
                tmdb_id = (payload.get("ids") or {}).get("tmdb")
                if not tmdb_id:
                    continue
                norm_kind = "movie" if kind == "movie" else "tv"
                have = have_movies if norm_kind == "movie" else have_shows
                if tmdb_id in have:
                    continue
                candidates.append(
                    {
                        "_kind": norm_kind,
                        "_tmdb_id": tmdb_id,
                        "_title": payload.get("title", ""),
                        "_year": payload.get("year", ""),
                        "_list_name": lst["name"],
                    }
                )
            time.sleep(1)

        notified, skipped = _notify_batch(
            state,
            "trakt",
            candidates,
            _render_trakt,
            ["transgender_flag", "film_projector"],
            ntfy_config=self._ntfy_config,
            max_per_poll=self._ntfy_max_per_poll,
        )
        log.info(
            f"Trakt: {len(candidates)} not-in-library across {len(lists)} lists, "
            f"{notified} notified, {skipped} over cap (notify-only)"
        )
        mark_polled(state, "trakt")

    def render(self, item):
        return _render_trakt(item)
