"""Project Worlds seam: per-world discovery runs, no module globals.

The legacy loop (engine.run_once) was built for the standalone container:
it reads module-level config set from environment variables by
dispenser.py, so two worlds cannot safely share one process. This seam is
what Project Worlds consumes — pass a loaded world dict + a state path,
and everything flows from that world's own config.

Contracts preserved from the original engine (do not weaken):
- dedup against state; overflow marked seen with a logged summary
- per-poll notification cap
- one failing source never blocks the others
- state is disposable: corrupt/missing starts fresh and re-discovers
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from .sources import SOURCE_TYPES
from .state import load_state, save_state

log = logging.getLogger("personal-world.discovery")


def run_world(
    world: dict[str, Any],
    state_path: Path,
    *,
    only: set[str] | None = None,
    force: bool = False,
    source_types: dict | None = None,
) -> dict[str, Any]:
    """Poll every enabled source of ONE world, isolated from all others.

    Returns a summary: {"world", "ran", "discovered", "errors"}.
    With no notify endpoint configured, discoveries are captured into
    state (see notifier capture mode) for the world to surface natively.
    """
    registry = source_types if source_types is not None else SOURCE_TYPES
    state = load_state(Path(state_path))
    captured_before = len(state.get("discovered", []))
    notify_cfg = world.get("notify") or {}
    max_per_poll = int(notify_cfg.get("max_per_poll", 5) or 5)
    if notify_cfg.get("endpoint"):
        ntfy_config = {
            "base": notify_cfg["endpoint"],
            "topic": notify_cfg.get("topic", ""),
            "token": notify_cfg.get("token", ""),
        }
    else:
        ntfy_config = {"mode": "capture"}

    ran: list[str] = []
    for name, scfg in (world.get("sources") or {}).items():
        if only and name not in only:
            continue
        if not scfg.get("enabled", True):
            continue
        cls = registry.get(scfg.get("type"))
        if cls is None:
            raise KeyError(
                f"world {world.get('name')!r}: source {name!r} has unknown "
                f"type {scfg.get('type')!r}; registered types: {sorted(registry)}"
            )
        adapter = cls(
            ntfy_config=ntfy_config,
            ntfy_max_per_poll=max_per_poll,
            config=scfg,
        )
        if force:
            state.setdefault("last_poll", {}).clear()
        try:
            adapter.poll(state)
            ran.append(name)
        except Exception as exc:  # noqa: BLE001 — one bad source must not stop the world
            log.warning("world %s: source %s failed: %s", world.get("name"), name, exc)
            state["errors"] = state.get("errors", 0) + 1

    save_state(state, Path(state_path))
    new_items = state.get("discovered", [])[captured_before:]
    # capture history is a queue, not an archive: keep the newest window so
    # disposable per-world state files stay disposable
    keep = int(world.get("capture_keep", 200) or 200)
    if len(state.get("discovered", [])) > keep:
        state["discovered"] = state["discovered"][-keep:]
        save_state(state, Path(state_path))
    return {
        "world": world.get("name"),
        "ran": ran,
        # only THIS run's finds; the state file keeps a bounded capture window
        "discovered": new_items[-keep:],
        "errors": state.get("errors", 0),
    }
