"""Tool registry: exposes Project Worlds capabilities to the reasoning brain.

Each tool has structured metadata and calls the same domain operation
the HTTP API uses. The brain proposes; Project Worlds authorizes and executes.

Read tools execute immediately when authorized.
Write tools go through propose → approval → execution → evidence.
"""

import json
import time
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
    data_dir: Any = None,
    world_path: Any = None,
    scheduler: Any = None,
    memory_provider: Any = None,
) -> ToolRegistry:
    """Build the default tool set from existing domain objects.

    ``world_path`` / ``scheduler`` / ``memory_provider`` wire the write
    executors and reminder reads to the SAME authoritative paths the
    API uses (single source of truth); older callers omit them and
    write tools answer honestly that persistence is not wired.
    """
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
        handler=lambda query: _search_journal(journal, query, memory_provider),
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
        handler=lambda: _reminders(scheduler),
    ))

    # ── Media ──

    tools.register(Tool(
        id="inspect_media_status",
        capability="media",
        operation="status",
        description="Inspect media providers: Plex, Sonarr, Radarr, Lidarr status.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _media_status(config_dir),
    ))

    tools.register(Tool(
        id="inspect_media_recent",
        capability="media",
        operation="recent",
        description="Recently added media: new movies, episodes, albums.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _media_recent(config_dir),
    ))

    tools.register(Tool(
        id="inspect_media_activity",
        capability="media",
        operation="activity",
        description="Media queue: downloading, queued, failed items.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _media_activity(config_dir),
    ))

    tools.register(Tool(
        id="search_media",
        capability="media",
        operation="search",
        description="Search for media by title across all providers.",
        read_write="read",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Title to search for"}
            },
            "required": ["query"],
        },
        handler=lambda query: _media_search(query, config_dir),
    ))

    # ── Write tools (proposal-based) ──

    tools.register(Tool(
        id="propose_journal_entry",
        capability="journal",
        operation="write",
        description="Propose writing a journal entry. Returns a proposal for owner approval before writing.",
        read_write="write",
        requires_approval=True,
        parameters={
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Journal entry text (1-2000 chars)"}
            },
            "required": ["text"],
        },
        handler=lambda text: _propose_journal_write(journal, text),
    ))

    tools.register(Tool(
        id="propose_world_intent",
        capability="world",
        operation="write",
        description="Propose setting a world intent. Returns a proposal for owner approval.",
        read_write="write",
        requires_approval=True,
        parameters={
            "type": "object",
            "properties": {
                "key": {"type": "string", "description": "Intent key"},
                "intent": {"type": "string", "description": "What the owner wants true"}
            },
            "required": ["key", "intent"],
        },
        handler=lambda key, intent: _propose_world_intent(journal, world, key, intent),
    ))

    tools.register(Tool(
        id="propose_world_fact",
        capability="world",
        operation="write",
        description="Propose recording a world fact. Returns a proposal for owner approval.",
        read_write="write",
        requires_approval=True,
        parameters={
            "type": "object",
            "properties": {
                "key": {"type": "string", "description": "Fact key"},
                "fact": {"type": "string", "description": "Observed reality"}
            },
            "required": ["key", "fact"],
        },
        handler=lambda key, fact: _propose_world_fact(journal, world, key, fact),
    ))

    tools.register(Tool(
        id="propose_reminder",
        capability="reminders",
        operation="write",
        description="Propose adding a reminder. Returns a proposal for owner approval.",
        read_write="write",
        requires_approval=True,
        parameters={
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Reminder text"}
            },
            "required": ["text"],
        },
        handler=lambda text: _propose_reminder(journal, text),
    ))

    tools.register(Tool(
        id="propose_reconciler_apply",
        capability="reconciler",
        operation="write",
        description="Propose applying reconciliation for a service. Returns a proposal for owner approval.",
        read_write="write",
        requires_approval=True,
        parameters={
            "type": "object",
            "properties": {
                "service": {"type": "string", "description": "Service name to reconcile"}
            },
            "required": ["service"],
        },
        handler=lambda service: _propose_reconciler_apply(journal, service),
    ))

    # ── Execute approved writes ──
    # Temporary approval rule (until durable human approval exists):
    # the MODEL may create proposals but may NOT approve its own.
    # execute_approved_write refuses to act on a proposal unless the
    # executor receives an authorization token minted OUTSIDE the
    # model loop. The chat tool loop deliberately has no such token,
    # so model-called executions fail closed and proposals stay
    # pending. A future human-controlled surface passes the token.
    tools.register(Tool(
        id="execute_approved_write",
        capability="write",
        operation="execute",
        description=(
            "Execute a write proposal. Model-provided approval is not "
            "accepted: a proposal stays pending until a human-authorized "
            "caller executes it."
        ),
        read_write="write",
        requires_step_up=True,
        parameters={
            "type": "object",
            "properties": {
                "proposal_id": {"type": "string", "description": "The proposal ID"},
                "approved": {"type": "boolean", "description": "Whether the owner approved"}
            },
            "required": ["proposal_id", "approved"],
        },
        handler=lambda proposal_id, approved: _execute_approved_write(
            journal, world, proposal_id, approved,
            world_path=world_path,
            scheduler=scheduler,
        ),
    ))

    return tools


# ── Proposal store (in-memory, per-process) ──
# Deliberately NOT durable in this pass: proposals are pending intents,
# never approval evidence. A restart loses them — that is safe (a lost
# pending proposal executes nothing) rather than dangerous.
# BATCH 2 rule: model calls may create proposals but may NOT execute
# them; only a human-authorized executor (one carrying
# HUMAN_APPROVAL_TOKEN, minted outside the model loop) may execute.
# The chat tool loop never has this token.

_proposals: dict[str, dict[str, Any]] = {}
_proposal_counter = 0

# Authorization token for human-authorized executions. Rotated per
# process; never present in any tool schema the model sees.
HUMAN_EXECUTION_AUTH: str | None = None


def human_execution_token() -> str:
    """Mint (once) the process-wide human-authorization token for
    proposal execution. Intended for the future human-controlled
    approval surface; the model loop never receives it."""
    global HUMAN_EXECUTION_AUTH
    if HUMAN_EXECUTION_AUTH is None:
        import secrets as _secrets
        HUMAN_EXECUTION_AUTH = _secrets.token_urlsafe(24)
    return HUMAN_EXECUTION_AUTH


def _next_proposal_id() -> str:
    global _proposal_counter
    _proposal_counter += 1
    return f"proposal-{_proposal_counter}"


def _propose(proposal: dict[str, Any], journal: Any, description: str) -> Result:
    """Record a pending proposal and journal its creation (audit
    minimum: created / id / type / pending — never a fake approval)."""
    global _proposal_counter
    _proposal_counter += 1
    pid = f"proposal-{_proposal_counter}"
    proposal["id"] = pid
    proposal["status"] = "pending"
    _proposals[pid] = proposal
    try:
        journal.record(
            "recommendation",
            f"brain write proposal created: {pid} ({proposal['type']}, "
            f"status: pending) — {description}",
            source="brain-proposal",
        )
    except Exception:
        pass  # proposal creation must not depend on journal health
    return ok("healthy", data={
        "proposal_id": pid,
        "type": proposal["type"],
        "status": "pending",
        "description": description,
        "requires_approval": True,
    })


def _propose_journal_write(journal: Any, text: str) -> Result:
    """Propose a journal entry. Returns proposal for approval."""
    if not text or len(text) > 2000:
        return fail("invalid_args", warnings=["text must be 1-2000 chars"])
    return _propose(
        {"type": "journal_write", "text": text},
        journal,
        f"Write journal entry: {text[:100]}...",
    )


def _propose_world_intent(journal: Any, world: Any, key: str, intent: str) -> Result:
    """Propose a world intent. Returns proposal for approval."""
    if not key:
        return fail("invalid_args", warnings=["key required"])
    return _propose(
        {"type": "world_intent", "key": key, "intent": intent},
        journal,
        f"Set intent '{key}': {intent[:100]}",
    )


def _propose_world_fact(journal: Any, world: Any, key: str, fact: str) -> Result:
    """Propose a world fact. Returns proposal for approval."""
    if not key:
        return fail("invalid_args", warnings=["key required"])
    return _propose(
        {"type": "world_fact", "key": key, "fact": fact},
        journal,
        f"Record fact '{key}': {fact[:100]}",
    )


def _propose_reminder(journal: Any, text: str) -> Result:
    """Propose a reminder. Returns proposal for approval."""
    if not text or not text.strip():
        return fail("invalid_args", warnings=["text required"])
    return _propose(
        {"type": "reminder", "text": text},
        journal,
        f"Add reminder: {text[:100]}",
    )


def _propose_reconciler_apply(journal: Any, service: str) -> Result:
    """Propose reconciliation. Returns proposal for approval."""
    try:
        from .providers.native_reconciler import NativeSettingsReconciler
        reconciler = NativeSettingsReconciler()
        if not hasattr(reconciler, "desired_state"):
            return fail("unsupported", warnings=[
                "reconciler exposes no public desired-state reader"])
        desired = reconciler.desired_state(service)
        if desired is None:
            return fail("not_found", warnings=[f"no desired state for '{service}'"])
        return _propose(
            {"type": "reconciler_apply", "service": service, "desired": desired},
            journal,
            f"Apply reconciliation for {service}",
        )
    except Exception as e:
        return fail("unavailable", warnings=[f"reconciler: {e}"])


def _execute_approved_write(
    journal: Any,
    world: Any,
    proposal_id: str,
    approved: bool,
    human_auth: str | None = None,
    world_path: Any = None,
    scheduler: Any = None,
) -> Result:
    """Execute a write proposal — human-authorized callers only.

    BATCH 2 rule: the `approved` boolean alone proves nothing (the
    model could have generated it). A call must ALSO carry
    `human_auth` equal to the process's human-authorization token,
    which is never exposed to the model. Without it the proposal
    stays pending and nothing is executed, journaled, or deleted.
    """
    proposal = _proposals.get(proposal_id)
    if not proposal:
        return fail("not_found", warnings=[f"proposal '{proposal_id}' not found"])
    if proposal["status"] != "pending":
        return fail("invalid_state", warnings=[f"proposal is {proposal['status']}, not pending"])

    if human_auth != HUMAN_EXECUTION_AUTH:
        # Model (or any caller without the human token) may not
        # approve its own proposal. The proposal REMAINS pending.
        return fail(
            "forbidden",
            warnings=[
                "execution requires human authorization; proposal "
                f"{proposal_id} remains pending",
            ],
        )

    if not approved:
        proposal["status"] = "rejected"
        try:
            journal.record(
                "recommendation",
                f"brain write proposal {proposal_id} rejected by owner "
                f"(type {proposal['type']})",
                source="brain-proposal",
            )
        except Exception:
            pass
        return ok("healthy", data={"proposal_id": proposal_id, "status": "rejected"})

    proposal["status"] = "executing"
    ptype = proposal["type"]

    try:
        if ptype == "journal_write":
            journal.record("observation", proposal["text"], source="brain-tool")
            proposal["status"] = "executed"
            return ok("healthy", data={
                "proposal_id": proposal_id, "status": "executed",
                "type": ptype, "persisted": "journal",
            })

        elif ptype == "world_intent":
            from .model import Intent, Provenance
            world.set_intent(Intent(
                key=proposal["key"], value=proposal["intent"],
                provenance=Provenance(source="brain-tool"),
            ))
            if world_path is not None:
                from .app import save_world
                save_world(world, world_path)
                persisted = "world.json"
            else:
                proposal["status"] = "failed"
                return fail(
                    "unavailable",
                    warnings=["no world_path wired; intent not persisted"],
                )
            proposal["status"] = "executed"
            return ok("healthy", data={
                "proposal_id": proposal_id, "status": "executed",
                "type": ptype, "persisted": "world.json",
            })

        elif ptype == "world_fact":
            from .model import Fact, Provenance
            world.record_fact(Fact(
                key=proposal["key"], value=proposal["fact"],
                provenance=Provenance(source="brain-tool"),
            ))
            if world_path is not None:
                from .app import save_world
                save_world(world, world_path)
            else:
                proposal["status"] = "failed"
                return fail(
                    "unavailable", warnings=["no world_path wired; fact not persisted"],
                )
            proposal["status"] = "executed"
            return ok("healthy", data={
                "proposal_id": proposal_id, "status": "executed",
                "type": ptype, "persisted": "world.json",
            })

        elif ptype == "reminder":
            if scheduler is None:
                proposal["status"] = "pending"
                return fail(
                    "unavailable",
                    warnings=["scheduler not wired; reminder proposal remains pending"],
                )
            rid = f"r-{int(time.time())}"
            from .scheduler import Reminder
            r = scheduler.add(Reminder(id=rid, text=proposal["text"]))
            if not r.ok:
                proposal["status"] = "pending"
                return fail(r.status, warnings=r.warnings or ["scheduler refused the reminder"])
            proposal["status"] = "executed"
            return ok("healthy", data={
                "proposal_id": proposal_id, "status": "executed",
                "type": ptype, "persisted": "reminders.json",
                "reminder_id": rid,
            })

        elif ptype == "reconciler_apply":
            # No reconciliation adapter exists yet. Honesty over a
            # fake success: the proposal is NOT consumed and nothing
            # is applied.
            proposal["status"] = "pending"
            return fail(
                "unsupported",
                warnings=[
                    "no reconciliation adapter exists; nothing was "
                    "applied and the proposal remains pending",
                ],
            )

        else:
            proposal["status"] = "failed"
            return fail("unsupported", warnings=[f"unknown proposal type: {ptype}"])

    except Exception as e:
        proposal["status"] = "failed"
        return fail("unavailable", warnings=[f"execute failed: {e}"])


# ── Tool implementations ──
# These call the same domain operations the HTTP API uses.

def _search_journal(journal: Any, query: str, memory_provider: Any = None) -> Result:
    """Search journal entries through the canonical memory/search
    implementation (FTS index over the journal — the same source
    /api/memory/search reads). Falls back to an honest unavailable
    result; it never pretends to have searched."""
    if memory_provider is None or not hasattr(memory_provider, "search"):
        return fail("unavailable", warnings=[
            "no memory search provider wired; journal search unavailable"])
    try:
        result = memory_provider.search(query)
        if not result.ok:
            return result
        data = result.data or {}
        results = [
            {
                "ts": r.get("timestamp"),
                "kind": r.get("kind"),
                "summary": r.get("text"),
            }
            for r in data.get("results", [])
        ]
        return ok("healthy", data={
            "entries": results, "query": query,
            "count": len(results), "source": "memory-fts",
        })
    except Exception as e:
        return fail("unavailable", warnings=[f"journal search: {e}"])


def _read_journal(journal: Any, count: int) -> Result:
    """Read recent journal entries (current view: superseded entries
    are corrections history, not current truth, so the calm
    `current_events` view the API serves is used when available)."""
    try:
        if hasattr(journal, "current_events"):
            entries = journal.current_events(count)
        else:
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
    """Get desired-vs-observed diff for a service.

    Honest partial: only desired state is inspectable today (no
    observed-state source is wired), so the result says so instead of
    claiming a real drift computation. Public reader only — no private
    attribute reach-ins."""
    try:
        from .providers.native_reconciler import NativeSettingsReconciler
        reconciler = NativeSettingsReconciler()
        if not hasattr(reconciler, "desired_state"):
            return fail("unsupported", warnings=[
                "reconciler exposes no public desired-state reader"])
        desired = reconciler.desired_state(service)
        if desired is None:
            return fail("not_found", warnings=[f"no desired state for service '{service}'"])
        return ok("healthy", data={
            "service": service,
            "desired": desired,
            "note": "Desired state only — no observed-state diff exists yet.",
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
    """Get vault status (never secrets). Reports encryption honestly:
    true only when real Fernet encryption is active; the base64
    fallback says so with the vault's own warning text."""
    try:
        warning = getattr(vault, "warning", None)
        encrypted = not (warning and "NOT encrypted" in warning)
        return ok("healthy", data={
            "locked": not vault.is_unlocked if hasattr(vault, 'is_unlocked') else True,
            "encrypted": encrypted,
            **({"warning": warning} if warning else {}),
        })
    except Exception as e:
        return fail("unavailable", warnings=[f"vault: {e}"])


def _reminders(scheduler: Any = None) -> Result:
    """List reminders through the Scheduler (the single reminder
    domain). No parallel JSON reader: when no scheduler is wired the
    honest answer is unavailable, not a raw file scrape."""
    try:
        if scheduler is None or not hasattr(scheduler, "list_reminders"):
            return fail("unavailable", warnings=[
                "scheduler not wired; reminder listing unavailable"])
        reminders = [
            r.model_dump(mode="json") if hasattr(r, "model_dump") else r
            for r in scheduler.list_reminders()
        ]
        return ok("healthy", data={"reminders": reminders, "count": len(reminders)})
    except Exception as e:
        return fail("unavailable", warnings=[f"reminders: {e}"])


# ── Media tool implementations ──

def _build_media_engine(config_dir: Any = None):
    """Build media engine via the canonical shared helper (one
    construction path for API and tools — no env re-derivation)."""
    from .providers.native_media import build_media_engine_from_config
    from pathlib import Path
    return build_media_engine_from_config(
        config_dir if config_dir is not None else Path("./config"))


def _media_status(config_dir: Any = None) -> Result:
    """Inspect media providers status."""
    try:
        engine = _build_media_engine(config_dir)
        return engine.status()
    except Exception as e:
        return fail("unavailable", warnings=[f"media: {e}"])


def _media_recent(config_dir: Any = None) -> Result:
    """Recently added media."""
    try:
        engine = _build_media_engine(config_dir)
        return engine.recent()
    except Exception as e:
        return fail("unavailable", warnings=[f"media recent: {e}"])


def _media_activity(config_dir: Any = None) -> Result:
    """Media queue activity."""
    try:
        engine = _build_media_engine(config_dir)
        return engine.activity()
    except Exception as e:
        return fail("unavailable", warnings=[f"media activity: {e}"])


def _media_search(query: str, config_dir: Any = None) -> Result:
    """Search media by title."""
    try:
        engine = _build_media_engine(config_dir)
        return engine.search(query)
    except Exception as e:
        return fail("unavailable", warnings=[f"media search: {e}"])
