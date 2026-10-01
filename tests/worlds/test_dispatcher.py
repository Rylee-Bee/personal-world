"""Tests for personal_world.worlds.dispatcher (C3): authority, single dispatch, recovery, receipts."""
import json
import sqlite3
import threading

import pytest

from personal_world.worlds.authn import Principal
from personal_world.worlds.confinement import ConfinementError, RawResponse
from personal_world.worlds.config_store import ConfigStore
from personal_world.worlds.db import Database
from personal_world.worlds.dispatcher import (BadRequest, DispatchError, Dispatcher, NotConsumable, NotPermitted,
                                              classify_outcome)
from personal_world.worlds.models import Action, Provider, Request
from personal_world.worlds.reference_provider import ReferenceServer, reference_send

NOW = 3_000_000.0


class Clock:
    t = NOW

    def __call__(self):
        return self.t


class Crash(BaseException):
    """Simulates the process dying mid-dispatch (not an Exception: must never be swallowed)."""


class Sender:
    def __init__(self, result=None):
        self.result = result if result is not None else RawResponse(200, body=b"{}")
        self.calls = []
        self.gate = None
        self.in_tx = []
        self.db = None

    def __call__(self, provider, request, *, effect):
        self.calls.append((request.method, request.path, effect, dict(request.headers), request.body))
        if self.db is not None:
            self.in_tx.append(self.db.conn().in_transaction)
        if self.gate:
            self.gate.wait(5)
        r = self.result
        if isinstance(r, BaseException):
            raise r
        return r


def owner(step_up=True, clock=Clock()):
    return Principal("owner", "owner", session_hash="h", step_up_at=clock() if step_up else None, via="session")


def agent(scopes=("deploy.*",), pid="agent1"):
    return Principal("agent", pid, tuple(scopes), via="token")


@pytest.fixture
def env(tmp_path):
    clock = Clock()
    clock.t = NOW
    db = Database.in_dir(tmp_path / "data")
    store = ConfigStore(tmp_path / "cfg")
    store.save("provider", Provider(id="ref", name="Ref", kind="reference", base_url="http://127.0.0.1:9"))
    store.save("request", Request(id="ref.go", provider="ref", method="POST", path="/go"))
    store.save("action", Action(id="go", request="ref.go", name="Go", scope="deploy.run", exposed=True))
    send = Sender()
    send.db = db
    d = Dispatcher(db, store, send=send, clock=clock, secret_values=("s3cret-value",))
    return d, db, store, send, clock


def approved(env, params=None, key=None, principal=None):
    d, *_ = env
    a = d.request_authorization(principal or owner(), "go", params, key)
    return d.approve(owner(), a["id"])


# ---------------------------------------------------------------- authority

def test_agents_see_only_exposed_actions_in_scope(env):
    d, db, store, *_ = env
    store.save("action", Action(id="hidden", request="ref.go", name="H", scope="deploy.run", exposed=False))
    store.save("action", Action(id="other", request="ref.go", name="O", scope="memory.read", exposed=True))
    assert {a.id for a in d.list_actions(agent())} == {"go"}
    assert {a.id for a in d.list_actions(owner())} == {"go", "hidden", "other"}
    for aid in ("hidden", "other"):
        with pytest.raises(NotPermitted):
            d.request_authorization(agent(), aid)
    assert d.request_authorization(agent(), "go")["state"] == "pending"


def test_unknown_action_and_param_rules(env):
    d, db, store, *_ = env
    with pytest.raises(BadRequest):
        d.request_authorization(owner(), "nope")
    with pytest.raises(BadRequest):
        d.request_authorization(owner(), "go", {"x": "y" * 9000})
    with pytest.raises(BadRequest):
        d.request_authorization(owner(), "go", ["not", "an", "object"])
    store.save("request", Request(id="ref.get", provider="ref", path="/g"))
    store.save("action", Action(id="read", request="ref.get", name="R", access="read", approval="never"))
    with pytest.raises(BadRequest):
        d.request_authorization(owner(), "read", {"a": 1})
    store.save("action", Action(id="idem", request="ref.go", name="I", idempotency="required"))
    with pytest.raises(BadRequest):
        d.request_authorization(owner(), "idem")
    assert d.request_authorization(owner(), "idem", None, "k-1")["idempotency_key"] == "k-1"
    with pytest.raises(BadRequest):
        d.request_authorization(owner(), "idem", None, "bad\nkey")


def test_only_owner_session_with_fresh_step_up_approves(env):
    d, db, store, send, clock = env
    a = d.request_authorization(agent(), "go")
    with pytest.raises(NotPermitted):
        d.approve(agent(), a["id"])                       # a token is never approval
    with pytest.raises(NotPermitted):
        d.approve(owner(step_up=False), a["id"])           # no step-up
    stale = Principal("owner", "owner", step_up_at=clock.t - 1000, via="session")
    with pytest.raises(NotPermitted):
        d.approve(stale, a["id"])
    tok_owner = Principal("owner", "owner", step_up_at=clock.t, via="token")
    with pytest.raises(NotPermitted):
        d.approve(tok_owner, a["id"])
    ok = d.approve(owner(), a["id"])
    assert ok["state"] == "approved" and ok["authority"] == "worlds_owner" and ok["approved_by"] == "owner"
    assert ok["step_up_at"] == clock.t and send.calls == []


def test_agent_executes_its_own_approved_authorization_only(env):
    d, db, store, send, _ = env
    a = d.request_authorization(agent(), "go")
    d.approve(owner(), a["id"])
    with pytest.raises(NotPermitted):
        d.execute(agent(pid="intruder"), a["id"])
    assert send.calls == []
    assert d.execute(agent(), a["id"])["state"] == "SUCCEEDED"


def test_unapproved_pending_denied_cannot_execute(env):
    d, db, store, send, _ = env
    a = d.request_authorization(owner(), "go")
    with pytest.raises(NotConsumable):
        d.execute(owner(), a["id"])
    d.deny(owner(), a["id"])
    with pytest.raises(NotConsumable):
        d.execute(owner(), a["id"])
    assert send.calls == []


def test_policy_never_is_auto_approved_but_still_leaves_a_receipt(env):
    d, db, store, send, _ = env
    store.save("action", Action(id="auto", request="ref.go", name="A", approval="never"))
    a = d.request_authorization(owner(), "auto")
    assert a["state"] == "approved" and a["approved_by"] == "policy:never" and a["authority"] == "worlds_owner"
    r = d.execute(owner(), a["id"])
    assert r["state"] == "SUCCEEDED" and d.list_receipts()[0]["execution_id"] == r["execution_id"]


def test_missing_approval_field_defaults_to_always(env):
    d, *_ = env
    assert d.request_authorization(owner(), "go")["state"] == "pending"


# ------------------------------------------------------------- single dispatch

def test_execute_once_then_never_again_and_no_tx_across_network(env):
    d, db, store, send, _ = env
    a = approved(env, key="k1")
    r = d.execute(owner(), a["id"])
    assert r["state"] == "SUCCEEDED" and r["status_code"] == 200
    assert len(send.calls) == 1 and send.in_tx == [False]
    assert send.calls[0][3].get("Idempotency-Key") == "k1" and send.calls[0][2] == "write"
    with pytest.raises(NotConsumable):
        d.execute(owner(), a["id"])
    assert len(send.calls) == 1
    assert d.get_authorization(a["id"])["state"] == "consumed"
    assert db.conn().execute("select count(*) from executions").fetchone()[0] == 1


def test_params_become_the_body_and_are_hash_checked(env):
    d, db, store, send, _ = env
    a = approved(env, params={"n": 1})
    d.execute(owner(), a["id"])
    assert send.calls[0][4] == {"n": 1}
    b = approved(env, params={"n": 2})
    with db.write_tx() as tx:
        tx.execute("update authorizations set params_json=? where id=?", (json.dumps({"n": 999}), b["id"]))
    with pytest.raises(NotConsumable):
        d.execute(owner(), b["id"])
    assert len(send.calls) == 1


def test_concurrent_dispatchers_one_wins(env):
    d, db, store, send, _ = env
    a = approved(env)
    send.gate = threading.Event()
    out, errs = [], []

    def go():
        try:
            out.append(d.execute(owner(), a["id"]))
        except NotConsumable as e:
            errs.append(e)

    ts = [threading.Thread(target=go) for _ in range(8)]
    [t.start() for t in ts]
    send.gate.set()
    [t.join() for t in ts]
    assert len(out) == 1 and len(errs) == 7 and len(send.calls) == 1


def test_two_dispatcher_instances_on_one_database(env, tmp_path):
    d, db, store, send, clock = env
    send2 = Sender()
    d2 = Dispatcher(Database.in_dir(tmp_path / "data"), store, send=send2, clock=clock)
    a = approved(env)
    d.execute(owner(), a["id"])
    with pytest.raises(NotConsumable):
        d2.execute(owner(), a["id"])
    assert send2.calls == []


def test_execution_unique_per_authorization(env):
    d, db, store, send, _ = env
    a = approved(env)
    d.execute(owner(), a["id"])
    with pytest.raises(sqlite3.IntegrityError):
        with db.write_tx() as tx:
            tx.execute("insert into executions(id,authorization_id,intent_at,state) values ('x',?,1,'INTENT')", (a["id"],))


# ------------------------------------------------------ expiry, change, cancel

def test_expired_authorization_is_not_sent(env):
    d, db, store, send, clock = env
    a = approved(env)
    clock.t += 601
    with pytest.raises(NotConsumable) as e:
        d.execute(owner(), a["id"])
    assert "expired" in str(e.value) and send.calls == []
    assert d.expire_due() == 1 and d.get_authorization(a["id"])["state"] == "expired"


def test_cannot_approve_expired_or_stale_version(env):
    d, db, store, send, clock = env
    a = d.request_authorization(owner(), "go")
    clock.t += 601
    with pytest.raises(NotConsumable):
        d.approve(Principal("owner", "owner", step_up_at=clock.t, via="session"), a["id"])


def test_destination_change_invalidates_pending_and_approved(env):
    d, db, store, send, _ = env
    a1 = approved(env)
    a2 = d.request_authorization(owner(), "go")
    store.save("provider", Provider(id="ref", name="Ref", kind="reference", base_url="http://127.0.0.1:10"),
               etag=store.etag("provider", "ref"))
    assert d.get_authorization(a1["id"])["state"] == "invalidated"
    assert d.get_authorization(a2["id"])["state"] == "invalidated"
    with pytest.raises(NotConsumable):
        d.execute(owner(), a1["id"])
    assert send.calls == []


def test_version_check_holds_even_if_listener_is_missed(env):
    d, db, store, send, _ = env
    a = approved(env)
    d.close()  # no listener: the consume transaction itself must still refuse
    store.save("request", Request(id="ref.go", provider="ref", method="POST", path="/other"),
               etag=store.etag("request", "ref.go"))
    with pytest.raises(NotConsumable):
        d.execute(owner(), a["id"])
    assert send.calls == []


def test_credential_ref_change_invalidates(env):
    d, db, store, send, _ = env
    a = approved(env)
    store.save("provider", Provider(id="ref", name="Ref", kind="reference", base_url="http://127.0.0.1:9",
                                    auth={"type": "bearer", "secret_ref": "env:OTHER"}), etag=store.etag("provider", "ref"))
    assert d.get_authorization(a["id"])["state"] == "invalidated"


def test_cancel_before_consume_ok_after_consume_refused(env):
    d, db, store, send, _ = env
    a = approved(env)
    assert d.deny(owner(), a["id"])["state"] == "denied"
    b = approved(env)
    d.execute(owner(), b["id"])
    with pytest.raises(NotConsumable):
        d.deny(owner(), b["id"])
    c = d.request_authorization(agent(), "go")
    with pytest.raises(NotPermitted):
        d.deny(agent(pid="other"), c["id"])
    assert d.deny(agent(), c["id"])["state"] == "denied"


# ------------------------------------------------------------------- outcomes

@pytest.mark.parametrize("result,state", [
    (RawResponse(200), "SUCCEEDED"), (RawResponse(204), "SUCCEEDED"),
    (RawResponse(400), "FAILED"), (RawResponse(401), "FAILED"), (RawResponse(404), "FAILED"), (RawResponse(422), "FAILED"),
    (RawResponse(408), "UNKNOWN"), (RawResponse(409), "UNKNOWN"), (RawResponse(425), "UNKNOWN"), (RawResponse(429), "UNKNOWN"),
    (RawResponse(500), "UNKNOWN"), (RawResponse(502), "UNKNOWN"), (RawResponse(302), "UNKNOWN"),
    (ConfinementError("timeout"), "UNKNOWN"), (ConfinementError("connection"), "UNKNOWN"),
    (ConfinementError("too_large"), "UNKNOWN"), (ConfinementError("redirect_refused"), "UNKNOWN"),
    (ConfinementError("confinement_denied"), "FAILED"), (ConfinementError("auth_failed"), "FAILED"),
    (RuntimeError("sender bug"), "UNKNOWN"), (None, "SUCCEEDED")])
def test_outcome_classification(env, result, state):
    d, db, store, send, _ = env
    if result is not None:
        send.result = result
    r = d.execute(owner(), approved(env)["id"])
    assert r["state"] == state and len(send.calls) == 1


def test_lost_response_after_dispatch_is_unknown_and_effect_happened_once(env, tmp_path):
    d, db, store, send, clock = env
    with ReferenceServer() as srv:
        store.save("provider", Provider(id="ref", name="Ref", kind="reference", base_url=srv.base_url, network={"lan": True}),
                   etag=store.etag("provider", "ref"))
        store.save("request", Request(id="ref.go", provider="ref", method="POST", path="/lost"), etag=store.etag("request", "ref.go"))
        d2 = Dispatcher(db, store, send=reference_send({}), clock=clock)
        r = d2.execute(owner(), (lambda a: d2.approve(owner(), a["id"]))(d2.request_authorization(owner(), "go"))["id"])
        assert r["state"] == "UNKNOWN" and srv.counters["lost"] == 1


def test_receipt_contents_and_redaction(env):
    d, db, store, send, clock = env
    send.result = ConfinementError("connection", "failed Authorization: Bearer abcdef123456 key s3cret-value")
    a = approved(env)
    r = d.execute(owner(), a["id"])
    assert r["caller"] == "owner" and r["action_id"] == "go" and r["authority"] == "worlds_owner"
    assert r["action_version"] == store.action_version("go") and r["destination"].startswith("ref:")
    assert r["approved_at"] == NOW and r["intent_at"] == NOW and r["finished_at"] == NOW and r["dispatch_started_at"] == NOW
    blob = json.dumps(r)
    assert "abcdef123456" not in blob and "s3cret-value" not in blob and "Authorization" not in blob


# -------------------------------------------------------------- crash recovery

def test_crash_after_consume_before_dispatch_becomes_unknown_never_sent(env, tmp_path):
    d, db, store, send, clock = env
    a = approved(env)
    d._consume(owner(), a["id"])          # process dies right here: INTENT row exists, nothing sent
    fresh = Dispatcher(Database.in_dir(tmp_path / "data"), store, send=Sender(), clock=clock)
    assert fresh.recover() == 1
    ex = fresh.list_receipts()[0]
    assert ex["state"] == "UNKNOWN" and send.calls == []
    with pytest.raises(NotConsumable):
        fresh.execute(owner(), a["id"])


def test_crash_during_dispatch_becomes_unknown_and_is_not_resent(env, tmp_path):
    d, db, store, send, clock = env
    send.result = Crash()
    a = approved(env)
    with pytest.raises(Crash):
        d.execute(owner(), a["id"])
    assert db.conn().execute("select state from executions").fetchone()[0] == "DISPATCHING"
    send2 = Sender()
    fresh = Dispatcher(Database.in_dir(tmp_path / "data"), store, send=send2, clock=clock)
    assert fresh.recover() == 1 and fresh.recover() == 0
    assert fresh.list_receipts()[0]["state"] == "UNKNOWN" and send2.calls == []
    with pytest.raises(NotConsumable):
        fresh.execute(owner(), a["id"])
    assert len(send.calls) == 1


def test_retry_is_a_new_authorization_with_a_warning(env):
    d, db, store, send, _ = env
    store.save("action", Action(id="auto", request="ref.go", name="A", approval="never"))
    send.result = RawResponse(503)
    r = d.execute(owner(), approved(env)["id"])
    assert r["state"] == "UNKNOWN"
    retry = d.request_retry(owner(), r["execution_id"])
    assert retry["state"] == "pending" and retry["retry_of"] == r["execution_id"] and retry["previous_may_have_run"] is True
    assert retry["id"] != r["authorization_id"]
    send.result = RawResponse(200)
    r2 = d.execute(owner(), d.approve(owner(), retry["id"])["id"])
    assert r2["state"] == "SUCCEEDED" and r2["previous_may_have_run"] is True and len(send.calls) == 2
    auto_first = d.execute(owner(), d.request_authorization(owner(), "auto")["id"])
    again = d.request_retry(owner(), auto_first["execution_id"])
    assert again["state"] == "pending"          # even "never" actions need a fresh approval to retry
    failed = Sender(RawResponse(422)); d._send = failed
    f = d.execute(owner(), approved(env)["id"])
    assert d.request_retry(owner(), f["execution_id"])["previous_may_have_run"] is False


def test_retry_refused_while_in_progress_and_for_strangers(env):
    d, db, store, send, _ = env
    a = approved(env)
    d._consume(owner(), a["id"])
    ex = db.conn().execute("select id from executions").fetchone()[0]
    with pytest.raises(NotConsumable):
        d.request_retry(owner(), ex)
    with pytest.raises(NotPermitted):
        d.request_retry(agent(pid="x"), ex)


# -------------------------------------------------------- Project Home authority

def test_project_home_governed_operations_use_ph_authority(env, tmp_path):
    d0, db, store, send, clock = env
    verified = []
    d = Dispatcher(db, store, send=send, clock=clock,
                   governed_by_project_home=lambda p: p.id == "ref",
                   project_home_verifier=lambda ph_id, row: verified.append(ph_id) or ph_id == "ph-good")
    a = d.request_authorization(owner(), "go")
    with pytest.raises(NotPermitted):
        d.approve(owner(), a["id"])                       # Worlds cannot approve what Project Home governs
    with pytest.raises(NotPermitted):
        d.record_project_home_approval(a["id"], "ph-bad")
    ok = d.record_project_home_approval(a["id"], "ph-good")
    assert ok["state"] == "approved" and ok["authority"] == "project_home:ph-good"
    assert d.execute(owner(), a["id"])["authority"] == "project_home:ph-good"


def test_ph_policy_never_does_not_bypass_project_home(env):
    d0, db, store, send, clock = env
    store.save("action", Action(id="auto", request="ref.go", name="A", approval="never"))
    d = Dispatcher(db, store, send=send, clock=clock, governed_by_project_home=lambda p: True,
                   project_home_verifier=lambda *_: True)
    assert d.request_authorization(owner(), "auto")["state"] == "pending"


def test_ph_approval_unavailable_without_verifier_and_for_ungoverned(env):
    d, db, store, send, _ = env
    a = d.request_authorization(owner(), "go")
    with pytest.raises(NotPermitted):
        d.record_project_home_approval(a["id"], "x")


def test_classify_outcome_unknown_input():
    assert classify_outcome(object())[0] == "UNKNOWN"


# ---------------------------------------------------- approval: never on writes (C1.2)

def test_never_applies_to_a_write_only_when_the_owner_wrote_it_and_declared_access_write(env):
    d, db, store, send, _ = env
    default = Action(id="dflt", request="ref.go", name="D")
    assert default.approval == "always"                                  # missing means always
    store.save("action", default)
    assert d.request_authorization(owner(), "dflt")["state"] == "pending"
    store.save("action", Action(id="never-w", request="ref.go", name="N", access="write", approval="never"))
    assert d.request_authorization(owner(), "never-w")["state"] == "approved"
    # a read-labelled action whose request would write is NOT auto-approved even with approval: never
    store.save("action", Action(id="never-r", request="ref.go", name="R", access="read", approval="never"))
    a = d.request_authorization(owner(), "never-r")
    assert a["state"] == "pending" and a["approved_by"] is None
    # a genuinely read request with approval: never is fine
    store.save("request", Request(id="ref.look", provider="ref", path="/look"))
    store.save("action", Action(id="look", request="ref.look", name="L", access="read", approval="never"))
    assert d.request_authorization(owner(), "look")["state"] == "approved"
    # an agent asking for a never-write action gets the policy the owner wrote (never an agent choice)
    store.save("action", Action(id="agent-never", request="ref.go", name="A", access="write", approval="never",
                                exposed=True, scope="deploy.run"))
    assert d.request_authorization(agent(), "agent-never")["state"] == "approved"
