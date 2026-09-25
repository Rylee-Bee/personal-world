"""Worlds briefing + place continuity (contract: worlds-briefing/1).

Guards the properties the briefing is trusted for:

* every source degrades honestly (``not_configured`` / ``unavailable``)
  and one dead source never takes the whole briefing down;
* agents mapping reads only Project Home's own fields;
* estate reads the lab lowbw rows dict;
* the thread is the person's own journal entry, never a machine line;
* place round-trips, rejects unknown systems, caps size, needs no step-up,
  and is person-only (agents are refused);
* ``since`` / ``new`` flags and the Keeper's mood follow the contract.
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from fastapi.testclient import TestClient  # noqa: E402

from personal_world.briefing import SYSTEM_IDS, build_briefing  # noqa: E402
from personal_world.envelope import ok  # noqa: E402
from personal_world.providers.project_home import (  # noqa: E402
    ProjectHomeResult,
    ProjectHomeSource,
)

NOW = datetime(2026, 9, 25, 10, 0, tzinfo=timezone.utc)
AUTH = {"Authorization": "Bearer instancetoken"}


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


# ── fakes ────────────────────────────────────────────────────────────
class FakeSource:
    """An injected source; ``boom=True`` simulates a hard failure."""

    def __init__(self, result=None, boom: bool = False):
        self._result = result
        self._boom = boom

    def observe(self):
        if self._boom:
            raise RuntimeError("source exploded")
        return self._result


class FakeJournal:
    def __init__(self, events=None):
        self._events = list(events or [])

    def current_events(self, n: int = 20):
        return self._events[-n:]


def _ph(snapshot=None, status="healthy", observed=None):
    return FakeSource(
        ProjectHomeResult(
            status=status,
            observed_at=_iso(observed or (NOW - timedelta(hours=1))),
            snapshot={"attention_items": [], "bookmarks": [], **(snapshot or {})},
            reason=None,
        )
    )


def _lab(rows=None, overall="WORKING", status="healthy"):
    return FakeSource(ok(status, data={
        "overall_state": overall,
        "generated_at": _iso(NOW - timedelta(minutes=5)),
        "rows": rows if rows is not None else {},
    }))


def _disc(sources=None, items=None):
    return FakeSource(ok("healthy", data={
        "sources": sources if sources is not None else [{"id": "s1"}],
        "items": items or [],
    }))


def _brief(**overrides):
    kwargs = dict(
        project_home=_ph(),
        lab=_lab(),
        discovery=_disc(),
        journal=FakeJournal(),
        place=None,
        now=NOW,
    )
    kwargs.update(overrides)
    return build_briefing(**kwargs)


def _system(brief, system_id):
    return next(s for s in brief["data"]["systems"] if s["id"] == system_id)


def _items(brief, system_id, kind):
    return [i for i in _system(brief, system_id)["items"] if i["kind"] == kind]


# ── source honesty ───────────────────────────────────────────────────
class TestSourceHonesty:
    def test_project_home_without_config_is_not_configured(self):
        result = ProjectHomeSource.from_env({}).observe()
        assert result.status == "not_configured"
        assert result.snapshot is None

    def test_project_home_http_without_token_is_not_configured(self):
        result = ProjectHomeSource.from_env(
            {"PW_PH_URL": "http://127.0.0.1:9", "PW_PH_TOKEN_ENV": "PW_PH_TEST_TOKEN"}
        ).observe()
        assert result.status == "not_configured"

    def test_project_home_cli_failure_is_unavailable(self):
        class Boom:
            def __call__(self, *a, **k):
                raise OSError("no such cli")

        result = ProjectHomeSource(cli="/no/such/cli", runner=Boom()).observe()
        assert result.status == "unavailable"
        assert result.snapshot is None

    def test_systems_without_sources_are_not_configured(self):
        from personal_world.envelope import fail

        brief = _brief(
            project_home=FakeSource(ProjectHomeResult(status="not_configured")),
            lab=FakeSource(fail("not_configured")),
            discovery=_disc(sources=[]),
            journal=FakeJournal(),
        )
        assert _system(brief, "agents")["status"] == "not_configured"
        assert _system(brief, "estate")["status"] == "not_configured"
        assert _system(brief, "interests")["status"] == "not_configured"
        assert _system(brief, "news")["status"] == "not_configured"
        assert brief["ok"] is True

    def test_one_failing_source_does_not_break_the_briefing(self):
        brief = _brief(project_home=FakeSource(boom=True))
        agents = _system(brief, "agents")
        assert agents["status"] == "unavailable"
        # the other systems still report; the response is still ok
        assert _system(brief, "estate")["status"] in ("healthy", "stale")
        assert _system(brief, "news")["status"] == "not_configured"
        assert brief["ok"] is True


# ── agents mapping ───────────────────────────────────────────────────
class TestAgentsMapping:
    def _snapshot(self):
        return {
            "attention_items": [
                {"id": "a1", "kind": "owner_decision", "title": "Pick a database",
                 "consequence": "blocks the build",
                 "raised_at": _iso(NOW - timedelta(hours=3))},
                {"id": "a2", "kind": "tool_failure", "title": "Backup tool down",
                 "detail": "exit 1", "raised_at": _iso(NOW - timedelta(hours=2))},
                {"id": "a3", "kind": "maintenance", "title": "Tidy the disk",
                 "stale": False, "raised_at": _iso(NOW - timedelta(hours=1))},
                {"id": "a4", "kind": "maintenance", "title": "Ancient tidy",
                 "stale": True},
                {"id": "a5", "kind": "curiosity", "title": "not a task"},
            ],
            "bookmarks": [
                {"project_id": "proj-moon-base",
                 "working_on": "Start the reactor\nsecond line",
                 "next_action": "wire the console",
                 "updated_at": _iso(NOW - timedelta(minutes=30))},
                {"project_id": "proj-old-hat",
                 "working_on": "too old to count",
                 "updated_at": _iso(NOW - timedelta(hours=100))},
            ],
        }

    def test_have_tos_only_owner_decision_and_tool_failure(self):
        brief = _brief(project_home=_ph(self._snapshot()))
        agents = _system(brief, "agents")
        kinds = {i["kind"] for i in agents["items"]}
        ids = {i["id"] for i in _items(brief, "agents", "have_to")}
        assert ids == {"agents:a1", "agents:a2"}
        assert "have_to" in kinds
        # maintenance-not-stale is an arrival; stale maintenance is dropped
        arrival_ids = {i["id"] for i in _items(brief, "agents", "arrival")}
        assert "agents:a3" in arrival_ids
        assert "agents:a4" not in arrival_ids

    def test_arrivals_only_bookmarks_inside_72h_with_pretty_names(self):
        brief = _brief(project_home=_ph(self._snapshot()))
        by_id = {i["id"]: i for i in _items(brief, "agents", "arrival")}
        assert "agents:proj-moon-base" in by_id
        assert "agents:proj-old-hat" not in by_id
        item = by_id["agents:proj-moon-base"]
        assert item["title"] == "Moon Base: Start the reactor"
        assert item["detail"] == "wire the console"
        assert item["kind"] == "arrival"

    def test_counts_are_full_not_item_cap(self):
        agents = _system(_brief(project_home=_ph(self._snapshot())), "agents")
        assert agents["counts"]["have_tos"] == 2
        assert agents["counts"]["arrivals"] == 2


# ── estate mapping ───────────────────────────────────────────────────
class TestEstateMapping:
    def _rows(self):
        return {
            "urgent": {"observations": [
                {"concept": "Disk failing", "detail": "SMART errors",
                 "action": "replace", "evidence": [
                     {"observed_at": _iso(NOW - timedelta(hours=1))}]},
            ]},
            "review": {"observations": [
                {"concept": "Package updates", "detail": "3 pending",
                 "evidence": [{"observed_at": _iso(NOW - timedelta(hours=2))}]},
            ]},
        }

    def test_rows_dict_maps_urgent_to_have_tos_review_to_arrivals(self):
        brief = _brief(lab=_lab(rows=self._rows()))
        estate = _system(brief, "estate")
        assert [i["id"] for i in _items(brief, "estate", "have_to")] == ["estate:urgent:0"]
        assert [i["id"] for i in _items(brief, "estate", "arrival")] == ["estate:review:0"]
        assert _items(brief, "estate", "have_to")[0]["title"] == "Disk failing"
        assert estate["counts"] == {"arrivals": 1, "have_tos": 1}

    def test_overall_state_unknown_is_unknown_status(self):
        estate = _system(_brief(lab=_lab(rows=self._rows(), overall="UNKNOWN")), "estate")
        assert estate["status"] == "unknown"

    def test_rows_list_shape_is_also_accepted(self):
        rows_list = [
            {"row": "urgent", "observations": [
                {"detail": "d1", "observed_at": _iso(NOW)}]},
        ]
        brief = _brief(lab=_lab(rows=rows_list))
        assert _items(brief, "estate", "have_to")[0]["title"] == "d1"


# ── records / thread ─────────────────────────────────────────────────
def _event(summary, source, ts):
    from personal_world.model import JournalEvent, JournalKind, Provenance

    return JournalEvent(
        kind=JournalKind.OBSERVATION,
        summary=summary,
        provenance=Provenance(source=source, observed_at=ts),
        ts=ts,
    )


class TestThread:
    def test_thread_is_the_users_entry_not_a_daily_loop_line(self):
        daily = _event("daily loop observed things", "daily", NOW - timedelta(minutes=1))
        user = _event("my own note", "user", NOW - timedelta(hours=5))
        brief = _brief(journal=FakeJournal([user, daily]))
        thread = brief["data"]["thread"]
        assert thread is not None
        assert thread["title"] == "my own note"
        assert thread["kind"] == "thread"
        # records reflects only the person's entry, never the machine line
        records = _system(brief, "records")
        assert [i["title"] for i in records["items"]] == ["my own note"]

    def test_empty_journal_has_no_thread(self):
        brief = _brief(journal=FakeJournal())
        assert brief["data"]["thread"] is None
        assert _system(brief, "records")["status"] == "unknown"


# ── flags and mood ───────────────────────────────────────────────────
class TestFlagsAndMood:
    def _arrival_snapshot(self):
        return {"bookmarks": [
            {"project_id": "proj-a", "working_on": "new thing",
             "updated_at": _iso(NOW - timedelta(minutes=10))},
            {"project_id": "proj-b", "working_on": "older thing",
             "updated_at": _iso(NOW - timedelta(minutes=45))},
        ]}

    def test_since_sets_new_flags_by_time(self):
        place = {"system": "agents", "item_id": "x",
                 "updated_at": _iso(NOW - timedelta(minutes=30))}
        brief = _brief(project_home=_ph(self._arrival_snapshot()), place=place)
        assert brief["data"]["since"] == _iso(NOW - timedelta(minutes=30))
        by_id = {i["id"]: i for i in _items(brief, "agents", "arrival")}
        assert by_id["agents:proj-a"]["new"] is True
        assert by_id["agents:proj-b"]["new"] is False

    def test_null_since_means_nothing_is_new(self):
        brief = _brief(project_home=_ph(self._arrival_snapshot()), place=None)
        assert brief["data"]["since"] is None
        assert all(i["new"] is False for i in brief["data"]["arrivals"])

    def test_mood_sleepy_wins_late_even_with_work(self):
        snapshot = {"attention_items": [
            {"id": "a1", "kind": "owner_decision", "title": "decide"}]}
        brief = _brief(project_home=_ph(snapshot), now=NOW.replace(hour=23))
        assert brief["data"]["keeper"]["mood"] == "sleepy"

    def test_mood_busy_with_have_tos(self):
        snapshot = {"attention_items": [
            {"id": "a1", "kind": "tool_failure", "title": "down"}]}
        brief = _brief(project_home=_ph(snapshot))
        assert brief["data"]["keeper"]["mood"] == "busy"
        assert brief["status"] == "needs_attention"

    def test_mood_celebrating_with_arrivals_and_no_have_tos(self):
        place = {"system": "agents", "item_id": "x",
                 "updated_at": _iso(NOW - timedelta(hours=1))}
        brief = _brief(project_home=_ph(self._arrival_snapshot()), place=place)
        assert brief["data"]["keeper"]["mood"] == "celebrating"

    def test_mood_greeting_on_a_first_visit(self):
        brief = _brief(place=None)
        assert brief["data"]["keeper"]["mood"] == "greeting"

    def test_mood_calm_on_a_return_visit_with_nothing_new(self):
        place = {"system": "agents", "item_id": "x",
                 "updated_at": _iso(NOW - timedelta(hours=1))}
        brief = _brief(place=place)
        assert brief["data"]["keeper"]["mood"] == "calm"

    def test_have_tos_top_level_is_capped_and_ranked(self):
        snapshot = {"attention_items": [
            {"id": f"a{i}", "kind": "tool_failure", "title": f"t{i}"}
            for i in range(4)
        ] + [{"id": "o1", "kind": "owner_decision", "title": "decide"}]}
        brief = _brief(project_home=_ph(snapshot))
        assert brief["data"]["have_tos_total"] == 5
        assert len(brief["data"]["have_tos"]) == 3
        assert brief["data"]["have_tos"][0]["id"] == "agents:o1"

    def test_briefing_schema_shape(self):
        brief = _brief()
        data = brief["data"]
        assert data["schema"] == "worlds-briefing/1"
        assert set(data) >= {
            "schema", "generated_at", "since", "keeper", "systems",
            "have_tos", "have_tos_total", "arrivals", "thread",
        }
        assert [s["id"] for s in data["systems"]] == [
            "agents", "estate", "records", "interests", "news", "threads",
        ]
        assert data["keeper"]["resident"]["key"] == "personal-world"


# ── routes ───────────────────────────────────────────────────────────
@pytest.fixture
def client(tmp_path, monkeypatch):
    from personal_world.api import create_app
    from personal_world.init import init_world

    monkeypatch.setenv("PW_API_TOKEN", "instancetoken")
    monkeypatch.setenv("PW_IDENTITY_MODE", "single")
    monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("PW_CONFIG_DIR", str(tmp_path))
    monkeypatch.setenv("PW_LAB_CLI", "/nonexistent/lab")
    for var in ("PW_PH_CLI", "PW_PH_URL", "PW_PH_TOKEN_ENV"):
        monkeypatch.delenv(var, raising=False)
    init_world(tmp_path, tmp_path)
    (tmp_path / "setup-complete").write_text("ok")
    return TestClient(create_app(tmp_path, tmp_path))


@pytest.fixture
def multi_client(tmp_path, monkeypatch):
    from personal_world.api import create_app

    monkeypatch.setenv("PW_API_TOKEN", "instancetoken")
    monkeypatch.setenv("PW_IDENTITY_MODE", "multi")
    monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("PW_CONFIG_DIR", str(tmp_path))
    monkeypatch.setenv("PW_LAB_CLI", "/nonexistent/lab")
    return TestClient(create_app(tmp_path, tmp_path))


class TestPlaceRoutes:
    def test_get_is_null_before_any_visit(self, client):
        r = client.get("/api/place", headers=AUTH)
        assert r.status_code == 200
        assert r.json() == {"ok": True, "data": {"place": None}}

    def test_round_trip(self, client):
        put = client.put(
            "/api/place",
            json={"system": "agents", "item_id": "a1"},
            headers=AUTH,
        )
        assert put.status_code == 200
        stored = put.json()["data"]["place"]
        assert stored["system"] == "agents"
        assert stored["item_id"] == "a1"
        assert stored["updated_at"]
        got = client.get("/api/place", headers=AUTH).json()["data"]["place"]
        assert got == stored

    def test_null_place_is_accepted(self, client):
        r = client.put("/api/place", json={"system": None, "item_id": None},
                       headers=AUTH)
        assert r.status_code == 200
        assert r.json()["data"]["place"]["system"] is None

    def test_unknown_system_is_422(self, client):
        r = client.put("/api/place", json={"system": "not-a-system"},
                       headers=AUTH)
        assert r.status_code == 422

    def test_size_cap_is_enforced(self, client):
        r = client.put(
            "/api/place",
            json={"system": "agents", "item_id": "z" * 4000},
            headers=AUTH,
        )
        assert r.status_code == 422

    def test_put_needs_no_step_up(self, client):
        # No X-PW-StepUp header at all: continuity is not an elevation event.
        r = client.put("/api/place", json={"system": "records", "item_id": "n1"},
                       headers=AUTH)
        assert r.status_code == 200

    def test_briefing_route_returns_since_from_stored_place(self, client):
        client.put("/api/place", json={"system": "agents", "item_id": "a1"},
                   headers=AUTH)
        r = client.get("/api/briefing", headers=AUTH)
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["data"]["schema"] == "worlds-briefing/1"
        assert body["data"]["since"] == client.get(
            "/api/place", headers=AUTH
        ).json()["data"]["place"]["updated_at"]

    def test_briefing_route_requires_auth(self, client):
        assert client.get("/api/briefing").status_code in (401, 503)


class TestAgentRefused:
    def _agent_token(self, c):
        r = c.post(
            "/api/identity/agents",
            json={"agent_id": "briefbot", "scopes": ["read"]},
            headers={**AUTH, "X-PW-StepUp": "1"},
        )
        assert r.status_code == 200, r.text
        return r.json()["data"]["token"]

    def test_agent_cannot_read_briefing_or_place(self, multi_client):
        token = self._agent_token(multi_client)
        headers = {"Authorization": f"Bearer {token}"}
        assert multi_client.get("/api/briefing", headers=headers).status_code == 403
        assert multi_client.get("/api/place", headers=headers).status_code == 403

    def test_agent_cannot_write_place(self, multi_client):
        token = self._agent_token(multi_client)
        r = multi_client.put(
            "/api/place",
            json={"system": "agents", "item_id": "x"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 403


class TestKnownSystems:
    def test_system_ids_match_the_contract(self):
        assert SYSTEM_IDS == {
            "agents", "estate", "records", "interests", "news", "threads",
        }