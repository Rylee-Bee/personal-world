"""POST /api/discovery/interests is a person's own-data write.

It needs a signed-in person (no step-up), never an agent key, and it
refuses an entry with no id or name.
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
    import personal_world.api as api_mod
    from personal_world.api import create_app

    monkeypatch.delenv("PW_DEV_AUTH_BYPASS", raising=False)
    monkeypatch.delenv("PW_PROXY_STEPUP_SECRET", raising=False)
    monkeypatch.setenv("PW_API_TOKEN", TOKEN)
    monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
    c = TestClient(create_app(tmp_path, tmp_path))
    # No step-up on offer: the plain credential is all there is.
    monkeypatch.setattr(api_mod, "_is_true_loopback", lambda request: False)
    return c


def _agent_token(client, scopes):
    r = client.post(
        "/api/identity/agents",
        json={"agent_id": "helper-bot", "scopes": scopes},
        headers={**AUTH, "X-PW-StepUp": "1"},
    )
    assert r.status_code == 200, r.text
    return r.json()["data"]["token"]


def test_agent_token_is_refused(client, tmp_path, monkeypatch):
    import personal_world.api as api_mod

    monkeypatch.setattr(api_mod, "_is_true_loopback", lambda request: True)
    token = _agent_token(client, ["read", "write"])
    monkeypatch.setattr(api_mod, "_is_true_loopback", lambda request: False)
    r = client.post(
        "/api/discovery/interests",
        json={"id": "i1", "name": "reading"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403, r.text
    assert not (tmp_path / "discovery.json").exists()


def test_person_still_adds_without_step_up(client):
    r = client.post(
        "/api/discovery/interests", json={"id": "i1", "name": "reading"}, headers=AUTH
    )
    assert r.status_code == 200, r.text


@pytest.mark.parametrize(
    "body",
    [{}, {"id": "", "name": "x"}, {"id": "x", "name": "  "}, {"id": 5, "name": "x"}, []],
)
def test_entry_without_id_or_name_is_refused(client, body):
    r = client.post("/api/discovery/interests", json=body, headers=AUTH)
    assert r.status_code == 422, r.text
