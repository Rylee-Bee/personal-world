"""Shared *arr library snapshot helpers (Radarr/Sonarr/Lidarr) for dedup."""

import json
import logging
import os

from personal_world.discovery.http import http_get

log = logging.getLogger("candy-dispenser")

RADARR_URL = os.environ.get("RADARR_URL", "http://radarr:7878")
RADARR_API_KEY = os.environ.get("RADARR_API_KEY", "")
SONARR_URL = os.environ.get("SONARR_URL", "http://sonarr:8989")
SONARR_API_KEY = os.environ.get("SONARR_API_KEY", "")
LIDARR_URL = os.environ.get("LIDARR_URL", "http://lidarr:8686")
LIDARR_API_KEY = os.environ.get("LIDARR_API_KEY", "")


def _arr_json(base_url, api_key, path, timeout=20):
    """GET an *arr API path and return the decoded JSON, or None."""
    if not api_key:
        return None
    status, body = http_get(
        f"{base_url}{path}",
        {"X-Api-Key": api_key, "Accept": "application/json"},
        timeout=timeout,
    )
    if status != 200:
        log.warning(f"arr GET {path} failed ({status}): {body[:160]}")
        return None
    try:
        return json.loads(body)
    except Exception as e:  # noqa: BLE001 - keep running if this fails
        log.warning(f"arr GET {path} parse failed: {e}")
        return None


def radarr_tmdb_ids():
    """Set of TMDB ids already in Radarr. Empty set means 'unknown'."""
    data = _arr_json(RADARR_URL, RADARR_API_KEY, "/api/v3/movie")
    if not isinstance(data, list):
        return set()
    return {m["tmdbId"] for m in data if m.get("tmdbId")}


def sonarr_tmdb_ids():
    """Set of TMDB ids already in Sonarr. Empty set means 'unknown'.

    Sonarr indexes on TVDB natively but carries tmdbId on the series
    record, which is what makes the TMDB keyword feed dedupable at all.
    Series with tmdbId==0 (TVDB-only adds) fall through as 'not present'
    and may notify once; the state file then suppresses repeats.
    """
    data = _arr_json(SONARR_URL, SONARR_API_KEY, "/api/v3/series")
    if not isinstance(data, list):
        return set()
    return {s["tmdbId"] for s in data if s.get("tmdbId")}


def lidarr_artist_names():
    """Set of lowercased artist names already in Lidarr."""
    data = _arr_json(LIDARR_URL, LIDARR_API_KEY, "/api/v1/artist")
    if not isinstance(data, list):
        return set()
    return {
        (a.get("artistName") or "").strip().lower() for a in data if a.get("artistName")
    }
