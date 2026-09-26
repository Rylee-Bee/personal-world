"""People screens step 2 (owner-approved 2026-09-26): invites, helpers,
supervised limits, guests.

Every numbered item of the plan is pinned here:

1. **Invites** — single-use, expiry enforced, the owner is never
   invitable, and only the owner may invite an admin. The token is
   returned once and only its hash is stored.
2. **Guests** — after ``until`` the principal resolves to nothing (401)
   and ``/api/people`` says they are expired; guests hold only
   ``see_shared``.
3. **Helper grants** — the person grants, never an admin; grant /
   revoke / expiry; ``see_needs_of`` for any live grant, ``act_for``
   only with ``can_act``; expired grants are ignored everywhere; the
   owner may revoke any grant in an emergency, visibly.
4. **Helping principal** — ``X-Worlds-Helping`` without a live grant is
   a 403 with a plain message; with a grant it works only on the rooms
   needs list and room actions, and every action records by/for in the
   person's "helped by" log (``undoable`` false unless a room says so).
5. **Supervised limits** — closed key set, who set it and when, the
   person sees their own, a guardian (live ``can_act`` grant) may set
   them, and a guardian can never read the person's journal or world
   (403, proven).
6. **/api/me** — ``helpers_granted``, ``helping``, ``limits``,
   ``guest_until``.
7. **Manifest** — every new route is curated with the right gate.

All people here are made up: sam, jo, alex, robin, kit. The rooms
transport is ``httpx.MockTransport`` — no network is touched.
"""

import json
import sys
import time
from pathlib import Path
from typing import ClassVar

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from fastapi.testclient import TestClient

from personal_world import people as people_mod
from personal_world import rooms
from personal_world.identity import IdentityStore, Principal
from personal_world.roles import can
from personal_world.rooms import RoomsService

OWNER_TOKEN = "instancetoken"
OWNER = {"Authorization": f"Bearer {OWNER_TOKEN}", "X-PW-StepUp": "1"}



def _app(tmp_path, monkeypatch):
    from personal_world.api import create_app

    monkeypatch.setenv("PW_API_TOKEN", OWNER_TOKEN)
    monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("PW_CONFIG_DIR", str(tmp_path))
    monkeypatch.setenv("PW_IDENTITY_MODE", "multi")
    monkeypatch.delenv("PW_ROOMS", raising=False)
    monkeypatch.delenv("PW_ROOMS_REGISTRY_URL", raising=False)
    return TestClient(create_app(tmp_path, tmp_path))


def _h(token, step_up=True):
    headers = {"Authorization": f"Bearer {token}"}
    if step_up:
        headers["X-PW-StepUp"] = "1"
    return headers


def _provision(c, user_id, display_name="Made up person"):
    """Owner provisions a member account; returns its token."""
    r = c.post(
        "/api/identity/users",
        json={"user_id": user_id, "display_name": display_name},
        headers=OWNER,
    )
    assert r.status_code == 200, r.text
    return r.json()["data"]["token"]


def _future_iso(seconds):
    return people_mod.to_iso(time.time() + seconds)


def _make_invite(c, *, role="member", display_name="Sam Person", **extra):
    body = {"role": role, "display_name": display_name, **extra}
    r = c.post("/api/people/invites", json=body, headers=OWNER)
    assert r.status_code == 200, r.text
    return r.json()["data"]


def _accept(c, token):
    return c.post("/api/invites/accept", json={"token": token})


# ── 1. Invites ────────────────────────────────────────────────────────


class TestInvites:
    def test_invite_is_single_use(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        invite = _make_invite(c, display_name="Sam Person")
        assert invite["role"] == "member"
        token = invite["token"]
        r = _accept(c, token)
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert data["role"] == "member"
        assert data["user_id"] == "sam-person"
        # The sign-in key returned once is the account's credential.
        key = data["sign_in_key"]
        assert len(key) >= 40
        me = c.get("/api/me", headers=_h(key, step_up=False))
        assert me.status_code == 200
        assert me.json()["data"]["role"] == "member"
        # The link works once.
        second = _accept(c, token)
        assert second.status_code == 403
        assert "not valid" in second.json()["detail"]

    def test_only_hash_is_stored_token_shown_once(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        invite = _make_invite(c)
        token = invite["token"]
        assert _accept(c, token).status_code == 200
        # The stored file keeps only the hash — never the plain token.
        blob = (tmp_path / "invites.json").read_text()
        assert token not in blob
        assert "token_hash" in blob
        # The list carries no token material at all.
        listing = c.get("/api/people/invites", headers=OWNER)
        assert listing.status_code == 200
        rows = listing.json()["data"]
        assert token not in json.dumps(rows)
        assert "token_hash" not in json.dumps(rows)
        assert {row["invite_id"] for row in rows} == {invite["invite_id"]}
        # The sign-in key is not stored in the clear either (no display
        # prefix).
        user = IdentityStore(tmp_path).get_user("sam-person")
        assert user["token_prefixes"] == []
        assert user["hashed_tokens"]

    def test_invite_expiry_is_enforced(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        invite = _make_invite(c, display_name="Alex Person")
        store = people_mod.InviteStore(tmp_path)
        payload = store._load()
        payload["invites"][0]["expires_at"] = time.time() - 5
        store._save(payload)
        r = _accept(c, invite["token"])
        assert r.status_code == 403
        assert "expired" in r.json()["detail"]
        listing = c.get("/api/people/invites", headers=OWNER).json()["data"]
        assert listing[0]["expired"] is True
        # And no account was created for the expired link.
        assert IdentityStore(tmp_path).get_user("alex-person") is None

    def test_hours_default_and_bounds(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        invite = _make_invite(c)
        # Default 72 hours.
        delta = people_mod.parse_iso(invite["expires_at"]) - time.time()
        assert 71 * 3600 < delta <= 72 * 3600 + 10
        # Max 336 accepted, 337 refused.
        assert (
            c.post(
                "/api/people/invites",
                json={"role": "member", "display_name": "Kit Person",
                      "expires_in_hours": 336},
                headers=OWNER,
            ).status_code
            == 200
        )
        assert (
            c.post(
                "/api/people/invites",
                json={"role": "member", "display_name": "Kit Person",
                      "expires_in_hours": 337},
                headers=OWNER,
            ).status_code
            == 422
        )
        for bad in (0, -1, "72", True, 72.5):
            assert (
                c.post(
                    "/api/people/invites",
                    json={"role": "member", "display_name": "Kit Person",
                          "expires_in_hours": bad},
                    headers=OWNER,
                ).status_code
                == 422
            ), bad

    def test_owner_is_never_invitable(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        r = c.post(
            "/api/people/invites",
            json={"role": "owner", "display_name": "Sam Person"},
            headers=OWNER,
        )
        assert r.status_code == 422
        # A wrong-shaped role is refused too, never guessed.
        for bad in ("wizard", None, 7):
            assert (
                c.post(
                    "/api/people/invites",
                    json={"role": bad, "display_name": "Sam Person"},
                    headers=OWNER,
                ).status_code
                == 422
            ), bad

    def test_only_the_owner_makes_admins(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        jo_tok = _provision(c, "jo")
        assert (
            c.put("/api/people/jo/role", json={"role": "admin"}, headers=OWNER)
            .status_code
            == 200
        )
        h = _h(jo_tok)
        # An admin may invite member / supervised / guest…
        for role, extra in (
            ("member", {}),
            ("supervised", {}),
            ("guest", {"guest_until": _future_iso(3600)}),
        ):
            r = c.post(
                "/api/people/invites",
                json={"role": role, "display_name": "Sam Person", **extra},
                headers=h,
            )
            assert r.status_code == 200, (role, r.text)
        # …but never an admin.
        r = c.post(
            "/api/people/invites",
            json={"role": "admin", "display_name": "Robin Admin"},
            headers=h,
        )
        assert r.status_code == 403
        assert "only the owner" in r.json()["detail"]
        # The owner may.
        invite = _make_invite(c, role="admin", display_name="Robin Admin")
        assert _accept(c, invite["token"]).json()["data"]["role"] == "admin"

    def test_manage_people_is_required(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        sam_tok = _provision(c, "sam")
        h = _h(sam_tok)
        assert (
            c.post(
                "/api/people/invites",
                json={"role": "member", "display_name": "Sam Person"},
                headers=h,
            ).status_code
            == 403
        )
        assert c.get("/api/people/invites", headers=h).status_code == 403
        assert c.delete("/api/people/invites/inv-xx", headers=h).status_code == 403

    def test_guest_until_only_for_guests(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        # guest role: required, must parse, must be future
        r = c.post(
            "/api/people/invites",
            json={"role": "guest", "display_name": "Kit Guest"},
            headers=OWNER,
        )
        assert r.status_code == 422
        for bad in ("later", "", 5, "2000-01-01T00:00:00Z"):
            assert (
                c.post(
                    "/api/people/invites",
                    json={"role": "guest", "display_name": "Kit Guest",
                          "guest_until": bad},
                    headers=OWNER,
                ).status_code
                == 422
            ), bad
        # a non-guest role never carries guest_until
        r = c.post(
            "/api/people/invites",
            json={"role": "member", "display_name": "Sam Person",
                  "guest_until": _future_iso(3600)},
            headers=OWNER,
        )
        assert r.status_code == 422

    def test_delete_removes_the_link(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        invite = _make_invite(c)
        r = c.delete(f"/api/people/invites/{invite['invite_id']}", headers=OWNER)
        assert r.status_code == 200
        assert c.get("/api/people/invites", headers=OWNER).json()["data"] == []
        # The token is dead with the record.
        assert _accept(c, invite["token"]).status_code == 403
        assert (
            c.delete(f"/api/people/invites/{invite['invite_id']}", headers=OWNER)
            .status_code
            == 404
        )

    def test_unknown_or_empty_token_is_refused(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        assert _accept(c, "not-a-real-token").status_code == 403
        assert _accept(c, "").status_code == 422
        invite = _make_invite(c)
        assert _accept(c, invite["token"]).status_code == 200

    def test_each_accepted_invite_gets_its_own_key(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        a = _accept(c, _make_invite(c, display_name="Jo One")["token"]).json()["data"]
        b = _accept(c, _make_invite(c, display_name="Jo Two")["token"]).json()["data"]
        assert a["sign_in_key"] != b["sign_in_key"]
        for row in (a, b):
            me = c.get("/api/me", headers=_h(row["sign_in_key"], step_up=False))
            assert me.json()["data"]["id"] == row["user_id"]


# ── 2. Guests ─────────────────────────────────────────────────────────


class TestGuests:
    def test_guest_expires_to_401_and_shows_expired(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        until = _future_iso(3600)
        invite = _make_invite(
            c, role="guest", display_name="Kit Guest", guest_until=until
        )
        data = _accept(c, invite["token"]).json()["data"]
        assert data["guest_until"] == until
        key = data["sign_in_key"]
        me = c.get("/api/me", headers=_h(key, step_up=False)).json()["data"]
        assert me["role"] == "guest"
        # A guest holds only see_shared.
        assert me["permissions"] == ["see_shared"]
        people = c.get("/api/people", headers=OWNER).json()["data"]
        row = next(p for p in people if p["id"] == "kit-guest")
        assert row["guest_until"] == until
        assert row["expired"] is False
        # Time passes (simulated honestly: the record's until moves).
        store = IdentityStore(tmp_path)
        store.set_guest_until("kit-guest", _future_iso(-5))
        assert c.get("/api/me", headers=_h(key, step_up=False)).status_code == 401
        assert c.get("/api/prefs", headers=_h(key, step_up=False)).status_code == 401
        # The store resolves the credential to nothing, both paths.
        assert store.match_token(key) is None
        assert store.get_principal_record("kit-guest") is None
        people = c.get("/api/people", headers=OWNER).json()["data"]
        row = next(p for p in people if p["id"] == "kit-guest")
        assert row["expired"] is True

    def test_only_guests_expire_a_stale_until_cannot_kill_a_member(
        self, tmp_path, monkeypatch
    ):
        """A person who is not a guest never expires: an old guest_until
        left on a promoted record cannot resolve their principal to
        nothing."""
        c = _app(tmp_path, monkeypatch)
        tok = _provision(c, "sam")
        store = IdentityStore(tmp_path)
        store.set_guest_until("sam", _future_iso(-5))  # stale, past
        assert store.role_for("sam") == "member"
        assert c.get("/api/me", headers=_h(tok)).status_code == 200


# ── 3. Helper grants ──────────────────────────────────────────────────


class TestCanTargetGrants:
    """``can(..., target=..., grants=...)`` — the per-person answers."""

    GRANT: ClassVar[dict] = {
        "grant_id": "g1",
        "person_id": "sam",
        "helper_id": "jo",
        "can_act": True,
        "until": "2099-01-01T00:00:00Z",
        "revoked_at": None,
    }

    def test_see_needs_of_any_live_grant_act_for_only_can_act(self):
        jo = Principal(id="jo", role="member")
        assert can(jo, "see_needs_of", target="sam", grants=[self.GRANT]) is True
        assert can(jo, "act_for", target="sam", grants=[self.GRANT]) is True
        see_only = dict(self.GRANT, can_act=False)
        assert can(jo, "see_needs_of", target="sam", grants=[see_only]) is True
        assert can(jo, "act_for", target="sam", grants=[see_only]) is False

    def test_no_grant_other_person_or_revoked_is_denied(self):
        jo = Principal(id="jo", role="member")
        assert can(jo, "see_needs_of", target="sam", grants=[]) is False
        assert can(jo, "see_needs_of", target="alex", grants=[self.GRANT]) is False
        assert can(jo, "see_needs_of", target="sam", grants=[dict(self.GRANT, helper_id="kit")]) is False
        assert can(jo, "see_needs_of", target="sam", grants=[dict(self.GRANT, revoked_at="x")]) is False
        assert can(jo, "act_for", target="sam", grants=[dict(self.GRANT, revoked_at="x")]) is False

    def test_agents_and_garbage_never_hold_grants(self):
        bot = Principal(id="bot", kind="agent", owner_id="jo", scopes=("read",), role="owner")
        assert can(bot, "see_needs_of", target="sam", grants=[self.GRANT]) is False
        assert can(Principal(id="jo"), "see_needs_of", target=None, grants=[self.GRANT]) is False
        assert can(Principal(id="jo"), "see_needs_of", target="sam", grants=["not-a-dict"]) is False

    def test_target_never_widens_a_role_permission(self):
        sam = Principal(id="sam", role="member")
        assert can(sam, "approve", target="sam", grants=[self.GRANT]) is False
        assert can(sam, "see_shared", target="sam", grants=[self.GRANT]) is True


def _grant(c, token, helper_id, **body_extra):
    return c.post(
        "/api/me/helpers",
        json={"helper_id": helper_id, **body_extra},
        headers=_h(token),
    )


class TestHelperGrants:
    def test_grant_list_revoke_roundtrip(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        sam_tok = _provision(c, "sam")
        _provision(c, "jo")
        r = _grant(c, sam_tok, "jo", can_act=True)
        assert r.status_code == 200, r.text
        grant = r.json()["data"]
        assert grant["helper_id"] == "jo"
        assert grant["can_act"] is True
        assert grant["live"] is True
        # Default until is 7 days.
        delta = people_mod.parse_iso(grant["until"]) - time.time()
        assert 6 * 86400 < delta <= 7 * 86400 + 10

        listing = c.get("/api/me/helpers", headers=_h(sam_tok)).json()["data"]
        assert len(listing) == 1
        assert listing[0]["grant_id"] == grant["grant_id"]

        d = c.delete(f"/api/me/helpers/{grant['grant_id']}", headers=_h(sam_tok))
        assert d.status_code == 200
        listing = c.get("/api/me/helpers", headers=_h(sam_tok)).json()["data"]
        assert listing[0]["revoked_at"]
        assert listing[0]["live"] is False

    def test_regranting_the_same_pair_refreshes_one_live_grant(
        self, tmp_path, monkeypatch
    ):
        c = _app(tmp_path, monkeypatch)
        sam_tok = _provision(c, "sam")
        _provision(c, "jo")
        first = _grant(c, sam_tok, "jo", can_act=False).json()["data"]
        second = _grant(
            c, sam_tok, "jo", can_act=True, until=_future_iso(86400)
        ).json()["data"]
        assert first["grant_id"] == second["grant_id"]  # refreshed, not stacked
        listing = c.get("/api/me/helpers", headers=_h(sam_tok)).json()["data"]
        assert len(listing) == 1
        assert listing[0]["can_act"] is True

    def test_until_bounds(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        sam_tok = _provision(c, "sam")
        _provision(c, "jo")
        assert _grant(c, sam_tok, "jo", until=_future_iso(31 * 86400)).status_code == 422
        assert _grant(c, sam_tok, "jo", until=_future_iso(-5)).status_code == 422
        assert _grant(c, sam_tok, "jo", until="whenever").status_code == 422
        assert _grant(c, sam_tok, "jo", can_act="yes").status_code == 422
        assert _grant(c, sam_tok, "jo", until=_future_iso(30 * 86400)).status_code == 200

    def test_only_a_real_other_person_can_be_a_helper(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        sam_tok = _provision(c, "sam")
        assert _grant(c, sam_tok, "sam").status_code == 422  # yourself: no
        assert _grant(c, sam_tok, "nobody").status_code == 404  # unknown: no
        assert _grant(c, sam_tok, "../bad id").status_code == 422  # unsafe id
        # An agent is never a helper.
        bot = c.post(
            "/api/identity/agents",
            json={"agent_id": "kit-bot", "scopes": ["read"]},
            headers=OWNER,
        )
        assert bot.status_code == 200
        assert _grant(c, sam_tok, "kit-bot").status_code == 404

    def test_expired_grant_is_ignored_everywhere(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        sam_tok = _provision(c, "sam")
        jo_tok = _provision(c, "jo")
        grant = _grant(c, sam_tok, "jo", can_act=True).json()["data"]
        # The grant window passes (the record's until moves).
        store = people_mod.HelperStore(tmp_path)
        payload = store._load()
        for g in payload["grants"]:
            if g["grant_id"] == grant["grant_id"]:
                g["until"] = _future_iso(-5)
        store._save(payload)

        assert c.get("/api/me/helpers", headers=_h(sam_tok)).json()["data"][0]["live"] is False
        me = c.get("/api/me", headers=_h(jo_tok)).json()["data"]
        assert me["helping"] == []
        sam_me = c.get("/api/me", headers=_h(sam_tok)).json()["data"]
        assert sam_me["helpers_granted"] == 0

    def test_owner_may_revoke_any_grant_in_an_emergency(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        sam_tok = _provision(c, "sam")
        _provision(c, "jo")
        grant = _grant(c, sam_tok, "jo", can_act=True).json()["data"]
        # An unrelated member cannot revoke someone else's grant.
        alex_tok = _provision(c, "alex")
        d = c.delete(f"/api/me/helpers/{grant['grant_id']}", headers=_h(alex_tok))
        assert d.status_code == 403
        # The owner can, and it stays visible to the person.
        d = c.delete(f"/api/me/helpers/{grant['grant_id']}", headers=OWNER)
        assert d.status_code == 200
        assert d.json()["data"]["revoked_by"] == "primary"
        listing = c.get("/api/me/helpers", headers=_h(sam_tok)).json()["data"]
        assert listing[0]["revoked_at"]
        assert listing[0]["revoked_by"] == "primary"
        journal_blob = (tmp_path / "journal.ndjson").read_text()
        assert "owner revoked helper grant" in journal_blob


# ── 4. The helping principal (X-Worlds-Helping) ───────────────────────

REGISTRY_URL = "https://registry.test/api/rooms/registry"
TOKEN_ENV_NAME = "PW_ROOM_WORKSHOP_TOKEN"
TOKEN_VALUE = "tok-room"

DESCRIPTOR = {
    "contract": "room/0",
    "id": "workshop",
    "name": "Workshop",
    "icon": "wrench",
    "version": "1.0.0",
    "commit": "a1b2c3d",
    "status": "healthy",
    "updated_at": "2026-09-25T13:05:48Z",
}
ACTIONS = [
    {"id": "approve", "label": "Approve", "writes": True},
    {"id": "refresh", "label": "Refresh", "writes": False},
]

SAM_NEED = {"id": "need-sam-1", "text": "Sam's own need"}
JO_NEED = {"id": "need-jo-1", "text": "Jo's own need"}


def _rooms_stub(tmp_path, seen):
    """A forwarding registry room whose needs are per principal."""

    def handle(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        pid = request.headers.get(rooms.PRINCIPAL_HEADER)
        if request.url.host == "registry.test":
            entry = {
                "id": "workshop",
                "name": "Workshop",
                "base_url": "http://room.test",
                "contract": "room/0",
                "token_env": TOKEN_ENV_NAME,
                "insecure_tls": False,
                "enabled": True,
                "public_url": None,
                "forward_principal": True,
            }
            return httpx.Response(
                200, json={"updated_at": "2026-09-26T12:00:00Z", "rooms": [entry]}
            )
        seen.append(request)
        if path == rooms.ACTIONS_PATH:
            return httpx.Response(200, json=ACTIONS)
        if path.startswith(rooms.ACTIONS_PATH + "/"):
            return httpx.Response(
                200,
                json={
                    "action_id": path.rsplit("/", 1)[-1],
                    "ok": True,
                    "summary": "Done.",
                    "changed": ["card-1"],
                    "at": "2026-09-26T08:00:00Z",
                },
            )
        if path == rooms.ROOM_PATH:
            return httpx.Response(200, json=DESCRIPTOR)
        if path == rooms.CARDS_PATH:
            return httpx.Response(200, json=[])
        if path == rooms.NEEDS_YOU_PATH:
            needs = {"sam": [SAM_NEED], "jo": [JO_NEED]}.get(pid, [])
            return httpx.Response(200, json=needs)
        return httpx.Response(404, json={"detail": "unknown"})

    return RoomsService(
        transport=httpx.MockTransport(handle),
        registry_state_path=tmp_path / "rooms-registry.json",
    )


@pytest.fixture
def helping(tmp_path, monkeypatch):
    """sam (the person) + jo (the helper), one stubbed forwarding room."""
    import personal_world.api as api_mod

    c = _app(tmp_path, monkeypatch)
    monkeypatch.setenv("PW_ROOMS_REGISTRY_URL", REGISTRY_URL)
    monkeypatch.setenv(TOKEN_ENV_NAME, TOKEN_VALUE)
    seen: list[httpx.Request] = []
    monkeypatch.setattr(api_mod, "_ROOMS", _rooms_stub(tmp_path, seen))
    sam_tok = _provision(c, "sam")
    jo_tok = _provision(c, "jo")
    return c, sam_tok, jo_tok, seen


def _grant_to_jo(c, sam_tok, **extra):
    return _grant(c, sam_tok, "jo", **extra)


class TestHelpingPrincipal:
    def test_header_without_a_grant_is_403_plain(self, helping):
        c, _sam_tok, jo_tok, _seen = helping
        r = c.get(
            "/api/rooms",
            headers={**_h(jo_tok, step_up=False), "X-Worlds-Helping": "sam"},
        )
        assert r.status_code == 403
        assert "permission to help" in r.json()["detail"]

    def test_header_is_honored_only_on_the_two_rooms_routes(self, helping):
        c, sam_tok, jo_tok, _seen = helping
        assert _grant_to_jo(c, sam_tok, can_act=True).status_code == 200
        h = {**_h(jo_tok), "X-Worlds-Helping": "sam"}
        # Even WITH a grant, any other route refuses the header — with a
        # plain message, and it is how a guardian is kept out of the
        # person's journal and world.
        for path in (
            "/api/me",
            "/api/journal",
            "/api/exports/world",
            "/api/people",
            "/api/me/limits",
        ):
            r = c.get(path, headers=h)
            assert r.status_code == 403, path
            body = r.json()
            assert "seeing needs" in body["detail"] or "permission to help" in body["detail"]
        # And it is refused on a room visit POST too (not an allowed route).
        r = c.post("/api/rooms/workshop/visit", headers=h, json={})
        assert r.status_code == 403

    def test_helper_sees_the_persons_needs_not_their_own(self, helping):
        c, sam_tok, jo_tok, _seen = helping
        assert _grant_to_jo(c, sam_tok).status_code == 200  # see-only grant
        own = c.get("/api/rooms", headers=_h(jo_tok, step_up=False)).json()
        assert JO_NEED["id"] in json.dumps(own)
        assert SAM_NEED["id"] not in json.dumps(own)
        helped = c.get(
            "/api/rooms",
            headers={**_h(jo_tok, step_up=False), "X-Worlds-Helping": "sam"},
        )
        assert helped.status_code == 200
        blob = json.dumps(helped.json())
        assert SAM_NEED["id"] in blob  # the person's need…
        assert JO_NEED["id"] not in blob  # …not the helper's own

    def test_act_for_needs_can_act(self, helping):
        c, sam_tok, jo_tok, _seen = helping
        assert _grant_to_jo(c, sam_tok, can_act=False).status_code == 200
        r = c.post(
            "/api/rooms/workshop/actions/approve",
            headers={
                **_h(jo_tok),
                "X-Worlds-Helping": "sam",
                "Idempotency-Key": "k-see-1",
            },
            json={},
        )
        assert r.status_code == 403
        assert "permission to help" in r.json()["detail"]

    def test_helper_action_records_by_and_for(self, helping):
        c, sam_tok, jo_tok, seen = helping
        assert _grant_to_jo(c, sam_tok, can_act=True).status_code == 200
        r = c.post(
            "/api/rooms/workshop/actions/approve",
            headers={
                **_h(jo_tok),
                "X-Worlds-Helping": "sam",
                "Idempotency-Key": "k-act-1",
            },
            json={},
        )
        assert r.status_code == 200, r.text
        receipt = r.json()["data"]
        assert receipt["ok"] is True
        # The room was told who the action is FOR.
        action_calls = [
            q for q in seen if q.url.path.startswith(rooms.ACTIONS_PATH + "/")
        ]
        assert action_calls
        assert action_calls[-1].headers.get(rooms.PRINCIPAL_HEADER) == "sam"
        # The person's "helped by" log shows who did it (BY), newest first.
        log = c.get("/api/me/helped-by", headers=_h(sam_tok)).json()["data"]
        assert len(log) == 1
        entry = log[0]
        assert entry["helper_id"] == "jo"  # by
        assert entry["action"] == "approve"
        assert entry["summary"] == "Done."
        assert entry["at"] == "2026-09-26T08:00:00Z"
        assert entry["undoable"] is False  # false unless a room receipt says so
        # The helper's own log stays empty; this is the person's view.
        assert c.get("/api/me/helped-by", headers=_h(jo_tok)).json()["data"] == []

    def test_revoked_grant_stops_helping_at_once(self, helping):
        c, sam_tok, jo_tok, _seen = helping
        grant = _grant_to_jo(c, sam_tok, can_act=True).json()["data"]
        h = {**_h(jo_tok, step_up=False), "X-Worlds-Helping": "sam"}
        assert c.get("/api/rooms", headers=h).status_code == 200
        c.delete(f"/api/me/helpers/{grant['grant_id']}", headers=_h(sam_tok))
        assert c.get("/api/rooms", headers=h).status_code == 403

    def test_helping_needs_a_real_person_target(self, helping):
        c, sam_tok, jo_tok, _seen = helping
        assert _grant_to_jo(c, sam_tok).status_code == 200
        # A made-up or unsafe id is refused, never a hint about existence.
        for bad in ("nobody", "../etc", "a" * 200):
            r = c.get(
                "/api/rooms",
                headers={**_h(jo_tok, step_up=False), "X-Worlds-Helping": bad},
            )
            assert r.status_code == 403, bad

    def test_agent_may_never_help(self, helping):
        c, _sam_tok, _jo_tok, _seen = helping
        bot = c.post(
            "/api/identity/agents",
            json={"agent_id": "kit-bot", "scopes": ["read"]},
            headers=OWNER,
        )
        bot_tok = bot.json()["data"]["token"]
        r = c.get(
            "/api/rooms",
            headers={**_h(bot_tok, step_up=False), "X-Worlds-Helping": "sam"},
        )
        assert r.status_code == 403


# ── 5. Supervised limits ──────────────────────────────────────────────

GOOD_LIMITS = [
    {"key": "chat_quiet_hours", "value": "21:00-07:00"},
    {"key": "no_outside_sharing", "value": True},
    {"key": "content_boundary", "value": "gentle"},
]


class TestLimits:
    def test_closed_key_set_with_who_and_when(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        sam_tok = _provision(c, "sam")
        # A supervised person, so /api/me reports the limits too.
        assert (
            c.put("/api/people/sam/role", json={"role": "supervised"}, headers=OWNER)
            .status_code
            == 200
        )
        r = c.put(
            "/api/people/sam/limits", json={"limits": GOOD_LIMITS}, headers=OWNER
        )
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert data["set_by"] == "primary"
        assert data["set_at"]
        assert data["limits"] == {
            "chat_quiet_hours": "21:00-07:00",
            "no_outside_sharing": True,
            "content_boundary": "gentle",
        }
        # The person sees their own limits and who set them.
        mine = c.get("/api/me/limits", headers=_h(sam_tok)).json()["data"]
        assert mine["set_by"] == "primary"
        assert mine["limits"]["content_boundary"] == "gentle"
        # And in /api/me (item 6).
        me = c.get("/api/me", headers=_h(sam_tok)).json()["data"]
        assert me["limits"]["set_by"] == "primary"

    def test_unknown_keys_and_bad_values_are_refused(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        _provision(c, "sam")

        def put(limits):
            return c.put(
                "/api/people/sam/limits", json={"limits": limits}, headers=OWNER
            )

        assert put([{"key": "screen_time", "value": 1}]).status_code == 422
        assert put([{"key": "chat_quiet_hours", "value": "night"}]).status_code == 422
        assert put([{"key": "chat_quiet_hours", "value": "24:00-07:00"}]).status_code == 422
        assert put([{"key": "no_outside_sharing", "value": "yes"}]).status_code == 422
        assert put([{"key": "content_boundary", "value": "wild"}]).status_code == 422
        assert put([{"key": "content_boundary", "value": "standard"}]).status_code == 200
        assert put([{"key": "content_boundary", "value": "gentle"},
                    {"key": "content_boundary", "value": "standard"}]).status_code == 422
        assert put({"key": "content_boundary", "value": "gentle"}).status_code == 422
        # Nothing bad landed.
        stored = people_mod.LimitsStore(tmp_path).get("sam")
        assert stored["limits"] == {"content_boundary": "standard"}

    def test_guardian_may_set_limits_others_may_not(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        sam_tok = _provision(c, "sam")
        jo_tok = _provision(c, "jo")
        alex_tok = _provision(c, "alex")
        # jo is sam's guardian: a live can_act grant from sam.
        assert _grant(c, sam_tok, "jo", can_act=True).status_code == 200
        r = c.put(
            "/api/people/sam/limits", json={"limits": GOOD_LIMITS}, headers=_h(jo_tok)
        )
        assert r.status_code == 200, r.text
        assert r.json()["data"]["set_by"] == "jo"
        # alex has no grant and no manage_people: refused.
        assert (
            c.put(
                "/api/people/sam/limits", json={"limits": GOOD_LIMITS},
                headers=_h(alex_tok),
            ).status_code
            == 403
        )
        # A revoked guardian is refused again.
        grant = c.get("/api/me/helpers", headers=_h(sam_tok)).json()["data"][0]
        c.delete(f"/api/me/helpers/{grant['grant_id']}", headers=_h(sam_tok))
        assert (
            c.put(
                "/api/people/sam/limits", json={"limits": GOOD_LIMITS},
                headers=_h(jo_tok),
            ).status_code
            == 403
        )

    def test_the_owner_is_not_limited_here(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        r = c.put(
            "/api/people/primary/limits", json={"limits": GOOD_LIMITS}, headers=OWNER
        )
        assert r.status_code == 403
        assert (
            c.put(
                "/api/people/nobody/limits", json={"limits": GOOD_LIMITS}, headers=OWNER
            ).status_code
            == 404
        )

    def test_a_guardian_cannot_read_the_persons_journal_or_world(
        self, tmp_path, monkeypatch
    ):
        """The 403 that proves helping never becomes a key to content."""
        c, sam_tok, jo_tok, _seen = self._with_grant(tmp_path, monkeypatch)
        # sam writes something only sam should ever see.
        secret = "sam-only note about the bike shed"
        assert (
            c.post("/api/journal", json={"text": secret}, headers=_h(sam_tok))
            .status_code
            == 200
        )
        h = {**_h(jo_tok, step_up=False), "X-Worlds-Helping": "sam"}
        # Trying to read sam's journal or world AS sam: 403.
        assert c.get("/api/journal", headers=h).status_code == 403
        assert c.get("/api/exports/world", headers=h).status_code == 403
        # Without the header jo reads only jo's own journal: the secret
        # is not there either. There is no route that would let it be.
        own = c.get("/api/journal", headers=_h(jo_tok, step_up=False))
        assert own.status_code == 200
        assert secret not in json.dumps(own.json())

    @staticmethod
    def _with_grant(tmp_path, monkeypatch):
        import personal_world.api as api_mod

        c = _app(tmp_path, monkeypatch)
        monkeypatch.setenv("PW_ROOMS_REGISTRY_URL", REGISTRY_URL)
        monkeypatch.setenv(TOKEN_ENV_NAME, TOKEN_VALUE)
        seen: list[httpx.Request] = []
        monkeypatch.setattr(api_mod, "_ROOMS", _rooms_stub(tmp_path, seen))
        sam_tok = _provision(c, "sam")
        jo_tok = _provision(c, "jo")
        assert _grant(c, sam_tok, "jo", can_act=True).status_code == 200
        return c, sam_tok, jo_tok, seen


# ── 6. /api/me fields ─────────────────────────────────────────────────


class TestApiMeFields:
    def test_helpers_granted_and_helping(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        sam_tok = _provision(c, "sam")
        jo_tok = _provision(c, "jo")
        grant = _grant(c, sam_tok, "jo", can_act=True).json()["data"]
        sam_me = c.get("/api/me", headers=_h(sam_tok)).json()["data"]
        assert sam_me["helpers_granted"] == 1
        jo_me = c.get("/api/me", headers=_h(jo_tok)).json()["data"]
        assert jo_me["helping"] == [
            {"person_id": "sam", "until": grant["until"], "can_act": True}
        ]
        # Revoking takes the count down (the grant stays visible in the
        # person's own list, but it is not live).
        c.delete(f"/api/me/helpers/{grant['grant_id']}", headers=_h(sam_tok))
        sam_me = c.get("/api/me", headers=_h(sam_tok)).json()["data"]
        assert sam_me["helpers_granted"] == 0
        jo_me = c.get("/api/me", headers=_h(jo_tok)).json()["data"]
        assert jo_me["helping"] == []

    def test_limits_only_for_supervised_guest_until_only_for_guests(
        self, tmp_path, monkeypatch
    ):
        c = _app(tmp_path, monkeypatch)
        kid_tok = _provision(c, "sam")
        assert (
            c.put("/api/people/sam/role", json={"role": "supervised"}, headers=OWNER)
            .status_code
            == 200
        )
        me = c.get("/api/me", headers=_h(kid_tok)).json()["data"]
        assert me["limits"] == {"limits": {}, "set_by": None, "set_at": None}
        c.put("/api/people/sam/limits", json={"limits": GOOD_LIMITS}, headers=OWNER)
        me = c.get("/api/me", headers=_h(kid_tok)).json()["data"]
        assert me["limits"]["set_by"] == "primary"
        assert me["limits"]["limits"]["content_boundary"] == "gentle"
        # A plain member has no limits field at all.
        member_tok = _provision(c, "jo")
        assert "limits" not in c.get("/api/me", headers=_h(member_tok)).json()["data"]
        # A guest gets guest_until; a member does not.
        assert "guest_until" not in c.get("/api/me", headers=_h(member_tok)).json()["data"]

    def test_agent_gets_only_the_base_fields(self, tmp_path, monkeypatch):
        c = _app(tmp_path, monkeypatch)
        bot = c.post(
            "/api/identity/agents",
            json={"agent_id": "kit-bot", "scopes": ["read"]},
            headers=OWNER,
        )
        bot_tok = bot.json()["data"]["token"]
        me = c.get("/api/me", headers=_h(bot_tok, step_up=False)).json()["data"]
        assert me["id"] == "kit-bot"
        for field in ("helpers_granted", "helping", "limits", "guest_until"):
            assert field not in me


# ── 7. Manifest honesty for every new route ───────────────────────────


class TestManifest:
    def test_new_routes_are_curated_with_the_right_gates(self, tmp_path, monkeypatch):
        from personal_world.api_manifest import endpoint_manifest

        c = _app(tmp_path, monkeypatch)
        rows = {
            (r["method"], r["path"]): r
            for r in endpoint_manifest(c.app.routes)["endpoints"]
        }
        step_up_writes = [
            ("POST", "/api/people/invites"),
            ("DELETE", "/api/people/invites/{invite_id}"),
            ("POST", "/api/me/helpers"),
            ("DELETE", "/api/me/helpers/{grant_id}"),
            ("PUT", "/api/people/{user_id}/limits"),
        ]
        for key in step_up_writes:
            assert key in rows, key
            assert rows[key]["gate"] == "step-up", key
            assert rows[key]["kind"] == "write", key
        for key in (
            ("GET", "/api/people/invites"),
            ("GET", "/api/me/helpers"),
            ("GET", "/api/me/helped-by"),
            ("GET", "/api/me/limits"),
        ):
            assert rows[key]["gate"] == "none", key
            assert rows[key]["kind"] == "read", key
        accept = rows[("POST", "/api/invites/accept")]
        assert accept["auth"] == "public"  # the token is the proof

    def test_no_api_route_is_uncatalogued(self, tmp_path, monkeypatch):
        """The new routes ride the manifest's own coverage claim."""
        from personal_world.api_manifest import endpoint_manifest

        c = _app(tmp_path, monkeypatch)
        payload = endpoint_manifest(c.app.routes)
        assert payload["curated_but_not_registered"] == []
        api_new = [
            r
            for r in payload["uncurated"]
            if "/invites" in r["path"] or "/helpers" in r["path"] or "limits" in r["path"]
        ]
        assert api_new == []
