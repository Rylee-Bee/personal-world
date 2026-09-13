"""Tool registry: exposes Project Worlds capabilities to the reasoning brain.

Each tool has structured metadata and calls the same domain operation
the HTTP API uses. The brain proposes; Project Worlds authorizes and executes.

Read tools execute immediately when authorized.
Write tools go through propose → approval → execution → evidence.
"""

import json
from dataclasses import dataclass, field
from typing import Any, Callable

from .envelope import Result, fail, ok


@dataclass
class Tool:
    """A capability the brain can invoke."""
    id: str
    capability: str
    operation: str
    description: str
    read_write: str  # "read" or "write"
    required_args: list[str] = field(default_factory=list)
    optional_args: list[str] = field(default_factory=list)
    requires_step_up: bool = False
    requires_approval: bool = False
    handler: Callable[..., Result] | None = None

    def to_schema(self) -> dict[str, Any]:
        """JSON Schema for the brain's tool list."""
        schema: dict[str, Any] = {
            "name": self.id,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {},
                "required": self.required_args,
            },
        }
        return schema

    def to_metadata(self) -> dict[str, Any]:
        """Full metadata for provenance/debugging."""
        return {
            "id": self.id,
            "capability": self.capability,
            "operation": self.operation,
            "description": self.description,
            "read_write": self.read_write,
            "required_args": self.required_args,
            "optional_args": self.optional_args,
            "requires_step_up": self.requires_step_up,
            "requires_approval": self.requires_approval,
        }


class ToolRegistry:
    """Registry of tools available to the reasoning brain."""

    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.id] = tool

    def get(self, tool_id: str) -> Tool | None:
        return self._tools.get(tool_id)

    def list_tools(self) -> list[Tool]:
        return list(self._tools.values())

    def list_schemas(self) -> list[dict[str, Any]]:
        """Tool schemas for the brain's function-calling format."""
        return [t.to_schema() for t in self._tools.values()]

    def list_metadata(self) -> list[dict[str, Any]]:
        """Full metadata for provenance."""
        return [t.to_metadata() for t in self._tools.values()]

    def invoke(self, tool_id: str, args: dict[str, Any]) -> Result:
        """Invoke a tool. Read tools execute immediately.
        Write tools require approval (checked by caller)."""
        tool = self._tools.get(tool_id)
        if tool is None:
            return fail("not_found", warnings=[f"tool '{tool_id}' not registered"])
        if tool.handler is None:
            return fail("not_implemented", warnings=[f"tool '{tool_id}' has no handler"])
        try:
            return tool.handler(**args)
        except TypeError as e:
            return fail("invalid_args", warnings=[f"tool '{tool_id}': {e}"])
        except Exception as e:
            return fail("unavailable", warnings=[f"tool '{tool_id}' failed: {e}"])


def build_default_tools(
    world: Any,
    registry: Any,
    journal: Any,
    source_control: Any,
    vault: Any,
) -> ToolRegistry:
    """Build the default tool set from existing domain objects."""
    tools = ToolRegistry()

    # ── Read tools (execute immediately) ──

    tools.register(Tool(
        id="inspect_world_status",
        capability="world",
        operation="status",
        description="Inspect world status: capabilities, health, facts, intents, policies.",
        read_write="read",
        handler=lambda: ok("healthy", data=world.summary()),
    ))

    tools.register(Tool(
        id="inspect_capabilities",
        capability="capabilities",
        operation="status",
        description="Inspect all capabilities and their current status.",
        read_write="read",
        handler=lambda: ok("healthy", data=registry.status_map()),
    ))

    tools.register(Tool(
        id="inspect_capability",
        capability="capabilities",
        operation="inspect",
        description="Inspect a specific capability by name.",
        read_write="read",
        required_args=["capability"],
        handler=lambda capability: registry.observe(capability),
    ))

    tools.register(Tool(
        id="search_journal",
        capability="journal",
        operation="search",
        description="Search journal entries by text.",
        read_write="read",
        required_args=["query"],
        handler=lambda query: _search_journal(journal, query),
    ))

    tools.register(Tool(
        id="read_journal",
        capability="journal",
        operation="read",
        description="Read recent journal entries.",
        read_write="read",
        optional_args=["count"],
        handler=lambda count=10: _read_journal(journal, count),
    ))

    tools.register(Tool(
        id="inspect_source_control",
        capability="source_control",
        operation="status",
        description="Inspect source control repository status.",
        read_write="read",
        handler=lambda: _source_control_status(source_control),
    ))

    tools.register(Tool(
        id="inspect_source_control_history",
        capability="source_control",
        operation="history",
        description="Read recent commit history for a repository.",
        read_write="read",
        required_args=["repo"],
        optional_args=["limit"],
        handler=lambda repo, limit=10: _source_control_history(source_control, repo, limit),
    ))

    tools.register(Tool(
        id="inspect_vault_status",
        capability="vault",
        operation="status",
        description="Inspect vault lock state. Never returns secret values.",
        read_write="read",
        handler=lambda: _vault_status(vault),
    ))

    tools.register(Tool(
        id="inspect_actors",
        capability="providers",
        operation="list",
        description="List all registered providers/actors and their status.",
        read_write="read",
        handler=lambda: ok("healthy", data=[a.model_dump() for a in registry.actors()]),
    ))

    tools.register(Tool(
        id="inspect_manifest",
        capability="manifest",
        operation="read",
        description="Read the capability manifest: what exists, what's native, what's provided.",
        read_write="read",
        handler=lambda: ok("healthy", data=registry.manifest()),
    ))

    return tools


def _search_journal(journal: Any, query: str) -> Result:
    """Search journal entries."""
    try:
        entries = journal.search(query) if hasattr(journal, 'search') else []
        return ok("healthy", data={"entries": entries, "query": query})
    except Exception as e:
        return fail("unavailable", warnings=[f"journal search: {e}"])


def _read_journal(journal: Any, count: int) -> Result:
    """Read recent journal entries."""
    try:
        entries = journal.recent(count) if hasattr(journal, 'recent') else []
        return ok("healthy", data={"entries": entries, "count": len(entries)})
    except Exception as e:
        return fail("unavailable", warnings=[f"journal read: {e}"])


def _source_control_status(source_control: Any) -> Result:
    """Get source control status."""
    try:
        return source_control.status() if hasattr(source_control, 'status') else fail("not_implemented")
    except Exception as e:
        return fail("unavailable", warnings=[f"source control: {e}"])


def _source_control_history(source_control: Any, repo: str, limit: int) -> Result:
    """Get commit history."""
    try:
        return source_control.history(repo, limit) if hasattr(source_control, 'history') else fail("not_implemented")
    except Exception as e:
        return fail("unavailable", warnings=[f"source control history: {e}"])


def _vault_status(vault: Any) -> Result:
    """Get vault status (never secrets)."""
    try:
        return ok("healthy", data={
            "locked": not vault.is_unlocked if hasattr(vault, 'is_unlocked') else True,
            "encrypted": True,
        })
    except Exception as e:
        return fail("unavailable", warnings=[f"vault: {e}"])
