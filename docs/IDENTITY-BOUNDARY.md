# Identity Boundary — per-user vs instance-global state

> **Status:** Reference · **Verified:** 2026-09-26 · **Canonical for:** the per-user vs instance-global state boundary and the `identity.principal_scoped_path` seam · **Read this if:** you are adding per-person state or working on multi-user mode.

**In short:** one Worlds instance can serve several people, and this page says exactly which state is per-person (journal, reminders, world, crew, room visits, …) and which is instance-wide (runtime config, the shared connections registry, identity records). Every per-user file resolves through one seam, so single-user installs keep working unchanged.

Product decision #13: **one instance can serve multiple people**
(OIDC/Authelia identities map onto local principal records). The
single-user default must keep working byte-identically — this boundary
is what makes both true at once.

The single seam is `identity.principal_scoped_path(data_dir, principal,
kind, mode=...)` (`src/personal_world/identity.py`). Every per-user
store resolves its file through it; no handler invents its own layout.
`api.py` wraps it as `_scoped_path(principal, kind)`.

## The boundary

| Per-user (scoped to the calling Principal) | Where it lives |
|---|---|
| World (facts, intents, policies, lore) | `world` kind → `world.json` |
| Preferences (accessibility/presentation) | inside the per-user world (`accessibility`) |
| Map/constellation structure (sections layout) | inside the per-user world (`layout`) |
| Journal (notes, corrections, audit/story) | `journal` kind → `journal.ndjson` |
| Reminders | `reminders` kind → `reminders.json` |
| Brain proposals (+ approval evidence) | `proposals` kind → `proposals.json` |
| Chat history (transcript) | `chat_history` kind → `chat-history.ndjson` |
| Interests + discovery sources | `discovery` kind → `discovery.json` |
| Crew + rooms (companions, keepers, doorways, visit/seen state) | `crew` → `crew.json`; `rooms_visits` → `rooms-visits.json` |
| Continuity (journal drafts, edit pairs, last place) | `journal_draft`, `journal_edit_pairs`, `last_place` kinds |
| Personal connections / personal provider credentials | see SECURITY.md contract (shared registry stays global) |

| Instance-global (never per-user) | Why |
|---|---|
| Application/runtime config (`config/`, `.env`, setup state) | one deployment, one runtime |
| Capability definitions / catalog / manifest | the product's capability model is not personal |
| System health, status maps, lab/media/source-control observations | observations about shared infrastructure |
| Deployment config (compose/systemd adapters) | operator concern, not person concern |
| Shared connections registry (`connections.json` + local overrides) | provider wiring is instance-level; secrets stay in the vault contract |
| Identity records (`users.json`), sessions, OIDC config | the trust root itself |
| Apps registry, theme packs, brain templates | installed content available to everyone |
| Memory FTS index (`memory.fts5.db`) | currently indexes the instance journal (per-user index is future work) |
| Vault (`vault.enc`) | currently instance-level; per-user vault isolation is an open security decision, not a default |

## Path rules (in order)

1. Unknown kind → `ValueError`. Fail closed; never a guessed path.
2. Single mode (`PW_IDENTITY_MODE=single`, the default), or no
   principal (background seams like the scheduler tick) → the **legacy
   instance path**. A single-user install reads and writes exactly the
   files it has always used; enabling multi-user later never silently
   moves or loses data.
3. Multi mode → `data/users/<id>/<file>`, where `<id>` is the person's
   id — or an **agent's owner id**: agents act on their owner's tree, so
   an agent-proposed reminder or proposal lands where the owner will
   review it.
4. An id that is not a safe path segment → `ValueError` (no traversal).

Legacy mapping (rule 2), explicitly:

| Kind | Legacy path (single-user default) |
|---|---|
| world | `<data_dir>/world.json` |
| journal | `<data_dir>/journal.ndjson` |
| reminders | `<data_dir>/reminders.json` |
| proposals | `<data_dir>/proposals.json` |
| chat_history | `<data_dir>/chat-history.ndjson` |
| discovery | `~/.config/personal-world/discovery.json` |

In multi mode the bootstrap `primary` person gets a tree like everyone
else (`data/users/primary/…`); the instance-root files remain the
single-mode home and the scheduler's legacy tick. Switching an existing
install to multi is an explicit operator opt-in; migrating the legacy
files into `users/primary/` at that moment is a deliberate, visible
step — never a silent redirect.

## Runtime behavior

- The legacy scheduler thread keeps firing `<data_dir>/reminders.json`.
  In multi mode an additional 60s tick fires each enabled person's own
  reminders file into their own journal (trees without a reminders file
  are skipped, so a person's directory is never materialized by the
  clock alone).
- Proposal stores are per-path instances (`tool_registry.ProposalStore`,
  cached via `proposal_store_for`). Approval evidence, step-up gating,
  and the "model can never self-approve" rule are identical in every
  store; stores never see each other's proposals.
- `/api/chat` observes the caller's own world/journal, proposes into the
  caller's own store, and appends to the caller's own transcript
  (`GET /api/chat/history`).

## Sync-friendliness (decision #15)

This boundary is kept clean so **future multi-device sync stays
possible** — sync is explicitly NOT built here, and nothing in this
design may assume it. The properties that keep the door open:

- One person's state is exactly one directory tree
  (`data/users/<id>/`), with stable file names per kind — a sync unit
  can be defined per person without re-partitioning anything.
- Append-only formats where truth is temporal (journal, chat history)
  merge more safely than rewrite-in-place formats.
- Per-tree proposal ids and counters: two devices (or two people) never
  collide on a shared global counter.
- Instance-global state stays out of the per-user trees, so syncing a
  person's data never drags deployment config or credentials along.

Do not add cross-user reads, shared mutable per-user files, or
global counters to per-user kinds without revisiting this document.

## Tests

`tests/test_identity_boundary.py` — seam rules, two-principal isolation
(journal, reminders, proposals, prefs, chat history, interests), and
legacy-path continuity for the single-user default. Existing coverage:
`tests/test_multiuser_phase23.py`, `tests/test_identity.py`,
`tests/test_proposal_durability.py`.
