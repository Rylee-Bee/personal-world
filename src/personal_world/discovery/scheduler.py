"""Poll scheduling helpers for the discovery engine."""

from datetime import UTC, datetime, timedelta


def should_poll(state, source, interval):
    """Check if enough time has passed since last poll."""
    last = state.get("last_poll", {}).get(source)
    if not last:
        return True
    try:
        last_dt = datetime.fromisoformat(last)
        return datetime.now(UTC) - last_dt >= timedelta(seconds=interval)
    except Exception:  # noqa: BLE001 - keep running if this fails
        return True


def mark_polled(state, source):
    """Record that a source was polled."""
    state["last_poll"][source] = datetime.now(UTC).isoformat()
