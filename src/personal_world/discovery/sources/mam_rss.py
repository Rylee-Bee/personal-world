"""MAM RSS + Hardcover source adapters."""

import json
import logging
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import UTC, datetime, timedelta

from personal_world.discovery.dedup import is_seen, mark_seen
from personal_world.discovery.http import http_get, http_post, bindery_headers
from personal_world.discovery.notify import send_ntfy, _header_safe
from personal_world.discovery.scheduler import should_poll, mark_polled

log = logging.getLogger("candy-dispenser")

MAM_RSS_URL = os.environ.get("MAM_RSS_FEED_URL", "")
MAM_POLL_INTERVAL = int(os.environ.get("MAM_POLL_INTERVAL", "14400"))  # 4h
HARDCOVER_TOKEN = os.environ.get("HARDCOVER_TOKEN", "")
HARDCOVER_POLL_INTERVAL = int(os.environ.get("HARDCOVER_POLL_INTERVAL", "604800"))  # 7d
AUTO_GRAB = os.environ.get("AUTO_GRAB", "true").lower() in ("true", "1", "yes")
BINDERY_API_KEY = os.environ.get("BINDERY_API_KEY", "")
BINDERY_URL = os.environ.get("BINDERY_URL", "http://bindery:8787")
MAM_INDEXER_NAME = os.environ.get("MAM_INDEXER_NAME", "MyAnonamouse")
EBOOK_DOWNLOAD_CLIENT_NAME = os.environ.get("EBOOK_DOWNLOAD_CLIENT_NAME", "qBittorrent")

# These are populated at startup by the main dispenser / grabs.bindery
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
# MAM RSS parse + poll
# ---------------------------------------------------------------------------


def parse_mam_rss(xml_text):
    """Parse MAM RSS feed, return list of items with metadata."""
    items = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        log.error(f"MAM RSS parse error: {e}")
        return items

    for item in root.iter("item"):
        title = item.findtext("title", "")
        link = item.findtext("link", "")
        guid = item.findtext("guid", "") or link
        desc = item.findtext("description", "")
        pub_date = item.findtext("pubDate", "")
        author = item.findtext("author", "") or item.findtext(
            "{http://purl.org/dc/elements/1.1/}creator", ""
        )

        # MAM RSS includes category tags
        categories = [c.text for c in item.findall("category") if c.text]

        # Check for LGBTQ+ indicators in title, description, categories
        text_blob = f"{title} {desc} {' '.join(categories)}".lower()
        # Focus: transgender, transfeminine, and lesbian content.
        # Intentionally narrower than generic LGBTQ+ - the goal is
        # content that resonates with Rylee's specific interests,
        # not every queer-adjacent keyword.
        lgbtq_keywords = [
            "transgender",
            "trans woman",
            "trans women",
            "trans man",
            "trans men",
            "transfem",
            "trans femme",
            "transfeminine",
            "trans feminine",
            "trans girl",
            "trans boy",
            "transsexual",
            "mtf",
            "ftm",
            "nonbinary trans",
            "non-binary trans",
            "lesbian",
            "sapphic",
            "wlw",
            "women loving women",
            "dyke",
            "butch",
            "femme4femme",
            "femme 4 femme",
            "trans lesbian",
            "trans sapphic",
            "trans wlw",
            "trans romance",
            "trans protagonist",
            "trans fiction",
            "trans memoir",
            "trans story",
        ]
        is_queer = any(kw in text_blob for kw in lgbtq_keywords)

        # Extract torrent link from enclosure
        enclosure = item.find("enclosure")
        torrent_url = enclosure.get("url", "") if enclosure is not None else ""

        items.append(
            {
                # Use guid when available so dedup survives URL changes.
                "id": guid or link or title,
                "title": title,
                "link": link,
                "guid": guid,
                "author": author.strip() if author else "",
                "description": desc[:300] if desc else "",
                "categories": categories,
                "pub_date": pub_date,
                "torrent_url": torrent_url,
                "is_queer": is_queer,
                "queer_matches": [kw for kw in lgbtq_keywords if kw in text_blob],
            }
        )

    return items


def parse_author_from_rss_item(item):
    """Best-effort author extraction for a MAM RSS item.

    Priority order (deliberate, lives next to the parser):
    1. <author> / <dc:creator> child of the item -- canonical, when present.
    2. "Author(s): NAME" header inside the description block -- the relay
       format from 063qb.mrd.ninja puts it there for every item.
    3. Fall back to title heuristics (" By ", " by ", " - ").

    Returns (author, book_title) where book_title has format tags stripped.
    Returns ("", original_title) on no-match.
    """
    title = item.get("title", "") or ""
    desc = item.get("description", "") or ""

    author = ""

    # 1. <author> child already on the parsed item if parse_mam_rss
    #    surfaces it; otherwise empty.
    author = (item.get("author") or "").strip()

    # 2. Description "Author(s): X" (relay format, confirmed 2026-08-22).
    if not author and desc:
        m = re.search(
            r"Author\(s\)\s*:\s*([^<\r\n]+?)(?:\s*<|\s*$|\s*Narrator)",
            desc,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if m:
            author = m.group(1).strip()
            # If multiple authors joined by " & ", take the first.
            if "&" in author:
                author = author.split("&", 1)[0].strip()
            if "," in author and ";" not in author:
                # "Smith, Jane" -> "Jane Smith"
                parts = [p.strip() for p in author.split(",", 1)]
                if len(parts) == 2 and parts[1]:
                    author = f"{parts[1]} {parts[0]}"

    # 3. Title heuristic last.
    book_title = title
    if not author:
        if " By " in title:
            parts = title.split(" By ", 1)
            book_title = parts[0].strip()
            author = parts[1].strip()
        elif " by " in title:
            parts = title.split(" by ", 1)
            book_title = parts[0].strip()
            author = parts[1].strip()
        elif " - " in title:
            parts = title.split(" - ", 1)
            author = parts[0].strip()
            book_title = parts[1].strip()

    # Strip format tags like [EPUB] [MOBI] etc from book title
    book_title = re.sub(r"\[.*?\]", "", book_title).strip()
    book_title = re.sub(
        r"\.(epub|mobi|azw3|pdf)$",
        "",
        book_title,
        flags=re.IGNORECASE,
    ).strip()

    # Clean stray characters off author.
    author = author.strip(" ,;:-")
    if author.endswith(","):
        author = author[:-1].strip()
    if author.lower().startswith("by "):
        author = author[3:].strip()

    if not author:
        return "", book_title

    return author, book_title


def send_diag_ntfy(state, ntfy_config):
    """Send a periodic diagnostic ntfy aggregating grab/error state.

    Sent at most once per 24h. Operator-facing summary: how many grabs
    fired, how many were skipped (parse fail, missing MAM release, wrong
    indexer). Keeps low-traffic observability without per-item pings.
    """
    last = state.get("last_diag_ntfy_at")
    if last:
        try:
            last_dt = datetime.fromisoformat(last)
            if datetime.now(UTC) - last_dt < timedelta(hours=24):
                return
        except Exception:  # noqa: BLE001, S110 - keep running if this fails
            pass
    authors = state.get("author_suggestions_pending", [])
    lines = [
        "candy-dispenser 24h digest:",
        f"  grabs accepted : {state.get('grabs_accepted', 0)}",
        f"  grabs refused  : {state.get('grabs_refused', 0)}",
        f"  parse-skips    : {state.get('parse_skip', 0)}",
        f"  errors         : {state.get('errors', 0)}",
        f"  MAM indexer    : id={RESOLVED_MAM_INDEXER_ID} name={MAM_INDEXER_NAME!r}",
        f"  ebook client   : id={RESOLVED_EBOOK_DOWNLOAD_CLIENT_ID} name={EBOOK_DOWNLOAD_CLIENT_NAME!r}",
        f"  resolve ok     : {_resolve_ok()}",
    ]
    if authors:
        lines.append(f"  new authors    : {len(authors)}")
        lines.extend(f"    - {a}" for a in authors[:5])
        if len(authors) > 5:
            lines.append(f"    ...and {len(authors) - 5} more")
    body = "\n".join(lines)
    if send_ntfy("Candy diags (24h)", body, ntfy_config, priority="low"):
        state["last_diag_ntfy_at"] = datetime.now(UTC).isoformat()
        state["author_suggestions_pending"] = []


class MAMRSSSource:
    """MAM RSS feed poller."""

    name = "mam_rss"
    enabled = bool(MAM_RSS_URL)
    interval = MAM_POLL_INTERVAL

    def __init__(self, *, ntfy_config, ntfy_max_per_poll):
        self._ntfy_config = ntfy_config
        self._ntfy_max_per_poll = ntfy_max_per_poll

    def poll(self, state):
        """Poll MAM RSS feed for new queer content. Auto-grab happy path;
        ntfy fires only as an aggregated 24h diagnostic."""
        if not MAM_RSS_URL:
            log.warning("MAM_RSS_FEED_URL not set, skipping MAM RSS")
            return

        if not should_poll(state, "mam_rss", MAM_POLL_INTERVAL):
            return

        log.info("polling MAM RSS feed...")
        status, body = http_get(MAM_RSS_URL, timeout=30)

        if status != 200:
            log.warning(f"MAM RSS fetch failed: HTTP {status}")
            state["errors"] = state.get("errors", 0) + 1
            mark_polled(state, "mam_rss")
            return

        items = parse_mam_rss(body)
        queer_items = [i for i in items if i["is_queer"]]
        new_items = [i for i in queer_items if not is_seen(state, "mam_rss", i["id"])]

        log.info(
            f"MAM RSS: {len(items)} total, {len(queer_items)} queer, {len(new_items)} new"
        )

        for item in new_items[:3]:  # cap per-poll to keep MAM rep gentle
            title = item.get("title", "")
            book_title_short = title[:60]

            grabbed = False
            if AUTO_GRAB:
                try:
                    from personal_world.discovery.grabs.bindery import auto_grab_mam_item
                    grabbed = auto_grab_mam_item(item)
                except Exception as e:  # noqa: BLE001 - keep running if this fails
                    log.error(f"auto-grab exception for {book_title_short!r}: {e}")

            if grabbed:
                state["grabs_accepted"] = state.get("grabs_accepted", 0) + 1
            else:
                state["grabs_refused"] = state.get("grabs_refused", 0) + 1

            # Mark seen unconditionally so we don't churn the same item
            mark_seen(state, "mam_rss", item["id"])
            state["notifications_sent"] = state.get("notifications_sent", 0)

        send_diag_ntfy(state, self._ntfy_config)

        mark_polled(state, "mam_rss")

    def render(self, item):
        """MAM items don't use the batch notification path."""
        raise NotImplementedError("MAM RSS uses its own notification path")


# ---------------------------------------------------------------------------
# Hardcover source (lives in same file per spec)
# ---------------------------------------------------------------------------


def query_hardcover_authors():
    """Query Hardcover GraphQL for LGBTQ+ authors.

    Returns list of {id, name, books_count, is_lgbtq, is_bipoc}.
    """
    if not HARDCOVER_TOKEN:
        log.warning("HARDCOVER_TOKEN not set, skipping Hardcover")
        return []

    query = """
    query {
      authors(
        where: {is_lgbtq: {_eq: true}}
        order_by: {books_count: desc}
        limit: 50
      ) {
        id
        name
        books_count
        is_lgbtq
        is_bipoc
      }
    }
    """

    url = "https://api.hardcover.app/v1/graphql"
    headers = {
        "Content-Type": "application/json",
    }
    if HARDCOVER_TOKEN:
        if HARDCOVER_TOKEN.startswith("Bearer "):
            headers["Authorization"] = HARDCOVER_TOKEN
        else:
            headers["Authorization"] = f"Bearer {HARDCOVER_TOKEN}"

    status, body = http_post(url, json.dumps({"query": query}), headers, timeout=20)

    if status != 200:
        log.warning(f"Hardcover query failed: HTTP {status}: {body[:200]}")
        return []

    try:
        data = json.loads(body)
        authors = data.get("data", {}).get("authors", [])
        log.info(f"Hardcover: {len(authors)} LGBTQ+ authors found")
        return authors
    except Exception as e:  # noqa: BLE001 - keep running if this fails
        log.warning(f"Hardcover parse error: {e}")
        return []


class HardcoverSource:
    """Hardcover LGBTQ+ author discovery poller."""

    name = "hardcover"
    enabled = bool(HARDCOVER_TOKEN)
    interval = HARDCOVER_POLL_INTERVAL

    def poll(self, state):
        """Poll Hardcover for new LGBTQ+ authors not yet in bindery."""
        if not HARDCOVER_TOKEN:
            return

        if not should_poll(state, "hardcover", HARDCOVER_POLL_INTERVAL):
            return

        log.info("polling Hardcover for LGBTQ+ authors...")
        authors = query_hardcover_authors()

        new_authors = []
        for author in authors:
            aid = str(author.get("id", ""))
            name = author.get("name", "")
            if not name:
                continue
            if is_seen(state, "hardcover", aid):
                continue
            # Check if already in bindery
            from personal_world.discovery.grabs.bindery import check_bindery_for_author
            in_bindery = check_bindery_for_author(name)
            if not in_bindery:
                new_authors.append(author)
                mark_seen(state, "hardcover", aid)

        log.info(f"Hardcover: {len(new_authors)} new LGBTQ+ authors not in bindery")

        # Queue top 1-2 new authors for the next 24h digest instead of an
        # immediate push -- "new author found" is a nice-to-know, not urgent.
        for author in new_authors[:2]:
            name = author.get("name", "")
            count = author.get("books_count", 0)
            bipoc = author.get("is_bipoc", False)
            line = (
                f"New author: {name} ({count} books on Hardcover"
                f"{', also BIPOC' if bipoc else ''}, not yet in library)"
            )
            state["author_suggestions_pending"].append(line)

        mark_polled(state, "hardcover")

    def render(self, item):
        """Hardcover items don't use the batch notification path."""
        raise NotImplementedError("Hardcover uses its own notification path")
