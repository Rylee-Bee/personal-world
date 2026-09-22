"""State management for the discovery engine."""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path

log = logging.getLogger("candy-dispenser")


def load_state(state_file: Path):
    """Load persisted state (seen items, last poll times)."""
    if state_file.exists():
        try:
            return json.loads(state_file.read_text())
        except Exception as e:  # noqa: BLE001 - keep running if this fails
            log.warning(f"state load failed: {e}, starting fresh")
    return {
        "seen": {},  # source -> {item_id: first_seen_iso}
        "last_poll": {},  # source -> iso timestamp
        "notifications_sent": 0,
        "errors": 0,
        "started_at": datetime.now(UTC).isoformat(),
        "author_suggestions_pending": [],  # queued for the next 24h digest
    }


def save_state(state, state_file: Path):
    """Persist state to disk."""
    state_file.parent.mkdir(parents=True, exist_ok=True)
    tmp = state_file.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2))
    tmp.replace(state_file)
