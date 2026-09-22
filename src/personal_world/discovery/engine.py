"""Main discovery engine loop."""

import logging
import os
import sys
import time
from datetime import UTC, datetime

from personal_world.discovery.state import load_state, save_state

log = logging.getLogger("candy-dispenser")

# ---------------------------------------------------------------------------
# Configuration (will move to config module in Phase 1)
# ---------------------------------------------------------------------------

MEDIA_AUTO_ADD = False
MAM_RSS_URL = os.environ.get("MAM_RSS_FEED_URL", "")
KNOWN_MAM_RSS_RELAYS = frozenset(
    {
        "063qb.mrd.ninja",
    }
)
TMDB_READ_TOKEN = os.environ.get("TMDB_READ_TOKEN", "")
TMDB_KEYWORD_ID = os.environ.get("TMDB_KEYWORD_ID", "290527")
TRAKT_ENABLED = os.environ.get("TRAKT_ENABLED", "false").lower() in (
    "true",
    "1",
    "yes",
)
TRAKT_LIST_MAX_ITEMS = int(os.environ.get("TRAKT_LIST_MAX_ITEMS", "300"))
BANDCAMP_TAG = os.environ.get("BANDCAMP_TAG", "transgender")
LASTFM_API_KEY = os.environ.get("LASTFM_API_KEY", "")
DISCOVERY_NOTIFY_MAX_PER_POLL = int(
    os.environ.get("DISCOVERY_NOTIFY_MAX_PER_POLL", "5")
)
NTFY_BASE = os.environ.get("NTFY_BASE", "http://ntfy:80")
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "homelab-digest")
NTFY_TOKEN = os.environ.get("NTFY_TOKEN", "")
STATE_FILE = os.environ.get("STATE_FILE", "/var/lib/candy-dispenser/state.json")
MAM_INDEXER_NAME = os.environ.get("MAM_INDEXER_NAME", "MyAnonamouse")
EBOOK_DOWNLOAD_CLIENT_NAME = os.environ.get("EBOOK_DOWNLOAD_CLIENT_NAME", "qBittorrent")


def classify_mam_rss_url(url):
    """Return one of: 'relay', 'direct-with-passkey', 'direct-no-passkey', 'unset'.

    Relays are 3rd-party frontends authorised by MAM (KNOWN_MAM_RSS_RELAYS).
    Direct MAM URLs embed a passkey query string and are very long. A
    "direct-no-passkey" answer is the only case the legacy warning should
    still fire for.
    """
    if not url:
        return "unset"
    try:
        from urllib.parse import urlparse

        host = (urlparse(url).hostname or "").lower()
    except Exception:  # noqa: BLE001 - keep running if this fails
        host = ""
    if host in KNOWN_MAM_RSS_RELAYS:
        return "relay"
    if len(url) >= 80:
        return "direct-with-passkey"
    return "direct-no-passkey"


# POLLERS is the list of (source_name, function_name) pairs used by run_once().
# In Phase 0 these reference globals() -- in a later phase they'll be
# adapter instances.
POLLERS = [
    ("mam_rss", "poll_mam_rss"),
    ("hardcover", "poll_hardcover"),
    ("tmdb", "poll_tmdb"),
    ("trakt", "poll_trakt"),
    ("bandcamp", "poll_bandcamp"),
    ("lastfm", "poll_lastfm"),
]


def run_once(state, only=None, force=False):
    """Run one pass of every poller (or just `only`) and return.

    This is the operator entry point for verifying a new source without
    waiting out a 24h/7d interval or restarting the long-running process:

        docker exec candy-dispenser python3 /app/dispenser.py \\
            --once --source tmdb --force

    `force` clears the source's last_poll stamp so should_poll() lets the
    cycle through. State is saved on the way out, so a --force run does
    consume the dedup window -- that is deliberate: a verification run
    that did not persist would notify twice.
    """
    from pathlib import Path as _Path
    from personal_world.discovery.sources.mam_rss import MAMRSSSource, HardcoverSource
    from personal_world.discovery.sources.tmdb import TMDBSource
    from personal_world.discovery.sources.trakt import TraktSource
    from personal_world.discovery.sources.bandcamp import BandcampSource
    from personal_world.discovery.sources.lastfm import LastfmSource

    ntfy_config = {"base": NTFY_BASE, "topic": NTFY_TOPIC, "token": NTFY_TOKEN}
    max_poll = DISCOVERY_NOTIFY_MAX_PER_POLL

    # Build adapter instances
    adapters = {
        "mam_rss": MAMRSSSource(ntfy_config=ntfy_config, ntfy_max_per_poll=max_poll),
        "hardcover": HardcoverSource(),
        "tmdb": TMDBSource(ntfy_config=ntfy_config, ntfy_max_per_poll=max_poll),
        "trakt": TraktSource(ntfy_config=ntfy_config, ntfy_max_per_poll=max_poll),
        "bandcamp": BandcampSource(ntfy_config=ntfy_config, ntfy_max_per_poll=max_poll),
        "lastfm": LastfmSource(ntfy_config=ntfy_config, ntfy_max_per_poll=max_poll),
    }

    ran = []
    if force and only and "trakt" in only:
        # Explicitly asked for trakt with --force: let the disabled-by-
        # default guard through for this run only. Not persisted.
        state["_force_trakt"] = True

    for name, _fn_name in POLLERS:
        if only and name not in only:
            continue
        if force:
            state.get("last_poll", {}).pop(name, None)
        try:
            adapter = adapters.get(name)
            if adapter:
                adapter.poll(state)
            ran.append(name)
        except Exception as e:  # noqa: BLE001 - keep running if this fails
            log.error(f"{name} poll failed: {e}")
            state["errors"] = state.get("errors", 0) + 1

    state.pop("_force_trakt", None)
    save_state(state, _Path(STATE_FILE))
    log.info(f"--once complete; ran: {', '.join(ran) or '(none)'}")
    return ran


def main():
    from pathlib import Path

    argv = sys.argv[1:]
    once = "--once" in argv
    force = "--force" in argv
    only = None
    if "--source" in argv:
        idx = argv.index("--source")
        if idx + 1 < len(argv):
            only = {s.strip() for s in argv[idx + 1].split(",") if s.strip()}

    log.info("candy-dispenser starting (auto-grab on for grimmory hand-off)")
    log.info(
        f"Phase B/C are notify-only: MEDIA_AUTO_ADD={MEDIA_AUTO_ADD}, "
        f"per-poll notify cap={DISCOVERY_NOTIFY_MAX_PER_POLL}"
    )

    state_file = Path(STATE_FILE)
    state = load_state(state_file)

    if once:
        # No health server, no infinite loop, no bindery id resolution
        # (Phase B/C never touch bindery). One pass, then exit -- so this
        # can be run inside the already-running container without
        # colliding on :5126.
        log.info(
            f"--once mode: sources={sorted(only) if only else 'all'} force={force}"
        )
        run_once(state, only=only, force=force)
        return

    from personal_world.discovery.health import start_health_server, HealthHandler
    from personal_world.discovery.sources.mam_rss import (
        _resolve_bindery_ids,
        RESOLVED_MAM_INDEXER_ID,
        RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID,
    )

    start_health_server(state)

    # Set health handler live values
    HealthHandler.mam_indexer_name = MAM_INDEXER_NAME
    HealthHandler.ebook_download_client_name = EBOOK_DOWNLOAD_CLIENT_NAME
    HealthHandler.auto_grab = os.environ.get("AUTO_GRAB", "true").lower() in ("true", "1", "yes")
    HealthHandler.media_auto_add = MEDIA_AUTO_ADD
    HealthHandler.mam_rss_url = MAM_RSS_URL
    HealthHandler.known_mam_rss_relays = KNOWN_MAM_RSS_RELAYS
    HealthHandler.tmdb_read_token = TMDB_READ_TOKEN
    HealthHandler.tmdb_keyword_id = TMDB_KEYWORD_ID
    HealthHandler.trakt_enabled = TRAKT_ENABLED
    HealthHandler.trakt_list_max_items = TRAKT_LIST_MAX_ITEMS
    HealthHandler.bandcamp_tag = BANDCAMP_TAG
    HealthHandler.lastfm_api_key = LASTFM_API_KEY
    HealthHandler.notify_max_per_poll = DISCOVERY_NOTIFY_MAX_PER_POLL

    # One-shot MAM RSS classification at boot. Only warn if the URL is
    # actually misshapen -- relay URLs are short by design.
    rss_state = classify_mam_rss_url(MAM_RSS_URL)
    if rss_state == "direct-no-passkey":
        log.warning(
            f"MAM_RSS_URL is only {len(MAM_RSS_URL)} chars; "
            "looks like a direct MAM URL missing its passkey. "
            "Get the full URL from MAM > Preferences > Torrent Search > "
            "RSS feed generator. (If this is supposed to be a relay URL, "
            "add the host to KNOWN_MAM_RSS_RELAYS in dispenser.py.)"
        )
    elif rss_state == "relay":
        log.info(f"MAM RSS URL is a known relay ({MAM_RSS_URL}) -- treating as valid")
    elif rss_state == "direct-with-passkey":
        log.info(
            f"MAM RSS URL looks like a direct passkey URL (len {len(MAM_RSS_URL)})"
        )

    # Resolve indexer+download-client ids at boot. Refreshed per poll
    # cycle to detect drift (ids shift when bindery is reconfigured).
    if not _resolve_bindery_ids():
        log.warning(
            "bindery id resolution incomplete at startup; "
            "auto-grab will refuse every grab until MAM + qBittorrent "
            "are both resolved. Use /health to inspect."
        )

    # Track how often we refresh ids. Each successful refresh is one less
    # bad grab the next time the bindery config drifts.
    cycles_since_refresh = 0
    ID_REFRESH_EVERY_N_CYCLES = 12  # every ~hour at the 5-minute poll cadence

    from personal_world.discovery.sources.mam_rss import (
        MAMRSSSource,
        RESOLVED_MAM_INDEXER_ID,
        RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID,
    )
    from personal_world.discovery.sources.tmdb import TMDBSource
    from personal_world.discovery.sources.trakt import TraktSource
    from personal_world.discovery.sources.bandcamp import BandcampSource
    from personal_world.discovery.sources.lastfm import LastfmSource

    ntfy_config = {"base": NTFY_BASE, "topic": NTFY_TOPIC, "token": NTFY_TOKEN}
    max_poll = DISCOVERY_NOTIFY_MAX_PER_POLL

    mam_source = MAMRSSSource(ntfy_config=ntfy_config, ntfy_max_per_poll=max_poll)
    # Hardcover uses the same source class for adapter extraction
    from personal_world.discovery.sources.mam_rss import HardcoverSource
    hardcover_source = HardcoverSource()
    tmdb_source = TMDBSource(ntfy_config=ntfy_config, ntfy_max_per_poll=max_poll)
    trakt_source = TraktSource(ntfy_config=ntfy_config, ntfy_max_per_poll=max_poll)
    bandcamp_source = BandcampSource(ntfy_config=ntfy_config, ntfy_max_per_poll=max_poll)
    lastfm_source = LastfmSource(ntfy_config=ntfy_config, ntfy_max_per_poll=max_poll)

    while True:
        try:
            if cycles_since_refresh >= ID_REFRESH_EVERY_N_CYCLES:
                _resolve_bindery_ids()
                cycles_since_refresh = 0
            cycles_since_refresh += 1

            mam_source.poll(state)
            hardcover_source.poll(state)
            # Phase B (film/TV) + Phase C (music). Each has its own
            # interval and is a no-op on cycles where it is not due.
            tmdb_source.poll(state)
            trakt_source.poll(state)
            bandcamp_source.poll(state)
            lastfm_source.poll(state)
            save_state(state, state_file)
        except Exception as e:  # noqa: BLE001 - keep running if this fails
            log.error(f"poll cycle failed: {e}")
            state["errors"] += 1
            save_state(state, state_file)

        # Sleep 5 minutes between checks (each source has its own interval)
        log.info("sleeping 300s until next poll check...")
        time.sleep(300)


if __name__ == "__main__":
    main()
