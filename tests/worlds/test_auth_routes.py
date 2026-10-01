"""Tests for personal_world.worlds.auth_routes and owner policy (fail closed, owner allow-list)."""
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from personal_world.oidc import FLOW_COOKIE, OIDCLoginError, VerifiedIdentity
from personal_world.worlds.auth_routes import (FREE_FAILURES, FRESH_AUTH_SECONDS, GLOBAL_CEILING, GLOBAL_GAP, MAX_BACKOFF,
                                               OIDC_LOGIN_KEY, register_auth_routes)
from personal_world.worlds.authn import CSRF_COOKIE, SESSION_COOKIE, Auth, load_csrf_key
from personal_world.worlds.db import Database
from personal_world.worlds.owner import load_owner_policy

ORIGIN = "https://worlds.example.test"
ISSUER = "https://auth.example.test"
OWNER_SUB = "owner-subject-123"


class Clock:
    t = 2_000_000.0

    def __call__(self):
        return self.t


class FakeClient:
    def __init__(self):
        self.redirect_uris = []
        self.identity = VerifiedIdentity(sub=OWNER_SUB, issuer=ISSUER, auth_time=Clock.t)
        self.raise_on_complete = None

    def start_login(self, redirect_uri, link_to=None, step_up_for=None, return_to=None):
        self.redirect_uris.append(redirect_uri)
        pending = SimpleNamespace(state="st", step_up_for=step_up_for, return_to=return_to)
        self.pending = pending
        return f"{ISSUER}/authorize?state=st", pending, "flowcookie"

    def read_pending(self, cookie):
        if cookie != "flowcookie":
            raise OIDCLoginError("bad flow", error_code="oidc_state_mismatch")
        return self.pending

    def complete_login(self, code, pending):
        if self.raise_on_complete:
            raise self.raise_on_complete
        return self.identity


def write_policy(cfg, *, oidc=True, bootstrap=True):
    lines = ["schema_version: 1", f"public_origin: {ORIGIN}"]
    if oidc:
        lines += ["oidc:", f"  issuer: {ISSUER}", f"  subject: {OWNER_SUB}"]
    if bootstrap:
        lines += ["bootstrap:", "  enabled: true", "  secret_ref: env:PW_TEST_BOOTSTRAP"]
    (cfg / "owner.yaml").write_text("\n".join(lines) + "\n")


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("PW_TEST_BOOTSTRAP", "open-sesame-123")
    cfg = tmp_path / "cfg"; cfg.mkdir()
    write_policy(cfg)
    clock = Clock()
    db = Database.in_dir(tmp_path / "data")
    auth = Auth(db, load_csrf_key(tmp_path / "data"), frozenset({ORIGIN}), clock=clock,
                binding=lambda: load_owner_policy(cfg).binding())
    fake = FakeClient()
    service = SimpleNamespace(client=lambda: fake)
    app = FastAPI()
    register_auth_routes(app, auth, lambda: load_owner_policy(cfg), service)
    c = TestClient(app, base_url=ORIGIN, follow_redirects=False)
    return SimpleNamespace(auth=auth, c=c, fake=fake, clock=clock, cfg=cfg, tmp=tmp_path)


def boot(e, token="open-sesame-123", origin=ORIGIN):
    return e.c.post("/api/auth/bootstrap", json={"token": token}, headers={"Origin": origin} if origin else {})


def test_policy_fails_closed_when_missing_or_invalid(tmp_path):
    assert load_owner_policy(tmp_path).file is None
    (tmp_path / "owner.yaml").write_text("schema_version: 2\npublic_origin: https://x.test\n")
    assert load_owner_policy(tmp_path).file is None
    (tmp_path / "owner.yaml").write_text("schema_version: 1\npublic_origin: https://x.test/path\n")
    assert load_owner_policy(tmp_path).file is None
    (tmp_path / "owner.yaml").write_text("schema_version: 1\npublic_origin: https://u:p@x.test\n")
    assert load_owner_policy(tmp_path).file is None
    p = load_owner_policy(tmp_path)
    assert not p.is_owner_identity("a", "b") and not p.bootstrap_matches("x")


def test_session_info_unauthenticated_leaks_nothing(env):
    r = env.c.get("/api/auth/session").json()
    assert r == {"authenticated": False, "oidc_available": True, "bootstrap_available": True}


def test_bootstrap_requires_origin_and_right_secret(env):
    assert boot(env, origin=None).status_code == 403
    assert boot(env, origin="https://evil.example").status_code == 403
    assert boot(env, token="wrong").status_code == 401
    assert SESSION_COOKIE not in env.c.cookies
    r = boot(env)
    assert r.status_code == 200
    set_cookie = " ".join(r.headers.get_list("set-cookie")).lower()
    assert "httponly" in set_cookie and "secure" in set_cookie and "samesite=lax" in set_cookie
    assert "samesite=strict" in set_cookie
    info = env.c.get("/api/auth/session").json()
    assert info["authenticated"] and info["principal"] == "owner" and info["step_up"] is False and info["csrf_token"]


def boot_from(env, ip, token="nope"):
    from fastapi.testclient import TestClient
    c = TestClient(env.c.app, base_url=ORIGIN, follow_redirects=False, client=(ip, 5555))
    return c, c.post("/api/auth/bootstrap", json={"token": token}, headers={"Origin": ORIGIN})


def test_bootstrap_backoff_is_per_client_and_exponential(env):
    attacker = "203.0.113.7"
    for _ in range(FREE_FAILURES):
        assert boot_from(env, attacker)[1].status_code == 401          # the first few guesses cost nothing
    c, r = boot_from(env, attacker)
    assert r.status_code == 401                                          # this one is wrong too, and now arms the delay
    r = c.post("/api/auth/bootstrap", json={"token": "open-sesame-123"}, headers={"Origin": ORIGIN})
    assert r.status_code == 429 and int(r.headers["retry-after"]) >= 5   # even the RIGHT secret waits: no guessing in back-off
    assert SESSION_COOKIE not in r.headers.get("set-cookie", "")
    # the owner, from another address, is not locked out by the attacker
    owner_c, ok = boot_from(env, "198.51.100.9", token="open-sesame-123")
    assert ok.status_code == 200
    # delays double and are capped
    env.clock.t += 6
    assert boot_from(env, attacker)[1].status_code == 401                # wrong again -> next delay is 10s
    env.clock.t += 6
    assert boot_from(env, attacker, "open-sesame-123")[1].status_code == 429
    env.clock.t += 5
    assert boot_from(env, attacker, "open-sesame-123")[1].status_code == 200
    for _ in range(40):
        env.clock.t += MAX_BACKOFF + 1
        boot_from(env, "203.0.113.50")
    c2, r2 = boot_from(env, "203.0.113.50")
    r2 = c2.post("/api/auth/bootstrap", json={"token": "x"}, headers={"Origin": ORIGIN})
    assert int(r2.headers.get("retry-after", "0")) <= int(MAX_BACKOFF) + 1


def test_global_ceiling_slows_but_never_locks_the_owner_out(env):
    for i in range(GLOBAL_CEILING + 1):                                   # a botnet: many addresses, one guess each
        boot_from(env, f"192.0.2.{i % 250 + 1}")
    _, fast = boot_from(env, "198.51.100.77", token="open-sesame-123")
    _, again = boot_from(env, "198.51.100.78", token="open-sesame-123")
    assert 429 in (fast.status_code, again.status_code)                   # attempts are spaced out...
    env.clock.t += GLOBAL_GAP + 0.1
    _, later = boot_from(env, "198.51.100.79", token="open-sesame-123")
    assert later.status_code == 200                                        # ...but the owner gets through


def test_oidc_login_is_never_blocked_by_bootstrap_lockout(env):
    for _ in range(FREE_FAILURES + 3):
        boot_from(env, "203.0.113.7")
    cb = login_via_oidc(env)
    assert cb.status_code == 303 and env.c.get("/api/auth/session").json()["authenticated"]


def test_sessions_end_when_the_owner_identity_changes(env):
    login_via_oidc(env)
    assert env.c.get("/api/auth/session").json()["authenticated"]
    (env.cfg / "owner.yaml").write_text((env.cfg / "owner.yaml").read_text().replace(OWNER_SUB, "someone-else"))
    assert env.c.get("/api/auth/session").json()["authenticated"] is False


def test_bootstrap_switches_itself_off_once_oidc_has_worked(env):
    assert boot_from(env, "198.51.100.1", "open-sesame-123")[1].status_code == 200   # before OIDC has worked: fine
    assert env.c.get("/api/auth/session").json()["bootstrap_available"] is True
    login_via_oidc(env)
    assert env.auth.get_state(OIDC_LOGIN_KEY)
    assert env.c.get("/api/auth/session").json()["bootstrap_available"] is False
    assert boot_from(env, "198.51.100.2", "open-sesame-123")[1].status_code == 401   # bootstrap sign-in is off now
    sid = env.c.cookies.get(SESSION_COOKIE)
    h = {"Origin": ORIGIN, "X-CSRF-Token": env.auth.csrf_token(sid)}
    assert env.c.post("/api/auth/step-up", json={"token": "open-sesame-123"}, headers=h).status_code == 401   # and so is its step-up


def test_bootstrap_stays_available_when_oidc_is_configured_but_never_used(env):
    assert env.c.get("/api/auth/session").json()["bootstrap_available"] is True
    assert boot_from(env, "198.51.100.1", "open-sesame-123")[1].status_code == 200


def test_bootstrap_disabled_without_policy(env):
    (env.cfg / "owner.yaml").unlink()
    assert boot(env).status_code == 401


def test_step_up_with_bootstrap_secret_needs_session_csrf(env):
    boot(env)
    sid = env.c.cookies.get(SESSION_COOKIE)
    h = {"Origin": ORIGIN, "X-CSRF-Token": env.auth.csrf_token(sid)}
    assert env.c.post("/api/auth/step-up", json={"token": "open-sesame-123"}).status_code == 403   # no origin/csrf
    assert env.c.post("/api/auth/step-up", json={"token": "bad"}, headers=h).status_code == 401
    assert env.c.post("/api/auth/step-up", json={"token": "open-sesame-123"}, headers=h).status_code == 200
    assert env.c.get("/api/auth/session").json()["step_up"] is True


def test_logout_invalidates_server_side(env):
    boot(env)
    sid = env.c.cookies.get(SESSION_COOKIE)
    h = {"Origin": ORIGIN, "X-CSRF-Token": env.auth.csrf_token(sid)}
    assert env.c.post("/api/auth/logout").status_code == 403
    assert env.c.post("/api/auth/logout", headers=h).status_code == 200
    assert env.auth.sessions.get(sid) is None


def login_via_oidc(e):
    r = e.c.get("/api/auth/oidc/login")
    assert r.status_code == 303 and r.headers["location"].startswith(ISSUER)
    e.c.cookies.set(FLOW_COOKIE, "flowcookie")
    return e.c.get("/api/auth/oidc/callback", params={"code": "c", "state": "st"})


def test_oidc_owner_gets_a_session_and_redirect_uri_ignores_host_header(env):
    r = env.c.get("/api/auth/oidc/login", headers={"Host": "evil.example"})
    assert env.fake.redirect_uris == [f"{ORIGIN}/api/auth/oidc/callback"]
    cb = login_via_oidc(env)
    assert cb.status_code == 303 and cb.headers["location"] == "/"
    assert env.c.get("/api/auth/session").json()["authenticated"]


@pytest.mark.parametrize("iss,sub", [(ISSUER, "someone-else"), ("https://other.example", OWNER_SUB), ("", OWNER_SUB), (ISSUER, "")])
def test_oidc_non_owner_is_refused_without_session(env, iss, sub):
    env.fake.identity = VerifiedIdentity(sub=sub, issuer=iss, auth_time=env.clock.t)
    cb = login_via_oidc(env)
    assert cb.status_code == 403 and SESSION_COOKIE not in cb.headers.get("set-cookie", "")
    assert env.c.get("/api/auth/session").json()["authenticated"] is False


def test_oidc_state_mismatch_and_provider_error_and_failures(env):
    env.c.get("/api/auth/oidc/login")
    env.c.cookies.set(FLOW_COOKIE, "flowcookie")
    refused = (400, 403)
    assert env.c.get("/api/auth/oidc/callback", params={"code": "c", "state": "WRONG"}).status_code in refused
    assert env.c.get("/api/auth/oidc/callback", params={"error": "access_denied"}).status_code in refused
    env.fake.raise_on_complete = OIDCLoginError("boom", error_code="oidc_token_exchange_failed")
    assert env.c.get("/api/auth/oidc/callback", params={"code": "c", "state": "st"}).status_code in refused
    env.c.cookies.delete(FLOW_COOKIE)
    assert env.c.get("/api/auth/oidc/callback", params={"code": "c", "state": "st"}).status_code in refused
    assert env.c.get("/api/auth/session").json()["authenticated"] is False


def test_oidc_unconfigured_is_503_and_never_signs_in(env):
    write_policy(env.cfg, oidc=False)
    assert env.c.get("/api/auth/oidc/login").status_code == 503
    assert env.c.get("/api/auth/oidc/callback", params={"code": "c", "state": "st"}).status_code == 503


def test_oidc_step_up_needs_fresh_auth_by_the_owner_in_the_same_session(env):
    login_via_oidc(env)
    r = env.c.get("/api/auth/oidc/step-up", params={"return_to": "//evil.example/x"})
    assert r.status_code == 303 and env.fake.pending.return_to == "/"          # open redirect refused
    env.c.cookies.set(FLOW_COOKIE, "flowcookie")
    env.fake.identity = VerifiedIdentity(sub=OWNER_SUB, issuer=ISSUER, auth_time=env.clock.t - FRESH_AUTH_SECONDS - 5)
    assert env.c.get("/api/auth/oidc/callback", params={"code": "c", "state": "st"}).status_code == 403  # stale auth_time
    assert env.c.get("/api/auth/session").json()["step_up"] is False
    env.c.get("/api/auth/oidc/step-up", params={"return_to": "/connect"})
    env.c.cookies.set(FLOW_COOKIE, "flowcookie")
    env.fake.identity = VerifiedIdentity(sub=OWNER_SUB, issuer=ISSUER, auth_time=env.clock.t - 5)
    ok = env.c.get("/api/auth/oidc/callback", params={"code": "c", "state": "st"})
    assert ok.status_code == 303 and ok.headers["location"] == "/connect"
    assert env.c.get("/api/auth/session").json()["step_up"] is True


def test_oidc_step_up_requires_a_session(env):
    assert env.c.get("/api/auth/oidc/step-up").status_code == 401
