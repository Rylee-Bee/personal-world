"""World configuration loader. Reads worlds/*.yml, interpolates env vars.

Secrets (API keys, tokens) live as env vars set by SOPS at deploy time.
YAML references them via ${VAR} syntax — never stored in plaintext.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import yaml

_ENV_PATTERN = re.compile(r"\$\{(\w+)(?::-(.*))?\}")


def _interpolate(value):
    """Replace ${VAR} and ${VAR:-default} in strings."""
    if isinstance(value, str):
        def _replace(m):
            var = m.group(1)
            default = m.group(2) or ""
            return os.environ.get(var, default)
        return _ENV_PATTERN.sub(_replace, value)
    return value


def _interpolate_recursive(obj):
    """Walk a nested structure, interpolating env vars in all strings."""
    if isinstance(obj, str):
        return _interpolate(obj)
    if isinstance(obj, dict):
        return {k: _interpolate_recursive(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_interpolate_recursive(v) for v in obj]
    return obj


def load_world(path: Path) -> dict:
    """Load a world YAML file. Interpolate env vars. Validate required keys."""
    with path.open() as f:
        raw = yaml.safe_load(f) or {}
    config = _interpolate_recursive(raw)
    if "name" not in config:
        raise ValueError(f"world {path}: missing 'name'")
    if "sources" not in config:
        raise ValueError(f"world {path}: missing 'sources'")
    return config


def load_all_worlds(worlds_dir: Path) -> dict[str, dict]:
    """Load all enabled worlds from a directory."""
    worlds = {}
    if not worlds_dir.exists():
        return worlds
    for path in sorted(worlds_dir.glob("*.yml")):
        try:
            config = load_world(path)
            if config.get("enabled", True):
                worlds[config["name"]] = config
        except Exception:
            pass  # skip malformed world files
    return worlds


def config_to_env_fallback(config: dict) -> dict:
    """Map YAML world config to the flat env-var-style dict that
    dispenser.py module-level globals expect.

    This bridges the YAML config to the existing code path so that
    dispenser.py can set its globals from the YAML without changing
    every function that reads them.
    """
    notify = config.get("notify", {})
    src = config.get("sources", {})
    mam = src.get("mam_rss", {})
    hc = src.get("hardcover", {})
    tmdb = src.get("tmdb", {})
    trakt = src.get("trakt", {})
    bc = src.get("bandcamp", {})
    lfm = src.get("lastfm", {})

    return {
        # ntfy
        "NTFY_BASE": notify.get("endpoint", os.environ.get("NTFY_BASE", "http://ntfy:80")),
        "NTFY_TOPIC": notify.get("topic", os.environ.get("NTFY_TOPIC", "homelab-digest")),
        # NTFY_TOKEN is never in YAML — always from env

        # MAM
        "MAM_RSS_FEED_URL": os.environ.get("MAM_RSS_FEED_URL", ""),
        "MAM_POLL_INTERVAL": mam.get("interval", int(os.environ.get("MAM_POLL_INTERVAL", "14400"))),
        "AUTO_GRAB": mam.get("auto_grab", os.environ.get("AUTO_GRAB", "true").lower() in ("true", "1", "yes")),
        "MAM_INDEXER_NAME": mam.get("indexer_name", os.environ.get("MAM_INDEXER_NAME", "MyAnonamouse")),
        "EBOOK_DOWNLOAD_CLIENT_NAME": mam.get("download_client_name", os.environ.get("EBOOK_DOWNLOAD_CLIENT_NAME", "qBittorrent")),
        # BINDERY_URL and BINDERY_API_KEY from env

        # Hardcover
        "HARDCOVER_POLL_INTERVAL": hc.get("interval", int(os.environ.get("HARDCOVER_POLL_INTERVAL", "604800"))),

        # *arr
        "RADARR_URL": os.environ.get("RADARR_URL", "http://radarr:7878"),
        "SONARR_URL": os.environ.get("SONARR_URL", "http://sonarr:8989"),
        "LIDARR_URL": os.environ.get("LIDARR_URL", "http://lidarr:8686"),

        # TMDB
        "TMDB_KEYWORD_ID": tmdb.get("keyword_id", os.environ.get("TMDB_KEYWORD_ID", "290527")),
        "TMDB_POLL_INTERVAL": tmdb.get("interval", int(os.environ.get("TMDB_POLL_INTERVAL", "86400"))),
        "TMDB_IMAGE_BASE": tmdb.get("image_base", os.environ.get("TMDB_IMAGE_BASE", "https://image.tmdb.org/t/p/w500")),
        "TMDB_LIMIT": tmdb.get("limit", int(os.environ.get("TMDB_LIMIT", "20"))),

        # Trakt
        "TRAKT_ENABLED": trakt.get("enabled", os.environ.get("TRAKT_ENABLED", "false").lower() in ("true", "1", "yes")),
        "TRAKT_CLIENT_ID": trakt.get("client_id", os.environ.get("TRAKT_CLIENT_ID", "64508a8bf370cee550dde4806469922fd7cd70afb2d5690e3ee7f75ae784b70e")),
        "TRAKT_POLL_INTERVAL": trakt.get("interval", int(os.environ.get("TRAKT_POLL_INTERVAL", "604800"))),
        "TRAKT_QUERIES": trakt.get("queries", os.environ.get("TRAKT_QUERIES", "transfem,transgender").split(",")),
        "TRAKT_LIST_MAX_ITEMS": trakt.get("list_max_items", int(os.environ.get("TRAKT_LIST_MAX_ITEMS", "300"))),
        "TRAKT_MAX_LISTS_PER_QUERY": trakt.get("max_lists_per_query", int(os.environ.get("TRAKT_MAX_LISTS_PER_QUERY", "5"))),

        # Bandcamp
        "BANDCAMP_TAG": bc.get("tag", os.environ.get("BANDCAMP_TAG", "transgender")),
        "BANDCAMP_POLL_INTERVAL": bc.get("interval", int(os.environ.get("BANDCAMP_POLL_INTERVAL", "86400"))),
        "BANDCAMP_PAGE_SIZE": bc.get("page_size", int(os.environ.get("BANDCAMP_PAGE_SIZE", "20"))),

        # Last.fm
        "LASTFM_TAG": lfm.get("tag", os.environ.get("LASTFM_TAG", "transgender")),
        "LASTFM_POLL_INTERVAL": lfm.get("interval", int(os.environ.get("LASTFM_POLL_INTERVAL", "604800"))),
        "LASTFM_LIMIT": lfm.get("limit", int(os.environ.get("LASTFM_LIMIT", "50"))),

        # General
        "USER_AGENT": config.get("user_agent", os.environ.get("DISCOVERY_USER_AGENT", "candy-dispenser/1.0 (+homelab; contact rylee)")),
        "DISCOVERY_NOTIFY_MAX_PER_POLL": notify.get("max_per_poll", int(os.environ.get("DISCOVERY_NOTIFY_MAX_PER_POLL", "5"))),
        "STATE_FILE": config.get("state_file", os.environ.get("STATE_FILE", "/var/lib/candy-dispenser/state.json")),
        "HEALTH_PORT": config.get("health_port", int(os.environ.get("HEALTH_PORT", "5126"))),
    }
