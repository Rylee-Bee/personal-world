"""Tool registry: exposes Project Worlds capabilities to the reasoning brain.

Each tool has structured metadata and calls the same domain operation
the HTTP API uses. The brain proposes; Project Worlds authorizes and executes.

Read tools execute immediately when authorized.
Write tools go through propose → approval → execution → evidence.
"""

import json
import os
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
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
        """Tool schemas for Ollama function-calling format.

        Read tools and proposal tools are exposed to the model.
        Proposal tools (requires_approval=True) create pending
        proposals without mutating the target domain. Execution tools
        are never exposed — the owner drives execution through the
        trusted API path.
        """
        return [
            t.to_ollama_schema()
            for t in self._tools.values()
            if t.handler is not None and (
                t.read_write == "read" or t.requires_approval
            )
        ]

    def list_metadata(self) -> list[dict[str, Any]]:
        """Full metadata for /api/tools endpoint."""
        return [t.to_metadata() for t in self._tools.values()]

    def invoke(self, tool_id: str, args: dict[str, Any]) -> Result:
        """Invoke a tool.

        Read tools execute immediately. Proposal tools
        (requires_approval=True) create pending proposals — they are
        callable by the brain but MUST NOT mutate the target domain
        or establish approval. Execution tools are structurally
        blocked — the owner drives execution through the trusted API.
        """
        tool = self._tools.get(tool_id)
        if tool is None:
            return fail("not_found", warnings=[f"tool '{tool_id}' not registered"])
        if tool.handler is None:
            return fail("not_implemented", warnings=[f"tool '{tool_id}' has no handler"])
        # Proposal tools (requires_approval=True) are safe for the
        # brain to call — they create pending state, nothing more.
        # Execution write tools (requires_approval=False) are blocked.
        if tool.read_write == "write" and not tool.requires_approval:
            return fail(
                "forbidden",
                warnings=[
                    f"tool '{tool_id}' is an execution tool and cannot be "
                    "invoked directly by the model. The owner must approve "
                    "through the trusted UI/API path first."
                ],
            )
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
    connection_manager: Any = None,
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
    ``connection_manager`` (origin/main) routes media engine
    construction through merged config.
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
        handler=lambda: _media_status(connection_manager),
    ))

    tools.register(Tool(
        id="inspect_media_recent",
        capability="media",
        operation="recent",
        description="Recently added media: new movies, episodes, albums.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _media_recent(connection_manager),
    ))

    tools.register(Tool(
        id="inspect_media_activity",
        capability="media",
        operation="activity",
        description="Media queue: downloading, queued, failed items.",
        read_write="read",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=lambda: _media_activity(connection_manager),
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
        handler=lambda query: _media_search(query, connection_manager),
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

    tools.register(Tool(
        id="execute_approved_write",
        capability="write",
        operation="execute",
        description="Execute an approved write proposal. Only call after owner approval.",
        read_write="write",
        requires_step_up=True,
        parameters={
            "type": "object",
            "properties": {
                "proposal_id": {"type": "string", "description": "The approved proposal ID"},
            },
            "required": ["proposal_id"],
        },
        handler=lambda proposal_id: _execute_approved_write(
            journal, world, proposal_id,
            world_path=world_path, scheduler=scheduler,
        ),
    ))

    return tools


# ── Proposal store (server-held, durable) ──
#
# Proposals are server-held state. The model may create proposals
# through propose_* tools. Only the owner can approve them through
# a trusted API path (step-up gated). Execution checks that the
# proposal was actually approved with actor/time/evidence.
#
# Durability: when a data dir is configured (create_app does this), the
# store is written atomically to <data_dir>/proposals.json after every
# state change, so an owner approval survives a restart and is never
# re-derived from a model-supplied argument. The in-memory dict object
# is never rebound, so helpers holding a reference to ``_proposals``
# always observe live state.

_proposals: dict[str, dict[str, Any]] = {}
_proposal_counter = 0
_proposal_path: Path | None = None
_proposal_journal: Any = None
_proposal_lock = threading.RLock()


def configure_proposal_store(data_dir: Any, journal: Any = None) -> None:
    """Point the proposal store at a data dir and load prior state.

    Called once per app instance at create_app time. Existing proposals
    (and their approval evidence) are restored and the id counter
    resumes above the highest persisted id. Mutates ``_proposals`` in
    place so existing references stay valid.
    """
    global _proposal_path, _proposal_counter, _proposal_journal
    with _proposal_lock:
        _proposal_path = Path(data_dir) / "proposals.json"
        _proposal_journal = journal
        _proposals.clear()
        if _proposal_path.is_file():
            try:
                data = json.loads(_proposal_path.read_text(encoding="utf-8"))
            except Exception:
                data = {}
            if isinstance(data, dict):
                _proposals.update(data)
        highest = 0
        for pid in _proposals:
            try:
                highest = max(highest, int(str(pid).rsplit("-", 1)[-1]))
            except (ValueError, IndexError):
                continue
        _proposal_counter = highest


def _persist_proposals_locked() -> None:
    """Atomic write of the proposal store (caller holds the lock)."""
    if _proposal_path is None:
        return
    try:
        _proposal_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = _proposal_path.with_suffix(_proposal_path.suffix + ".tmp")
        tmp.write_text(json.dumps(_proposals, indent=2), encoding="utf-8")
        os.replace(tmp, _proposal_path)
    except OSError:
        # Persistence failure must never fake a successful approval: the
        # in-memory state stands and the next write retries.
        pass


def _journal_proposal_event(journal: Any, kind: str, summary: str) -> None:
    target = journal if journal is not None else _proposal_journal
    if target is None:
        return
    try:
        target.record(kind, summary, source="brain-proposal")
    except Exception:
        pass


def _next_proposal_id() -> str:
    global _proposal_counter
    _proposal_counter += 1
    return f"proposal-{_proposal_counter}"


def _propose(proposal: dict[str, Any], journal: Any, description: str) -> Result:
    """Record a pending proposal. Server-held state only: creation
    journals NOTHING (the proposal store itself is the audit of
    preparation — `list_proposals()`/`get_proposal()` expose id, type,
    and status; approval/rejection evidence is recorded at the trust
    boundary, never by the model loop)."""
    global _proposal_counter
    with _proposal_lock:
        _proposal_counter += 1
        pid = f"proposal-{_proposal_counter}"
        proposal["id"] = pid
        proposal["status"] = "pending"
        proposal["created_at"] = time.time()
        _proposals[pid] = proposal
        _persist_proposals_locked()
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
    scheduler: Any = None,
    world_path: Any = None,
) -> Result:
    """Execute an approved write proposal.

    Called by the server after the owner approved the proposal
    through the trusted path (server-held approval evidence:
    approved_by/approved_at). Persistence is part of the act: world
    writes save through the authoritative path and report what they
    changed; a scheduler-less environment leaves a reminder pending
    rather than reporting success.
    """
    proposal = _proposals.get(proposal_id)
    if not proposal:
        return fail("not_found", warnings=[f"proposal '{proposal_id}' not found"])
    if proposal["status"] != "approved":
        return fail(
            "invalid_state",
            warnings=[
                f"proposal is {proposal['status']}, not approved. "
                "Only proposals approved through the trusted owner "
                "path can be executed."
            ],
        )

    proposal["status"] = "executing"
    ptype = proposal["type"]

    try:
        if ptype == "journal_write":
            journal.record("observation", proposal["text"], source="brain-tool")
            proposal["status"] = "executed"
            return ok("healthy", data={"proposal_id": proposal_id, "status": "executed", "type": ptype})

        elif ptype == "world_intent":
            from .model import Intent, Provenance
            world.set_intent(Intent(
                key=proposal["key"], value=proposal["intent"],
                provenance=Provenance(source="brain-tool"),
            ))
            if world_path is not None:
                from .app import save_world
                save_world(world, world_path)
                proposal["status"] = "executed"
                return ok("healthy", data={
                    "proposal_id": proposal_id, "status": "executed",
                    "type": ptype, "persisted": "world.json",
                })
            proposal["status"] = "failed"
            return fail(
                "unavailable",
                warnings=["no world_path wired; intent not persisted"],
            )

        elif ptype == "world_fact":
            from .model import Fact, Provenance
            world.record_fact(Fact(
                key=proposal["key"], value=proposal["fact"],
                provenance=Provenance(source="brain-tool"),
            ))
            if world_path is not None:
                from .app import save_world
                save_world(world, world_path)
                proposal["status"] = "executed"
                return ok("healthy", data={
                    "proposal_id": proposal_id, "status": "executed",
                    "type": ptype, "persisted": "world.json",
                })
            proposal["status"] = "failed"
            return fail(
                "unavailable", warnings=["no world_path wired; fact not persisted"],
            )

        elif ptype == "reminder":
            if scheduler is None or not hasattr(scheduler, "add"):
                proposal["status"] = "failed"
                return fail(
                    "unavailable",
                    warnings=["scheduler not available for reminder execution"],
                )
            from .scheduler import Reminder
            rid = f"proposal-{proposal_id}"
            r = scheduler.add(Reminder(id=rid, text=proposal.get("text", "")))
            if not r.ok:
                proposal["status"] = "failed"
                return fail("unavailable", warnings=r.warnings)
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
    finally:
        # Persist the terminal status (executed/failed/left-pending) so
        # a restart sees an honest, non-replayable proposal state.
        with _proposal_lock:
            _persist_proposals_locked()


def approve_proposal(proposal_id: str, actor: str,
                     journal: Any = None) -> Result:
    """Approve a pending proposal. Called through the trusted owner path.

    Records actor, time, and server-held approval evidence, then
    persists them. This is the ONLY way a proposal becomes approved —
    the model cannot do this, and no model-supplied boolean can forge
    the evidence. The trusted approval is journalled when a journal is
    available.
    """
    with _proposal_lock:
        proposal = _proposals.get(proposal_id)
        if not proposal:
            return fail("not_found",
                        warnings=[f"proposal '{proposal_id}' not found"])
        if proposal["status"] != "pending":
            return fail(
                "invalid_state",
                warnings=[f"proposal is {proposal['status']}, not pending"],
            )
        approved_at = time.time()
        proposal["status"] = "approved"
        proposal["approved_by"] = actor
        proposal["approved_at"] = approved_at
        proposal["approval_evidence"] = {
            "method": "trusted-api-approval",
            "approved_by": actor,
            "approved_at": approved_at,
        }
        _persist_proposals_locked()
    _journal_proposal_event(
        journal, "approval",
        f"brain write proposal {proposal_id} approved by owner "
        f"(type {proposal['type']}) by {actor}",
    )
    return ok("healthy", data={
        "proposal_id": proposal_id,
        "status": "approved",
        "approved_by": actor,
    })


def reject_proposal(proposal_id: str, actor: str,
                    journal: Any = None) -> Result:
    """Reject a pending proposal and persist the decision."""
    with _proposal_lock:
        proposal = _proposals.get(proposal_id)
        if not proposal:
            return fail("not_found",
                        warnings=[f"proposal '{proposal_id}' not found"])
        if proposal["status"] != "pending":
            return fail(
                "invalid_state",
                warnings=[f"proposal is {proposal['status']}, not pending"],
            )
        proposal["status"] = "rejected"
        proposal["rejected_by"] = actor
        proposal["rejected_at"] = time.time()
        _persist_proposals_locked()
    _journal_proposal_event(
        journal, "recommendation",
        f"brain write proposal {proposal_id} rejected by owner "
        f"(type {proposal['type']}) by {actor}",
    )
    return ok("healthy", data={"proposal_id": proposal_id, "status": "rejected"})


def list_proposals(status: str | None = None) -> list[dict[str, Any]]:
    """List proposals, optionally filtered by status."""
    with _proposal_lock:
        results = []
        for pid, p in _proposals.items():
            if status is None or p.get("status") == status:
                results.append({"proposal_id": pid, **p})
        return results


def get_proposal(proposal_id: str) -> dict[str, Any] | None:
    """Get a single proposal by ID."""
    with _proposal_lock:
        p = _proposals.get(proposal_id)
        if p is None:
            return None
        return {"proposal_id": proposal_id, **p}


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
    """Get desired-vs-observed diff for a service."""
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

def _build_media_engine(connection_manager: Any = None, config_dir: Any = None):
    """Build media engine from MERGED connection config.

    Resolves both:
    - connections[] entries (tracked config, provider shape)
    - flat UI config (connections.local.json, schema-driven shape)
    """
    from .providers.native_media import NativeMediaEngine, build_adapter
    from .connection_manager import resolve_media_connections

    if connection_manager is not None:
        config = connection_manager.get_all_config()
    else:
        import json as _json
        from pathlib import Path
        import os
        cfg_dir = Path(config_dir or os.environ.get("PW_CONFIG_DIR", "./config"))
        connections_path = cfg_dir / "connections.json"
        if not connections_path.exists():
            return NativeMediaEngine([])
        config = _json.loads(connections_path.read_text())

    adapters = []

    # 1. connections[] entries (provider shape — has "type" key)
    for conn in config.get("connections", []):
        if conn.get("type") in ("plex", "sonarr", "radarr", "lidarr"):
            adapter = build_adapter(conn)
            if adapter:
                adapters.append(adapter)

    # 2. Flat UI config saved under "media" key
    media_raw = config.get("media", {})
    if media_raw and media_raw.get("_adapter"):
        for conn in resolve_media_connections(media_raw):
            if conn.get("type") in ("plex", "sonarr", "radarr", "lidarr"):
                adapter = build_adapter(conn)
                if adapter:
                    adapters.append(adapter)

    return NativeMediaEngine(adapters)


def _media_status(connection_manager: Any = None) -> Result:
    """Inspect media providers status."""
    try:
        engine = _build_media_engine(connection_manager)
        return engine.status()
    except Exception as e:
        return fail("unavailable", warnings=[f"media: {e}"])


def _media_recent(connection_manager: Any = None) -> Result:
    """Recently added media."""
    try:
        engine = _build_media_engine(connection_manager)
        return engine.recent()
    except Exception as e:
        return fail("unavailable", warnings=[f"media recent: {e}"])


def _media_activity(connection_manager: Any = None) -> Result:
    """Media queue activity."""
    try:
        engine = _build_media_engine(connection_manager)
        return engine.activity()
    except Exception as e:
        return fail("unavailable", warnings=[f"media activity: {e}"])


def _media_search(query: str, connection_manager: Any = None) -> Result:
    """Search media by title."""
    try:
        engine = _build_media_engine(connection_manager)
        return engine.search(query)
    except Exception as e:
        return fail("unavailable", warnings=[f"media search: {e}"])
