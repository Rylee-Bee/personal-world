"""D16 fold-in: the vendored discovery engine + the PW per-world seam.

Contracts under test are the safety properties Rylee's handoff named:
dedup, per-poll cap, source isolation, disposable state — plus the seam's
own promises: no module globals, per-world state isolation, capture mode.
"""

import importlib
import pkgutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from personal_world.discovery import world_run  # noqa: E402
from personal_world.discovery.notifier import _notify_batch  # noqa: E402


class FakeSource:
    """Deterministic source: emits configured items through the real batcher."""

    def __init__(self, *, ntfy_config, ntfy_max_per_poll, config=None):
        self._ncfg = ntfy_config
        self._maxp = ntfy_max_per_poll
        self._items = (config or {}).get("items", [])
        self._boom = bool((config or {}).get("boom"))

    def poll(self, state):
        if self._boom:
            raise RuntimeError("deliberate failure")
        render = lambda c: (c["id"], c["title"], "body", None, None)  # noqa: E731
        _notify_batch(state, "fake", self._items, render, [],
                      ntfy_config=self._ncfg, max_per_poll=self._maxp)


TYPES = {"fake": FakeSource}


def _world(items, endpoint=None):
    w = {
        "name": "test-world",
        "sources": {"one": {"type": "fake", "enabled": True, "interval": 60, "items": items}},
    }
    if endpoint:
        w["notify"] = {"endpoint": endpoint}
    return w


def _items(n, prefix="x"):
    return [{"id": f"{prefix}{i}", "title": f"{prefix} item {i}"} for i in range(n)]


def test_vendored_package_imports_clean():
    """Every vendored module imports — proves the 44 rewritten seams."""
    import personal_world.discovery as pkg
    for m in pkgutil.walk_packages(pkg.__path__, prefix=pkg.__name__ + "."):
        importlib.import_module(m.name)


def test_capture_mode_and_dedup(tmp_path):
    st = tmp_path / "state.json"
    r1 = world_run.run_world(_world(_items(3)), st, source_types=TYPES)
    assert r1["ran"] == ["one"] and len(r1["discovered"]) == 3
    r2 = world_run.run_world(_world(_items(3)), st, source_types=TYPES)
    assert r2["discovered"] == []  # dedup against disposable state, per-world


def test_per_world_state_isolation(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    same = _items(2)
    r1 = world_run.run_world(_world(same), a, source_types=TYPES)
    r2 = world_run.run_world(_world(same), b, source_types=TYPES)
    assert len(r1["discovered"]) == len(r2["discovered"]) == 2  # no cross-contamination


def test_notify_cap_marks_overflow_seen(tmp_path):
    st = tmp_path / "state.json"
    w = _world(_items(10))
    w["notify"] = {"max_per_poll": 5}
    r = world_run.run_world(w, st, source_types=TYPES)
    assert len(r["discovered"]) == 5
    # the decisive behavior: the NEXT run finds nothing new —
    # the cap overflow was marked seen, not left to flood the next cycle
    r2 = world_run.run_world(w, st, source_types=TYPES)
    assert r2["discovered"] == []


def test_one_failing_source_does_not_stop_the_world(tmp_path):
    st = tmp_path / "state.json"
    w = _world(_items(2))
    w["sources"]["bad"] = {"type": "fake", "enabled": True, "interval": 60, "boom": True,
                           "items": []}
    r = world_run.run_world(w, st, source_types=TYPES)
    assert "bad" not in r["ran"] and r["errors"] >= 1
    assert len(r["discovered"]) == 2  # the healthy source still delivered


def test_unknown_type_raises_loudly(tmp_path):
    w = _world([])
    w["sources"]["weird"] = {"type": "no-such-thing", "enabled": True}
    try:
        world_run.run_world(w, tmp_path / "s.json", source_types=TYPES)
        raise AssertionError("expected KeyError")
    except KeyError as e:
        assert "no-such-thing" in str(e)


def test_disabled_source_skipped(tmp_path):
    w = _world(_items(3))
    w["sources"]["one"]["enabled"] = False
    r = world_run.run_world(w, tmp_path / "s.json", source_types=TYPES)
    assert r["ran"] == [] and r["discovered"] == []
