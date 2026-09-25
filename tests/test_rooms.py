"""Rooms — the front door renders other small backends (contract: room/0).

These tests pin the honesty floor of ``src/personal_world/rooms.py`` and
``GET /api/rooms``:

* a reachable room carries its descriptor, status, and needs-you;
* an unreachable room is ``reachable: false``, ``room: null``, status
  ``unreachable`` — never ``healthy``;
* a timeout and malformed JSON are named, never raised;
* a bearer token is sent only when the room configured one (via the
  ``PW_ROOM_<ID>_TOKEN_ENV`` indirection), and never appears in a row;
* ``last_seen`` survives a later outage (kept in memory);
* the snapshot is cached for 15 s;
* the route requires authentication.

The transport is ``httpx.MockTransport`` — the same httpx the repo
already uses for its TestClient and OIDC tests; no network is touched.
"""

import asyncio
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from personal_world import rooms  # noqa: E402
from personal_world.rooms import RoomsService, parse_rooms  # noqa: E402

DESCRIPTOR = {
    "contract": "room/0",
    "id": "studio",
    "name": "Studio",
    "icon": "book",
    "voice": "dry and precise",
    "version": "1.2.0",
    "commit": "a1b2c3d",
    "status": "healthy",
    "updated_at": "2026-09-25T13:05:48Z",
}

NEEDS = [
    {
        "id": "need-1",
        "title": "Confirm the transfer",
        "why": "A withdrawal above the usual threshold is waiting.",
        "actions": ["confirm-transfer"],
        "created_at": "2026-09-25T12:30:00Z",
    }
]

# Synthetic, short, never a real credential. Not 24+ chars, so it can
# never look like an embedded secret to the public-safety scanner.
TOKEN_VALUE = "tok-abc"


def run(coro):
    return asyncio.run(coro)


def _handler(*, descriptor=None, needs=None, calls=None, tokens=None):
    """A MockTransport handler for one room's two read endpoints."""

    def handle(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(request.url.path)
        if tokens is not None:
            tokens.append(request.headers.get("authorization"))
        if request.url.path == rooms.ROOM_PATH:
            if descriptor is None:
                return httpx.Response(500, json={"detail": "no"})
            return descriptor()
        if request.url.path == rooms.NEEDS_YOU_PATH:
            if needs is None:
                return httpx.Response(500, json={"detail": "no"})
            return needs()
        return httpx.Response(404, json={"detail": "unknown"})

    return handle


def _ok_descriptor():
    return httpx.Response(200, json=DESCRIPTOR)


def _ok_needs():
    return httpx.Response(200, json=NEEDS)


# ── Configuration ────────────────────────────────────────────────────


class TestParseRooms:
    def test_parses_id_and_base_url_list(self):
        cfgs = parse_rooms({"PW_ROOMS": "studio=http://127.0.0.1:8940, workshop=https://127.0.0.1:8961"})
        assert [(c.id, c.base_url) for c in cfgs] == [
            ("studio", "http://127.0.0.1:8940"),
            ("workshop", "https://127.0.0.1:8961"),
        ]
        assert all(c.invalid_reason is None for c in cfgs)

    def test_token_env_indirection_reads_the_named_var(self):
        cfgs = parse_rooms(
            {
                "PW_ROOMS": "studio=http://127.0.0.1:8940",
                "PW_ROOM_STUDIO_TOKEN_ENV": "PW_STUDIO_TOKEN",
                "PW_STUDIO_TOKEN": TOKEN_VALUE,
            }
        )
        assert cfgs[0].token == TOKEN_VALUE
        # A missing named var means no token, not a crash.
        assert parse_rooms({"PW_ROOMS": "studio=http://x.test"})[0].token is None

    def test_insecure_tls_flag(self):
        cfgs = parse_rooms(
            {
                "PW_ROOMS": "studio=https://room.test:8940",
                "PW_ROOM_STUDIO_INSECURE_TLS": "1",
            }
        )
        assert cfgs[0].insecure_tls is True

    def test_unusable_entry_is_kept_as_invalid(self):
        cfgs = parse_rooms({"PW_ROOMS": "broken=not-a-url"})
        assert cfgs[0].id == "broken"
        assert cfgs[0].invalid_reason is not None

    def test_empty_env_means_no_rooms(self):
        assert parse_rooms({}) == []
        assert parse_rooms({"PW_ROOMS": "   "}) == []


# ── Reachable / unreachable ──────────────────────────────────────────


class TestSnapshot:
    def test_reachable_room_carries_descriptor_status_and_needs(self):
        calls: list[str] = []
        svc = RoomsService(
            transport=httpx.MockTransport(
                _handler(descriptor=_ok_descriptor, needs=_ok_needs, calls=calls)
            )
        )
        rows = run(svc.snapshot({"PW_ROOMS": "studio=http://room.test"}))
        assert len(rows) == 1
        row = rows[0]
        assert row["id"] == "studio"
        assert row["base_url"] == "http://room.test"
        assert row["reachable"] is True
        assert row["status"] == "healthy"
        assert row["room"]["name"] == "Studio"
        assert [n["title"] for n in row["needs_you"]] == ["Confirm the transfer"]
        assert row["error"] is None
        assert row["checked_at"] and row["last_seen"]
        # Both endpoints were read.
        assert set(calls) == {rooms.ROOM_PATH, rooms.NEEDS_YOU_PATH}

    def test_connect_error_is_unreachable_not_healthy(self):
        def boom(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("connection refused")

        svc = RoomsService(transport=httpx.MockTransport(boom))
        row = run(svc.snapshot({"PW_ROOMS": "studio=http://room.test"}))[0]
        assert row["reachable"] is False
        assert row["room"] is None
        assert row["status"] == rooms.UNREACHABLE
        assert row["error"] == "connect error"
        assert row["last_seen"] is None  # never reached

    def test_timeout_is_named_and_never_raises(self):
        def slow(request: httpx.Request) -> httpx.Response:
            raise httpx.TimeoutException("too slow")

        svc = RoomsService(transport=httpx.MockTransport(slow))
        row = run(svc.snapshot({"PW_ROOMS": "studio=http://room.test"}))[0]
        assert row["reachable"] is False
        assert row["status"] == rooms.UNREACHABLE
        assert row["error"] == "timeout"

    def test_malformed_json_is_unreachable_with_error(self):
        svc = RoomsService(
            transport=httpx.MockTransport(
                _handler(
                    descriptor=lambda: httpx.Response(
                        200, content=b"{not json", headers={"content-type": "application/json"}
                    )
                )
            )
        )
        row = run(svc.snapshot({"PW_ROOMS": "studio=http://room.test"}))[0]
        assert row["reachable"] is False
        assert row["room"] is None
        assert row["status"] == rooms.UNREACHABLE
        assert row["error"] == "malformed JSON"

    def test_unknown_contract_value_fails_clearly(self):
        bad = dict(DESCRIPTOR, contract="room/9")
        svc = RoomsService(
            transport=httpx.MockTransport(
                _handler(descriptor=lambda: httpx.Response(200, json=bad))
            )
        )
        row = run(svc.snapshot({"PW_ROOMS": "studio=http://room.test"}))[0]
        assert row["reachable"] is True  # it answered
        assert row["room"] is None  # but we do not understand it
        assert row["status"] == "unknown"
        assert "room/9" in row["error"]

    def test_last_seen_survives_a_later_outage(self):
        state = {"up": True}

        def handle(request: httpx.Request) -> httpx.Response:
            if state["up"]:
                return _ok_descriptor() if request.url.path == rooms.ROOM_PATH else _ok_needs()
            raise httpx.ConnectError("down")

        svc = RoomsService(transport=httpx.MockTransport(handle))
        first = run(svc.snapshot({"PW_ROOMS": "studio=http://room.test"}))[0]
        assert first["last_seen"] is not None
        svc.invalidate()
        state["up"] = False
        second = run(svc.snapshot({"PW_ROOMS": "studio=http://room.test"}))[0]
        assert second["reachable"] is False
        assert second["last_seen"] == first["last_seen"]

    def test_snapshot_is_cached_for_fifteen_seconds(self):
        calls: list[str] = []
        clock = {"t": 1000.0}
        svc = RoomsService(
            transport=httpx.MockTransport(
                _handler(descriptor=_ok_descriptor, needs=_ok_needs, calls=calls)
            ),
            clock=lambda: clock["t"],
        )
        run(svc.snapshot({"PW_ROOMS": "studio=http://room.test"}))
        first_count = len(calls)
        run(svc.snapshot({"PW_ROOMS": "studio=http://room.test"}))
        assert len(calls) == first_count  # served from cache
        clock["t"] += rooms.CACHE_TTL_SECONDS + 1
        run(svc.snapshot({"PW_ROOMS": "studio=http://room.test"}))
        assert len(calls) > first_count  # refreshed


class TestTokenHeader:
    def test_token_sent_only_when_configured(self):
        tokens: list[str | None] = []
        svc = RoomsService(
            transport=httpx.MockTransport(
                _handler(descriptor=_ok_descriptor, needs=_ok_needs, tokens=tokens)
            )
        )
        run(svc.snapshot({"PW_ROOMS": "studio=http://room.test"}))
        assert all(t is None for t in tokens)

        tokens.clear()
        svc.invalidate()
        run(
            svc.snapshot(
                {
                    "PW_ROOMS": "studio=http://room.test",
                    "PW_ROOM_STUDIO_TOKEN_ENV": "PW_STUDIO_TOKEN",
                    "PW_STUDIO_TOKEN": TOKEN_VALUE,
                }
            )
        )
        assert tokens and all(t == f"Bearer {TOKEN_VALUE}" for t in tokens)


# ── The route ────────────────────────────────────────────────────────


@pytest.fixture
def client(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    from personal_world.api import create_app
    from personal_world.init import init_world

    monkeypatch.setenv("PW_API_TOKEN", "instancetoken")
    monkeypatch.setenv("PW_IDENTITY_MODE", "single")
    monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("PW_CONFIG_DIR", str(tmp_path))
    init_world(tmp_path, tmp_path)
    (tmp_path / "setup-complete").write_text("ok")
    app = create_app(tmp_path, tmp_path)
    return TestClient(app)


class TestRoomsRoute:
    def test_route_requires_auth(self, client):
        assert client.get("/api/rooms").status_code == 401

    def test_route_returns_honest_rows(self, client, monkeypatch):
        import personal_world.api as api_mod
        from personal_world.rooms import RoomsService

        svc = RoomsService(
            transport=httpx.MockTransport(
                _handler(descriptor=_ok_descriptor, needs=_ok_needs)
            )
        )
        monkeypatch.setattr(api_mod, "_ROOMS", svc)
        monkeypatch.setenv("PW_ROOMS", "studio=http://room.test")
        response = client.get(
            "/api/rooms", headers={"Authorization": "Bearer instancetoken"}
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["ok"] is True
        assert payload["data"][0]["id"] == "studio"
        assert payload["data"][0]["reachable"] is True


class TestBriefingReadsRooms:
    """The briefing reads the same one cached snapshot — no second round."""

    def test_briefing_workshop_system_comes_from_its_room(self, client, monkeypatch):
        import personal_world.api as api_mod

        needs = [
            {"id": f"n{i}", "title": f"Bench item {i}", "why": "waiting",
             "actions": [], "created_at": "2026-09-25T12:30:00Z"}
            for i in range(32)
        ]
        svc = RoomsService(
            transport=httpx.MockTransport(
                _handler(
                    descriptor=_ok_descriptor,
                    needs=lambda: httpx.Response(200, json=needs),
                )
            )
        )
        monkeypatch.setattr(api_mod, "_ROOMS", svc)
        monkeypatch.setenv("PW_ROOMS", "workshop=http://room.test")

        body = client.get(
            "/api/briefing", headers={"Authorization": "Bearer instancetoken"}
        ).json()
        assert body["ok"] is True
        agents = next(
            s for s in body["data"]["systems"] if s["id"] == "agents"
        )
        assert agents["status"] == "healthy"
        assert agents["counts"]["have_tos"] == 32
        assert body["data"]["have_tos_total"] == 32

    def test_unreachable_room_never_reports_the_system_healthy(
        self, client, monkeypatch
    ):
        import personal_world.api as api_mod

        def boom(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("connection refused")

        monkeypatch.setattr(
            api_mod, "_ROOMS", RoomsService(transport=httpx.MockTransport(boom))
        )
        monkeypatch.setenv("PW_ROOMS", "workshop=http://room.test")

        body = client.get(
            "/api/briefing", headers={"Authorization": "Bearer instancetoken"}
        ).json()
        agents = next(
            s for s in body["data"]["systems"] if s["id"] == "agents"
        )
        assert agents["status"] == "unavailable"
        assert agents["status"] != "healthy"