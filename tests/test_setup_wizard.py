"""First-run setup wizard: gating, invisible provisioning, honesty,
and the no-secrets contract.

Covers the P-universal deliverable: while `data/setup-complete` is
absent (or FORCE_SETUP=1), `/` redirects to `/setup`, the wizard is
served without auth, provisioning is create-if-absent and never
echoes the token, OIDC collection stores only an env var NAME for the
secret, and once setup is complete `/setup` refuses so the wizard can
never be re-run by accident.
"""

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from fastapi.testclient import TestClient  # noqa: E402


def _client(tmp_path, monkeypatch):
    """Fresh app over empty data/config dirs. PW_API_TOKEN is always
    monkeypatch-managed so the handler's in-process env write is
    undone at teardown (no leak into other tests)."""
    from personal_world.api import create_app

    monkeypatch.delenv("PW_API_TOKEN", raising=False)
    monkeypatch.delenv("FORCE_SETUP", raising=False)
    monkeypatch.setenv("PW_IDENTITY_MODE", "single")
    data_dir = tmp_path / "data"
    config_dir = tmp_path / "config"
    app = create_app(data_dir, config_dir)
    return TestClient(app), data_dir, config_dir


@pytest.fixture
def wizard_env(tmp_path, monkeypatch):
    return _client(tmp_path, monkeypatch)


def _read_token(data_dir: Path) -> str:
    for line in (data_dir / ".env").read_text().splitlines():
        if line.startswith("PW_API_TOKEN="):
            return line.split("=", 1)[1]
    raise AssertionError("no PW_API_TOKEN line in data/.env")


class TestFirstRunGating:
    def test_root_redirects_to_wizard(self, wizard_env):
        client, _, _ = wizard_env
        r = client.get("/", follow_redirects=False)
        assert r.status_code == 303
        assert r.headers["location"] == "/setup"

    def test_setup_serves_wizard_without_auth(self, wizard_env):
        client, _, _ = wizard_env
        r = client.get("/setup")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/html")
        assert "Set up Project Worlds" in r.text
        # Landmarks + skip link are part of the a11y floor.
        assert 'href="#main"' in r.text
        assert "<main" in r.text

    def test_wizard_assets_served(self, wizard_env):
        client, _, _ = wizard_env
        css = client.get("/setup/styles.css")
        assert css.status_code == 200
        assert css.headers["content-type"].startswith("text/css")
        js = client.get("/setup/wizard.js")
        assert js.status_code == 200
        assert "javascript" in js.headers["content-type"]

    def test_unknown_asset_404s(self, wizard_env):
        client, _, _ = wizard_env
        assert client.get("/setup/nope.txt").status_code == 404

    def test_healthz_reports_setup_needed(self, wizard_env):
        client, data_dir, _ = wizard_env
        assert client.get("/healthz").json()["setup_needed"] is True
        data_dir.mkdir(parents=True, exist_ok=True)
        (data_dir / "setup-complete").write_text("ok")
        assert client.get("/healthz").json()["setup_needed"] is False

    def test_setup_refuses_after_completion(self, wizard_env):
        client, data_dir, _ = wizard_env
        data_dir.mkdir(parents=True, exist_ok=True)
        (data_dir / "setup-complete").write_text("ok")
        r = client.get("/setup", follow_redirects=False)
        assert r.status_code == 303
        assert r.headers["location"] == "/"
        assert client.post("/api/setup-wizard/provision").status_code == 404
        assert client.post("/api/setup-wizard/finish").status_code == 404
        assert client.get("/api/setup-wizard/state").status_code == 404
        # / no longer hijacks into the wizard
        root = client.get("/", follow_redirects=False)
        assert root.status_code != 303

    def test_force_setup_reopens_wizard(self, tmp_path, monkeypatch):
        client, data_dir, _ = _client(tmp_path, monkeypatch)
        data_dir.mkdir(parents=True, exist_ok=True)
        (data_dir / "setup-complete").write_text("ok")
        assert client.get("/setup", follow_redirects=False).status_code == 303
        monkeypatch.setenv("FORCE_SETUP", "1")
        assert client.get("/setup").status_code == 200


class TestProvisioning:
    def test_creates_token_stores_and_index_without_marker(self, wizard_env):
        client, data_dir, config_dir = wizard_env
        r = client.post("/api/setup-wizard/provision")
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["data"]["token_ready"] is True
        assert body["data"]["search_index"] == "ready"
        token = _read_token(data_dir)
        assert len(token) >= 32
        # The token is NEVER echoed in any response or page.
        assert token not in r.text
        assert token not in client.get("/setup").text
        assert token not in client.get("/api/setup-wizard/state").text
        # Restrictive perms on the credential file.
        assert data_dir.joinpath(".env").stat().st_mode & 0o777 == 0o600
        # Stores created.
        assert (data_dir / "world.json").is_file()
        assert (data_dir / "journal.ndjson").exists()
        assert (config_dir / "connections.json").is_file()
        assert (data_dir / "memory.fts5.db").is_file()
        # The marker belongs to the finish step only.
        assert not (data_dir / "setup-complete").exists()

    def test_idempotent_and_never_overwrites(self, wizard_env):
        client, data_dir, _ = wizard_env
        assert client.post("/api/setup-wizard/provision").json()["ok"]
        first = (data_dir / ".env").read_text()
        world_before = (data_dir / "world.json").read_text()
        again = client.post("/api/setup-wizard/provision")
        assert again.json()["ok"] is True
        assert (data_dir / ".env").read_text() == first
        assert first.count("PW_API_TOKEN=") == 1
        assert (data_dir / "world.json").read_text() == world_before

    def test_existing_env_token_is_kept(self, tmp_path, monkeypatch):
        client, data_dir, _ = _client(tmp_path, monkeypatch)
        data_dir.mkdir(parents=True, exist_ok=True)
        (data_dir / ".env").write_text('PW_API_TOKEN="kept-token-01"\n')
        r = client.post("/api/setup-wizard/provision")
        body = r.json()
        assert body["ok"] is True
        assert body["data"]["token_state"] == "already-present"
        assert (data_dir / ".env").read_text() == 'PW_API_TOKEN="kept-token-01"\n'

    def test_existing_env_file_is_appended_not_clobbered(self, tmp_path, monkeypatch):
        client, data_dir, _ = _client(tmp_path, monkeypatch)
        data_dir.mkdir(parents=True, exist_ok=True)
        (data_dir / ".env").write_text("OTHER=keepme\n")
        r = client.post("/api/setup-wizard/provision")
        body = r.json()
        assert body["ok"] is True
        assert body["data"]["token_state"] == "generated (appended data/.env)"
        text = (data_dir / ".env").read_text()
        assert "OTHER=keepme" in text
        assert "PW_API_TOKEN=" in text

    def test_environment_token_needs_no_file(self, tmp_path, monkeypatch):
        client, data_dir, _ = _client(tmp_path, monkeypatch)
        monkeypatch.setenv("PW_API_TOKEN", "compose-provided-token")
        r = client.post("/api/setup-wizard/provision")
        body = r.json()
        assert body["ok"] is True
        assert body["data"]["token_state"] == "environment"
        assert not (data_dir / ".env").exists()
        assert "compose-provided-token" not in r.text


class TestAuthChoice:
    def _provision(self, client):
        assert client.post("/api/setup-wizard/provision").json()["ok"]

    def test_local_choice_zero_config(self, wizard_env):
        client, data_dir, config_dir = wizard_env
        self._provision(client)
        r = client.post("/api/setup-wizard/auth-choice", json={"choice": "local"})
        assert r.json()["ok"] is True
        assert not (config_dir / "oidc.json").exists()
        choices = json.loads((data_dir / "setup-choices.json").read_text())
        assert choices["auth_choice"] == "local"

    def test_unknown_choice_rejected_plainly(self, wizard_env):
        client, _, _ = wizard_env
        self._provision(client)
        r = client.post("/api/setup-wizard/auth-choice", json={"choice": "magic"})
        assert r.status_code == 422
        assert r.json()["ok"] is False
        assert "choose" in r.json()["warnings"][0].lower()

    def test_oidc_choice_stores_env_name_only(self, wizard_env):
        client, data_dir, config_dir = wizard_env
        self._provision(client)
        r = client.post(
            "/api/setup-wizard/auth-choice",
            json={
                "choice": "oidc",
                "issuer_url": "https://sso.example.invalid/",
                "client_id": "project-worlds",
                "client_secret_env": "MY_SSO_SECRET",
            },
        )
        body = r.json()
        assert body["ok"] is True
        # Honest warning: the env var is not set yet.
        assert any("MY_SSO_SECRET" in w and "not set" in w for w in body["warnings"])
        cfg = json.loads((config_dir / "oidc.json").read_text())
        assert cfg["issuer"] == "https://sso.example.invalid"
        assert cfg["client_id"] == "project-worlds"
        assert cfg["client_secret_env"] == "MY_SSO_SECRET"
        # Only the NAME is stored — no secret value anywhere.
        choices = json.loads((data_dir / "setup-choices.json").read_text())
        assert choices["oidc"]["client_secret_env"] == "MY_SSO_SECRET"
        assert set(choices["oidc"].keys()) == {
            "issuer",
            "client_id",
            "client_secret_env",
        }

    def test_oidc_config_never_overwritten(self, wizard_env):
        client, _, config_dir = wizard_env
        self._provision(client)
        first = {
            "choice": "oidc",
            "issuer_url": "https://first.example.invalid",
            "client_id": "one",
            "client_secret_env": "A_B",
        }
        assert client.post("/api/setup-wizard/auth-choice", json=first).json()["ok"]
        second = {
            "choice": "oidc",
            "issuer_url": "https://second.example.invalid",
            "client_id": "two",
            "client_secret_env": "C_D",
        }
        r = client.post("/api/setup-wizard/auth-choice", json=second)
        assert any("left it untouched" in w for w in r.json()["warnings"])
        cfg = json.loads((config_dir / "oidc.json").read_text())
        assert cfg["issuer"] == "https://first.example.invalid"

    def test_oidc_validation_is_honest(self, wizard_env):
        client, _, _ = wizard_env
        self._provision(client)
        bad = [
            {
                "choice": "oidc",
                "issuer_url": "ftp://x.example.invalid",
                "client_id": "c",
                "client_secret_env": "S",
            },
            {
                "choice": "oidc",
                "issuer_url": "https://x.example.invalid",
                "client_id": "",
                "client_secret_env": "S",
            },
            {
                "choice": "oidc",
                "issuer_url": "https://x.example.invalid",
                "client_id": "c",
                "client_secret_env": "not a name!",
            },
        ]
        for payload in bad:
            r = client.post("/api/setup-wizard/auth-choice", json=payload)
            assert r.status_code == 422, payload
            assert r.json()["warnings"], payload


class TestDiscoveryTest:
    def test_bad_scheme_is_bad_config(self, wizard_env):
        client, _, _ = wizard_env
        r = client.post("/api/setup-wizard/test-oidc", json={"issuer_url": "not-a-url"})
        body = r.json()
        assert body["ok"] is False
        assert body["data"]["status"] == "bad_config"
        assert body["data"]["detail"]

    def test_unreachable_is_reported_as_unreachable(self, wizard_env):
        client, _, _ = wizard_env
        # Port 9 (discard) on loopback refuses connections; the wizard
        # must say so plainly instead of faking success.
        r = client.post(
            "/api/setup-wizard/test-oidc", json={"issuer_url": "http://127.0.0.1:9"}
        )
        body = r.json()
        assert body["ok"] is False
        assert body["data"]["status"] == "unreachable"
        assert "could not reach" in body["data"]["detail"].lower()

    def test_no_secrets_in_response(self, wizard_env):
        client, _, _ = wizard_env
        r = client.post(
            "/api/setup-wizard/test-oidc", json={"issuer_url": "http://127.0.0.1:9"}
        )
        text = r.text.lower()
        assert "client_secret" not in text
        token = os.environ.get("PW_API_TOKEN", "")
        assert not token or token not in r.text


class TestComfortAndFinish:
    def test_comfort_applies_validated_prefs(self, wizard_env):
        client, data_dir, _ = wizard_env
        client.post("/api/setup-wizard/provision")
        r = client.post(
            "/api/setup-wizard/comfort",
            json={"larger_text": True, "gentle_animations": False},
        )
        assert r.json()["ok"] is True
        assert r.json()["data"]["applied"]["text_scale"] == 1.25
        assert r.json()["data"]["applied"]["motion"] == "reduced"
        world = json.loads((data_dir / "world.json").read_text())
        assert world["accessibility"]["text_scale"] == 1.25

    def test_finish_writes_marker_and_signs_in(self, wizard_env):
        client, data_dir, _ = wizard_env
        client.post("/api/setup-wizard/provision")
        client.post("/api/setup-wizard/auth-choice", json={"choice": "local"})
        client.post("/api/setup-wizard/comfort", json={})
        r = client.post("/api/setup-wizard/finish")
        body = r.json()
        assert body["ok"] is True
        assert body["data"]["redirect"] == "/"
        assert (data_dir / "setup-complete").is_file()
        # The person lands signed in: a real session cookie, no token.
        assert "pw_session=" in r.headers.get("set-cookie", "")
        assert _read_token(data_dir) not in r.text
        # The journal recorded the event.
        entries = [
            json.loads(l)
            for l in (data_dir / "journal.ndjson").read_text().splitlines()
            if l
        ]
        assert any("first-run setup completed" in e["summary"] for e in entries)
        # And the wizard now refuses to run again.
        assert client.get("/setup", follow_redirects=False).status_code == 303
        assert client.post("/api/setup-wizard/provision").status_code == 404

    def test_state_reports_progress(self, wizard_env):
        client, data_dir, _ = wizard_env
        state = client.get("/api/setup-wizard/state").json()["data"]
        assert state["setup_needed"] is True
        assert state["provisioned"]["env_file"] is False
        client.post("/api/setup-wizard/provision")
        client.post("/api/setup-wizard/auth-choice", json={"choice": "local"})
        state = client.get("/api/setup-wizard/state").json()["data"]
        assert state["provisioned"]["env_file"] is True
        assert state["choices"]["auth_choice"] == "local"
        assert _read_token(data_dir) not in client.get("/api/setup-wizard/state").text
