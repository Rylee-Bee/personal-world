# Proposal — Worlds as the universal front door (2026-10-01)

> **Status:** PROPOSED (not approved). Owner: Rylee. Drafted by Claude from a
> full backend + UI + provider-machinery inventory and an open-source survey;
> refined 2026-10-01 from the owner's review (revision 2). Nothing here is
> implemented. If approved, it supersedes `.project/PLAN.md` Step 1c onward and
> the conflicting decisions listed in **Superseded decisions** below, and gets
> ADR-0008 plus a `DECISIONS.md` entry.

## The goal and the principle

> **A small personal front door that gathers a large world without having to
> contain the whole world.**
>
> **Worlds owns meaning. Providers own mechanics.**

Worlds becomes a small, fast, accessible front door that speaks APIs natively.
You register a **provider** (any HTTP API, a Play-Nice room, later MCP); then
you **list** what it offers, **query** it, **test** it and **save** the
request. A **mapping** gives the result a human meaning, a **card** presents
it, and **boards** of cards are home. Your projects, interests and homelab
arrive as providers, never as code Worlds must ship to boot. **Memory stays a
core Worlds concept** with a deterministic local baseline; providers only
enrich it.

## Why now: what the inventory found

| Fact | Evidence |
|---|---|
| The backend is 41.8k LOC and 228 routes; `api.py` alone is 6.1k LOC and 192 routes | wc + route grep |
| Only about 1.4k LOC of route body serves the front-door core (connections, rooms, vault, sections, manifest, status, setup, apps) | backend inventory |
| About 2.5k LOC of `discovery/` is **dead**: the old candy-dispenser engine, imported by nothing | import graph |
| The auth stack is about 5.3k LOC. About 1.1k is needed for one owner, about 2.4k serves multi-user and about 1.6k is OIDC | backend inventory |
| There are 17 UI screens; 10 are persona or feature screens (Crew, Stickers, Lore, RoughNight, Library…) | UI inventory |
| Connection test, save and schema hooks **exist but no screen uses them** | `ui/src/data/hooks.ts` |
| There are about 7 partial "generic HTTP" primitives, 2 provider registries that disagree, 3 approval models and 3 capability lists | provider inventory |
| There is no request runner, no saved requests, no OpenAPI import and no MCP client | grep |
| `rooms.py` is the one solid generic layer: registry, token-by-env-name, caching, `unreachable`/`incompatible`, receipts, idempotency | provider inventory |

**Conclusion:** the bones are good. The bloat is integrations and persona
features baked into core. The fix is **one generic substrate that replaces many
domain-specific integrations**, not a rewrite.

## The core model

```
Provider → Request → Mapping → Card → Board
                │
                └→ Governed Action → assistant / automation
```

| Layer | Owns | Shape (sketch) | Stored as |
|---|---|---|---|
| **Provider** | connectivity | `id, name, kind (http · openapi · room · mcp-later · reference), base_url, auth {type, secret_ref}, path_prefix, tls, timeout` | `providers/<id>.yaml` |
| **Request** | transport mechanics | `provider, method, path, params, headers, body, assertions[], ttl` (Bruno-style) | `requests/<provider>/<id>.yaml` |
| **Mapping** | interpretation and human meaning | `request(s), fields[] {path (JSONPath), label, format, unit, remap}, status rule, meaning {concept}` | inside the card file, or `mappings/<id>.yaml` when shared |
| **Card** | presentation | `mapping, title, view (stat · list · table · status · link · markdown)` | `cards/<id>.yaml` |
| **Board** | composition | ordered cards and sections; "Home" is a board | `boards/<id>.yaml` |
| **Governed Action** | executable authority | `request, exposed, name, access (read · write), approval (never · always), idempotency` | `actions/<id>.yaml` |

The verbs everywhere are **list · query · test · save**, plus **pin**.

### Worlds owns meaning: the semantic layer

A saved HTTP request is never itself a product concept. Meaning lives in the
**Mapping**:

```yaml
request: sonarr.queue
card:
  title: Downloads
  view: list
meaning:
  concept: media.downloads
```

- `concept` is **descriptive metadata**: a namespaced, free-form label that Worlds
  uses for grouping, summaries, Memory links and, later, assistant discovery. It is
  **not** a globally enumerated capability, and adding a new one needs no core code
  change.
- This keeps ADR-0001's principle (Worlds owns the concept; the vendor's shape never
  becomes product truth). It drops the oversized machinery: the hard-coded capability
  registry, the three capability lists and the `status_map` equality invariant.
- Swapping Sonarr for another downloader means changing the request and mapping.
  The card, the board and the `media.downloads` meaning stay.

### Mapping details

- **Tier 1 (no code), the rendering system:** Homepage-style fields
  `{path, label, format, unit, remap}` feed a fixed set of accessible views
  (stat · list · table · status · link · markdown). Worlds owns these views, so
  44px targets, contrast, luminance-only rank and reduced motion hold everywhere.
- **Tier 2 (later):** a sandboxed template, as the escape hatch.
- **Status rule as data:** `{path, ok:[...], warn:[...]}`. A transport failure becomes
  `unavailable`, or `stale` with the last-good time. **One provider failing never
  blanks a board.**

### Providers, rooms and recipes

- **room/0 is a provider kind.** Its cards and needs-you arrive pre-mapped, and
  existing rooms keep working unchanged.
- **Rooms remain** for integrations that genuinely need logic.
- **Recipes are data:** a provider template plus suggested requests, mappings and
  cards (for example `recipes/sonarr.yaml`). Recipes replace Python adapters for
  services that are only an API.
- **The reference provider** (`kind: reference`) is built in and synthetic. It is
  for development, CI, examples and open-source verification only (see Phase 1).

### Governed actions: saved request ≠ tool

A saved request is **not** automatically something an assistant or automation
can call. It becomes callable only through an explicit **action binding** that
states its authority:

```yaml
# read, no approval
tool:
  exposed: true
  name: media.downloads
  access: read
  approval: never
```

```yaml
# write, always approved, single dispatch
tool:
  exposed: true
  name: service.restart
  access: write
  approval: always
  idempotency: required
```

`GET /queue`, `GET /medical-records`, `POST /restart-server` and
`DELETE /episode/1234` are all "saved requests", but they are not equivalent.
**Assistants and automation discover governed action bindings, never raw
request definitions.**

- **Defaults fail closed.** A request has no binding until you create one. Any method
  other than GET/HEAD is `access: write`. A binding with no `approval` field is
  treated as `always`.
- **One authority path.** The UI, the CLI, the assistant and automation all run writes
  through the same governed path: confirm, then idempotency key, receipt and journal
  entry. This replaces today's three approval models (rooms, `ProposalStore`,
  deployment).

### Single-dispatch approval invariant

Borrowed from Open Dots (an external project; it is not in this repo):

```
approve → consume authorization → dispatch exactly once
```

- An approval is consumed at dispatch and **cannot be replayed**, even if the client
  never receives the result.
- If the request is cancelled, times out or loses its connection **after** dispatch,
  the outcome is recorded as **`UNKNOWN`**, with no silent success or failure.
- A potentially side-effecting request is **never retried automatically**. Retrying
  is a new, separately approved action.
- This extends the room/0 idempotency rule to every write and keeps `UNKNOWN`
  first-class.

## Memory: a core concept, not a provider

> **Memory is continuity:** things I intentionally kept, things I need to return
> to, durable things about me, and enough history to re-orient myself.

Product Language already defines Memory as a deterministic place: model-independent,
opens instantly, browseable, searchable by ordinary means, with Records inside it and
pinned or important things there. AI is optional enrichment, never the only way in.
The existing promise stands: *remember, recall, Later: one place, nothing to chase.*

```
Memory
├── Kept      deliberate notes / remembered things
├── Later     things to return to
├── Records   durable structured personal information (sensitive ones need step-up)
├── History   journal / what happened
└── Find      deterministic local search
```

**Core baseline (stays in Worlds):** Remember/Kept, Later, Records, ordinary local
text search, and the journal and history infrastructure that supports them.

**Acceptance:** unplug every model and every memory provider (semantic retrieval,
Pollen, `rylee_lore`, Project Home context). Memory still opens, saved things can
be browsed, Later works, Records work, and local deterministic search works.

**Provider enrichment (optional, replaceable):** semantic recall, Pollen,
`rylee_lore`, Project Home context, and future association or retrieval systems.
They enrich Memory; they are never prerequisites for it to exist.

**The journal-gate policy survives.** The `journal_gate` implementation may be
replaced or removed, but its rule moves into the governed-action model: *agents get
deliberately narrow, governed answers about private memory, never arbitrary
retrieval access.* Concretely, Memory exposes a small set of read bindings with
fixed questions and bounded answers. No raw "search everything" tool is exposed to
an agent.

## Editing: UI first, files underneath

```
normal day:       Connect → edit/build → Save
power-user day:   YAML / git / bulk edit
```

Both paths produce the same portable files. The UI owns **no hidden
configuration state**.

**Invariant:** every configuration created through the UI round-trips through the
documented file format without loss.

The YAML stays portable, bulk-editable, diffable, versionable, recoverable, and
editable without the Worlds UI. On a low-energy day you never need to touch a file.
Real user configuration lives in the data/config volume, outside the public repo;
the repo carries only the reference provider and example recipes.

## Security boundary (non-negotiable, unchanged)

- Requests go **only** to the provider's registered `base_url` + `path_prefix`.
- No redirects are followed. Responses have size and time caps.
- SSRF protection blocks link-local and cloud-metadata addresses, unless a provider is
  explicitly marked LAN.
- Credentials are stored only as **references** (`env:NAME`, `vault:name`, later
  OpenBao per ADR-0007). The server injects them, and responses and logs redact them.
  **The browser never receives a secret value.**
- Adding or editing providers or secrets needs **step-up**. Owner-only by default,
  with scoped agent tokens.
- Governed actions are redacted, carry receipts, and follow the single-dispatch
  invariant.
- A provider failure degrades visibly and never blanks a board.
- `tests/test_public_safety.py` still gates every change.

## Navigation and product language

`Home · Connect · Memory · Settings`

- **Home** shows only human-shaped results: boards of cards. It is the calm daily
  landmark.
- **Connect** is the workshop, where raw API work happens. Technical depth is there
  when you want it, and the everyday experience is never an API console. This keeps
  AGENT_POLICY's "personal appliance, not an administration console" rule true.
- **Memory** is core (above).
- **Settings** covers preferences, themes, accessibility and packs.

## Superseded decisions (so no future agent "corrects" Worlds back)

If this proposal is approved, Phase 0 edits these documents in place with a dated
"superseded by ADR-0008" note:

| Document / decision | Old wording | New direction |
|---|---|---|
| `docs/PRODUCT-LANGUAGE.md` § Stable skeleton (also `AGENTS.md`, `docs/TRUE-NORTH.md` scope) | `Bridge · Memory · Chat · Settings` | `Home · Connect · Memory · Settings`. **Home supersedes Bridge/Overview** as the primary daily landmark. **Connect** becomes a stable first-class landmark. **Chat is no longer required core navigation**: it becomes an optional client of governed actions, later |
| `docs/PRODUCT-LANGUAGE.md` § Overview | Overview/Bridge aggregates each section's headline | The Home board does this through cards and mappings; there is no separate aggregator |
| `docs/PRODUCT-LANGUAGE.md` § theme principles | "Character art, a light sci-fi feel, and visible companions stay part of Worlds" | Crew, Keeper, stickers, Sol, star map, lore and related character behaviour **move out of core code into an optional theme/experience pack**. Art and character canon stay preserved in the repo. **Kept from the old rule:** plain still never means sterile or grey enterprise. Core keeps a warm, recognisable identity through typography, softness, interaction quality and complete themes |
| `.project/PLAN.md` Step 1b | "**Personality ships here, not later**" | Superseded: personality ships as the optional pack, after the front door works |
| `.project/PLAN.md` Steps 1c–3 | media, calendars, inboxes as built-in sources | They arrive as providers, recipes or rooms on the front-door model |
| ADR-0001 | core-owned enumerated capabilities, enforced by `framework validate` | ADR-0008 keeps the principle (*Worlds owns meaning*), moves meaning into Mapping `concept` metadata, and retires the enumerated registry and the `status_map` equality invariant for front-door providers. A small built-in set (Memory, vault, journal) keeps its contracts |
| `ARCHITECTURE.md` API-only routes (`/api/lab/*`, `/api/exports/story`, `/api/reconciler/status`) | declared product contract | They are removed in Phase 4 only once a recipe or room replaces each one, as a recorded owner decision |

## What stays, shrinks, moves, goes

| Keep (core) | Shrink | Move out (provider · recipe · room · pack) | Remove |
|---|---|---|---|
| The rooms reader, connections, secret_resolver, vault, envelope, status, sections → boards, setup, healthz, manifest + `api` CLI, the journal, the **Memory baseline (Kept, Later, Records, Find)**, themes/tokens/kit, a11y prefs, OIDC login | Auth (owner + agent tokens + OIDC), identity (single mode only), prefs, briefing (→ a summary card), backup, push | **Provider/recipe/room:** media, lab_*, reconciler, calendar, updates, deployment, source_control, github, agent_sync, project_home, traefik, discovery (live part), reminders, learning, semantic memory (`native_memory`), chat + tool_registry. **Pack:** crew, voice, briefing-voice, stickers, lore, theme_pack, Sol/Keeper/star-map UI | The dead discovery engine, content_db (personal paths), people/invites/helpers/roles/user, the `journal_gate` *implementation* (its policy moves to governed actions), legacy `/station` redirects |

**Rough target, an estimate:** backend about 12–15k LOC and about 40 routes; UI with
4 landmarks plus Connect's builder.

## Phases

Each phase is a vertical slice that ends with phone and desktop screenshots.
**Replace before remove:** Phase 4 removes only what Phases 1–3 have already
replaced.

| # | Slice | Includes | Done when |
|---|---|---|---|
| 0 | **Decide and record** | ADR-0008 (meaning/mechanics, mapping concepts, governed actions, single dispatch); the superseded-decision edits above; DECISIONS entry; tag `archive/pre-front-door`; delete the dead discovery engine (no behaviour change) | ADR merged, conflicting docs updated, pytest green |
| 1 | **Provider + Request + Mapping foundations** | SSRF guard, secret refs, request runner, assertions/test, YAML store with round-trip, Connect UI (add provider → Test → build request → Run → JSON viewer → map a field → Save → list), **the reference provider**, a deterministic test suite | The full Provider → Request → Mapping flow passes in CI against the reference provider, and you save a working request from your phone |
| 2 | **Cards + Boards** | Cards, mapping editor (click a JSON field to map it), status rules, TTL cache with stale/last-good, room/0 provider kind, Home board; writes run through the governed path with the single-dispatch invariant | Home shows your real rooms plus pinned cards, and one broken provider doesn't blank it |
| 3 | **Recipes, then import** | Recipes, in order: **1. Project Home**, **2. Sonarr**, **3. Homelab Health**. GitHub comes fourth, later. OpenAPI import only **after** the recipe model is proven by hand | Each of the three runs from a recipe with no Python adapter |
| 4 | **The cut** | One PR per removal family (persona → pack, multi-user, then each ported provider once its recipe or room works); tests leave with their code | Backend and UI at target size; all gates green; nothing removed without a working replacement |
| 5 | **Memory enrichment + assistant** | Memory already has its core baseline before this phase. Phase 5 adds external/semantic memory providers, governed action bindings for the assistant, the optional chat client, and the replacement of the handwritten tool registry | See acceptance below |
| Later | — | MCP provider kind; tier-2 templates; sharing recipes | — |

**Phase 5 acceptance:**

- Memory works with all models off.
- Chat off does not break Worlds.
- The assistant cannot call raw saved requests directly.
- Every write follows the same governed authority path as the UI.

### Assistant sequencing

The Chat UI is parked until Phase 5, but the request and action contracts from
Phases 1–3 are designed to be safe for assistant use from day one:

```
assistant → discovers governed action bindings → same authority/approval path as the UI → saved requests
```

Chat becomes another client of Worlds, not a subsystem the rest of Worlds bends
around. The handwritten tool registry can then disappear without being replaced by
implicit authority.

## The reference provider (Phase 1)

A built-in synthetic provider for development, tests, examples and open-source
verification. It is never used for real data. It has deterministic endpoints for
each of these cases:

| Case | Proves |
|---|---|
| GET list / GET object | list and stat mappings |
| POST idempotent action | governed action, receipt, single dispatch |
| slow response | timeout → `UNKNOWN` / `unavailable` |
| 500 response | degraded card, the board survives |
| malformed payload | an honest error, no fake data |
| secret-required endpoint | secret ref injection and redaction |
| stale data | stale + last-good display |
| redirect attempt | the redirect is refused |
| oversized response | the size cap holds |

**Architectural acceptance:** the front-door model works even when Rylee's personal
infrastructure does not exist. The whole Provider → Request → Mapping → Card → Board
flow runs with no Sonarr, no Project Home, no LAN, no personal tokens and none of
the estate.

## Invariants this changes (needs ADR-0008)

- `framework validate` fixes the capability set and requires each connection's
  capability to be declared. Front-door providers carry `meaning.concept` metadata
  instead. ADR-0008 amends ADR-0001 so validation checks schema, secret-refs and
  confinement, not membership in a capability enum.
- The secret-rule key naming stays and extends to the new YAML (`secret_ref` only).
- Zero-provider boot stays: Worlds starts, and Memory works, with no providers at all.
- room/0 is pinned upstream in Play-Nice; this plan does not change it.

## Strengths kept from revision 1

- Worlds remains small and fast. No rewrite.
- Replace before remove.
- One generic substrate replaces many domain-specific integrations.
- Raw API work lives in Connect, never on Home; Home shows only human-shaped results.
- Rooms remain for integrations that need logic. Recipes remain data.
- OpenAPI import comes after the request model is proven. MCP comes later.
- Theme and personality code leave core; canon and art are preserved.
- One owner plus scoped agent tokens. OIDC remains.
- Real user config lives outside the public repo. Secrets remain references.
- Provider failure degrades visibly, never silently.
- Accessible fixed views remain the Tier-1 card rendering.
- No AI is required for ordinary configuration or for Memory.
- `UNKNOWN` remains a valid outcome.

## Design reference: the owner's Figma Make prototype (2026-10-01)

Rylee built an example in Figma Make (file key `eS6fzNT9NC1hjSGWf3yFO3`). It is a
single-file React prototype, `App.tsx`, about 2.8k lines.

- Every API call in it is simulated with `setTimeout`, and its sample data is mock data.
- **Do not copy its sample hostnames, tokens or data into this public repo.**
- It is a reference for **structure and flow**, not for styling (see Accessibility below).

### What it confirms

| Prototype | Proposal equivalent |
|---|---|
| Bridge: greeting, status line, "needs you" tasks shown **only when something is pending**, a grid of room tiles, a **+ New Room** tile | Home board: calm, human-shaped, needs-you surfaced, not shouted |
| Each room has three tabs: **Room · API · Learn** | Card/board view with a **scoped Connect** one tap away (see below) |
| A room's **API** tab: suggested providers, each with a **role** ("Primary storage", "Vector search", "Auto-tagging"), a few config fields, **Test**, and **Pull** with a JSON preview | Provider → Request → Mapping, with test and query; the *role* is the Mapping's `meaning`. This is direct validation of the semantic layer |
| Systems → Providers · Variables · Connections · Health · Settings | Connect + secrets + status, grouped as one workshop area |
| Health list (label, ok/warn/error, latency, note) | A built-in board generated from provider status rules |
| Custom rooms: name, emoji, colour, type `list` · `board` (kanban) · `blank` | User-created boards |
| Phone bottom nav **Bridge · Needs you · Search**; desktop sidebar of rooms with **Systems** at the bottom | Answers open question 3: Connect lives in Systems, not in the phone's primary nav |

### What it changes or adds

1. **A per-room API tab.** Each board gets a scoped workshop that shows only the providers,
   requests and mappings feeding *this* board. The global workshop still exists under
   Systems. This is progressive disclosure where you already are: Home stays human,
   and depth is one tap away. Proposed for Phase 2.
2. **Needs you and Search as landmarks.** "Needs you" aggregates room/0 `needs-you`
   plus card status rules. "Search" starts as Memory's deterministic Find and later
   spans card results.
3. **Providers vs connections.** The prototype separates vendor accounts (API key,
   model) from project endpoints (URL plus auth type). The proposal keeps **one Provider
   concept** to avoid two registries again. The UI may group providers by category
   ("Services" and "My projects").
4. **Variables means names, never values.** The prototype shows editable secret values
   in the browser, which the security boundary forbids. The Worlds version lists each
   variable's name, source and set/not-set, with **write-only** value entry behind step-up.
5. **Room types.** `blank` is an empty board, Phase 2. `list` is local items, aligned
   with Memory/Kept, Phase 2–3. `board` (kanban) is **deferred**, because it is a
   product of its own.
6. **Learn tab, achievements and XP** go to the personality/experience pack, later.
   They are kin to the existing stickers and learning features.

### Accessibility: take the structure, not the styling

- **Text size and contrast.** Labels in the prototype are 9–10px monospace at 15–35%
  white. They fail the type floor (labels ≥13px) and contrast.
- **Colour-only encoding.** Each room is identified by colour alone.
- **Motion and focus.** Animations are on by default, and there are no visible focus states.
- **What Worlds renders instead.** The structure uses the existing tokens, complete
  themes, 44px targets and WorldButton/kit primitives, per
  `docs/accessibility/ACCESSIBILITY_CONTRACT.md`.

### Naming to settle (owner decision)

- **"Room" collision.** The prototype calls user-facing spaces **rooms** and home the
  **Bridge**. In this repo, "room" already means a Play-Nice room/0 *service*.
- **Options:**
  - (a) User-facing "Room" means a board, and the room/0 service becomes a "room
    provider" in docs and code.
  - (b) Keep "board" in the UI.
- **Nav options:**
  - The prototype's `Bridge · Needs you · Search`, with rooms and Systems in the
    sidebar or menu.
  - Revision 2's `Home · Connect · Memory · Settings`.

## Owner answers and review

**Tap-questions (2026-10-01):**

| Question | Answer |
|---|---|
| Personality layer | **Optional theme/experience pack.** Out of core code; art and canon stay in the repo |
| Who uses Worlds | **Just Rylee + scoped agent tokens** |
| Built-in SSO | **Keep OIDC in Worlds** |
| How to start | **Refine the plan first.** Nothing built yet |

**Owner review (2026-10-01, revision 2):** keep the direction; add Mapping as the
semantic layer; governed actions with single dispatch; Memory stays core with a
deterministic baseline and optional enrichment; journal-gate policy preserved; resolve
the doc conflicts explicitly; UI-first with lossless YAML round-trip; Chat parked until
Phase 5 but contracts assistant-safe from Phase 1; recipes Project Home → Sonarr →
Homelab Health (GitHub fourth); a reference provider in Phase 1.

## Still open

1. ADR-0008 wording, drafted in Phase 0 for your approval.
2. Exact `concept` naming convention (proposed: `area.thing`, free-form, lower-case).
3. Where Connect lives on the phone: a nav item, or inside Settings on narrow
   screens. To be decided with screenshots in Phase 1.
4. UNKNOWN: where Pollen and Open Dots live; neither is referenced in this repo.
