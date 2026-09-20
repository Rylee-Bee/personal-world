"""Last.fm tag.getTopArtists source adapter (Phase C supplement: music)."""

import json
import logging
import os
import urllib.parse

from personal_world.discovery.arr_dedup import lidarr_artist_names
from personal_world.discovery.http import http_get
from personal_world.discovery.notifier import _notify_batch
from personal_world.discovery.scheduler import should_poll, mark_polled

log = logging.getLogger("candy-dispenser")

LASTFM_API_KEY = os.environ.get("LASTFM_API_KEY", "")
LASTFM_TAG = os.environ.get("LASTFM_TAG", "transgender")
LASTFM_POLL_INTERVAL = int(os.environ.get("LASTFM_POLL_INTERVAL", "604800"))
LASTFM_LIMIT = int(os.environ.get("LASTFM_LIMIT", "50"))


def fetch_lastfm_top_artists(tag):
    """Top artists for a Last.fm tag. Returns [] when no key is configured."""
    if not LASTFM_API_KEY:
        return []
    url = (
        "https://ws.audioscrobbler.com/2.0/?method=tag.gettopartists"
        f"&tag={urllib.parse.quote(tag)}&api_key={LASTFM_API_KEY}"
        f"&format=json&limit={LASTFM_LIMIT}"
    )
    status, body = http_get(url, {"Accept": "application/json"}, timeout=20)
    if status != 200:
        log.warning(f"Last.fm tag.getTopArtists failed ({status}): {body[:160]}")
        return []
    try:
        data = json.loads(body)
    except Exception as e:  # noqa: BLE001 - keep running if this fails
        log.warning(f"Last.fm parse failed: {e}")
        return []
    return ((data.get("topartists") or {}).get("artist")) or []


def _render_lastfm(entry):
    name = (entry.get("name") or "").strip() or "(unknown artist)"
    mbid = (entry.get("mbid") or "").strip()
    url = entry.get("url") or ""
    body = "\n".join(
        [
            name,
            "",
            f"Last.fm top artist for tag: {LASTFM_TAG}",
            f"MusicBrainz id: {mbid}"
            if mbid
            else "No MusicBrainz id (Lidarr would need a manual lookup)",
            "",
            "Artist not in Lidarr",
            url,
        ]
    ).strip()
    return (
        f"lfm:{mbid or name.lower()}",
        f"Trans artist: {name}",
        body,
        url or None,
        None,
    )


class LastfmSource:
    """Last.fm tag.getTopArtists poller (Phase C supplement)."""

    name = "lastfm"
    enabled = bool(LASTFM_API_KEY)
    interval = LASTFM_POLL_INTERVAL

    def __init__(self, *, ntfy_config, ntfy_max_per_poll):
        self._ntfy_config = ntfy_config
        self._ntfy_max_per_poll = ntfy_max_per_poll

    def poll(self, state):
        """Weekly: notify on Last.fm top artists for the transgender tag that
        are not already in Lidarr. Notify-only.

        No-ops with one log line when LASTFM_API_KEY is unset, which is the
        state this shipped in -- see the LASTFM_API_KEY comment.
        """
        if not LASTFM_API_KEY:
            log.info(
                "LASTFM_API_KEY not set, skipping Last.fm (Phase C supplement). "
                "Add `lastfm/api-key` to secrets/openbao-export.enc.json and "
                "re-run scripts/render-secrets.sh to enable."
            )
            return
        if not should_poll(state, "lastfm", LASTFM_POLL_INTERVAL):
            return

        log.info(f"polling Last.fm tag.getTopArtists (tag={LASTFM_TAG})...")
        artists = fetch_lastfm_top_artists(LASTFM_TAG)
        have = lidarr_artist_names()
        log.info(
            f"Last.fm: {len(artists)} artists returned; Lidarr has {len(have)} "
            "monitored artists for dedup"
        )

        candidates = [
            a for a in artists if (a.get("name") or "").strip().lower() not in have
        ]

        notified, skipped = _notify_batch(
            state,
            "lastfm",
            candidates,
            _render_lastfm,
            ["transgender_flag", "headphones"],
            ntfy_config=self._ntfy_config,
            max_per_poll=self._ntfy_max_per_poll,
        )
        log.info(
            f"Last.fm: {len(candidates)} not-in-Lidarr, {notified} notified, "
            f"{skipped} over cap (notify-only)"
        )
        mark_polled(state, "lastfm")

    def render(self, item):
        return _render_lastfm(item)
