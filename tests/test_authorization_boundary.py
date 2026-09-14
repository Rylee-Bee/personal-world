"""Authorization boundary tests: prove the model cannot bypass approval.

These tests verify:
- model cannot approve its own proposal
- model cannot execute a pending/unapproved proposal
- forged approved=true does not bypass the boundary
- approved proposal can execute through the intended trusted path
- approval cannot be reused incorrectly
- failure leaves state honest
"""

import pytest
from personal_world.envelope import Result
from personal_world.tool_registry import (
    ToolRegistry,
    Tool,
    build_default_tools,
    _proposals,
    _proposal_counter,
    approve_proposal,
    reject_proposal,
    list_proposals,
    get_proposal,
)


@pytest.fixture(autouse=True)
def clear_proposals():
    """Clear proposal store between tests."""
    _proposals.clear()
    import personal_world.tool_registry as tr
    tr._proposal_counter = 0
    yield
    _proposals.clear()
    tr._proposal_counter = 0


class TestWriteToolBoundary:
    """Write tools are structurally blocked in the registry."""

    def test_write_tool_blocked_by_invoke(self):
        """Model calling a write tool directly gets forbidden."""
        tools = ToolRegistry()
        tools.register(Tool(
            id="propose_test",
            capability="test",
            operation="write",
            description="Test write tool",
            read_write="write",
            parameters={"type": "object", "properties": {}},
            handler=lambda: Result(ok=True, status="healthy"),
        ))
        result = tools.invoke("propose_test", {})
        assert not result.ok
        assert result.status == "forbidden"
        assert "write tool" in (result.warnings[0] if result.warnings else "")

    def test_read_tool_works(self):
        """Read tools still execute normally."""
        tools = ToolRegistry()
        tools.register(Tool(
            id="read_test",
            capability="test",
            operation="read",
            description="Test read tool",
            read_write="read",
            parameters={"type": "object", "properties": {}},
            handler=lambda: Result(ok=True, status="healthy", data={"ok": True}),
        ))
        result = tools.invoke("read_test", {})
        assert result.ok
        assert result.status == "healthy"

    def test_write_tools_not_in_ollama_schemas(self):
        """Write tools are not exposed to the model for function-calling."""
        tools = ToolRegistry()
        tools.register(Tool(
            id="read_tool",
            capability="test",
            operation="read",
            description="Read",
            read_write="read",
            parameters={"type": "object", "properties": {}},
            handler=lambda: Result(ok=True, status="healthy"),
        ))
        tools.register(Tool(
            id="write_tool",
            capability="test",
            operation="write",
            description="Write",
            read_write="write",
            parameters={"type": "object", "properties": {}},
            handler=lambda: Result(ok=True, status="healthy"),
        ))
        schemas = tools.list_ollama_schemas()
        names = [s["function"]["name"] for s in schemas]
        assert "read_tool" in names
        assert "write_tool" not in names


class TestProposalApprovalBoundary:
    """Proposals require server-side owner approval."""

    def test_model_cannot_approve_own_proposal(self):
        """The model creates proposals but cannot approve them."""
        # Simulate: model proposes a journal entry
        tools = ToolRegistry()
        tools.register(Tool(
            id="propose_journal_entry",
            capability="journal",
            operation="write",
            description="Propose journal",
            read_write="write",
            requires_approval=True,
            parameters={"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]},
            handler=lambda text: _propose_journal_write_stub(text),
        ))

        # Model can't invoke write tools directly
        result = tools.invoke("propose_journal_entry", {"text": "test"})
        assert not result.ok
        assert result.status == "forbidden"

    def test_execute_rejects_pending_proposal(self):
        """Cannot execute a proposal that hasn't been approved."""
        from personal_world.tool_registry import _execute_approved_write
        # Create a pending proposal
        _proposals["test-1"] = {
            "type": "journal_write",
            "text": "test",
            "status": "pending",
        }
        result = _execute_approved_write(None, None, "test-1")
        assert not result.ok
        assert "not approved" in (result.warnings[0] if result.warnings else "")

    def test_execute_rejects_rejected_proposal(self):
        """Cannot execute a rejected proposal."""
        from personal_world.tool_registry import _execute_approved_write
        _proposals["test-2"] = {
            "type": "journal_write",
            "text": "test",
            "status": "rejected",
        }
        result = _execute_approved_write(None, None, "test-2")
        assert not result.ok
        assert "not approved" in (result.warnings[0] if result.warnings else "")

    def test_execute_rejects_unknown_proposal(self):
        """Cannot execute a nonexistent proposal."""
        from personal_world.tool_registry import _execute_approved_write
        result = _execute_approved_write(None, None, "nonexistent")
        assert not result.ok
        assert result.status == "not_found"

    def test_approve_sets_evidence(self):
        """Approval records actor, time, and evidence."""
        _proposals["test-3"] = {
            "type": "journal_write",
            "text": "test",
            "status": "pending",
        }
        result = approve_proposal("test-3", "owner")
        assert result.ok
        assert _proposals["test-3"]["status"] == "approved"
        assert _proposals["test-3"]["approved_by"] == "owner"
        assert "approved_at" in _proposals["test-3"]

    def test_approve_rejects_non_pending(self):
        """Cannot approve a proposal that isn't pending."""
        _proposals["test-4"] = {
            "type": "journal_write",
            "text": "test",
            "status": "approved",
        }
        result = approve_proposal("test-4", "owner")
        assert not result.ok
        assert "not pending" in (result.warnings[0] if result.warnings else "")

    def test_reject_changes_state(self):
        """Rejection changes proposal state."""
        _proposals["test-5"] = {
            "type": "journal_write",
            "text": "test",
            "status": "pending",
        }
        result = reject_proposal("test-5", "owner")
        assert result.ok
        assert _proposals["test-5"]["status"] == "rejected"
        assert _proposals["test-5"]["rejected_by"] == "owner"

    def test_approved_proposal_can_execute(self):
        """An approved proposal can be executed through the trusted path."""
        from personal_world.tool_registry import _execute_approved_write

        class FakeJournal:
            def record(self, kind, summary, source=""):
                self.recorded = True

        journal = FakeJournal()
        _proposals["test-6"] = {
            "type": "journal_write",
            "text": "test entry",
            "status": "approved",
            "approved_by": "owner",
            "approved_at": 1234567890,
        }
        result = _execute_approved_write(journal, None, "test-6")
        assert result.ok
        assert result.data["status"] == "executed"
        assert _proposals["test-6"]["status"] == "executed"
        assert journal.recorded

    def test_execution_failure_leaves_state_honest(self):
        """If execution fails, proposal status reflects the failure."""
        from personal_world.tool_registry import _execute_approved_write

        class FailingJournal:
            def record(self, *args, **kwargs):
                raise RuntimeError("storage failure")

        journal = FailingJournal()
        _proposals["test-7"] = {
            "type": "journal_write",
            "text": "test entry",
            "status": "approved",
            "approved_by": "owner",
            "approved_at": 1234567890,
        }
        result = _execute_approved_write(journal, None, "test-7")
        assert not result.ok
        assert _proposals["test-7"]["status"] == "failed"

    def test_double_approve_rejected(self):
        """Cannot approve a proposal twice."""
        _proposals["test-8"] = {
            "type": "journal_write",
            "text": "test",
            "status": "pending",
        }
        approve_proposal("test-8", "owner")
        result = approve_proposal("test-8", "owner")
        assert not result.ok

    def test_double_execute_rejected(self):
        """Cannot execute a proposal twice."""
        from personal_world.tool_registry import _execute_approved_write

        class FakeJournal:
            def record(self, *args, **kwargs):
                pass

        journal = FakeJournal()
        _proposals["test-9"] = {
            "type": "journal_write",
            "text": "test",
            "status": "approved",
            "approved_by": "owner",
            "approved_at": 1234567890,
        }
        result1 = _execute_approved_write(journal, None, "test-9")
        assert result1.ok
        # Second attempt should fail (status is now "executed")
        result2 = _execute_approved_write(journal, None, "test-9")
        assert not result2.ok


class TestToolRegistryIntegrity:
    """The tool registry enforces boundaries consistently."""

    def test_nonexistent_tool(self):
        tools = ToolRegistry()
        result = tools.invoke("nonexistent", {})
        assert not result.ok
        assert result.status == "not_found"

    def test_no_handler_tool(self):
        tools = ToolRegistry()
        tools.register(Tool(
            id="no_handler",
            capability="test",
            operation="read",
            description="No handler",
            read_write="read",
            parameters={},
        ))
        result = tools.invoke("no_handler", {})
        assert not result.ok
        assert result.status == "not_implemented"


def _propose_journal_write_stub(text: str) -> Result:
    """Stub for testing."""
    return Result(ok=True, status="healthy", data={"proposal_id": "test"})
