"""Brain write-path coherence (critical batch).

Pins the repaired tool-executor semantics end to end:

- TOOL-004: journal search resolves through the canonical FTS memory
  provider (same source as /api/memory/search) and finds known phrases.
- TOOL-025/026: an AUTHORIZED proposal execution persists to
  world.json; a brand-new load sees the intent/fact.
- TOOL-027: an AUTHORIZED reminder execution goes through the live
  Scheduler (reminders.json); it survives a fresh Scheduler instance.
- TOOL-028: reconciler apply without an adapter answers
  ok=False / unsupported and consumes nothing.
- TOOL-029 truthfulness: no mutation returns success; model-provided
  `approved` booleans alone execute NOTHING (the proposal stays
  pending); only the process human-authorization token may execute.
- Proposal creation journals an audit event (created/pending), and a
  rejection is journaled — no fake approvals anywhere.
"""
import sys  # noqa: E402
from pathlib import Path  # noqa: E402

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from personal_world.app import load_world, save_world  # noqa: E402
from personal_world.journal import Journal  # noqa: E402
from personal_world.providers.native_memory import (  # noqa: E402
    NativeMemoryProvider,
)
from personal_world.scheduler import Reminder, Scheduler  # noqa: E402
from personal_world.tool_registry import (  # noqa: E402
    build_default_tools, human_execution_token, _proposals,
)


def _world_env(tmp_path):
    world_path = tmp_path / "world.json"
    world = load_world(world_path)
    journal = Journal(tmp_path / "journal.ndjson")
    memory = NativeMemoryProvider(tmp_path, journal=journal)
    return world, world_path, journal, memory


class TestJournalSearch:
    def test_search_via_memory_fts(self, tmp_path):
        world, world_path, journal, memory = _world_env(tmp_path)
        journal.record("observation", "the lantern festival is on Friday",
                       source="test")
        memory.index_journal()
        from personal_world.tool_registry import _search_journal
        r = _search_journal(journal, "lantern", memory)
        assert r.ok, r.warnings
        entries = r.data["entries"]
        assert entries, "known phrase must be found"
        assert any("lantern festival" in (e.get("summary") or "")
                   for e in entries)

    def test_no_memory_provider_is_honest(self, tmp_path):
        world, world_path, journal, _ = _world_env(tmp_path)
        from personal_world.tool_registry import _search_journal
        r = _search_journal(journal, "anything", None)
        assert not r.ok
        assert r.status == "unavailable"


class TestWorldWrites:
    def test_intent_persists_across_fresh_load(self, tmp_path):
        world, world_path, journal, memory = _world_env(tmp_path)
        r = _execute_intent(world, world_path, journal, "wishes/weather",
                            "sunny tomorrow")
        assert r.ok and r.data["status"] == "executed"
        assert r.data["persisted"] == "world.json"
        fresh = load_world(world_path)
        assert "wishes/weather" in fresh_intents(fresh)

    def test_fact_persists_across_new_api_request(self, tmp_path):
        world, world_path, journal, memory = _world_env(tmp_path)
        r = _execute_fact(world, world_path, journal, "tea/brewed", "yes")
        assert r.ok and r.data["status"] == "executed"
        # simulate a completely new request: load world from disk
        fresh = load_world(world_path)
        assert fresh.facts["tea/brewed"].value == "yes"


def fresh_intents(world):
    return world.intents


def _execute(world, world_path, journal, memory, scheduler,
             propose_call, proposal_id):
    """Authorized execution path: the caller must pass the process
    human token (minted outside any model loop)."""
    return _exec_core(journal, world, proposal_id, True,
                      world_path=world_path, scheduler=scheduler)


def _exec_core(journal, world, proposal_id, approved,
               world_path=None, scheduler=None):
    from personal_world.tool_registry import _execute_approved_write
    return _execute_approved_write(
        journal, world, proposal_id, approved,
        human_auth=human_execution_token(),
        world_path=world_path, scheduler=scheduler,
    )


def _execute_intent(world, world_path, journal, key, intent):
    r = _propose_intent(journal, world, key, intent)
    assert r.ok, r.warnings
    pid = r.data["proposal_id"]
    return _exec_core(journal, world, pid, True, world_path=world_path)


def _propose_intent(journal, world, key, intent):
    from personal_world.tool_registry import _propose_world_intent
    return _propose_world_intent(journal, world, key, intent)


def _execute_fact(world, world_path, journal, key, fact):
    from personal_world.tool_registry import _propose_world_fact
    r = _propose_world_fact(journal, world, key, fact)
    assert r.ok, r.warnings
    return _exec_core(journal, world, r.data["proposal_id"], True,
                      world_path=world_path)


class TestReminderWrites:
    def test_authorized_execution_creates_real_reminder(self, tmp_path):
        world, world_path, journal, memory = _world_env(tmp_path)
        sched = Scheduler(tmp_path / "reminders.json", journal=journal)
        from personal_world.tool_registry import _propose_reminder
        r = _propose_reminder(journal, "water the ferns")
        assert r.ok and r.data["status"] == "pending"
        pid = r.data["proposal_id"]
        ex = _exec_core(journal, world, pid, True,
                        world_path=world_path, scheduler=sched)
        assert ex.ok and ex.data["status"] == "executed"
        assert ex.data["persisted"] == "reminders.json"
        # fresh Scheduler over the same path sees it (survives restart)
        sched2 = Scheduler(tmp_path / "reminders.json")
        texts = [x.text for x in sched2.list_reminders()]
        assert "water the ferns" in texts

    def test_unwired_scheduler_leaves_pending(self, tmp_path):
        world, world_path, journal, memory = _world_env(tmp_path)
        from personal_world.tool_registry import _propose_reminder
        r = _propose_reminder(journal, "check the mail")
        pid = r.data["proposal_id"]
        ex = _exec_core(journal, world, pid, True, world_path=world_path)
        assert not ex.ok
        assert _proposals[pid]["status"] == "pending"


class TestReconcilerApply:
    def test_unsupported_without_adapter(self, tmp_path):
        world, world_path, journal, memory = _world_env(tmp_path)
        from personal_world.tool_registry import _propose_reconciler_apply
        r = _propose_reconciler_apply(journal, "no-such-service")
        # service has no desired state → honest not_found
        assert not r.ok
        assert r.status == "not_found"

    def test_execution_reports_unsupported_not_success(self, tmp_path, monkeypatch):
        world, world_path, journal, memory = _world_env(tmp_path)
        from personal_world.tool_registry import _propose_reconciler_apply
        # create desired state where the reconciler actually reads it
        monkeypatch.setenv("HOME", str(tmp_path))
        desired_dir = tmp_path / ".config/personal-world/reconciler/desired"
        desired_dir.mkdir(parents=True)
        (desired_dir / "svc.yml").write_text("image: nginx\n")
        r = _propose_reconciler_apply(journal, "svc")
        assert r.ok and r.data["status"] == "pending"
        pid = r.data["proposal_id"]
        ex = _exec_core(journal, world, pid, True,
                        world_path=world_path)
        assert not ex.ok
        assert ex.status == "unsupported"
        assert _proposals[pid]["status"] == "pending"


class TestSelfApprovalPrevention:
    def test_model_supplied_approval_executes_nothing(self, tmp_path):
        world, world_path, journal, memory = _world_env(tmp_path)
        from personal_world.tool_registry import _propose_world_intent
        r = _propose_intent(journal, world, "k", "v")
        pid = r.data["proposal_id"]
        # NO human token: exactly what the model loop can send
        from personal_world.tool_registry import _execute_approved_write
        res = _execute_approved_write(
            journal, world, pid, True,
            human_auth=None, world_path=world_path,
        )
        assert not res.ok
        assert res.status == "forbidden"
        assert _proposals[pid]["status"] == "pending"
        # and nothing was persisted
        fresh = load_world(world_path)
        assert "k" not in fresh.intents

    def test_wrong_token_also_refused(self, tmp_path):
        world, world_path, journal, memory = _world_env(tmp_path)
        r = _propose_intent(journal, world, "k", "v")
        pid = r.data["proposal_id"]
        from personal_world.tool_registry import _execute_approved_write
        res = _execute_approved_write(
            journal, world, pid, True, human_auth="guessed-token",
            world_path=world_path,
        )
        assert not res.ok
        assert _proposals[pid]["status"] == "pending"

    def test_correct_human_token_executes(self, tmp_path):
        world, world_path, journal, memory = _world_env(tmp_path)
        r = _propose_intent(journal, world, "k2", "v2")
        pid = r.data["proposal_id"]
        res = _exec_core(journal, world, pid, True, world_path=world_path)
        assert res.ok and res.data["status"] == "executed"

    def test_rejection_journaled_and_consumes(self, tmp_path):
        world, world_path, journal, memory = _world_env(tmp_path)
        r = _propose_intent(journal, world, "k3", "v3")
        pid = r.data["proposal_id"]
        res = _exec_core(journal, world, pid, False, world_path=world_path)
        assert res.ok
        assert res.data["status"] == "rejected"
        assert _proposals[pid]["status"] == "rejected"


class TestProposalAudit:
    def test_creation_journaled_pending(self, tmp_path):
        world, world_path, journal, memory = _world_env(tmp_path)
        r = _propose_intent(journal, world, "audit-key", "audit-val")
        assert r.data["status"] == "pending"
        events = [e.summary for e in journal.events()]
        assert any("brain write proposal created" in s and
                   r.data["proposal_id"] in s for s in events)
        # the audit record carries type + pending state
        assert any("world_intent" in s for s in events)

    def test_no_fake_approval_journaled(self, tmp_path):
        world, world_path, journal, memory = _world_env(tmp_path)
        r = _propose_intent(journal, world, "k4", "v4")
        pid = r.data["proposal_id"]
        before = journal.recent(100)
        from personal_world.tool_registry import _execute_approved_write
        _execute_approved_write(journal, world, pid, True, human_auth=None)
        after = journal.recent(len(before) + 50)
        # no new journal event may claim an approval/execution
        new_events = after[len(before):]
        assert not any("approved" in e.summary.lower() for e in new_events)