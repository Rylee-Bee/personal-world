"""Scoped step-up relaxation: PUT/PATCH /api/prefs, POST
/api/discovery/interests, PUT /api/identity/principal and POST
/api/lore/confirm now accept a plain authenticated (single-factor)
request instead of demanding a live step-up grant.

Root cause this pins against regressing: require_step_up wraps
require_auth and additionally demands OIDC re-auth / true-loopback /
a delegated-proxy header, which is broken end-to-end for this
household. These five routes never needed that extra elevation — they
are the caller acting on their own account, not a sensitive act like
role changes, ownership transfer or agent provisioning — so they were
moved to require_auth alone. Every other require_step_up route is
untouched; POST /api/identity/agents (not in the change list) is
pinned here as the still-gated control.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from fastapi.testclient import TestClient  # noqa: E402

TOKEN = "instancetoken"  # pw-safety: synthetic
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    from personal_world.api import create_app
    import personal_world.api as api_mod

    monkeypatch.delenv("PW_DEV_AUTH_BYPASS", raising=False)
    monkeypatch.delenv("PW_PROXY_STEPUP_SECRET", raising=False)
    monkeypatch.setenv("PW_API_TOKEN", TOKEN)
    monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
    c = TestClient(create_app(tmp_path, tmp_path))
    # TestClient requests present with host "testclient", which
    # _is_true_loopback treats as the documented loopback exception —
    # that would satisfy require_step_up too and hide the very
    # distinction this file exists to pin (the red-path idiom
    # test_records.py / test_lore_sync.py already use). Turn it off so a
    # plain AUTH header with no step-up grant is the only thing on offer.
    monkeypatch.setattr(api_mod, "_is_true_loopback", lambda request: False)
    return c


class TestScopedStepUpRelaxation:
    """The five routes moved from require_step_up to require_auth now
    accept a plain single-factor session — no step-up grant needed."""

    def test_put_prefs_accepts_plain_auth(self, client):
        r = client.put("/api/prefs", json={"text_scale": 1.25}, headers=AUTH)
        assert r.status_code == 200, r.text

    def test_patch_prefs_accepts_plain_auth(self, client):
        r = client.patch("/api/prefs", json={"text_scale": 1.5}, headers=AUTH)
        assert r.status_code == 200, r.text

    def test_discovery_interests_accepts_plain_auth(self, client):
        r = client.post(
            "/api/discovery/interests",
            json={"id": "i1", "name": "reading"},
            headers=AUTH,
        )
        assert r.status_code == 200, r.text

    def test_identity_principal_accepts_plain_auth(self, client):
        r = client.put(
            "/api/identity/principal", json={"display_name": "Ry"}, headers=AUTH
        )
        assert r.status_code == 200, r.text

    def test_lore_confirm_accepts_plain_auth(self, client):
        r = client.post("/api/lore/confirm", json={"keys": []}, headers=AUTH)
        assert r.status_code == 200, r.text


class TestOtherStepUpRoutesUntouched:
    """A route the change list explicitly excludes stays step-up gated —
    proves the relaxation did not spread past the five named routes."""

    def test_identity_agents_still_requires_step_up(self, client):
        r = client.post(
            "/api/identity/agents", json={"agent_id": "bot"}, headers=AUTH
        )
        assert r.status_code == 403
