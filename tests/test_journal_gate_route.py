"""Journal gate route + scope wiring (step 3-4 of the journal-gate
design, 2026-09-27). Proves the isolation property end to end over
real HTTP: a token holding ONLY the ``journal_gate`` scope reaches the
gate and nothing else; the existing hard wall on /api/journal and
/api/recall stays exactly as strict as before for every agent,
scoped or not.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from fastapi.testclient import TestClient  # noqa: E402

from personal_world.api import create_app  # noqa: E402
from personal_world.init import init_world  # noqa: E402


def _multi_client(tmp_path, monkeypatch):
    monkeypatch.setenv("PW_API_TOKEN", "instancetoken")
    monkeypatch.setenv("PW_IDENTITY_MODE", "multi")
    monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
    init_world(tmp_path, tmp_path)
    (tmp_path / "setup-complete").write_text("ok")
    return TestClient(create_app(tmp_path, tmp_path))


def _make_user_and_agent(c, scopes):
    tok = {"Authorization": "Bearer instancetoken"}
    r = c.post("/api/identity/users", json={"user_id": "beta"}, headers=tok)
    assert r.status_code == 200, r.text
    user_tok = r.json()["data"]["token"]
    r = c.post(
        "/api/identity/agents",
        json={"agent_id": "gatebot", "scopes": scopes},
        headers={"Authorization": f"Bearer {user_tok}", "X-PW-StepUp": "1"},
    )
    assert r.status_code == 200, r.text
    return user_tok, r.json()["data"]["token"]


ASK = {"ask": "relates_to", "topic": "migraine", "window_days": 7}


class TestGateAuth:
    def test_auth_required(self, tmp_path, monkeypatch):
        c = _multi_client(tmp_path, monkeypatch)
        assert c.post("/api/journal/gate", json=ASK).status_code == 401

    def test_person_can_ask(self, tmp_path, monkeypatch):
        c = _multi_client(tmp_path, monkeypatch)
        user_tok, _ = _make_user_and_agent(c, ["journal_gate"])
        r = c.post(
            "/api/journal/gate", json=ASK, headers={"Authorization": f"Bearer {user_tok}"}
        )
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert set(data.keys()) == {"answer", "strength", "when", "count"}
        assert data["answer"] in ("yes", "no", "unsure")


class TestScopeIsolation:
    def test_journal_gate_scoped_agent_can_ask(self, tmp_path, monkeypatch):
        c = _multi_client(tmp_path, monkeypatch)
        _, agent_tok = _make_user_and_agent(c, ["journal_gate"])
        r = c.post(
            "/api/journal/gate", json=ASK, headers={"Authorization": f"Bearer {agent_tok}"}
        )
        assert r.status_code == 200, r.text
        assert set(r.json()["data"].keys()) == {"answer", "strength", "when", "count"}

    def test_journal_gate_scoped_agent_cannot_read_journal(self, tmp_path, monkeypatch):
        """The existing hard wall is untouched: this scope does not
        unlock /api/journal, only the gate."""
        c = _multi_client(tmp_path, monkeypatch)
        _, agent_tok = _make_user_and_agent(c, ["journal_gate"])
        headers = {"Authorization": f"Bearer {agent_tok}"}
        assert c.get("/api/journal", headers=headers).status_code == 403
        assert c.get("/api/journal/last", headers=headers).status_code == 403
        assert c.get("/api/journal/audit", headers=headers).status_code == 403

    def test_journal_gate_scoped_agent_cannot_read_recall(self, tmp_path, monkeypatch):
        c = _multi_client(tmp_path, monkeypatch)
        _, agent_tok = _make_user_and_agent(c, ["journal_gate"])
        r = c.get("/api/recall", params={"q": "migraine"}, headers={"Authorization": f"Bearer {agent_tok}"})
        assert r.status_code == 403

    def test_journal_gate_scoped_agent_cannot_reach_other_confined_routes(self, tmp_path, monkeypatch):
        c = _multi_client(tmp_path, monkeypatch)
        _, agent_tok = _make_user_and_agent(c, ["journal_gate"])
        headers = {"Authorization": f"Bearer {agent_tok}"}
        assert c.get("/api/memory/search", params={"q": "x"}, headers=headers).status_code == 403
        assert c.post("/api/stickers/found", json={}, headers=headers).status_code in (403, 422, 404)

    def test_learning_scoped_agent_cannot_reach_gate(self, tmp_path, monkeypatch):
        """Confinement runs both directions: a token scoped to a
        DIFFERENT narrow door does not fall through to this one."""
        c = _multi_client(tmp_path, monkeypatch)
        _, agent_tok = _make_user_and_agent(c, ["learning"])
        r = c.post(
            "/api/journal/gate", json=ASK, headers={"Authorization": f"Bearer {agent_tok}"}
        )
        assert r.status_code == 403

    def test_full_person_journal_access_unaffected(self, tmp_path, monkeypatch):
        """Regression: adding the gate route/scope does not change
        ordinary person access to their own journal."""
        c = _multi_client(tmp_path, monkeypatch)
        user_tok, _ = _make_user_and_agent(c, ["journal_gate"])
        headers = {"Authorization": f"Bearer {user_tok}"}
        r = c.post("/api/journal", json={"text": "testing the gate did not break normal journaling"}, headers=headers)
        assert r.status_code == 200, r.text
        r = c.get("/api/journal", headers=headers)
        assert r.status_code == 200, r.text


class TestGateRateLimit:
    def test_rate_limit_returns_429_after_threshold(self, tmp_path, monkeypatch):
        c = _multi_client(tmp_path, monkeypatch)
        _, agent_tok = _make_user_and_agent(c, ["journal_gate"])
        headers = {"Authorization": f"Bearer {agent_tok}"}
        statuses = [
            c.post("/api/journal/gate", json=ASK, headers=headers).status_code
            for _ in range(25)
        ]
        assert 200 in statuses
        assert 429 in statuses
