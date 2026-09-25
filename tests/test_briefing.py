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
from personal_world.briefing_voice import resident_line  # noqa: E402
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


class BoomJournal:
    """A journal whose read itself fails (not merely empty)."""

    def current_events(self, n: int = 20):
        raise OSError("journal unreadable")


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


# ── arrival window (since / first visit) ─────────────────────────────
class TestArrivalWindow:
    def _snapshot(self):
        return {"bookmarks": [
            {"project_id": "proj-fresh", "working_on": "just now",
             "updated_at": _iso(NOW - timedelta(minutes=10))},
            {"project_id": "proj-mid", "working_on": "two days ago",
             "updated_at": _iso(NOW - timedelta(hours=48))},
            {"project_id": "proj-old", "working_on": "four days ago",
             "updated_at": _iso(NOW - timedelta(hours=100))},
        ]}

    def test_first_visit_uses_24h_not_72h(self):
        # No since: a 48h-old bookmark is outside the tighter first-visit
        # window even though it would fit the 72h return window.
        brief = _brief(project_home=_ph(self._snapshot()), place=None)
        ids = {i["id"] for i in _items(brief, "agents", "arrival")}
        assert ids == {"agents:proj-fresh"}

    def test_return_visit_counts_only_newer_than_since_within_72h(self):
        place = {"system": "agents", "item_id": "x",
                 "updated_at": _iso(NOW - timedelta(hours=100))}
        brief = _brief(project_home=_ph(self._snapshot()), place=place)
        ids = {i["id"] for i in _items(brief, "agents", "arrival")}
        # 48h fits the 72h window; the 100h bookmark sits at `since`.
        assert ids == {"agents:proj-fresh", "agents:proj-mid"}

    def test_bookmark_at_or_before_since_is_not_an_arrival(self):
        place = {"system": "agents", "item_id": "x",
                 "updated_at": _iso(NOW - timedelta(minutes=30))}
        brief = _brief(project_home=_ph(self._snapshot()), place=place)
        ids = {i["id"] for i in _items(brief, "agents", "arrival")}
        assert ids == {"agents:proj-fresh"}

    def test_estate_review_observation_follows_the_same_window(self):
        rows = {"review": {"observations": [
            {"concept": "Deploy pending", "detail": "waiting on approval",
             "evidence": [{"observed_at": _iso(NOW - timedelta(hours=48))}]},
        ]}}
        # First visit: 48h is outside the 24h window.
        first = _brief(lab=_lab(rows=rows), place=None)
        assert _items(first, "estate", "arrival") == []
        # Return visit from 100h ago: inside the 72h window and after since.
        place = {"system": "estate", "item_id": "x",
                 "updated_at": _iso(NOW - timedelta(hours=100))}
        back = _brief(lab=_lab(rows=rows), place=place)
        assert [i["id"] for i in _items(back, "estate", "arrival")] == ["estate:review:0"]


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
        # title is the first sentence of the detail, never the concept id
        assert _items(brief, "estate", "have_to")[0]["title"] == "SMART errors"
        assert _items(brief, "estate", "have_to")[0]["detail"] == "SMART errors"
        assert estate["counts"] == {"arrivals": 1, "have_tos": 1}

    def test_titles_are_human_never_the_bare_word_observation(self):
        rows = {"urgent": {"observations": [
            {"concept": "disk_failing", "detail": "verdict=failed\nsmart=errors"},
            {"concept": "last_known_good", "detail": "verdict=pass key=value"},
            {"concept": "ignored_id", "detail": ""},
            {"concept": "prose", "detail": "Package updates are pending. More text."},
        ]}}
        brief = _brief(lab=_lab(rows=rows))
        by_id = {i["id"]: i for i in _items(brief, "estate", "have_to")}
        assert by_id["estate:urgent:0"]["title"] == "Disk failing"
        assert by_id["estate:urgent:1"]["title"] == "Last known good deploy"
        assert by_id["estate:urgent:2"]["title"] == "Ignored id"
        assert by_id["estate:urgent:3"]["title"] == "Package updates are pending."
        for item in by_id.values():
            assert item["title"] != "Observation"
            assert item["title"] != "disk_failing"
            assert item["title"] != "last_known_good"
            assert item["title"] != "ignored_id"
        # the full detail is preserved, not replaced by the title
        assert by_id["estate:urgent:0"]["detail"] == "verdict=failed\nsmart=errors"

    def test_title_is_clipped_to_120_chars(self):
        rows = {"urgent": {"observations": [
            {"concept": "noise", "detail": "A" * 200},
        ]}}
        brief = _brief(lab=_lab(rows=rows))
        title = _items(brief, "estate", "have_to")[0]["title"]
        assert len(title) == 120

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
        records = _system(brief, "records")
        # A readable journal is healthy even with nothing personal yet;
        # the resident just falls through to its honest "quiet" voice.
        assert records["status"] == "healthy"
        assert records["voice"] == resident_line(
            "records", "healthy", {"arrivals": 0, "have_tos": 0}, False
        )

    def test_unreadable_journal_is_unavailable(self):
        records = _system(_brief(journal=BoomJournal()), "records")
        assert records["status"] == "unavailable"


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
        # Only the bookmark updated after `since` is an arrival now; the
        # older one is excluded, so every arrival here is genuinely new.
        assert set(by_id) == {"agents:proj-a"}
        assert by_id["agents:proj-a"]["new"] is True

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
        assert data["keeper"]["greeting"] in {
            "Good morning", "Good afternoon", "Good evening", "Hello",
        }
        assert data["keeper"]["name"] is None


# ── keeper: line, greeting, name ─────────────────────────────────────
class TestKeeperVoice:
    def test_keeper_line_is_always_produced(self):
        keeper = _brief()["data"]["keeper"]
        assert isinstance(keeper["line"], str)
        assert keeper["line"]

    @pytest.mark.parametrize("hour, expected", [
        (5, "Good morning"), (11, "Good morning"),
        (12, "Good afternoon"), (16, "Good afternoon"),
        (17, "Good evening"), (21, "Good evening"),
        (22, "Hello"), (23, "Hello"), (0, "Hello"), (4, "Hello"),
    ])
    def test_greeting_follows_the_server_hour(self, hour, expected):
        brief = _brief(now=NOW.replace(hour=hour))
        assert brief["data"]["keeper"]["greeting"] == expected

    def test_keeper_name_comes_from_the_optional_hint(self):
        assert _brief()["data"]["keeper"]["name"] is None
        assert _brief(name_hint="Rylee")["data"]["keeper"]["name"] == "Rylee"
        assert _brief(name_hint="   ")["data"]["keeper"]["name"] is None

    def test_arrivals_top_level_is_capped_at_five(self):
        snapshot = {"bookmarks": [
            {"project_id": f"proj-{i}", "working_on": "x",
             "updated_at": _iso(NOW - timedelta(minutes=i + 1))}
            for i in range(6)
        ]}
        brief = _brief(project_home=_ph(snapshot))
        assert brief["data"]["arrivals"] and len(brief["data"]["arrivals"]) == 5


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

    def test_briefing_route_passes_the_principal_display_name(self, client):
        keeper = client.get("/api/briefing", headers=AUTH).json()["data"]["keeper"]
        # single mode resolves the bootstrap person as "Primary person", a
        # placeholder label, not a name: the Keeper greets without a name.
        assert keeper["name"] is None
        assert keeper["greeting"] in {
            "Good morning", "Good afternoon", "Good evening", "Hello",
        }


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

def test_keeper_never_greets_the_placeholder_owner_label():
    from personal_world.briefing import build_briefing

    data = build_briefing(
        project_home=None, lab=None, discovery=None, journal=None, place=None,
        name_hint="Primary person",
    )
    assert data["data"]["keeper"]["name"] is None
    named = build_briefing(
        project_home=None, lab=None, discovery=None, journal=None, place=None,
        name_hint="Rylee",
    )
    assert named["data"]["keeper"]["name"] == "Rylee"
