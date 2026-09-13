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
    parameters: dict[str, Any] = field(default_factory=dict)
    requires_step_up: bool = False
    requires_approval: bool = False
    handler: Callable[..., Result] | None = None

    def to_ollama_schema(self) -> dict[str, Any]:
        """Ollama/OpenAI function-calling schema."""
        return {
            "type": "function",
            "function": {
                "name": self.id,
                "description": self.description,
                "parameters": self.parameters,
            },
        }

    def to_metadata(self) -> dict[str, Any]:
        """Full metadata for provenance/debugging."""
        return {
            "id": self.id,
            "capability": self.capability,
            "operation": self.operation,
            "description": self.description,
            "read_write": self.read_write,
            "parameters": self.parameters,
            "requires_step_up": self.requires_step_up,
            "requires_approval": self.requires_approval,
            "available": self.handler is not None,
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

    def list_ollama_schemas(self) -> list[dict[str, Any]]:
        """Tool schemas for Ollama function-calling format."""
        return [t.to_ollama_schema() for t in self._tools.values() if t.handler is not None]

    def list_metadata(self) -> list[dict[str, Any]]:
        """Full metadata for /api/tools endpoint."""
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
    config_dir: Any = None,
) -> ToolRegistry:
    """Build the default tool set from existing domain objects."""
    tools = ToolRegistry()

    # ── World ──

    tools.register(Tool(
        id="inspect_world_status",
        capability="world",
        operation="status",
        description="Inspect world status: facts, intents, policies, lore, capabilities.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: ok("healthy", data=world.summary()),
    ))

    tools.register(Tool(
        id="inspect_manifest",
        capability="manifest",
        operation="read",
        description="Read the capability manifest: what capabilities exist, which are native, which have providers.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: ok("healthy", data=registry.manifest()),
    ))

    # ── Journal ──

    tools.register(Tool(
        id="read_journal",
        capability="journal",
        operation="read",
        description="Read recent journal entries. Returns entries newest-first.",
        read_write="read",
        parameters={
            "type": "object",
            "properties": {
                "count": {"type": "integer", "description": "Number of entries to read (default 10)"}
            },
            "required": [],
        },
        handler=lambda count=10: _read_journal(journal, count),
    ))

    tools.register(Tool(
        id="search_journal",
        capability="journal",
        operation="search",
        description="Search journal entries by text query. Returns matching entries.",
        read_write="read",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Text to search for in journal entries"}
            },
            "required": ["query"],
        },
        handler=lambda query: _search_journal(journal, query),
    ))

    # ── Source Control ──

    tools.register(Tool(
        id="inspect_source_control",
        capability="source_control",
        operation="status",
        description="Inspect source control: list repositories with branch, revision, dirty state, ahead/behind.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _source_control_status(source_control, config_dir),
    ))

    tools.register(Tool(
        id="inspect_source_control_history",
        capability="source_control",
        operation="history",
        description="Read recent commit history for a repository.",
        read_write="read",
        parameters={
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Repository name or path"},
                "limit": {"type": "integer", "description": "Number of commits (default 10)"}
            },
            "required": ["repo"],
        },
        handler=lambda repo, limit=10: _source_control_history(source_control, repo, limit),
    ))

    tools.register(Tool(
        id="inspect_projects",
        capability="projects",
        operation="status",
        description="Inspect agent-sync project estate: settled, local work, unpublished, diverged.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _projects_status(),
    ))

    # ── Lab ──

    tools.register(Tool(
        id="inspect_lab_inventory",
        capability="lab",
        operation="inventory",
        description="Inspect native lab service inventory: list services with type and status.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _lab_inventory(),
    ))

    tools.register(Tool(
        id="inspect_lab_health",
        capability="lab",
        operation="health",
        description="Inspect native lab health: summary of healthy/unhealthy/unknown services.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _lab_health(),
    ))

    tools.register(Tool(
        id="inspect_lab_resources",
        capability="lab",
        operation="resources",
        description="Inspect system resources: CPU, memory, disk.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _lab_resources(),
    ))

    tools.register(Tool(
        id="inspect_lab_settings",
        capability="lab",
        operation="settings",
        description="Inspect native lab settings: services with desired state defined.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _lab_settings(),
    ))

    # ── Reconciler ──

    tools.register(Tool(
        id="inspect_reconciler_status",
        capability="reconciler",
        operation="status",
        description="Inspect settings reconciler: which services have desired state defined.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _reconciler_status(),
    ))

    tools.register(Tool(
        id="inspect_reconciler_diff",
        capability="reconciler",
        operation="diff",
        description="Inspect desired-vs-observed diff for a service. Shows what differs from what was asked for.",
        read_write="read",
        parameters={
            "type": "object",
            "properties": {
                "service": {"type": "string", "description": "Service name to inspect drift for"}
            },
            "required": ["service"],
        },
        handler=lambda service: _reconciler_diff(service),
    ))

    # ── Discovery ──

    tools.register(Tool(
        id="inspect_discovery_status",
        capability="discovery",
        operation="status",
        description="Inspect discovery engine: sources, interests, discovered items count.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _discovery_status(),
    ))

    tools.register(Tool(
        id="list_discovery_sources",
        capability="discovery",
        operation="sources",
        description="List configured discovery sources (RSS feeds, APIs).",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _discovery_sources(),
    ))

    tools.register(Tool(
        id="list_interests",
        capability="discovery",
        operation="interests",
        description="List configured interests.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _discovery_interests(),
    ))

    tools.register(Tool(
        id="run_discovery",
        capability="discovery",
        operation="discover",
        description="Run discovery: fetch new content from configured sources.",
        read_write="read",
        parameters={
            "type": "object",
            "properties": {
                "source": {"type": "string", "description": "Optional source ID to discover from (default: all)"}
            },
            "required": [],
        },
        handler=lambda source=None: _discovery_discover(source),
    ))

    # ── Vault ──

    tools.register(Tool(
        id="inspect_vault_status",
        capability="vault",
        operation="status",
        description="Inspect vault lock state. Never returns secret values.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _vault_status(vault),
    ))

    # ── Reminders ──

    tools.register(Tool(
        id="inspect_reminders",
        capability="reminders",
        operation="list",
        description="List active reminders.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _reminders(),
    ))

    return tools


# ── Tool implementations ──
# These call the same domain operations the HTTP API uses.

def _search_journal(journal: Any, query: str) -> Result:
    """Search journal entries."""
    try:
        entries = journal.search(query) if hasattr(journal, 'search') else []
        results = []
        for e in entries:
            results.append({
                "ts": e.ts.isoformat() if hasattr(e, 'ts') else str(e.ts),
                "kind": e.kind.value if hasattr(e, 'kind') else str(e.kind),
                "summary": e.summary if hasattr(e, 'summary') else str(e),
            })
        return ok("healthy", data={"entries": results, "query": query, "count": len(results)})
    except Exception as e:
        return fail("unavailable", warnings=[f"journal search: {e}"])


def _read_journal(journal: Any, count: int) -> Result:
    """Read recent journal entries."""
    try:
        entries = journal.recent(count) if hasattr(journal, 'recent') else []
        results = []
        for e in entries:
            results.append({
                "ts": e.ts.isoformat() if hasattr(e, 'ts') else str(e.ts),
                "kind": e.kind.value if hasattr(e, 'kind') else str(e.kind),
                "summary": e.summary if hasattr(e, 'summary') else str(e),
            })
        return ok("healthy", data={"entries": results, "count": len(results)})
    except Exception as e:
        return fail("unavailable", warnings=[f"journal read: {e}"])


def _source_control_status(source_control: Any, config_dir: Any = None) -> Result:
    """Get source control status."""
    try:
        from .source_control import configured_search_paths, status_all
        from pathlib import Path
        if config_dir is None:
            return fail("not_configured", warnings=["no config directory"])
        paths = configured_search_paths(Path(config_dir))
        if not paths:
            return fail("not_configured", warnings=["no source control search paths configured"])
        repos = status_all(paths)
        return ok("healthy", data={"repos": repos, "count": len(repos)})
    except Exception as e:
        return fail("unavailable", warnings=[f"source control: {e}"])


def _source_control_history(source_control: Any, repo: str, limit: int) -> Result:
    """Get commit history."""
    try:
        from .source_control import history as sc_history
        commits = sc_history(repo, limit)
        return ok("healthy", data={"repo": repo, "commits": commits, "count": len(commits)})
    except Exception as e:
        return fail("unavailable", warnings=[f"source control history: {e}"])


def _projects_status() -> Result:
    """Get agent-sync project status."""
    try:
        from .providers.agent_sync import AgentSyncProjectSensor
        result = AgentSyncProjectSensor().observe_projects()
        return result
    except Exception as e:
        return fail("unavailable", warnings=[f"projects: {e}"])


def _lab_inventory() -> Result:
    """Get native lab inventory."""
    try:
        from .providers.native_lab import NativeLabInventory
        inventory = NativeLabInventory()
        return inventory.observe()
    except Exception as e:
        return fail("unavailable", warnings=[f"lab inventory: {e}"])


def _lab_health() -> Result:
    """Get native lab health."""
    try:
        from .providers.native_lab import NativeLabInventory, NativeLabHealth
        inventory = NativeLabInventory()
        health = NativeLabHealth(inventory)
        return health.observe()
    except Exception as e:
        return fail("unavailable", warnings=[f"lab health: {e}"])


def _lab_resources() -> Result:
    """Get native lab resources."""
    try:
        from .providers.native_lab import NativeLabResources
        resources = NativeLabResources()
        return resources.observe()
    except Exception as e:
        return fail("unavailable", warnings=[f"lab resources: {e}"])


def _lab_settings() -> Result:
    """Get native lab settings."""
    try:
        from .providers.native_lab import NativeLabSettings
        settings = NativeLabSettings()
        return settings.observe()
    except Exception as e:
        return fail("unavailable", warnings=[f"lab settings: {e}"])


def _reconciler_status() -> Result:
    """Get reconciler status."""
    try:
        from .providers.native_reconciler import NativeSettingsReconciler
        reconciler = NativeSettingsReconciler()
        return reconciler.observe()
    except Exception as e:
        return fail("unavailable", warnings=[f"reconciler: {e}"])


def _reconciler_diff(service: str) -> Result:
    """Get desired-vs-observed diff for a service."""
    try:
        from .providers.native_reconciler import NativeSettingsReconciler
        reconciler = NativeSettingsReconciler()
        # For now, return the desired state for the service.
        # The actual diff requires observed state, which would come from
        # a provider. Return what we have.
        desired = reconciler._desired.get(service)
        if not desired:
            return fail("not_found", warnings=[f"no desired state for service '{service}'"])
        return ok("healthy", data={
            "service": service,
            "desired": desired.to_dict(),
            "note": "Observed state not available for diff. Desired state shown.",
        })
    except Exception as e:
        return fail("unavailable", warnings=[f"reconciler diff: {e}"])


def _discovery_status() -> Result:
    """Get discovery status."""
    try:
        from .providers.native_discovery import NativeDiscovery
        discovery = NativeDiscovery()
        return discovery.observe()
    except Exception as e:
        return fail("unavailable", warnings=[f"discovery: {e}"])


def _discovery_sources() -> Result:
    """List discovery sources."""
    try:
        from .providers.native_discovery import NativeDiscovery
        discovery = NativeDiscovery()
        r = discovery.observe()
        if r.ok:
            return ok("healthy", data={"sources": r.data.get("sources", [])})
        return r
    except Exception as e:
        return fail("unavailable", warnings=[f"discovery sources: {e}"])


def _discovery_interests() -> Result:
    """List interests."""
    try:
        from .providers.native_discovery import NativeDiscovery
        discovery = NativeDiscovery()
        r = discovery.observe()
        if r.ok:
            return ok("healthy", data={"interests": r.data.get("interests", [])})
        return r
    except Exception as e:
        return fail("unavailable", warnings=[f"discovery interests: {e}"])


def _discovery_discover(source: str | None = None) -> Result:
    """Run discovery."""
    try:
        from .providers.native_discovery import NativeDiscovery
        discovery = NativeDiscovery()
        return discovery.discover(source)
    except Exception as e:
        return fail("unavailable", warnings=[f"discovery: {e}"])


def _vault_status(vault: Any) -> Result:
    """Get vault status (never secrets)."""
    try:
        return ok("healthy", data={
            "locked": not vault.is_unlocked if hasattr(vault, 'is_unlocked') else True,
            "encrypted": True,
        })
    except Exception as e:
        return fail("unavailable", warnings=[f"vault: {e}"])


def _reminders() -> Result:
    """List reminders."""
    try:
        import json as _json
        from pathlib import Path
        import os
        data_dir = Path(os.environ.get("PW_DATA_DIR", "./data"))
        reminders_path = data_dir / "reminders.json"
        if reminders_path.exists():
            reminders = _json.loads(reminders_path.read_text())
            return ok("healthy", data={"reminders": reminders, "count": len(reminders)})
        return ok("healthy", data={"reminders": [], "count": 0})
    except Exception as e:
        return fail("unavailable", warnings=[f"reminders: {e}"])
