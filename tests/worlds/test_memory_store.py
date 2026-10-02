"""Acceptance tests for personal_world.worlds.memory_store (C4): Kept, Later, Records, History, Find."""
import json
import sqlite3
import stat
import threading

import pytest

from personal_world.worlds.db import Database
from personal_world.worlds.memory_store import (Locked, MemoryError_, MemoryStore, NotFound, NotPermitted_, restore_backup)

NOW = 4_000_000.0


class Clock:
    t = NOW

    def __call__(self):
        return self.t


@pytest.fixture
def ms(tmp_path):
    clock = Clock()
    clock.t = NOW
    db = Database.in_dir(tmp_path / "data")
    m = MemoryStore(db, clock=clock)
    m.clock = clock
    m.db = db
    m.dir = tmp_path / "data"
    return m


# ------------------------------------------------------------------ CRUD

def test_add_get_update_delete_each_table(ms):
    k = ms.add("kept", title="Soup recipe", body="lentils and cumin", tags=["food"], actor="owner")
    assert k["table"] == "kept" and k["provenance"] == "owner" and k["created_at"] == NOW and k["updated_at"] == NOW
    assert k["tags"] == ["food"]
    ms.clock.t += 10
    u = ms.update("kept", k["id"], {"title": "Better soup"}, actor="owner")
    assert u["title"] == "Better soup" and u["body"] == "lentils and cumin" and u["created_at"] == NOW and u["updated_at"] == NOW + 10
    assert ms.get("kept", k["id"])["title"] == "Better soup"
    ms.delete("kept", k["id"], actor="owner")
    with pytest.raises(NotFound):
        ms.get("kept", k["id"])
    with pytest.raises(NotFound):
        ms.delete("kept", k["id"], actor="owner")

    later = ms.add("later", title="Call the vet", due_at=NOW + 86400, actor="owner")
    assert later["status"] == "open" and later["due_at"] == NOW + 86400
    assert ms.update("later", later["id"], {"status": "done"}, actor="owner")["status"] == "done"
    with pytest.raises(MemoryError_):
        ms.update("later", later["id"], {"status": "banana"}, actor="owner")

    rec = ms.add("records", title="Passport", body="number on the card", kind="document", actor="owner")
    assert rec["sensitivity"] == "normal" and rec["kind"] == "document"


def test_validation(ms):
    for bad in ({"title": ""}, {"title": "x" * 201}, {"title": "ok", "body": "b" * 70000}, {"title": "ok", "tags": ["t"] * 40},
                {"title": "ok", "tags": [1]}):
        with pytest.raises(MemoryError_):
            ms.add("kept", actor="owner", **bad)
    with pytest.raises(MemoryError_):
        ms.add("nope", title="x", actor="owner")
    with pytest.raises(MemoryError_):
        ms.update("kept", "x", {"id": "other"}, actor="owner")
    k = ms.add("kept", title="t", actor="owner")
    for forbidden in ({"provenance": "owner"}, {"created_at": 1}, {"table": "later"}, {"nonsense": 1}):
        with pytest.raises(MemoryError_):
            ms.update("kept", k["id"], forbidden, actor="owner")
    with pytest.raises(MemoryError_):
        ms.add("later", title="t", due_at="tomorrow", actor="owner")
    with pytest.raises(MemoryError_):
        ms.add("records", title="t", sensitivity="secret", actor="owner")


def test_provenance_rules(ms):
    assert ms.add("kept", title="a", provenance="owner", actor="owner")["provenance"] == "owner"
    s = ms.add("kept", title="b", provenance="suggestion", actor="agent1")
    assert s["provenance"] == "suggestion"
    e = ms.add("kept", title="c", provenance="external_ref", source_ref="https://example.test/page", actor="owner")
    assert e["source_ref"] == "https://example.test/page"
    with pytest.raises(MemoryError_):
        ms.add("kept", title="d", provenance="external_ref", actor="owner")        # needs a source_ref
    with pytest.raises(MemoryError_):
        ms.add("kept", title="e", provenance="guess", actor="owner")
    with pytest.raises(MemoryError_):
        ms.add("kept", title="f", provenance="owner", source_ref="x", actor="owner")  # source_ref only for external_ref


def test_list_orders_and_pages(ms):
    ids = []
    for i in range(5):
        ms.clock.t += 1
        ids.append(ms.add("kept", title=f"n{i}", actor="owner")["id"])
    got = [r["id"] for r in ms.list("kept")]
    assert got == ids[::-1]                                     # newest first
    assert [r["id"] for r in ms.list("kept", limit=2, offset=1)] == ids[::-1][1:3]
    with pytest.raises(MemoryError_):
        ms.list("kept", limit=0)
    with pytest.raises(MemoryError_):
        ms.list("kept", limit=10_000)


def test_later_list_filters_by_status_and_sorts_by_due(ms):
    a = ms.add("later", title="a", due_at=NOW + 30, actor="owner")
    b = ms.add("later", title="b", due_at=NOW + 10, actor="owner")
    c = ms.add("later", title="c", actor="owner")
    ms.update("later", c["id"], {"status": "done"}, actor="owner")
    open_ids = [r["id"] for r in ms.list("later", status="open")]
    assert open_ids == [b["id"], a["id"]]
    assert [r["id"] for r in ms.list("later", status="done")] == [c["id"]]


# --------------------------------------------------------------- locked records

def test_locked_records_need_step_up_everywhere(ms):
    rec = ms.add("records", title="Bank PIN hint", body="blue heron", sensitivity="locked", actor="owner")
    with pytest.raises(Locked):
        ms.get("records", rec["id"])
    assert ms.get("records", rec["id"], step_up=True)["body"] == "blue heron"
    with pytest.raises(Locked):
        ms.update("records", rec["id"], {"body": "x"}, actor="owner")
    with pytest.raises(Locked):
        ms.delete("records", rec["id"], actor="owner")
    masked = [r for r in ms.list("records")][0]
    assert masked == {"id": rec["id"], "table": "records", "sensitivity": "locked", "locked": True,
                      "created_at": NOW}                           # no title, no body, no kind, no tags
    full = ms.list("records", step_up=True)[0]
    assert full["title"] == "Bank PIN hint" and full["body"] == "blue heron"
    assert ms.update("records", rec["id"], {"body": "red heron"}, actor="owner", step_up=True)["body"] == "red heron"
    ms.delete("records", rec["id"], actor="owner", step_up=True)


def test_locking_and_unlocking_a_record_needs_step_up_both_ways(ms):
    n = ms.add("records", title="plain", body="visible", actor="owner")
    with pytest.raises(Locked):
        ms.update("records", n["id"], {"sensitivity": "locked"}, actor="owner")        # locking changes who can read it
    ms.update("records", n["id"], {"sensitivity": "locked"}, actor="owner", step_up=True)
    with pytest.raises(Locked):
        ms.get("records", n["id"])
    with pytest.raises(Locked):
        ms.update("records", n["id"], {"sensitivity": "normal"}, actor="owner")
    ms.update("records", n["id"], {"sensitivity": "normal"}, actor="owner", step_up=True)
    assert ms.get("records", n["id"])["body"] == "visible"


def test_locked_text_never_reaches_find_or_agents_without_step_up(ms):
    ms.add("records", title="Heron note", body="the heron is blue", sensitivity="locked", actor="owner")
    ms.add("kept", title="Public heron", body="herons are birds", actor="owner")
    assert [r["table"] for r in ms.find("heron")] == ["kept"]
    got = ms.find("heron", step_up=True)
    assert sorted(r["table"] for r in got) == ["kept", "records"]
    assert [r for r in ms.find("heron", step_up=True, agent=True) if r["table"] == "records"] == []   # agents never
    blob = json.dumps(ms.find("heron"))
    assert "blue" not in blob and "Heron note" not in blob


def test_find_only_snippets_text_it_may_show(ms):
    ms.add("records", title="Vault", body="combination 12-34-56", sensitivity="locked", actor="owner")
    hit = [r for r in ms.find("combination", step_up=True) if r["table"] == "records"][0]
    assert "12-34-56" in hit["snippet"] and hit["sensitivity"] == "locked"
    assert ms.find("combination") == [] and ms.find("12-34-56") == []


def test_reading_a_locked_record_is_logged_without_its_content(ms):
    rec = ms.add("records", title="Secret title", body="secret body", sensitivity="locked", actor="owner")
    ms.get("records", rec["id"], step_up=True, actor="owner")
    events = ms.history(limit=10)
    read = [e for e in events if e["event"] == "read_locked"][0]
    assert read["row_id"] == rec["id"] and read["actor"] == "owner"
    assert "secret" not in json.dumps(events).lower()                # titles/bodies of locked rows are never in history


# ------------------------------------------------------------------------ find

def test_find_basic_prefix_and_sync(ms):
    a = ms.add("kept", title="Lentil soup", body="cumin and lemon", actor="owner")
    ms.add("later", title="Buy lentils", actor="owner")
    ms.add("records", title="Vet receipt", body="annual checkup", actor="owner")
    got = ms.find("lentil")
    assert {(r["table"]) for r in got} == {"kept", "later"}                       # prefix on the last token
    assert [r["table"] for r in ms.find("annual checkup")] == ["records"]
    assert ms.find("lemon")[0]["id"] == a["id"] and "lemon" in ms.find("lemon")[0]["snippet"].lower()
    ms.update("kept", a["id"], {"body": "cumin and lime"}, actor="owner")
    assert ms.find("lemon") == [] and ms.find("lime")[0]["id"] == a["id"]
    ms.delete("kept", a["id"], actor="owner")
    assert ms.find("lime") == [] and [r["table"] for r in ms.find("lentil")] == ["later"]


def test_find_limits_and_empty_queries(ms):
    for i in range(30):
        ms.add("kept", title=f"alpha {i}", actor="owner")
    assert len(ms.find("alpha", limit=5)) == 5
    assert len(ms.find("alpha")) == 20                         # default cap
    for q in ("", "   ", "***", "\"\"", "-", "()", "a" * 5000):
        assert ms.find(q) == [] or isinstance(ms.find(q), list)
    with pytest.raises(MemoryError_):
        ms.find("alpha", limit=1000)


@pytest.mark.parametrize("q", ['foo"bar', '"unbalanced', "a AND", "NEAR(x y)", "title:foo", "body : foo", "*", "foo*bar", "-foo",
                               "foo OR", "(foo", "foo)", "'; DROP TABLE kept;--", "\x00", "foo\nbar", "{x}", "^foo", "col1 : \"x\"",
                               "title NOT body", "+foo", "foo ~ bar", "‮foo"])
def test_find_treats_every_input_as_plain_words_never_syntax(ms, q):
    ms.add("kept", title="foo bar", body="x", actor="owner")
    ms.find(q)                                                     # never raises
    assert ms.db.conn().execute("select count(*) from kept").fetchone()[0] == 1   # and nothing was altered


def test_operators_are_just_words(ms):
    ms.add("kept", title="foo bar", actor="owner")
    ms.add("kept", title="foo or bar", actor="owner")
    ms.add("kept", title="foo", actor="owner")
    got = {r["title"] for r in ms.find("foo OR bar")}
    assert got == {"foo or bar"}                                   # OR is the word "or", all words must match
    assert {r["title"] for r in ms.find("title:foo")} == set()     # a column filter is not understood: "title" "foo"
    assert {r["title"] for r in ms.find("NEAR")} == set()


def test_find_unicode_and_case(ms):
    ms.add("kept", title="Crème brûlée", body="Zażółć gęślą", actor="owner")
    assert ms.find("creme")[0]["title"] == "Crème brûlée"           # diacritics folded
    assert ms.find("BRÛLÉE")[0]["title"] == "Crème brûlée"
    assert ms.find("zażółć")[0]["title"] == "Crème brûlée"


# ---------------------------------------------------------------------- history

def test_history_is_append_only_and_records_changes_without_bodies(ms):
    k = ms.add("kept", title="t", body="private-ish body", actor="owner")
    ms.update("kept", k["id"], {"body": "new private-ish body"}, actor="owner")
    ms.delete("kept", k["id"], actor="owner")
    ev = ms.history(limit=10)
    assert [e["event"] for e in ev] == ["deleted", "updated", "created"]
    assert all(e["table"] == "kept" and e["row_id"] == k["id"] and e["actor"] == "owner" for e in ev)
    assert ev[1]["detail"] == {"fields": ["body"]}
    assert "private-ish" not in json.dumps(ev)
    with pytest.raises(sqlite3.DatabaseError):
        with ms.db.write_tx() as tx:
            tx.execute("update history set actor='mallory'")
    with pytest.raises(sqlite3.DatabaseError):
        with ms.db.write_tx() as tx:
            tx.execute("delete from history")
    assert len(ms.history(limit=10)) == 3


def test_history_paging_and_limits(ms):
    for i in range(12):
        ms.add("kept", title=f"n{i}", actor="owner")
    assert len(ms.history(limit=5)) == 5
    assert ms.history(limit=5, before_id=ms.history(limit=1)[0]["id"])[0]["id"] < ms.history(limit=1)[0]["id"]
    with pytest.raises(MemoryError_):
        ms.history(limit=0)


# ------------------------------------------------------------- agent answers

def test_agent_answers_are_narrow_and_scoped(ms):
    ms.add("later", title="secret plan", actor="owner")
    ms.add("later", title="done one", actor="owner")
    ms.update("later", ms.list("later")[0]["id"], {"status": "done"}, actor="owner")
    ms.add("kept", title="k", actor="owner")
    ms.add("records", title="r", actor="owner")
    ms.add("records", title="locked", sensitivity="locked", actor="owner")
    assert ms.agent_answer("later.count", scopes=("memory.later.count",), actor="agent1") == {"name": "later.count", "value": 1}
    assert ms.agent_answer("kept.count", scopes=("memory.*",), actor="agent1")["value"] == 1
    assert ms.agent_answer("records.count", scopes=("memory.*",), actor="agent1")["value"] == 1     # locked not counted
    for answer in (ms.agent_answer("later.count", scopes=("memory.*",), actor="a"),):
        assert set(answer) == {"name", "value"} and isinstance(answer["value"], int)


def test_agent_answers_refuse_unknown_names_and_missing_scope(ms):
    with pytest.raises(NotPermitted_):
        ms.agent_answer("later.count", scopes=("deploy.*",), actor="a")
    with pytest.raises(NotPermitted_):
        ms.agent_answer("later.count", scopes=("memory.kept.count",), actor="a")
    with pytest.raises(NotFound):
        ms.agent_answer("search", scopes=("memory.*",), actor="a")          # there is no generic search for agents
    with pytest.raises(NotFound):
        ms.agent_answer("later.titles", scopes=("memory.*",), actor="a")


def test_agent_reads_are_logged(ms):
    ms.agent_answer("later.count", scopes=("memory.*",), actor="agent1")
    e = ms.history(limit=1)[0]
    assert e["event"] == "agent_read" and e["actor"] == "agent1" and e["detail"] == {"name": "later.count"}


# --------------------------------------------------------------- export/backup

def test_export_ndjson_per_table(ms):
    ms.add("kept", title="a", tags=["x"], actor="owner")
    ms.add("kept", title="b", provenance="suggestion", actor="agent1")
    ms.add("later", title="l", due_at=NOW + 5, actor="owner")
    ms.add("records", title="plain", body="p", actor="owner")
    ms.add("records", title="locked", body="l", sensitivity="locked", actor="owner")
    lines = list(ms.export_ndjson("kept"))
    rows = [json.loads(x) for x in lines]
    assert len(rows) == 2 and all(x.endswith("\n") for x in lines)
    assert {r["title"] for r in rows} == {"a", "b"} and all({"id", "provenance", "created_at", "updated_at"} <= set(r) for r in rows)
    assert [json.loads(x)["title"] for x in ms.export_ndjson("later")] == ["l"]
    plain = [json.loads(x) for x in ms.export_ndjson("records")]
    assert [r["title"] for r in plain] == ["plain"]                      # locked rows only with step-up
    both = [json.loads(x) for x in ms.export_ndjson("records", step_up=True)]
    assert {r["title"] for r in both} == {"plain", "locked"}
    hist = [json.loads(x) for x in ms.export_ndjson("history")]
    assert hist and "title" not in json.dumps(hist)
    with pytest.raises(MemoryError_):
        list(ms.export_ndjson("sqlite_master"))


def test_backup_is_a_dated_private_consistent_copy(ms, tmp_path):
    for i in range(20):
        ms.add("kept", title=f"n{i}", body="x", actor="owner")
    ms.add("records", title="L", body="y", sensitivity="locked", actor="owner")
    dest = tmp_path / "backups"
    path = ms.backup(dest)
    assert path.parent == dest and path.name.startswith("worlds-") and path.suffix == ".db"
    assert not stat.S_IMODE(path.stat().st_mode) & 0o077 and not stat.S_IMODE(dest.stat().st_mode) & 0o077
    c = sqlite3.connect(path)
    assert c.execute("pragma integrity_check").fetchone()[0] == "ok"
    assert c.execute("select count(*) from kept").fetchone()[0] == 20
    c.close()
    ms.clock.t += 1
    assert ms.backup(dest) != path                                      # a second backup never overwrites the first


def test_backup_during_concurrent_writes_is_consistent(ms, tmp_path):
    stop = threading.Event()

    def writer():
        i = 0
        while not stop.is_set():
            ms.add("kept", title=f"w{i}", body="data", actor="owner")
            i += 1

    t = threading.Thread(target=writer)
    t.start()
    try:
        path = ms.backup(tmp_path / "b")
    finally:
        stop.set()
        t.join()
    c = sqlite3.connect(path)
    assert c.execute("pragma integrity_check").fetchone()[0] == "ok"
    kept = c.execute("select count(*) from kept").fetchone()[0]
    indexed = c.execute("select count(*) from find_index where table_name='kept'").fetchone()[0]
    assert kept == indexed                                              # the index and the rows agree in the copy


def test_restore_round_trip_and_refusals(ms, tmp_path):
    k = ms.add("kept", title="Lentil soup", body="cumin", actor="owner")
    ms.add("later", title="vet", actor="owner")
    ms.add("records", title="L", body="heron", sensitivity="locked", actor="owner")
    backup = ms.backup(tmp_path / "bk")
    fresh = tmp_path / "restored"
    counts = restore_backup(backup, fresh)
    assert counts == {"kept": 1, "later": 1, "records": 1, "history": counts["history"]} and counts["history"] >= 3
    db2 = Database.in_dir(fresh)
    m2 = MemoryStore(db2, clock=Clock())
    assert m2.get("kept", k["id"])["title"] == "Lentil soup"
    assert [r["table"] for r in m2.find("lentil")] == ["kept"] and m2.find("heron") == []
    assert [r["table"] for r in m2.find("heron", step_up=True)] == ["records"]
    assert not stat.S_IMODE((fresh / "worlds.db").stat().st_mode) & 0o077
    with pytest.raises(MemoryError_):
        restore_backup(backup, fresh)                                   # never overwrites an existing database
    junk = tmp_path / "junk.db"
    junk.write_bytes(b"not a database at all")
    with pytest.raises(MemoryError_):
        restore_backup(junk, tmp_path / "other")
    assert not (tmp_path / "other" / "worlds.db").exists()


def test_data_survives_a_restart(ms, tmp_path):
    k = ms.add("kept", title="durable", body="persisted", actor="owner")
    ms.db.close()
    again = MemoryStore(Database.in_dir(ms.dir), clock=Clock())
    assert again.get("kept", k["id"])["body"] == "persisted" and again.find("durable")[0]["id"] == k["id"]
    assert again.history(limit=1)[0]["event"] == "created"


def test_concurrent_writers_keep_rows_and_index_in_step(ms):
    def work(n):
        for i in range(25):
            ms.add("kept", title=f"t{n}-{i}", body="zebra", actor=f"w{n}")

    ts = [threading.Thread(target=work, args=(n,)) for n in range(4)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert ms.db.conn().execute("select count(*) from kept").fetchone()[0] == 100
    assert len(ms.find("zebra", limit=100)) == 100
    assert ms.db.conn().execute("select count(*) from history where event='created'").fetchone()[0] == 100


def test_failed_write_rolls_back_rows_index_and_history_together(ms, monkeypatch):
    before = ms.db.conn().execute("select count(*) from history").fetchone()[0]

    def boom(*a, **k):
        raise RuntimeError("history write failed")

    monkeypatch.setattr(ms, "_record_history", boom)        # the history row is written in the same transaction
    with pytest.raises(RuntimeError):
        ms.add("kept", title="x" * 50, body="ok", actor="owner")
    assert ms.db.conn().execute("select count(*) from kept").fetchone()[0] == 0
    assert ms.db.conn().execute("select count(*) from find_index").fetchone()[0] == 0
    assert ms.db.conn().execute("select count(*) from history").fetchone()[0] == before


# ----------------------------------------------------------- review hardening

def test_step_up_must_be_exactly_true(ms):
    rec = ms.add("records", title="L", body="b", sensitivity="locked", actor="owner")
    for truthy in ("yes", 1, "true", [1], object()):
        with pytest.raises(Locked):
            ms.get("records", rec["id"], step_up=truthy)
        with pytest.raises(Locked):
            ms.update("records", rec["id"], {"body": "x"}, actor="owner", step_up=truthy)
        with pytest.raises(Locked):
            ms.delete("records", rec["id"], actor="owner", step_up=truthy)
    assert ms.get("records", rec["id"], step_up=True)["body"] == "b"


def test_the_lock_is_checked_inside_the_write_transaction(ms, monkeypatch):
    """A record locked between a caller's read and its write is still protected."""
    rec = ms.add("records", title="L", body="b", actor="owner")
    real = ms._fetch

    def lock_then_fetch(table, row_id, conn=None):
        if conn is not None:                                   # the in-transaction read: someone locked it just before
            conn.execute("update records set sensitivity='locked' where id=?", (row_id,))
        return real(table, row_id, conn)

    monkeypatch.setattr(ms, "_fetch", lock_then_fetch)
    with pytest.raises(Locked):
        ms.update("records", rec["id"], {"body": "overwritten"}, actor="owner")
    with pytest.raises(Locked):
        ms.delete("records", rec["id"], actor="owner")
    assert ms.db.conn().execute("select body from records").fetchone()[0] == "b"


def test_tags_update_round_trips(ms):
    k = ms.add("kept", title="t", tags=["a"], actor="owner")
    assert ms.update("kept", k["id"], {"tags": ["a", "b"]}, actor="owner")["tags"] == ["a", "b"]
    assert ms.get("kept", k["id"])["tags"] == ["a", "b"]
    assert ms.update("kept", k["id"], {"tags": None}, actor="owner")["tags"] == []


def test_export_and_backup_are_logged_and_export_says_whether_locked_rows_were_included(ms, tmp_path):
    ms.add("records", title="L", sensitivity="locked", actor="owner")
    list(ms.export_ndjson("records"))
    list(ms.export_ndjson("records", step_up=True))
    ms.backup(tmp_path / "b")
    ev = ms.history(limit=5)
    assert ev[0]["event"] == "backup" and "file" in ev[0]["detail"]
    assert [e["detail"] for e in ev[1:3]] == [{"locked_included": True}, {"locked_included": False}]


def test_a_refused_export_is_refused_at_call_time_and_not_logged(ms):
    n = len(ms.history(limit=100))
    with pytest.raises(MemoryError_):
        ms.export_ndjson("sqlite_master")                      # not even iterated
    assert len(ms.history(limit=100)) == n


def test_foreign_schema_cannot_run_functions(tmp_path):
    db = Database.in_dir(tmp_path / "d")
    assert db.conn().execute("pragma trusted_schema").fetchone()[0] == 0


# ------------------------------------------------ restore never imports anything but memory rows

def _poisoned_backup(ms, tmp_path):
    ms.add("kept", title="Lentil soup", body="cumin", actor="owner")
    ms.add("records", title="L", body="heron", sensitivity="locked", actor="owner")
    path = ms.backup(tmp_path / "bk")
    c = sqlite3.connect(path)
    c.execute("create table evil (x)")
    c.execute("create view evil_view as select * from kept")
    c.execute("create trigger pwn after insert on kept begin insert into history(at,actor,event) values (1,'pwn','pwned'); end")
    c.execute("drop trigger history_no_update")
    c.execute("drop trigger history_no_delete")
    c.execute("insert into sessions(id_hash,principal,method,created_at,last_seen_at,expires_at,binding) values ('h','owner','x',1,1,9e12,'')")
    c.execute("insert into agent_tokens(id,name,token_hash,scopes,created_at) values ('t','bot','h','[\"*\"]',1)")
    c.execute("insert into authorizations(id,action_id,action_version,caller,destination,params_hash,params_json,created_at,expires_at,state,"
              "authority) values ('a','go','v','agent','d','h','{}',1,9e12,'approved','policy:never')")
    c.execute("insert into leases(instance_id,heartbeat) values ('live',9e12)")
    c.execute("insert into owner_state(key,value) values ('oidc_login_binding','x')")
    c.commit()
    c.close()
    return path


def test_a_poisoned_backup_restores_only_memory_rows(ms, tmp_path):
    path = _poisoned_backup(ms, tmp_path)
    fresh = tmp_path / "restored"
    counts = restore_backup(path, fresh)
    assert counts["kept"] == 1 and counts["records"] == 1
    db = Database.in_dir(fresh)
    for table in ("sessions", "agent_tokens", "authorizations", "executions", "owner_state"):
        assert db.conn().execute(f"select count(*) from {table}").fetchone()[0] == 0, table
    assert db.conn().execute("select count(*) from leases where instance_id='live'").fetchone()[0] == 0
    names = {r[0] for r in db.conn().execute("select name from sqlite_master")}
    assert "evil" not in names and "evil_view" not in names and "pwn" not in names
    assert {"history_no_update", "history_no_delete"} <= names                      # our append-only triggers, not the backup's absence
    with pytest.raises(sqlite3.DatabaseError):
        with db.write_tx() as tx:
            tx.execute("update history set actor='x'")
    m2 = MemoryStore(db, clock=Clock())
    assert [r["table"] for r in m2.find("lentil")] == ["kept"] and [r["table"] for r in m2.find("heron", step_up=True)] == ["records"]
    assert m2.find("heron") == []
    assert not any(e["event"] == "pwned" for e in m2.history(limit=100))
    assert m2.history(limit=1)[0]["event"] == "restored"
    m2.add("kept", title="after", actor="owner")                                     # the planted trigger does not fire
    assert not any(e["actor"] == "pwn" for e in m2.history(limit=100))


@pytest.mark.parametrize("poison", [
    "update kept set provenance='root'", "update kept set id='not-hex'", "update kept set title=''", "update kept set tags='{bad'",
    "update kept set created_at='soon'", "update records set sensitivity='locked ' ",
    "update history set detail='{not json'", "update kept set source_ref='x' where 1"])
def test_a_crafted_row_refuses_the_whole_restore_atomically(ms, tmp_path, poison):
    path = _poisoned_backup(ms, tmp_path)
    c = sqlite3.connect(path)
    c.execute("drop trigger pwn")
    try:
        c.execute(poison)
    except sqlite3.Error:
        pytest.skip("the backup's own constraints already refuse this row")
    c.commit()
    c.close()
    fresh = tmp_path / "r2"
    with pytest.raises((MemoryError_, sqlite3.Error)):
        restore_backup(path, fresh)
    db = Database.in_dir(fresh)
    for t in ("kept", "later", "records", "history", "find_index"):
        assert db.conn().execute(f"select count(*) from {t}").fetchone()[0] == 0, t   # nothing partially restored


def test_restore_refuses_a_target_that_already_holds_memory(ms, tmp_path):
    ms.add("kept", title="x", actor="owner")
    backup = ms.backup(tmp_path / "bk")
    with pytest.raises(MemoryError_):
        restore_backup(backup, ms.dir)                         # the live data dir: never overwritten


def test_backup_files_stay_private_for_their_whole_lifetime(ms, tmp_path):
    import os
    before = os.umask(0o022)
    try:
        path = ms.backup(tmp_path / "bk2")
        assert os.umask(0o022) == 0o022                        # the process umask is put back
    finally:
        os.umask(before)
    for p in (tmp_path / "bk2").iterdir():
        assert not stat.S_IMODE(p.stat().st_mode) & 0o077, p.name
