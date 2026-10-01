"""Acceptance tests for personal_world.worlds.cards (C2 envelope, C5 data, home board defs)."""
import json

import pytest

from personal_world.worlds.confinement import ConfinementError, RawResponse
from personal_world.worlds.cards import CardService, home_board_defs
from personal_world.worlds.models import Board
from personal_world.worlds.runner import Runner

from .conftest import add_card, add_request, ok

ENVELOPE_KEYS = {"card_id", "source_state", "freshness", "observed_at", "fetched_at", "last_good_at",
                 "values", "meter", "meaning", "evidence"}


def svc(store, send, t=1_800_000_000.0, **kw):
    box = {"t": t}
    runner = Runner(store, send, clock=lambda: box["t"], **kw)
    s = CardService(store, runner, clock=lambda: box["t"])
    s.box = box
    return s


STATUS = {"state": "ok", "uptime": 3725, "cpu": 0.256, "disk": {"used": 512, "total": 1024}}


def fields():
    return [{"path": "$.uptime", "label": "Uptime", "format": "duration"},
            {"path": "$.cpu", "label": "CPU load", "format": "percent"},
            {"path": "$.disk.used", "label": "Disk used", "format": "bytes"}]


def test_healthy_envelope_shape_and_values(store, send):
    add_request(store, "status", "/status", ttl_s=0)
    add_card(store, request="ref.status", fields=fields(), status={"path": "$.state", "healthy": ["ok"], "needs_attention": ["warn"]})
    send.responses["/status"] = ok(STATUS)
    e = svc(store, send).build("c1")
    assert set(e) == ENVELOPE_KEYS
    assert e["card_id"] == "c1" and e["source_state"] == "healthy" and e["freshness"] == "current"
    assert e["values"]["uptime"] == {"text": "1h 2m", "raw": 3725}
    assert e["values"]["cpu-load"]["text"] == "25.6%"
    assert e["values"]["disk-used"] == {"text": "512 B", "raw": 512}
    assert e["meaning"] == {"short": "short", "full": "full"}
    assert e["last_good_at"] == e["fetched_at"] and e["observed_at"]
    ev = e["evidence"]
    assert ev["request_id"] == "ref.status" and ev["method"] == "GET" and ev["path"] == "/status"
    assert ev["status_code"] == 200 and ev["duration_ms"] == 7 and ev["error_class"] is None
    json.dumps(e)


def test_status_map_words(store, send):
    add_request(store, "status", "/status", ttl_s=0)
    add_card(store, request="ref.status", status={"path": "$.state", "healthy": ["ok"], "needs_attention": ["warn"]})
    s = svc(store, send)
    for value, want in [("ok", "healthy"), ("warn", "needs_attention"), ("weird", "unknown")]:
        send.responses["/status"] = ok({"state": value})
        assert s.build("c1")["source_state"] == want


def test_empty_list_is_healthy_and_missing_is_unknown_never_zero(store, send):
    add_request(store, ttl_s=0)
    add_card(store, fields=[{"path": "$.items[*].name", "label": "Names"}, {"path": "$.total", "label": "Total", "format": "number"}])
    send.responses["/items"] = ok({"items": []})
    e = svc(store, send).build("c1")
    assert e["source_state"] == "healthy"
    assert e["values"]["names"]["text"] == "none" and e["values"]["names"]["raw"] == []
    assert e["values"]["total"]["text"] == "unknown" and "raw" not in e["values"]["total"]


def test_list_values_join(store, send):
    add_request(store, ttl_s=0)
    add_card(store, fields=[{"path": "$.items[*].name", "label": "Names"}])
    send.responses["/items"] = ok({"items": [{"name": "a"}, {"name": "b"}]})
    assert svc(store, send).build("c1")["values"]["names"]["text"] == "a, b"


@pytest.mark.parametrize("err,state", [
    (ConfinementError("timeout"), "unavailable"), (ConfinementError("connection"), "unavailable"),
    (ConfinementError("redirect_refused"), "unavailable"), (ConfinementError("too_large"), "unavailable"),
    (ConfinementError("confinement_denied"), "unavailable"), (ConfinementError("auth_failed"), "needs_attention"),
    (RawResponse(status_code=500), "unavailable"), (RawResponse(status_code=404), "degraded"),
    (RawResponse(status_code=401), "needs_attention"), (RawResponse(status_code=200, body=b"x{"), "degraded")])
def test_failure_maps_to_play_nice_words_and_stale(store, send, err, state):
    add_request(store, ttl_s=0)
    add_card(store, fields=[{"path": "$.v", "label": "V", "format": "number"}])
    send.responses["/items"] = err
    e = svc(store, send).build("c1")
    assert e["source_state"] == state and e["freshness"] == "stale" and e["last_good_at"] is None
    assert e["values"]["v"]["text"] == "unknown"
    assert e["evidence"]["error_class"] in {"timeout", "connection", "redirect_refused", "too_large", "confinement_denied",
                                            "auth_failed", "http_4xx", "http_5xx", "malformed"}


def test_unavailable_keeps_last_good_values_marked_stale(store, send):
    add_request(store, ttl_s=0)
    add_card(store, fields=[{"path": "$.v", "label": "V", "format": "number"}])
    s = svc(store, send)
    send.responses["/items"] = ok({"v": 41})
    first = s.build("c1")
    s.box["t"] += 3600
    send.responses["/items"] = RawResponse(status_code=503)
    e = s.build("c1")
    assert e["source_state"] == "unavailable" and e["freshness"] == "stale"
    assert e["values"]["v"] == {"text": "41", "raw": 41}
    assert e["last_good_at"] == first["last_good_at"] and e["fetched_at"] != e["last_good_at"]


def test_not_configured_when_request_missing_and_no_send(store, send):
    add_request(store, ttl_s=0)
    add_card(store)
    import os
    os.remove(next((store._worlds / "requests").rglob("ref.items.yaml")))
    store.reload()
    e = svc(store, send).build("c1")
    assert e["source_state"] == "not_configured" and send.calls == []


def test_unknown_card_returns_none(store, send):
    assert svc(store, send).build("nope") is None


def test_meter_text_equivalent_and_no_meter_is_none(store, send):
    add_request(store, "status", "/status", ttl_s=0)
    add_card(store, request="ref.status", fields=fields(), meter={"type": "progress"})
    send.responses["/status"] = ok(STATUS)
    e = svc(store, send).build("c1")
    assert e["meter"]["type"] == "progress" and "Uptime: 1h 2m" in e["meter"]["text_equivalent"]
    add_card(store, "c2", request="ref.status", fields=fields())
    assert svc(store, send).build("c2")["meter"] is None


def test_multi_request_card_and_first_failing_evidence(store, send):
    add_request(store, "status", "/status", ttl_s=0)
    add_request(store, "items", "/items", ttl_s=0)
    store.save("card", __import__("personal_world.worlds.models", fromlist=["Card"]).Card(
        id="agg", title="Agg", requests=["ref.status", "ref.items"], meaning={"concept": "c", "short": "s"},
        fields=[{"path": "$.status.state", "label": "State"}, {"path": "$.items.total", "label": "Total", "format": "number"}]))
    send.responses["/status"] = ok({"state": "ok"})
    send.responses["/items"] = ok({"total": 2})
    e = svc(store, send).build("agg")
    assert e["values"]["state"]["text"] == "ok" and e["values"]["total"]["text"] == "2" and e["source_state"] == "healthy"
    send.responses["/items"] = RawResponse(status_code=500)
    e = svc(store, send).build("agg")
    assert e["evidence"]["request_id"] == "ref.items" and e["evidence"]["error_class"] == "http_5xx"
    assert e["source_state"] == "unavailable"


def test_evidence_is_redacted_and_has_no_body(store, send):
    add_request(store, ttl_s=0)
    add_card(store)
    send.responses["/items"] = ConfinementError("auth_failed", "Authorization: Bearer abcdef123456 s3cret-value")
    e = svc(store, send, secret_values=["s3cret-value"]).build("c1")
    blob = json.dumps(e)
    assert "abcdef123456" not in blob and "s3cret-value" not in blob and "Authorization" not in blob


def test_home_board_defs_are_display_only(store, send):
    add_request(store, "status", "/status")
    add_card(store, request="ref.status", fields=fields(), meter={"type": "progress"}, icon="cpu", group="machine")
    store.save("board", Board(id="home", title="Home", home=True, items=[{"card": "c1", "size": "L"}]))
    d = home_board_defs(store)
    assert d["id"] == "home" and d["title"] == "Home"
    item = d["items"][0]
    assert item == {"card": "c1", "size": "L", "hidden": False, "title": "T", "icon": "cpu", "group": "machine",
                    "view": "stat", "fields": [{"key": "uptime", "label": "Uptime", "format": "duration", "unit": None},
                                               {"key": "cpu-load", "label": "CPU load", "format": "percent", "unit": None},
                                               {"key": "disk-used", "label": "Disk used", "format": "bytes", "unit": None}],
                    "meter_type": "progress"}
    blob = json.dumps(d)
    for leak in ("/status", "ref.status", "$.uptime", "provider", "base_url"):
        assert leak not in blob


def test_no_home_board_returns_none(store):
    assert home_board_defs(store) is None
