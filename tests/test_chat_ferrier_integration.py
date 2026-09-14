"""Chat ↔ ferrier integration tests.

Verifies the /api/chat tool-calling path is bounded to the ferrier
surface: READ + PROPOSAL tools only. `execute_approved_write` must be
absent from the model schema and refused by the invoke path. Hermetic —
no live models, no network.
"""

import json
import inspect
import sys
from pathlib import Path

import pytest

from personal_world import api
from personal_world.envelope import Result, fail, ok
from personal_world.tool_registry import Tool, ToolRegistry


def _registry_with_execute() -> ToolRegistry:
    tools = ToolRegistry()
    tools.register(Tool(
        id="inspect_media_status",
        capability="media",
        operation="status",
        description="Inspect media health.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: ok("healthy", data={"status": "healthy"}),
    ))
    tools.register(Tool(
        id="propose_reminder",
        capability="journal",
        operation="propose",
        description="Propose a reminder for owner approval.",
        read_write="write",
        requires_approval=True,
        parameters={
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
        handler=lambda text: ok("proposal_pending", data={"proposal_id": "p1", "text": text}),
    ))
    tools.register(Tool(
        id="execute_approved_write",
        capability="write",
        operation="execute",
        description="Execute an approved write. Only after owner approval.",
        read_write="write",
        requires_step_up=True,
        parameters={
            "type": "object",
            "properties": {"proposal_id": {"type": "string"}},
            "required": ["proposal_id"],
        },
        handler=lambda proposal_id: ok("applied", data={"applied": proposal_id}),
    ))
    return tools


# ── Surface: schema hides execution ────────────────────────────────


def test_ferrier_schemas_hides_execute():
    tools = _registry_with_execute()
    names = {s["function"]["name"] for s in tools.ferrier_schemas()}
    assert "inspect_media_status" in names
    assert "propose_reminder" in names
    assert "execute_approved_write" not in names


def test_ferrier_schemas_are_ollama_format():
    tools = _registry_with_execute()
    for schema in tools.ferrier_schemas():
        assert "function" in schema
        assert "name" in schema["function"]
        assert "parameters" in schema["function"]


def test_full_surface_still_has_execute():
    tools = _registry_with_execute()
    names = {s["function"]["name"] for s in tools.list_ollama_schemas()}
    assert "execute_approved_write" in names


# ── Invoke path: execution refused ─────────────────────────────────


def test_invoke_ferrier_allows_read():
    tools = _registry_with_execute()
    result = tools.invoke_ferrier("inspect_media_status", {})
    assert result.ok is True


def test_invoke_ferrier_allows_proposal():
    tools = _registry_with_execute()
    result = tools.invoke_ferrier("propose_reminder", {"text": "water plants"})
    assert result.ok is True
    assert result.status == "proposal_pending"


def test_invoke_ferrier_refuses_execute():
    tools = _registry_with_execute()
    result = tools.invoke_ferrier("execute_approved_write", {"proposal_id": "p1"})
    assert result.ok is False
    assert result.status == "forbidden"


def test_invoke_ferrier_refuses_evasion_aliases():
    tools = _registry_with_execute()
    for alias in ("Execute", "execute_approved_write ", "execute_approved_writ"):
        result = tools.invoke_ferrier(alias, {})
        assert result.ok is False, alias


def test_invoke_ferrier_refuses_unknown():
    tools = _registry_with_execute()
    result = tools.invoke_ferrier("no_such_tool", {})
    assert result.ok is False
    assert result.status == "forbidden"


# ── Chat tool loop routes through ferrier surface ──────────────────


class _FakeChat:
    """Two-phase fake: first call returns a tool call to the execute
    tool; second call returns a plain text reply."""

    def __init__(self, tool_name: str) -> None:
        self.tool_name = tool_name
        self.calls = 0

    def chat_with_tools(self, messages, tool_schemas):
        self.calls += 1
        schema_names = {s["function"]["name"] for s in tool_schemas}
        if self.calls == 1:
            assert self.tool_name not in schema_names, (
                f"execute tool must not be in model schema: {schema_names}"
            )
            return ok("healthy", data={
                "tool_calls": [{
                    "function": {
                        "name": self.tool_name,
                        "arguments": json_dumps({"proposal_id": "p1"}),
                    },
                    "id": "call_1",
                }],
                "model": "fake",
            })
        return ok("healthy", data={"reply": "done", "model": "fake"})


def json_dumps(obj) -> str:
    return json.dumps(obj)


def test_chat_loop_refuses_execute_via_ferrier_surface():
    tools = _registry_with_execute()
    schemas = tools.ferrier_schemas()
    messages: list[dict] = [{"role": "user", "content": "do it"}]

    result = api._chat_with_tools_loop(_FakeChat("execute_approved_write"), messages, tools, schemas)

    assert result.ok is True
    # The fake second-phase reply wins; the execute refusal was a tool
    # result the model saw, and no execution was performed.
    assert "done" in str(result.data)


def test_chat_loop_never_exposes_execute_schema():
    tools = _registry_with_execute()
    schemas = tools.ferrier_schemas()
    names = {s["function"]["name"] for s in schemas}
    assert "execute_approved_write" not in names
    assert "inspect_media_status" in names
    assert "propose_reminder" in names


# ── /api/chat endpoint uses ferrier_schemas ────────────────────────


def test_chat_loop_routes_through_invoke_ferrier():
    """The loop must execute through the ferrier guard, never raw invoke."""
    source = inspect.getsource(api._chat_with_tools_loop)
    assert "invoke_ferrier" in source
    assert ".invoke(" not in source


def test_chat_endpoint_uses_ferrier_schemas_for_loop():
    """The /api/chat endpoint requests its tool surface via
    ferrier_schemas() so execution tools never reach the model schema."""
    source = inspect.getsource(api.create_app)
    assert "ferrier_schemas()" in source
    assert "list_ollama_schemas()" not in source