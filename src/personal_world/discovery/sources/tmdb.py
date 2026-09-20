"""TMDB discover source adapter (Phase B: film/TV)."""

import json
import logging
import os

from personal_world.discovery.arr_dedup import radarr_tmdb_ids, sonarr_tmdb_ids
from personal_world.discovery.http import http_get
from personal_world.discovery.notifier import _notify_batch
from personal_world.discovery.scheduler import should_poll, mark_polled

log = logging.getLogger("candy-dispenser")

TMDB_READ_TOKEN = os.environ.get("TMDB_READ_TOKEN", "")
TMDB_KEYWORD_ID = os.environ.get("TMDB_KEYWORD_ID", "290527")
TMDB_POLL_INTERVAL = int(os.environ.get("TMDB_POLL_INTERVAL", "86400"))  # 1d
TMDB_IMAGE_BASE = os.environ.get("TMDB_IMAGE_BASE", "https://image.tmdb.org/t/p/w500")
MEDIA_AUTO_ADD = False


def tmdb_headers():
    return {
        "Authorization": f"Bearer {TMDB_READ_TOKEN}",
        "Accept": "application/json",
    }


def fetch_tmdb_discover(kind, page=1):
    """Fetch one page of TMDB discover for the transgender keyword.

    `kind` is "movie" or "tv". Sorted newest-first so page 1 is the only
    page worth polling daily -- older entries were already seen on an
    earlier cycle and live in the state file.
    """
    if not TMDB_READ_TOKEN:
        return []
    sort = "primary_release_date.desc" if kind == "movie" else "first_air_date.desc"
    url = (
        f"https://api.themoviedb.org/3/discover/{kind}"
        f"?with_keywords={TMDB_KEYWORD_ID}&sort_by={sort}&page={page}"
        f"&include_adult=false"
    )
    status, body = http_get(url, tmdb_headers(), timeout=20)
    if status != 200:
        log.warning(f"TMDB discover/{kind} failed ({status}): {body[:200]}")
        return []
    try:
        return json.loads(body).get("results", []) or []
    except Exception as e:  # noqa: BLE001 - keep running if this fails
        log.warning(f"TMDB discover/{kind} parse failed: {e}")
        return []


def _render_tmdb(entry):
    """(dedup_id, title, body, click, attach) for a TMDB discover result."""
    kind = entry["_kind"]
    tmdb_id = entry.get("id")
    name = entry.get("title") or entry.get("name") or "(untitled)"
    date = entry.get("release_date") or entry.get("first_air_date") or "TBA"
    overview = (entry.get("overview") or "").strip() or "(no overview on TMDB)"
    if len(overview) > 500:
        overview = overview[:500].rstrip() + "..."
    vote = entry.get("vote_average") or 0
    poster = entry.get("poster_path")
    label = "Film" if kind == "movie" else "TV"
    body = "\n".join(
        [
            f"{name} ({date[:4] if date else 'TBA'})",
            "",
            overview,
            "",
            f"TMDB {label} #{tmdb_id}"
            + (f" | rating {vote:.1f}" if vote else "")
            + " | not in your library",
        ]
    )
    return (
        f"{kind}:{tmdb_id}",
        f"Trans {label}: {name}",
        body,
        f"https://www.themoviedb.org/{kind}/{tmdb_id}",
        f"{TMDB_IMAGE_BASE}{poster}" if poster else None,
    )


class TMDBSource:
    """TMDB discover poller (keyword 290527 == transgender)."""

    name = "tmdb"
    enabled = bool(TMDB_READ_TOKEN)
    interval = TMDB_POLL_INTERVAL

    def __init__(self, *, ntfy_config, ntfy_max_per_poll):
        self._ntfy_config = ntfy_config
        self._ntfy_max_per_poll = ntfy_max_per_poll

    def poll(self, state):
        """Notify on newly-released TMDB titles tagged transgender that are
        not already in Radarr/Sonarr. Notify-only: nothing is added."""
        if not TMDB_READ_TOKEN:
            log.info("TMDB_READ_TOKEN not set, skipping TMDB (Phase B)")
            return
        if not should_poll(state, "tmdb", TMDB_POLL_INTERVAL):
            return

        log.info(f"polling TMDB discover (keyword {TMDB_KEYWORD_ID})...")
        movies = fetch_tmdb_discover("movie")
        shows = fetch_tmdb_discover("tv")

        have_movies = radarr_tmdb_ids()
        have_shows = sonarr_tmdb_ids()
        log.info(
            f"TMDB: {len(movies)} movies + {len(shows)} shows on page 1; "
            f"library has {len(have_movies)} Radarr / {len(have_shows)} Sonarr "
            "TMDB ids for dedup"
        )

        candidates = []
        for m in movies:
            if m.get("id") in have_movies:
                continue
            candidates.append({**m, "_kind": "movie"})
        for s in shows:
            if s.get("id") in have_shows:
                continue
            candidates.append({**s, "_kind": "tv"})

        notified, skipped = _notify_batch(
            state, "tmdb", candidates, _render_tmdb, ["transgender_flag", "clapper"],
            ntfy_config=self._ntfy_config, max_per_poll=self._ntfy_max_per_poll,
        )
        log.info(
            f"TMDB: {len(candidates)} not-in-library, {notified} notified, "
            f"{skipped} over cap (notify-only, MEDIA_AUTO_ADD={MEDIA_AUTO_ADD})"
        )
        mark_polled(state, "tmdb")

    def render(self, item):
        return _render_tmdb(item)
