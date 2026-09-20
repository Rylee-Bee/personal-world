"""ntfy notification helper for the discovery engine."""

import logging
import unicodedata
import urllib.request

log = logging.getLogger("candy-dispenser")


def _header_safe(text, limit=200):
    """Fold `text` to something safe for an HTTP header value.

    urllib encodes headers as latin-1, so a raw 'í' or an em-dash raises
    UnicodeEncodeError and the whole notification is lost. Normalising to
    NFKD and dropping non-ASCII keeps the title legible ("Reflexos e
    Ruinas") instead of dropping the push.
    """
    if not text:
        return ""
    folded = unicodedata.normalize("NFKD", str(text))
    folded = folded.encode("ascii", "ignore").decode("ascii")
    folded = " ".join(folded.split())  # collapse newlines/tabs
    return folded[:limit]


def send_ntfy(title, message, config, *, priority="default", click=None, attach=None, tags=None):
    """Send a notification to ntfy.

    `click` becomes the notification's tap target (TMDB / Trakt / Bandcamp
    page). `attach` is an image URL rendered inline by the ntfy clients --
    this is how the poster art from the issue spec reaches the phone
    without candy-dispenser having to proxy image bytes.

    Header values are ASCII-sanitised: ntfy rejects a Title header with
    raw non-latin1 bytes, and Phase B/C titles are full of them
    ("Reflexos e Ruínas", "Alice Júnior"). The body keeps the real
    characters -- only the header is folded.

    `config` must have keys: base, topic, token.
    """
    base = config["base"]
    topic = config["topic"]
    token = config.get("token", "")
    url = f"{base}/{topic}"
    headers = {
        "Title": _header_safe(title),
        "Priority": priority,
        "Content-Type": "text/plain",
    }
    if click:
        headers["Click"] = click
    if attach:
        headers["Attach"] = attach
    if tags:
        headers["Tags"] = ",".join(tags) if isinstance(tags, (list, tuple)) else tags
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        req = urllib.request.Request(
            url,
            data=message.encode("utf-8"),
            headers=headers,
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10)
        log.info(f"ntfy sent: {title}")
        return True
    except Exception as e:  # noqa: BLE001 - keep running if this fails
        log.warning(f"ntfy send failed: {e}")
        return False
