"""Health endpoint for the discovery engine."""

import http.server
import json
import logging
import os
import threading

log = logging.getLogger("candy-dispenser")

HEALTH_PORT = int(os.environ.get("HEALTH_PORT", "5126"))


class HealthHandler(http.server.BaseHTTPRequestHandler):
    """Minimal health endpoint. Returns 200 with state JSON."""

    state_ref = None  # set by start_health_server
    worlds_dir = None  # Path to worlds/ directory
    # These are set by engine.py / main() to provide live values
    mam_indexer_id = None
    ebook_download_client_id = None
    mam_indexer_name = ""
    ebook_download_client_name = ""
    auto_grab = False
    media_auto_add = False
    mam_rss_url = ""
    known_mam_rss_relays = frozenset()
    tmdb_read_token = ""
    tmdb_keyword_id = ""
    trakt_enabled = False
    trakt_list_max_items = 0
    bandcamp_tag = ""
    lastfm_api_key = ""
    notify_max_per_poll = 0

    def do_GET(self):
        if self.path == "/health":
            self._serve_health_json()
        elif self.path == "/":
            self._serve_dashboard()
        elif self.path == "/api/worlds":
            self._serve_worlds_api()
        else:
            self.send_response(404)
            self.end_headers()

    def _serve_health_json(self):
        """JSON health endpoint — unchanged from original."""
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        body = json.dumps(
            {
                "status": "ok",
                "notifications_sent": self.state_ref.get("notifications_sent", 0),
                "errors": self.state_ref.get("errors", 0),
                "grabs_accepted": self.state_ref.get("grabs_accepted", 0),
                "grabs_refused": self.state_ref.get("grabs_refused", 0),
                "sources": list(self.state_ref.get("last_poll", {}).keys()),
                "seen_count": sum(
                    len(v) for v in self.state_ref.get("seen", {}).values()
                ),
                "started_at": self.state_ref.get("started_at", ""),
                "mam_indexer_id": self.mam_indexer_id,
                "ebook_download_client_id": self.ebook_download_client_id,
                "mam_indexer_name": self.mam_indexer_name,
                "ebook_download_client_name": self.ebook_download_client_name,
                "resolve_ok": (
                    self.mam_indexer_id is not None
                    and self.ebook_download_client_id is not None
                ),
                "auto_grab": self.auto_grab,
                "mam_rss_classification": _classify_mam_rss_url(
                    self.mam_rss_url, self.known_mam_rss_relays
                ),
                # Phase B/C. media_auto_add is reported so /health is
                # the answer to "can this thing write to Radarr?"
                # without reading the source.
                "media_auto_add": self.media_auto_add,
                "notify_max_per_poll": self.notify_max_per_poll,
                "phase_b": {
                    "tmdb": "configured" if self.tmdb_read_token else "no-token",
                    "tmdb_keyword": self.tmdb_keyword_id,
                    "trakt": (
                        "enabled" if self.trakt_enabled else "disabled-low-signal"
                    ),
                    "trakt_list_max_items": self.trakt_list_max_items,
                },
                "phase_c": {
                    "bandcamp": "configured",
                    "bandcamp_tag": self.bandcamp_tag,
                    "lastfm": "configured" if self.lastfm_api_key else "no-api-key",
                },
            },
            indent=2,
        )
        self.wfile.write(body.encode())

    def _serve_dashboard(self):
        """HTML dashboard — inline, no framework."""
        html = self._build_dashboard_html()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode())

    def _serve_worlds_api(self):
        """JSON list of worlds with live health."""
        worlds = self._load_worlds_summary()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        body = json.dumps({"worlds": worlds}, indent=2)
        self.wfile.write(body.encode())

    def _load_worlds_summary(self):
        """Load world configs and merge with health data."""
        import yaml as _yaml

        worlds = []
        if not self.worlds_dir or not self.worlds_dir.exists():
            return worlds
        for path in sorted(self.worlds_dir.glob("*.yml")):
            if path.name.startswith("_"):
                continue
            try:
                with path.open() as f:
                    config = _yaml.safe_load(f) or {}
                sources = config.get("sources", {})
                active = sum(1 for s in sources.values() if s.get("enabled", True))
                source_names = [k for k, v in sources.items() if v.get("enabled", True)]
                worlds.append({
                    "name": config.get("name", path.stem),
                    "description": config.get("description", ""),
                    "enabled": config.get("enabled", True),
                    "sources_total": len(sources),
                    "sources_active": active,
                    "sources": source_names,
                })
            except Exception:
                worlds.append({"name": path.stem, "error": "malformed"})
        return worlds

    def _build_dashboard_html(self):
        """Inline HTML dashboard. No framework, no build step."""
        worlds = self._load_worlds_summary()
        worlds_json = json.dumps(worlds)

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Discovery Engine</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: system-ui, -apple-system, sans-serif; background: #0f0f0f; color: #e0e0e0; padding: 2rem; }}
  h1 {{ font-size: 1.5rem; margin-bottom: 0.5rem; }}
  .subtitle {{ color: #888; margin-bottom: 2rem; }}
  .world {{ border: 1px solid #333; border-radius: 8px; padding: 1.2rem; margin-bottom: 1rem; }}
  .world-name {{ font-size: 1.1rem; font-weight: 600; }}
  .world-desc {{ color: #888; font-size: 0.9rem; margin-top: 0.3rem; }}
  .world-stats {{ margin-top: 0.8rem; font-size: 0.85rem; color: #aaa; }}
  .status {{ display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }}
  .status-ok {{ background: #1a3a1a; color: #4ade80; }}
  .status-disabled {{ background: #3a2a1a; color: #fbbf24; }}
  .status-error {{ background: #3a1a1a; color: #f87171; }}
  .sources {{ margin-top: 0.6rem; }}
  .source {{ display: inline-block; margin: 0.2rem; padding: 0.2rem 0.5rem; background: #1a1a1a; border-radius: 4px; font-size: 0.8rem; }}
  footer {{ margin-top: 3rem; color: #555; font-size: 0.8rem; }}
</style>
</head>
<body>
<h1>&#x1f50d; Discovery Engine</h1>
<p class="subtitle">Personal discovery worlds</p>
<div id="worlds">
<script>
document.getElementById('worlds').innerHTML = '<p>Loading...</p>';
</script>
<noscript><p>JavaScript required for live data.</p></noscript>
</div>
<footer>candy-dispenser &bull; discovery engine</footer>
<script>
var WORLDS_DATA = {worlds_json};
(function() {{
  var data = WORLDS_DATA;
  var el = document.getElementById('worlds');
  if (!data || data.length === 0) {{
    el.innerHTML = '<p>No worlds configured</p>';
    return;
  }}
  el.innerHTML = data.map(function(w) {{
    var statusClass = w.error ? 'status-error' : (w.enabled ? 'status-ok' : 'status-disabled');
    var statusText = w.error ? 'error' : (w.enabled ? 'active' : 'disabled');
    var sources = (w.sources && w.sources.length > 0)
      ? '<div class="sources">' + w.sources.map(function(s) {{ return '<span class="source">' + s + '</span>'; }}).join('') + '</div>'
      : '';
    return '<div class="world">'
      + '<div class="world-name">' + w.name + ' <span class="status ' + statusClass + '">' + statusText + '</span></div>'
      + '<div class="world-desc">' + (w.description || '') + '</div>'
      + '<div class="world-stats">' + (w.sources_active || 0) + '/' + (w.sources_total || 0) + ' sources active</div>'
      + sources
      + '</div>';
  }}).join('');
}})();
</script>
</body>
</html>"""

    def log_message(self, format, *args):
        pass  # Suppress access logs


def _classify_mam_rss_url(url, known_relays):
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
    if host in known_relays:
        return "relay"
    if len(url) >= 80:
        return "direct-with-passkey"
    return "direct-no-passkey"


def start_health_server(state, worlds_dir=None):
    """Start the health endpoint in a background thread."""
    HealthHandler.state_ref = state
    HealthHandler.worlds_dir = worlds_dir
    server = http.server.HTTPServer(("0.0.0.0", HEALTH_PORT), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    log.info(f"health endpoint on :{HEALTH_PORT}")
