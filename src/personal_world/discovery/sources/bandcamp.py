"""Bandcamp discover source adapter (Phase C: music)."""

import json
import logging
import os

from personal_world.discovery.arr_dedup import lidarr_artist_names
from personal_world.discovery.http import http_post
from personal_world.discovery.notifier import _notify_batch
from personal_world.discovery.scheduler import should_poll, mark_polled

log = logging.getLogger("candy-dispenser")

BANDCAMP_TAG = os.environ.get("BANDCAMP_TAG", "transgender")
BANDCAMP_POLL_INTERVAL = int(os.environ.get("BANDCAMP_POLL_INTERVAL", "86400"))
BANDCAMP_PAGE_SIZE = int(os.environ.get("BANDCAMP_PAGE_SIZE", "20"))


def fetch_bandcamp_discover(tag):
    """New Bandcamp releases carrying `tag`.

    Uses POST /api/discover/1/discover_web, NOT the
    GET /api/discover/3/get_web?tag=... endpoint the issue specced.
    Reason, measured 2026-08-30: get_web *silently ignores* the tag
    parameter -- `tag=transgender` and `tag=jazz` returned byte-identical
    first pages (48 items, same three leading albums). It would have fed
    the notification stream Bandcamp's global new-arrivals firehose while
    looking like it worked. discover_web with `tag_norm_names` does
    filter: the two tags return disjoint result sets.

    Both endpoints are undocumented internal APIs and can break; a
    non-200 or shape change degrades to "no items", never to unfiltered
    output.
    """
    payload = json.dumps(
        {
            "tag_norm_names": [tag],
            "include_result_types": ["a"],  # albums only, not merch/tracks
            "slice": "new",
            "cursor": "*",
            "size": BANDCAMP_PAGE_SIZE,
        }
    )
    status, body = http_post(
        "https://bandcamp.com/api/discover/1/discover_web",
        payload,
        {"Content-Type": "application/json", "Accept": "application/json"},
        timeout=25,
    )
    if status != 200:
        log.warning(f"Bandcamp discover failed ({status}): {body[:200]}")
        return []
    try:
        data = json.loads(body)
    except Exception as e:  # noqa: BLE001 - keep running if this fails
        log.warning(f"Bandcamp discover parse failed: {e}")
        return []
    results = data.get("results")
    if not isinstance(results, list):
        log.warning(
            "Bandcamp discover returned no `results` list "
            f"(keys={list(data)[:6]}); treating as empty rather than "
            "guessing at a new shape"
        )
        return []
    return results


def _render_bandcamp(entry):
    artist = (entry.get("band_name") or "").strip() or "(unknown artist)"
    album = (entry.get("title") or "").strip() or "(untitled)"
    item_id = entry.get("item_id")
    location = (entry.get("band_location") or "").strip()
    url = (entry.get("item_url") or "").split("?")[0]
    img = entry.get("primary_image") or {}
    art_id = img.get("image_id")
    body = "\n".join(
        [
            f"{artist} - {album}",
            "",
            f"Bandcamp, tag: {BANDCAMP_TAG}" + (f" | {location}" if location else ""),
            "",
            "Artist not in Lidarr" if not entry.get("_in_lidarr") else "",
            url,
        ]
    ).strip()
    return (
        f"bc:{item_id}",
        f"Trans music: {artist}",
        body,
        url or None,
        f"https://f4.bcbits.com/img/a{art_id}_10.jpg" if art_id else None,
    )


class BandcampSource:
    """Bandcamp discover poller (Phase C primary)."""

    name = "bandcamp"
    enabled = True
    interval = BANDCAMP_POLL_INTERVAL

    def __init__(self, *, ntfy_config, ntfy_max_per_poll):
        self._ntfy_config = ntfy_config
        self._ntfy_max_per_poll = ntfy_max_per_poll

    def poll(self, state):
        """Daily: notify on new Bandcamp albums tagged transgender whose artist
        is not already monitored in Lidarr. Notify-only."""
        if not should_poll(state, "bandcamp", BANDCAMP_POLL_INTERVAL):
            return

        log.info(f"polling Bandcamp discover (tag={BANDCAMP_TAG})...")
        items = fetch_bandcamp_discover(BANDCAMP_TAG)
        have = lidarr_artist_names()
        log.info(
            f"Bandcamp: {len(items)} albums returned; Lidarr has "
            f"{len(have)} monitored artists for dedup"
        )

        candidates = []
        for it in items:
            artist = (it.get("band_name") or "").strip().lower()
            if artist and artist in have:
                continue
            candidates.append({**it, "_in_lidarr": False})

        notified, skipped = _notify_batch(
            state,
            "bandcamp",
            candidates,
            _render_bandcamp,
            ["transgender_flag", "musical_note"],
            ntfy_config=self._ntfy_config,
            max_per_poll=self._ntfy_max_per_poll,
        )
        log.info(
            f"Bandcamp: {len(candidates)} not-in-Lidarr, {notified} notified, "
            f"{skipped} over cap (notify-only, no Lidarr writes)"
        )
        mark_polled(state, "bandcamp")

    def render(self, item):
        return _render_bandcamp(item)
