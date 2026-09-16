"""Same-origin serving for the Station map UI (product decision #12).

Decision #12 (`docs/PRODUCT-VISION-HANDOFF.md`, round-2 answers) makes the
Station map the product frontend. Serving it from this process — rather
than from a separate static host — is what makes the browser session
work: the ``pw_session`` cookie is same-origin, so every ``fetch`` the
Station makes carries credentials with no CORS exception anywhere, and
the API needs no browser-only token path.

Boundaries this module keeps:

* **Authorization reuses the canonical seam.** Nothing here re-implements
  a credential check: ``api.require_auth`` decides, and this module only
  maps its verdict onto a browser-appropriate response (a redirect to
  ``/login``) instead of a JSON 401.
* **First-run wins.** Before the ``setup-complete`` marker exists, every
  Station path redirects to ``/setup``; a half-built world is never
  presented as a working one.
* **No user-controlled filesystem paths.** The served set is an allowlist
  built once at app start (the same pattern as the SPA dist allowlist in
  ``api.py``): a relative POSIX path → a resolved absolute ``Path``.
  Traversal cannot escape because it simply misses the dict. Newly added
  files are picked up on restart; edited files are re-read per request
  and revalidated by ETag.
* **Only web assets, never documentation.** ``.md`` files are excluded on
  purpose: the design directory carries internal handoff notes that are
  not part of the served UI, and ``_``-prefixed directories (``_legacy/``)
  stay out of the primary navigation.
* **Honest absence.** The packaged container image ships ``src/`` and the
  built SPA dist, not ``design/``. When the Station is not installed the
  route says so plainly (503) and never echoes a filesystem path.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from starlette.responses import Response

_logger = logging.getLogger("personal_world.station_ui")

#: Mount point. The Station's own HTML links relatively
#: (``station.css``, ``interests.html``), so one prefix is enough.
STATION_PREFIX = "/station"

#: Web assets the Station may serve. Anything else (notably ``.md``
#: internal handoff notes) is not part of the UI and is never served.
SERVED_SUFFIXES = frozenset(
    {
        ".html",
        ".css",
        ".js",
        ".mjs",
        ".json",
        ".webmanifest",
        ".svg",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".ico",
        ".woff",
        ".woff2",
        ".txt",
    }
)

#: Explicit types for the text assets that must not be sniffed wrong.
#: Anything unlisted falls through to Starlette's mimetype guess.
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
}

#: Directory segments that are never served (archives, tooling, dotdirs).
SKIPPED_PREFIXES = ("_", ".")


def default_station_dir() -> Path:
    """The in-repo Station, or ``PW_STATION_DIST`` when set.

    The env override exists for deployments that ship the Station
    somewhere other than the source tree; the default is the design
    directory this repo actually maintains.
    """
    override = os.environ.get("PW_STATION_DIST")
    if override:
        return Path(override)
    return (
        Path(__file__).resolve().parents[2]
        / "design"
        / "opendesign-exploration"
        / "station"
    )


def build_allowlist(root: Path) -> dict[str, Path]:
    """Map every servable relative path under ``root`` to its file.

    Built once, eagerly, so a request never turns a user-supplied string
    into a filesystem lookup.
    """
    allowlist: dict[str, Path] = {}
    if not root.is_dir():
        return allowlist
    for candidate in root.rglob("*"):
        if not candidate.is_file():
            continue
        relative = candidate.relative_to(root)
        if any(part.startswith(SKIPPED_PREFIXES) for part in relative.parts):
            continue
        if candidate.suffix.lower() not in SERVED_SUFFIXES:
            continue
        allowlist[relative.as_posix()] = candidate.resolve()
    return allowlist


STATION_NOT_INSTALLED_HTML = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Project Worlds — Station not installed</title></head>
<body>
<main id="main-content">
<h1>The Station is not installed here</h1>
<p>This deployment does not include the Station interface files. The packaged
container image ships the API and the built SPA; the Station lives in the
source tree's design directory.</p>
<p>To serve it, run from a source checkout, or point
<code>PW_STATION_DIST</code> at a directory containing the Station files and
restart.</p>
<p>The API is still available; nothing else is affected.</p>
</main>
</body>
</html>"""

STATION_NOT_FOUND_HTML = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Project Worlds — page not found</title></head>
<body>
<main id="main-content">
<h1>That page is not part of the Station</h1>
<p><a href="/station/">Return to the systems map</a>.</p>
<p>Files added to the Station directory are served after a restart; only web
assets are served, never internal notes.</p>
</main>
</body>
</html>"""


def station_router(data_dir: Path, dist: Path | None = None) -> APIRouter:
    """Build the ``/station`` router.

    ``data_dir`` supplies the first-run marker; ``dist`` overrides the
    Station directory (tests, or a deployment that ships it elsewhere).
    """
    root = (dist or default_station_dir()).resolve()
    allowlist = build_allowlist(root)
    if not allowlist:
        _logger.warning(
            "Station interface not installed (%s); %s will report it "
            "honestly instead of serving",
            root.name or "unset",
            STATION_PREFIX,
        )

    router = APIRouter()
    data_dir = Path(data_dir)

    async def _gate(request: Request) -> Response | None:
        """Answer 'may this browser see the Station?' — or redirect.

        The authorization decision belongs to ``api.require_auth`` (the
        single credential seam: bearer, session, or the opt-in loopback
        dev bypass). This only translates a refusal into a navigation a
        human can follow, because a JSON 401 is not a usable answer to a
        browser that asked for a page.
        """
        from .api import require_auth  # local import: api.py mounts us

        if not (data_dir / "setup-complete").exists():
            return RedirectResponse(url="/setup", status_code=303)
        try:
            await require_auth(request)
        except HTTPException:
            return RedirectResponse(url="/login", status_code=303)
        return None

    def _serve(request: Request, rel: str) -> Response:
        from .api import _cached_file  # canonical static-file revalidation

        path = allowlist.get(rel)
        if path is None or not path.is_file():
            return HTMLResponse(
                STATION_NOT_FOUND_HTML,
                status_code=404,
                headers={"Cache-Control": "no-store"},
            )
        ctype = CONTENT_TYPES.get(path.suffix.lower())
        return _cached_file(request, path, ctype)

    @router.get(STATION_PREFIX, include_in_schema=False)
    async def station_root(request: Request):
        blocked = await _gate(request)
        if blocked is not None:
            return blocked
        if not allowlist:
            return HTMLResponse(
                STATION_NOT_INSTALLED_HTML,
                status_code=503,
                headers={"Cache-Control": "no-store"},
            )
        # A bare /station is the map's front door.
        return RedirectResponse(url=f"{STATION_PREFIX}/", status_code=303)

    @router.get(STATION_PREFIX + "/", include_in_schema=False)
    async def station_index(request: Request):
        blocked = await _gate(request)
        if blocked is not None:
            return blocked
        if not allowlist:
            return HTMLResponse(
                STATION_NOT_INSTALLED_HTML,
                status_code=503,
                headers={"Cache-Control": "no-store"},
            )
        return _serve(request, "index.html")

    @router.get(STATION_PREFIX + "/{full_path:path}", include_in_schema=False)
    async def station_asset(full_path: str, request: Request):
        blocked = await _gate(request)
        if blocked is not None:
            return blocked
        if not allowlist:
            return HTMLResponse(
                STATION_NOT_INSTALLED_HTML,
                status_code=503,
                headers={"Cache-Control": "no-store"},
            )
        return _serve(request, full_path)

    return router
