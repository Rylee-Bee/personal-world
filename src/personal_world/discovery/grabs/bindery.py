"""Bindery grab adapter for MAM auto-grab (Phase A books)."""

import json
import logging
import os
import time
import urllib.parse

from personal_world.discovery.http import http_get, http_post, bindery_headers

log = logging.getLogger("candy-dispenser")

BINDERY_API_KEY = os.environ.get("BINDERY_API_KEY", "")
BINDERY_URL = os.environ.get("BINDERY_URL", "http://bindery:8787")
AUTO_GRAB = os.environ.get("AUTO_GRAB", "true").lower() in ("true", "1", "yes")
MAM_INDEXER_NAME = os.environ.get("MAM_INDEXER_NAME", "MyAnonamouse")
EBOOK_DOWNLOAD_CLIENT_NAME = os.environ.get("EBOOK_DOWNLOAD_CLIENT_NAME", "qBittorrent")
HARDCOVER_TOKEN = os.environ.get("HARDCOVER_TOKEN", "")

# These are populated at startup by the main dispenser or resolve_bindery_ids()
RESOLVED_MAM_INDEXER_ID = None
RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID = None
RESOLVED_INDEXERS_LIST = []
RESOLVED_DOWNLOAD_CLIENTS_LIST = []


def _resolve_ok():
    """True if both ids are resolved. Caller must check before grab."""
    return (
        RESOLVED_MAM_INDEXER_ID is not None
        and RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID is not None
    )


# ---------------------------------------------------------------------------
# Indexer + download-client resolution
# ---------------------------------------------------------------------------


def fetch_bindery_indexers():
    """Return the bindery indexer list (live) or [] on failure.

    Stable identifiers are `name` and `implementation`/`type`. Bindery's
    integer `id` is recycled across delete-and-readd cycles, so callers
    must match by name and resolve to id only at grab time.
    """
    if not BINDERY_API_KEY:
        return []
    status, body = http_get(
        f"{BINDERY_URL}/api/v1/indexer", bindery_headers(), timeout=15
    )
    if status != 200:
        log.warning(f"bindery indexer list failed ({status}): {body[:200]}")
        return []
    try:
        items = json.loads(body)
    except Exception as e:  # noqa: BLE001 - keep running if this fails
        log.warning(f"bindery indexer list parse failed: {e}")
        return []
    return items if isinstance(items, list) else []


def fetch_bindery_download_clients():
    """Return the bindery download-client list (live) or [] on failure."""
    if not BINDERY_API_KEY:
        return []
    status, body = http_get(
        f"{BINDERY_URL}/api/v1/downloadclient", bindery_headers(), timeout=15
    )
    if status != 200:
        log.warning(f"bindery downloadclient list failed ({status}): {body[:200]}")
        return []
    try:
        items = json.loads(body)
    except Exception as e:  # noqa: BLE001 - keep running if this fails
        log.warning(f"bindery downloadclient list parse failed: {e}")
        return []
    return items if isinstance(items, list) else []


def resolve_bindery_ids():
    """Populate RESOLVED_MAM_INDEXER_ID and RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID.

    Called at startup and refreshed periodically. Returns True if both
    resolved successfully.

    Selection rules (deliberate, lives next to the lookup):
    - MAM indexer: name match wins (e.g. "MyAnonamouse"). Fall back to
      implementation/type match (`torznab`) AND name contains "mouse" (the
      MAM Cardigann identifier). Refuses to match anything that is not a
      torrent (type=="newznab").
    - Ebook download client: name match wins. Then type=='qbittorrent'
      AND enabled. A usenet (sabnzbd / nzbget) client is NEVER picked even
      if name matches -- this is the lock that prevents the
      "epub landing in SABnzbd" failure mode.
    """
    global RESOLVED_MAM_INDEXER_ID, RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID
    global RESOLVED_INDEXERS_LIST, RESOLVED_DOWNLOAD_CLIENTS_LIST

    RESOLVED_INDEXERS_LIST = fetch_bindery_indexers()
    RESOLVED_DOWNLOAD_CLIENTS_LIST = fetch_bindery_download_clients()

    RESOLVED_MAM_INDEXER_ID = None
    RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID = None

    # MAM indexer: name match first, then implementation+keyword fallback.
    for ix in RESOLVED_INDEXERS_LIST:
        if not ix.get("enabled"):
            continue
        if ix.get("name", "").lower() == MAM_INDEXER_NAME.lower():
            RESOLVED_MAM_INDEXER_ID = ix.get("id")
            log.info(
                f"resolved MAM indexer: name={ix.get('name')!r} "
                f"id={RESOLVED_MAM_INDEXER_ID} "
                f"type={ix.get('type')!r}"
            )
            break
    if RESOLVED_MAM_INDEXER_ID is None:
        for ix in RESOLVED_INDEXERS_LIST:
            if not ix.get("enabled"):
                continue
            ix_type = (ix.get("type") or ix.get("implementation") or "").lower()
            ix_name = (ix.get("name") or "").lower()
            if ix_type == "torznab" and "mouse" in ix_name:
                RESOLVED_MAM_INDEXER_ID = ix.get("id")
                log.info(
                    f"resolved MAM indexer (fallback): "
                    f"name={ix.get('name')!r} id={RESOLVED_MAM_INDEXER_ID}"
                )
                break
    if RESOLVED_MAM_INDEXER_ID is None:
        names = [i.get("name") for i in RESOLVED_INDEXERS_LIST]
        log.warning(
            f"could not resolve MAM indexer "
            f"(looking for name={MAM_INDEXER_NAME!r}; "
            f"available={names}); will not auto-grab"
        )

    # Ebook download client: name match preferred, then type==qbittorrent.
    # Always exclude usenet clients (sabnzbd / nzbget) regardless of name.
    USENET_TYPES = {"sabnzbd", "nzbget"}
    for dc in RESOLVED_DOWNLOAD_CLIENTS_LIST:
        if not dc.get("enabled"):
            continue
        if (dc.get("type") or "").lower() in USENET_TYPES:
            continue
        if dc.get("name", "").lower() == EBOOK_DOWNLOAD_CLIENT_NAME.lower():
            RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID = dc.get("id")
            log.info(
                f"resolved ebook download client: name={dc.get('name')!r} "
                f"id={RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID} "
                f"type={dc.get('type')!r}"
            )
            break
    if RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID is None:
        for dc in RESOLVED_DOWNLOAD_CLIENTS_LIST:
            if not dc.get("enabled"):
                continue
            if (dc.get("type") or "").lower() in USENET_TYPES:
                continue
            if (dc.get("type") or "").lower() == "qbittorrent":
                RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID = dc.get("id")
                log.info(
                    f"resolved ebook download client (fallback): "
                    f"name={dc.get('name')!r} id={RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID}"
                )
                break
    if RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID is None:
        names = [d.get("name") for d in RESOLVED_DOWNLOAD_CLIENTS_LIST]
        log.warning(
            f"could not resolve ebook download client "
            f"(looking for name={EBOOK_DOWNLOAD_CLIENT_NAME!r}, "
            f"excluded usenet; available={names})"
        )

    return (
        RESOLVED_MAM_INDEXER_ID is not None
        and RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID is not None
    )


# ---------------------------------------------------------------------------
# Author lookup helpers
# ---------------------------------------------------------------------------


def check_bindery_for_author(author_name):
    """Check if an author is already in bindery's library."""
    if not BINDERY_API_KEY:
        return False
    # /api/v1/author?q= is the singular list endpoint; /authors 404s.
    # The q param is a server-side hint (not always strict); we
    # post-filter by case-insensitive name match.
    url = f"{BINDERY_URL}/api/v1/author?q={urllib.parse.quote(author_name)}"
    status, body = http_get(url, bindery_headers(), timeout=10)
    if status != 200:
        return False
    try:
        data = json.loads(body)
    except Exception:  # noqa: BLE001 - keep running if this fails
        return False
    items = data.get("items", data) if isinstance(data, dict) else data
    if not isinstance(items, list) or not items:
        return False
    target = author_name.lower()
    for a in items:
        name = (a.get("authorName") or a.get("sortName") or "").lower()
        if target in name or name in target:
            return True
    return False


def search_openlibrary_author(author_name):
    """Search OpenLibrary for an author key. Returns (ol_key, name) or (None, None)."""
    url = f"https://openlibrary.org/search/authors.json?q={urllib.parse.quote(author_name)}"
    status, body = http_get(url, timeout=15)
    if status != 200:
        return None, None
    try:
        data = json.loads(body)
        docs = data.get("docs", [])
        if docs:
            return docs[0].get("key"), docs[0].get("name", author_name)
    except Exception:  # noqa: BLE001, S110 - keep running if this fails
        pass
    return None, None


def search_hardcover_author(author_name):
    """Search Hardcover for an author. Returns ('hc:<id>', name) or (None, None).

    Uses Hardcover's GraphQL authors endpoint. Requires HARDCOVER_TOKEN.
    Returns the prefixed foreignAuthorId form ('hc:<numeric_id>') that
    bindery expects, so the result is drop-in for search_openlibrary_author.
    """
    if not HARDCOVER_TOKEN:
        return None, None
    query = json.dumps(
        {
            "query": (
                "query($name: String!) {"
                " authors(where: {name: {_ilike: $name}}, limit: 1) {"
                "   id name"
                " }"
                "}"
            ),
            "variables": {"name": f"%{author_name}%"},
        }
    )
    headers = {"Content-Type": "application/json"}
    if HARDCOVER_TOKEN.startswith("Bearer "):
        headers["Authorization"] = HARDCOVER_TOKEN
    else:
        headers["Authorization"] = f"Bearer {HARDCOVER_TOKEN}"
    status, body = http_post(
        "https://api.hardcover.app/v1/graphql", query, headers, timeout=15
    )
    if status != 200:
        return None, None
    try:
        data = json.loads(body)
        authors = data.get("data", {}).get("authors", [])
        if authors:
            return f"hc:{authors[0]['id']}", authors[0].get("name", author_name)
    except Exception:  # noqa: BLE001, S110 - keep running if this fails
        pass
    return None, None


def lookup_author_foreign_id(author_name):
    """Resolve a bindery foreignAuthorId for `author_name`.

    Tries OpenLibrary first (the canonical source bindery documents); falls
    back to Hardcover (the secondary metadata source bindery supports);
    returns (None, None) on no-match. Bindery's POST /api/v1/author
    requires a non-empty foreignAuthorId -- so callers must treat None as
    "skip the author" rather than POSTing with empty.
    """
    ol_key, _ol_name = search_openlibrary_author(author_name)
    if ol_key:
        log.info(f"foreignAuthorId from OpenLibrary: {ol_key}")
        return ol_key, author_name
    hc_key, _hc_name = search_hardcover_author(author_name)
    if hc_key:
        log.info(f"foreignAuthorId from Hardcover: {hc_key}")
        return hc_key, author_name
    return None, None


def add_author_to_bindery(author_name, foreign_id=None):
    """Add an author to bindery with monitor_mode=none (no back-catalogue flood).

    `foreign_id` is the unprefixed or prefixed foreignAuthorId accepted
    by bindery (forms: OLxxxA, hc:<id>, dnb:<id>). When omitted, the
    function looks up via lookup_author_foreign_id() (OpenLibrary, then
    Hardcover). Returns the author dict with id, or None on failure.
    """
    if not BINDERY_API_KEY:
        return None

    if not foreign_id:
        # Resolve via OL/Hardcover. Use a local variable so the caller's
        # `author_name` is preserved on miss (otherwise None would
        # propagate and the warning below would log 'for None').
        resolved_id, _resolved_name = lookup_author_foreign_id(author_name)
        if not resolved_id:
            log.warning(
                f"could not resolve any foreignAuthorId for {author_name!r} "
                "(OpenLibrary + Hardcover both empty); bindery rejects authors "
                "without a foreign id, so we skip"
            )
            return None
        foreign_id = resolved_id

    # Apply prefix if missing. Accepts raw OpenLibrary work keys (which
    # already start with 'OL'), 'hc:<id>' and 'dnb:<id>' already prefixed.
    if not foreign_id.startswith(("OL", "hc:", "dnb:")):
        foreign_id = f"OL{foreign_id}"

    headers = {
        "X-Api-Key": BINDERY_API_KEY,
        "Content-Type": "application/json",
        "X-Requested-With": "bindery-ui",
    }
    payload = json.dumps(
        {
            "foreignAuthorId": foreign_id,
            "authorName": author_name,
            "monitored": True,
            "monitorMode": "none",  # prevent back-catalogue flood (bindery v1.32 fix)
        }
    )
    url = f"{BINDERY_URL}/api/v1/author"
    status, body = http_post(url, payload, headers, timeout=15)
    if status in (200, 201):
        try:
            return json.loads(body)
        except Exception:  # noqa: BLE001, S110 - keep running if this fails
            pass
    if status == 409:
        # Author already exists (duplicate add). The 409 response body
        # contains the canonical author record -- extract and return it.
        try:
            data = json.loads(body)
            canonical = data.get("canonicalAuthor", data)
            log.info(f"author already in bindery (id={canonical.get('id')}), reusing")
            return canonical
        except Exception:  # noqa: BLE001, S110 - keep running if this fails
            pass
    log.warning(f"bindery author add failed ({status}): {body[:200]}")
    return None


def search_bindery_for_book(author_name, book_title):
    """Search bindery for a book by author + title. Returns book dict or None.

    Uses the author search endpoint to find the author, then fetches their
    books and matches by title. More reliable than the book search endpoint
    which requires exact query parameter formatting.
    """
    if not BINDERY_API_KEY:
        return None
    # Search for the author first
    url = f"{BINDERY_URL}/api/v1/author?q={urllib.parse.quote(author_name)}"
    status, body = http_get(url, bindery_headers(), timeout=10)
    if status != 200:
        return None
    try:
        data = json.loads(body)
        # Author search returns {"items": [...]} or a plain list.
        # Note: the q parameter does not always filter server-side,
        # so we must search the results for a name match.
        authors = data.get("items", data) if isinstance(data, dict) else data
        if not isinstance(authors, list) or not authors:
            return None
        # Find the author by name match (case-insensitive)
        author_id = None
        author_lower = author_name.lower()
        for a in authors:
            name = a.get("authorName", "").lower()
            if author_lower in name or name in author_lower:
                author_id = a.get("id")
                break
        if not author_id:
            # Fall back to exact match on sortName
            for a in authors:
                name = a.get("sortName", "").lower()
                if author_lower in name:
                    author_id = a.get("id")
                    break
        if not author_id:
            return None
    except Exception:  # noqa: BLE001 - keep running if this fails
        return None

    # Fetch author's books and match by title
    url = f"{BINDERY_URL}/api/v1/author/{author_id}"
    status, body = http_get(url, bindery_headers(), timeout=10)
    if status != 200:
        return None
    try:
        data = json.loads(body)
        books = data.get("books", [])
        title_lower = book_title.lower()
        for book in books:
            b_title = book.get("title", "").lower()
            # Match if titles overlap (handles subtitle differences)
            if title_lower in b_title or b_title in title_lower:
                return book
            # Also try matching on the first part before a colon
            b_main = b_title.split(":")[0].strip()
            t_main = title_lower.split(":")[0].strip()
            if t_main and t_main == b_main:
                return book
    except Exception:  # noqa: BLE001, S110 - keep running if this fails
        pass
    return None


def grab_book_via_bindery(book_id, release):
    """Send a release to bindery for download. Returns True on success.

    The indexerId and downloadClientId come from bindery's live id
    resolution; this function refuses to grab if either is unresolved
    OR if the release does not come from the MAM indexer.
    """
    if not BINDERY_API_KEY:
        return False
    if not _resolve_ok():
        log.warning(
            f"grab skipped: bindery ids unresolved "
            f"(indexer={RESOLVED_MAM_INDEXER_ID}, "
            f"client={RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID})"
        )
        return False
    release_indexer = release.get("indexerId")
    release_indexer_name = (release.get("indexerName") or "").lower()  # noqa: F841 — diagnostic, checked elsewhere
    release_protocol = (release.get("protocol") or "").lower()
    if release_indexer is not None and release_indexer != RESOLVED_MAM_INDEXER_ID:
        log.warning(
            f"grab refused: release indexerId={release_indexer} "
            f"!= MAM ({RESOLVED_MAM_INDEXER_ID}); would have routed "
            f"to the wrong client"
        )
        return False
    if release_protocol and release_protocol not in ("torrent", "torznab"):
        log.warning(
            f"grab refused: protocol={release_protocol!r} is not torrent; "
            "ebook pipeline is torrent-only"
        )
        return False

    headers = {
        "X-Api-Key": BINDERY_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = json.dumps(
        {
            "guid": release.get("guid", ""),
            "nzbUrl": release.get("nzbUrl", ""),
            "indexerId": RESOLVED_MAM_INDEXER_ID,
            "bookId": book_id,
            "title": release.get("title", ""),
            "downloadClientId": RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID,
            "size": release.get("size", 0),
            "protocol": "torrent",
        }
    )
    url = f"{BINDERY_URL}/api/v1/queue/grab"
    status, body = http_post(url, payload, headers, timeout=15)
    if status in (200, 202):
        log.info(
            f"bindery grab accepted for bookId={book_id} "
            f"(indexerId={RESOLVED_MAM_INDEXER_ID}, "
            f"clientId={RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID})"
        )
        return True
    log.warning(f"bindery grab failed ({status}): {body[:300]}")
    return False


def auto_grab_mam_item(item):
    """Try to auto-grab a MAM RSS item via bindery.

    Flow: extract author from item -> ensure author in bindery -> find
    book -> search indexers -> grab the MAM-originated release.
    Returns True if grabbed. False on any soft-failure path; callers log
    but do not retry (state["seen"] covers dedup already).
    """
    if not AUTO_GRAB or not BINDERY_API_KEY:
        return False
    if not _resolve_ok():
        log.warning("auto-grab skipped: bindery ids not resolved yet")
        return False

    # Import here to avoid circular dependency; parse_author_from_rss_item
    # lives in sources.mam_rss but is called during MAM poll flow
    from personal_world.discovery.sources.mam_rss import parse_author_from_rss_item

    title = item.get("title", "")
    author, book_title = parse_author_from_rss_item(item)
    if not author:
        log.info(f"auto-grab: could not extract author from item: {title[:60]!r}")
        return False

    log.info(f"auto-grab: author={author!r}, title={book_title[:60]!r}")

    # Ensure author exists in bindery. With backoff -- bindery's async
    # catalogue fetch can take longer than a single 5s sleep on a cold
    # path (OpenLibrary network latency + DNB enrichment). Up to 3
    # attempts spaced ~6s.
    if not check_bindery_for_author(author):
        log.info(f"auto-grab: adding author {author!r} to bindery")
        added = add_author_to_bindery(author)
        if not added:
            log.info(
                f"auto-grab: could not add author {author!r} "
                "(no foreignAuthorId resolvable)"
            )
            return False
        for attempt in range(3):
            time.sleep(6 + attempt * 3)  # 6, 9, 12 seconds
            if check_bindery_for_author(author):
                log.info(
                    f"auto-grab: author visible after {(6 + attempt * 3)}s "
                    f"(attempt {attempt + 1})"
                )
                break
        else:
            log.info(
                f"auto-grab: author {author!r} still not visible in bindery "
                "after 27s; skipping this item (will be retried next poll)"
            )
            return False

    # Search bindery for the book
    book = search_bindery_for_book(author, book_title)
    if not book:
        log.info(f"auto-grab: book not found in bindery yet: {book_title[:60]!r}")
        return False

    book_id = book.get("id")
    if not book_id:
        return False

    # Skip if already imported
    if book.get("status") == "imported":
        log.info(f"auto-grab: already imported: {book_title[:60]!r}")
        return False

    # Trigger bindery indexer search
    headers = bindery_headers()
    headers["Content-Type"] = "application/json"
    url = f"{BINDERY_URL}/api/v1/book/{book_id}/search"
    status, body = http_post(url, "{}", headers, timeout=45)
    if status != 200:
        log.info(f"auto-grab: bindery search failed ({status}): {body[:200]}")
        return False

    try:
        results = json.loads(body)
        releases = results.get("results", [])
    except Exception:  # noqa: BLE001 - keep running if this fails
        releases = []

    if not releases:
        log.info(f"auto-grab: no releases for: {book_title[:60]!r}")
        return False

    # Selection: prefer MAM-originated release, English, smallest size.
    # Refuses to fall back to NZBGeek or any non-torrent release -- that
    # was the "epub in SABnzbd" failure mode.
    mam_candidates = [
        r for r in releases if r.get("indexerId") == RESOLVED_MAM_INDEXER_ID
    ]
    if not mam_candidates:
        log.info(
            f"auto-grab: no MAM-originated release for "
            f"{book_title[:60]!r} (had {len(releases)} from "
            "other indexers); refusing to grab from a non-torrent source"
        )
        return False

    title_lower_fn = lambda r: (r.get("title") or "").lower()
    english_mam = [
        r
        for r in mam_candidates
        if "eng" in title_lower_fn(r)
        and "fre/" not in title_lower_fn(r)
        and "pol/" not in title_lower_fn(r)
        and "spa/" not in title_lower_fn(r)
    ]
    pool = english_mam or mam_candidates
    pool.sort(key=lambda r: r.get("size") or 0)
    best = pool[0]

    # Force protocol=torrent on what we hand bindery; _resolve_ok() also
    # blocks non-torrent calls downstream, but defense in depth.
    best = dict(best)
    best["protocol"] = "torrent"
    if "indexerName" not in best:
        for ix in RESOLVED_INDEXERS_LIST:
            if ix.get("id") == RESOLVED_MAM_INDEXER_ID:
                best["indexerName"] = ix.get("name", "")
                break

    grabbed = grab_book_via_bindery(book_id, best)
    return grabbed


class BinderyGrabAdapter:
    """Bindery grab adapter for MAM auto-grab (Phase A books)."""

    def grab(self, item, config):
        """Grab a MAM item via bindery. Config keys: bindery_url, bindery_api_key, auto_grab."""
        # This is a thin wrapper; the real work is in auto_grab_mam_item()
        # which uses the module-level globals. Config override not yet wired.
        return auto_grab_mam_item(item)
