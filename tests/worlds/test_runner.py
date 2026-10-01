"""Acceptance tests for personal_world.worlds.runner (C2 inputs, confinement seam, last-good)."""
import json
import stat
import threading
import time

import pytest

from personal_world.worlds.confinement import ConfinementError, RawResponse
from personal_world.worlds.models import Assertion
from personal_world.worlds.runner import Runner

from .conftest import add_request, ok


class Clock:
    def __init__(self, t=1000.0):
        self.t = t

    def __call__(self):
        return self.t


def make(store, send, clock=None, **kw):
    return Runner(store, send, clock=clock or Clock(), **kw)


def test_fetch_ok_parses_json_and_calls_send_with_read_effect(store, send):
    add_request(store)
    send.responses["/items"] = ok({"items": [1]})
    f = make(store, send).fetch("ref.items")
    assert f.ok and f.data == {"items": [1]} and f.status_code == 200 and f.error_class is None
    assert f.method == "GET" and f.path == "/items" and f.duration_ms == 7 and not f.from_cache
    assert send.calls == [("ref.items", "GET", "/items", "read")]


def test_ttl_cache_force_and_expiry(store, send):
    add_request(store, ttl_s=60)
    send.responses["/items"] = ok({"n": 1})
    clock = Clock()
    r = make(store, send, clock)
    r.fetch("ref.items")
    again = r.fetch("ref.items")
    assert again.from_cache and send.count() == 1
    r.fetch("ref.items", force=True)
    assert send.count() == 2
    clock.t += 61
    r.fetch("ref.items")
    assert send.count() == 3


def test_ttl_zero_never_caches(store, send):
    add_request(store, ttl_s=0)
    send.responses["/items"] = ok({})
    r = make(store, send)
    r.fetch("ref.items"); r.fetch("ref.items")
    assert send.count() == 2


def test_write_request_is_refused_before_send(store, send):
    add_request(store, name="do", path="/do", method="POST")
    f = make(store, send).fetch("ref.do")
    assert not f.ok and f.error_class == "confinement_denied" and "write" in f.note
    assert send.calls == []


def test_unknown_request_never_calls_send(store, send):
    f = make(store, send).fetch("ref.nope")
    assert not f.ok and f.error_class == "confinement_denied" and send.calls == []


@pytest.mark.parametrize("status,cls", [(500, "http_5xx"), (503, "http_5xx"), (404, "http_4xx"), (422, "http_4xx"),
                                        (401, "auth_failed"), (403, "auth_failed")])
def test_http_status_classes(store, send, status, cls):
    add_request(store)
    send.responses["/items"] = RawResponse(status_code=status, body=b"x")
    f = make(store, send).fetch("ref.items")
    assert not f.ok and f.error_class == cls and f.status_code == status


def test_malformed_json_and_non_utf8(store, send):
    add_request(store)
    send.responses["/items"] = RawResponse(status_code=200, body=b"not json {")
    assert make(store, send).fetch("ref.items").error_class == "malformed"
    send.responses["/items"] = RawResponse(status_code=200, body=b"\xff\xfe")
    assert make(store, send, ).fetch("ref.items", force=True).error_class == "malformed"


def test_confinement_errors_pass_through(store, send):
    add_request(store)
    for cls in ("timeout", "connection", "redirect_refused", "too_large", "confinement_denied", "auth_failed"):
        send.responses["/items"] = ConfinementError(cls, "n")
        f = make(store, send).fetch("ref.items", force=True)
        assert not f.ok and f.error_class == cls


def test_sender_exception_never_escapes(store, send):
    add_request(store)
    send.responses["/items"] = RuntimeError("boom with s3cret-value")
    f = make(store, send, secret_values=["s3cret-value"]).fetch("ref.items")
    assert not f.ok and f.error_class == "connection"
    assert "s3cret-value" not in f.note


def test_assertions(store, send):
    add_request(store, assertions=[Assertion(status=200), Assertion(path="$.items", is_list=True),
                                   Assertion(path="$.state", equals="ok"), Assertion(path="$.state", exists=True)])
    send.responses["/items"] = ok({"items": [], "state": "ok"})
    assert make(store, send).fetch("ref.items").ok
    send.responses["/items"] = ok({"items": {}, "state": "ok"})
    f = make(store, send).fetch("ref.items", force=True)
    assert not f.ok and f.error_class == "malformed" and "assert" in f.note
    send.responses["/items"] = ok({"items": [], "state": "bad"})
    assert not make(store, send).fetch("ref.items", force=True).ok
    send.responses["/items"] = ok({"items": []})
    assert not make(store, send).fetch("ref.items", force=True).ok
    send.responses["/items"] = ok({"items": [], "state": "ok"}, status=201)
    assert not make(store, send).fetch("ref.items", force=True).ok


def test_last_good_survives_failure_and_failure_is_not_cached_as_good(store, send):
    add_request(store, ttl_s=0)
    r = make(store, send, Clock(500.0))
    send.responses["/items"] = ok({"v": 1})
    r.fetch("ref.items")
    send.responses["/items"] = RawResponse(status_code=500)
    f = r.fetch("ref.items")
    assert not f.ok
    lg = r.last_good("ref.items")
    assert lg is not None and lg[0] == {"v": 1} and lg[1] == 500.0


def test_last_good_persists_in_cache_dir_and_is_disposable(store, send, tmp_path):
    add_request(store, ttl_s=0)
    cache = tmp_path / "cache"
    send.responses["/items"] = ok({"v": 2})
    make(store, send, Clock(700.0), cache_dir=cache).fetch("ref.items")
    files = list(cache.rglob("*"))
    assert [f for f in files if f.is_file()]
    for f in files:
        if f.is_file():
            assert not stat.S_IMODE(f.stat().st_mode) & 0o077
    r2 = make(store, send, cache_dir=cache)
    assert r2.last_good("ref.items")[0] == {"v": 2}
    import shutil
    shutil.rmtree(cache)
    assert make(store, send, cache_dir=cache).last_good("ref.items") is None


def test_notes_are_redacted_and_short(store, send):
    add_request(store)
    send.responses["/items"] = ConfinementError(
        "connection", "failed with Authorization: Bearer abcdef123456 and key s3cret-value " + "x" * 5000)
    f = make(store, send, secret_values=["s3cret-value"]).fetch("ref.items")
    assert "abcdef123456" not in f.note and "s3cret-value" not in f.note and len(f.note) <= 300


def test_no_response_body_in_fetch_evidence(store, send):
    add_request(store)
    send.responses["/items"] = RawResponse(status_code=500, body=b"SECRET-BODY-" + b"z" * 5000)
    f = make(store, send).fetch("ref.items")
    assert "SECRET-BODY" not in f.note


def test_single_flight_for_concurrent_fetches(store, send):
    add_request(store, ttl_s=0)
    def slow():
        time.sleep(0.2)
        return ok({"x": 1})
    send.responses["/items"] = slow
    r = make(store, send)
    out = []
    ts = [threading.Thread(target=lambda: out.append(r.fetch("ref.items"))) for _ in range(5)]
    [t.start() for t in ts]; [t.join() for t in ts]
    assert send.count() == 1 and len(out) == 5 and all(o.ok for o in out)
