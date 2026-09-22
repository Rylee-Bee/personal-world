"""HTTP helper functions for the discovery engine."""

import os
import urllib.error
import urllib.request

BINDERY_API_KEY = os.environ.get("BINDERY_API_KEY", "")
BINDERY_URL = os.environ.get("BINDERY_URL", "http://bindery:8787")


def http_get(url, headers=None, timeout=15):
    """Simple GET with optional headers. Returns (status, body)."""
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001 - keep running if this fails
        return 0, str(e)


def http_post(url, data, headers=None, timeout=15):
    """Simple POST. Returns (status, body)."""
    req = urllib.request.Request(
        url,
        data=data.encode("utf-8") if isinstance(data, str) else data,
        headers=headers or {},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001 - keep running if this fails
        return 0, str(e)


def bindery_headers():
    """Standard auth headers for bindery API calls. Returns {} if no key."""
    if not BINDERY_API_KEY:
        return {}
    return {
        "X-Api-Key": BINDERY_API_KEY,
        "Accept": "application/json",
    }
