"""Follow-ups A-E from the #233 re-check: credential header names, hard deadline, delete of invalid files,
IPv6 Host parsing, and the dev sender's port rule."""
import socket
import threading
import time

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from personal_world.worlds.confinement import ConfinementError, confined_request
from personal_world.worlds.models import Auth, Provider, Request
from personal_world.worlds.reference_provider import ReferenceServer, reference_send
from personal_world.worlds.server import build_app, parse_host


# ---- A
@pytest.mark.parametrize("name", ["Host", "host", "Cookie", "Set-Cookie", "Transfer-Encoding", "Content-Length", "Content-Type",
                                  "Authorization", "Proxy-Authorization", "Forwarded", "X-Forwarded-For", "X-Forwarded-Host",
                                  "X-Forwarded-Proto", "X-Real-IP", "Connection", "Upgrade", "TE", "Via", "Origin",
                                  "Proxy-Foo", "Sec-Fetch-Mode", "Idempotency-Key", "bad name", "a:b", "", "x" * 65,
                                  "x\r\ny", "-lead", "name_underscore"])
def test_credential_header_names_are_constrained(name):
    with pytest.raises(ValidationError):
        Auth(type="header", header_name=name, secret_ref="env:K")


@pytest.mark.parametrize("name", ["X-Api-Key", "X-Token", "Api-Key", "Ocp-Apim-Subscription-Key", "apikey"])
def test_ordinary_credential_header_names_ok(name):
    assert Auth(type="header", header_name=name, secret_ref="env:K").header_name == name


def test_confinement_refuses_a_bad_credential_header_even_if_validation_was_bypassed(monkeypatch):
    monkeypatch.setenv("K", "v")
    bad = Auth.model_construct(type="header", header_name="Host", secret_ref="env:K")
    p = Provider.model_construct(schema_version=1, id="p", name="P", kind="http", base_url="http://127.0.0.1:9", path_prefix="",
                                 auth=bad, network=__import__("personal_world.worlds.models", fromlist=["Network"]).Network(lan=True),
                                 tls_verify=True, timeout_s=1, max_bytes=100)
    out = confined_request(p, Request(id="p.r", provider="p", path="/x"), effect="read")
    assert isinstance(out, ConfinementError) and out.error_class == "confinement_denied"


# ---- B: one blocked read must not outlive the budget
def _silent_server(delay):
    """Accepts and says nothing for `delay` seconds (header-phase stall)."""
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(5)
    conns = []

    def run():
        while True:
            try:
                c, _ = srv.accept()
            except OSError:
                return
            conns.append(c)
            threading.Timer(delay, c.close).start()

    threading.Thread(target=run, daemon=True).start()
    return srv


def test_confinement_deadline_covers_a_stalled_body_read():
    with ReferenceServer() as ref:
        p = Provider(id="p", name="P", kind="http", base_url=ref.base_url, network={"lan": True}, timeout_s=0.5)
        t0 = time.monotonic()
        out = confined_request(p, Request(id="p.r", provider="p", path="/stall"), effect="read")
        assert isinstance(out, ConfinementError) and out.error_class == "timeout"
        assert time.monotonic() - t0 < 1.0, time.monotonic() - t0   # not ~2x the budget


def test_confinement_deadline_covers_a_stalled_header_phase():
    srv = _silent_server(5)
    try:
        port = srv.getsockname()[1]
        p = Provider(id="p", name="P", kind="http", base_url=f"http://127.0.0.1:{port}", network={"lan": True}, timeout_s=0.6)
        t0 = time.monotonic()
        out = confined_request(p, Request(id="p.r", provider="p", path="/x"), effect="read")
        assert isinstance(out, ConfinementError) and out.error_class == "timeout"
        assert time.monotonic() - t0 < 1.2, time.monotonic() - t0
    finally:
        srv.close()


def test_reference_sender_has_the_same_hard_deadline():
    with ReferenceServer() as ref:
        p = Provider(id="p", name="P", kind="reference", base_url=ref.base_url, network={"lan": True}, timeout_s=0.5)
        t0 = time.monotonic()
        out = reference_send({})(p, Request(id="p.r", provider="p", path="/stall"), effect="read")
        assert isinstance(out, ConfinementError) and out.error_class == "timeout"
        assert time.monotonic() - t0 < 1.0, time.monotonic() - t0


# ---- C
def _api(tmp_path):
    app = build_app(tmp_path / "cfg", principal_dependency=lambda: "owner", send_override=lambda *a, **k: None)
    return app, TestClient(app, base_url="http://127.0.0.1")


def _provider(c, pid="p1"):
    body = {"schema_version": 1, "id": pid, "name": "P", "kind": "http", "base_url": "http://127.0.0.1:9"}
    return c.put(f"/api/config/provider/{pid}", json=body, headers={"If-None-Match": "*"})


def test_delete_of_a_newly_invalid_file_needs_the_listed_etag(tmp_path):
    app, c = _api(tmp_path)
    f = tmp_path / "cfg" / "worlds" / "providers" / "broken.yaml"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text("schema_version: 1\nid: broken\nname: [x\n")
    app.state.store.reload()
    err = [e for e in c.get("/api/config/provider").json()["errors"] if e["id"] == "broken"][0]
    assert c.get("/api/config/provider/broken").status_code == 404           # no valid version to read
    assert c.delete("/api/config/provider/broken").status_code == 409        # no etag
    assert c.delete("/api/config/provider/broken", headers={"If-Match": "deadbeef"}).status_code == 409
    assert c.delete("/api/config/provider/broken", headers={"If-Match": "*"}).status_code == 428
    assert f.exists()
    assert c.delete("/api/config/provider/broken", headers={"If-Match": '"' + err["etag"] + '"'}).status_code == 204
    assert not f.exists() and not [e for e in c.get("/api/config/provider").json()["errors"] if e["id"] == "broken"]


def test_delete_with_stale_etag_conflicts_and_missing_is_404(tmp_path):
    app, c = _api(tmp_path)
    r = _provider(c)
    etag = r.headers["etag"]
    _provider_put = c.put("/api/config/provider/p1", json=r.json() | {"name": "N"}, headers={"If-Match": etag})
    assert c.delete("/api/config/provider/p1", headers={"If-Match": etag}).status_code == 409
    assert c.delete("/api/config/provider/p1", headers={"If-Match": _provider_put.headers["etag"]}).status_code == 204
    assert c.delete("/api/config/provider/p1").status_code == 404
    assert c.delete("/api/config/provider/Bad..Id").status_code == 404
    assert c.delete("/api/config/bogus/x").status_code == 404


def test_delete_still_blocked_while_referenced_and_valid_delete_needs_no_etag(tmp_path):
    app, c = _api(tmp_path)
    _provider(c)
    req = {"schema_version": 1, "id": "p1.r", "provider": "p1", "path": "/x"}
    c.put("/api/config/request/p1.r", json=req, headers={"If-None-Match": "*"})
    assert c.delete("/api/config/provider/p1").status_code == 409
    assert c.delete("/api/config/request/p1.r").status_code == 204
    assert c.delete("/api/config/provider/p1").status_code == 204


# ---- D
@pytest.mark.parametrize("raw,host", [("127.0.0.1", "127.0.0.1"), ("127.0.0.1:8765", "127.0.0.1"), ("[::1]:8765", "::1"),
                                      ("[::1]", "::1"), ("LOCALHOST:80", "localhost"), ("[::ffff:7f00:1]:1", "::ffff:7f00:1")])
def test_parse_host_ok(raw, host):
    assert parse_host(raw) == host


@pytest.mark.parametrize("raw", [None, "", "a@127.0.0.1", "127.0.0.1/x", "127.0.0.1:abc", "[::1", "::1", "127.0.0.1\r\nx", "a b",
                                 "127.0.0.1:99999"])
def test_parse_host_rejects_malformed(raw):
    assert parse_host(raw) is None


def test_host_guard_end_to_end(tmp_path):
    app = build_app(tmp_path / "cfg", principal_dependency=lambda: "owner",
                    allowed_hosts=["127.0.0.1", "::1", "localhost"])
    c = TestClient(app, base_url="http://127.0.0.1")
    for good in ("127.0.0.1", "127.0.0.1:8765", "[::1]:8765", "[::1]", "localhost:1"):
        assert c.get("/healthz", headers={"Host": good}).status_code == 200, good
    for bad in ("evil.example", "127.0.0.1.evil.example", "a@127.0.0.1", "127.0.0.1:x", "[::2]:1", "0.0.0.0"):
        assert c.get("/healthz", headers={"Host": bad}).status_code == 400, bad


# ---- E
def test_reference_sender_accepts_only_loopback_literal_and_live_ports():
    with ReferenceServer(token="t") as ref, ReferenceServer(token="t") as other:
        def prov(base, **kw):
            return Provider(id="p", name="P", kind="reference", base_url=base, network={"lan": True},
                            auth={"type": "bearer", "secret_ref": "env:DEV"}, **kw)
        r = Request(id="p.r", provider="p", path="/secret")
        send = reference_send({"DEV": "t"}, allowed_ports={ref.port})
        assert send(prov(ref.base_url), r, effect="read").status_code == 200
        out = send(prov(other.base_url), r, effect="read")                   # a different port: never gets the token
        assert isinstance(out, ConfinementError) and out.error_class == "confinement_denied"
        assert other.calls == []
        for base in (f"http://localhost:{ref.port}", f"http://[::1]:{ref.port}", f"http://127.0.0.2:{ref.port}",
                     "http://127.0.0.1"):
            assert send(prov(base), r, effect="read").error_class == "confinement_denied", base
        default = reference_send({"DEV": "t"})                                # default: any LIVE reference server
        assert default(prov(other.base_url), r, effect="read").status_code == 200
    gone = reference_send({"DEV": "t"})(prov(other.base_url), r, effect="read")
    assert gone.error_class == "confinement_denied"                           # server stopped: port no longer live
