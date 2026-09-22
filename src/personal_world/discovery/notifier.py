"""Shared notification batching for Phase B/C sources."""

import logging

from personal_world.discovery.dedup import is_seen, mark_seen
from personal_world.discovery.notify import send_ntfy, _header_safe

log = logging.getLogger("candy-dispenser")


def _notify_batch(state, source, candidates, render, ntfy_tags, *, ntfy_config, max_per_poll):
    """Notify at most `max_per_poll` of `candidates`.

    `render` maps a candidate to (dedup_id, title, body, click, attach).
    Every candidate is marked seen -- including the overflow -- so a
    backlog of 400 items drains as "5 notified + 1 summary line" once,
    not 400 pushes over the next 80 poll cycles. The summary line is the
    audit trail for what was skipped.

    Returns (notified_count, skipped_count).
    """
    new = []
    for c in candidates:
        dedup_id = render(c)[0]
        if not dedup_id or is_seen(state, source, dedup_id):
            continue
        new.append(c)

    # PW seam: with no push channel configured, discoveries are CAPTURED
    # into state for the world itself to surface (journal events / Interests
    # view) instead of requiring ntfy. Dedup + per-poll cap semantics are
    # identical; only the delivery differs.
    capture = bool(ntfy_config) and ntfy_config.get("mode") == "capture"

    notified = 0
    for c in new[:max_per_poll]:
        dedup_id, title, body, click, attach = render(c)
        if capture:
            state.setdefault("discovered", []).append(
                {"source": source, "id": dedup_id, "title": title, "url": click}
            )
            notified += 1
            state["notifications_sent"] = state.get("notifications_sent", 0) + 1
        elif send_ntfy(
            title, body, ntfy_config, priority="low", click=click, attach=attach, tags=ntfy_tags
        ):
            notified += 1
            state["notifications_sent"] = state.get("notifications_sent", 0) + 1
        mark_seen(state, source, dedup_id)

    overflow = new[max_per_poll:]
    for c in overflow:
        mark_seen(state, source, render(c)[0])
    if overflow:
        names = ", ".join(_header_safe(render(c)[1], 60) for c in overflow[:10])
        log.info(
            f"{source}: {len(overflow)} further new items suppressed by the "
            f"per-poll cap ({max_per_poll}); marked seen: "
            f"{names}{' ...' if len(overflow) > 10 else ''}"
        )
    return notified, len(overflow)
