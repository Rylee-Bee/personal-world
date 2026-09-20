"""Deduplication helpers for the discovery engine."""

from datetime import UTC, datetime


def is_seen(state, source, item_id):
    """Check if an item has already been surfaced."""
    return item_id in state.get("seen", {}).get(source, {})


def mark_seen(state, source, item_id):
    """Mark an item as seen."""
    if source not in state["seen"]:
        state["seen"][source] = {}
    state["seen"][source][item_id] = datetime.now(UTC).isoformat()
