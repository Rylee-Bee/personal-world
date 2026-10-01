# Proposal — Worlds as the universal front door (2026-10-01)

> **Status:** PROPOSED (not approved). Owner: Rylee. **Revision 3** (refine-only
> round, 2026-10-01). Drafted by Claude from a full backend + UI +
> provider-machinery inventory, an open-source survey, three owner review rounds,
> the owner's Figma Make prototype and an interactive design lab. Nothing here is
> implemented. Production code is untouched until this is approved. If approved,
> it supersedes `.project/PLAN.md` Step 1c onward and every decision listed in
> **Superseded decisions**, and gets ADR-0008 (draft wording below) plus a
> `DECISIONS.md` entry.

## North star

> **Worlds owns meaning. Providers own mechanics.**
>
> **Worlds is a small personal front door that gathers a large world without
> having to contain the whole world.**

You register a **provider** (any HTTP API, a service that speaks room/0, later
MCP); then you **list** what it offers, **query** it, **test** it and **save**
the request. A **mapping** gives the result a human meaning, a **card** presents
it, and **boards** of cards make up Home and any personal sections. **Memory
stays a core Worlds concept** with a deterministic local baseline; providers only
enrich it. Personality (Station, crew, Sol, lore) is an optional **experience
pack** layered over a structure that never moves.

## What the UI test taught us

The Make prototype exposed **two architectures living on top of each other**.

| Keep: a strong human-facing Worlds | Relocate: provider plumbing leaking into the product |
|---|---|
| A calm Home/Bridge orientation | Every room knows about APIs and providers |
| "What needs me?" | Rooms expose API and Learn tabs directly |
| Useful destinations | Systems owns Providers, Variables, Connections and Health |
| A dark, warm visual language with a strong sense of place | Provider configuration starts to define what Memory, Projects, Hive and Journal *are* (Memory = Supabase + Pinecone + Claude) |
| Personality without needing technical knowledge | Achievements, rank and Station terms become structural instead of optional |

This revision keeps the left column and gives the right column one home: **Connect**.

## Why now: what the inventory found

| Fact | Evidence |
|---|---|
| The backend is 41.8k LOC and 228 routes; `api.py` alone is 6.1k LOC and 192 routes | wc + route grep |
| Only about 1.4k LOC of route body serves the front-door core | backend inventory |
| About 2.5k LOC of `discovery/` is **dead** (the old candy-dispenser engine; nothing imports it) | import graph |
| The auth stack is about 5.3k LOC: about 1.1k needed for one owner, about 2.4k multi-user, about 1.6k OIDC | backend inventory |
| There are 17 UI screens, 10 of them persona or feature screens | UI inventory |
| Connection test, save and schema hooks **exist, but no screen uses them** | `ui/src/data/hooks.ts` |
| Overlapping machinery: about 7 partial "generic HTTP" primitives, 2 provider registries that disagree, 3 approval models, 3 capability lists | provider inventory |
| There is no request runner, no saved requests, no OpenAPI import and no MCP client | grep |
| `rooms.py` is the one solid generic layer | provider inventory |

The bones are good. The bloat is integrations and persona features baked into core. The
fix is **one generic substrate that replaces many domain-specific integrations**, not
a rewrite.

## The model

```
Provider → Request → Mapping → Card → Board
                │
                └→ Governed Action → assistant / automation
```

| Layer | Owns | Examples | Stored as |
|---|---|---|---|
| **Provider** | connectivity | Project Home, Sonarr, a Gatus health API, a room/0 service, the reference provider; MCP later | `providers/<id>.yaml` |
| **Request** | transport mechanics | `GET /queue`, `GET /projects?status=active`, a POST action; parameters, assertions, TTL | `requests/<provider>/<id>.yaml` |
| **Mapping** | human interpretation, the seam between external data and Worlds' meaning | `concept: media.downloads`, fields, status rule | inside the card file, or `mappings/<id>.yaml` when shared |
| **Card** | human-shaped presentation | Tier-1 views: stat · list · table · status · link · markdown | `cards/<id>.yaml` |
| **Board** | composition | Home is a board; personal sections are boards | `boards/<id>.yaml` |
| **Governed Action** | executable authority | `media.downloads` (read), `downloads.pause_all` (write) | `actions/<id>.yaml` |

```yaml
request: sonarr.queue
meaning:
  concept: media.downloads
card:
  title: Downloads
  view: list
```

- **`concept` is descriptive metadata**, not a global capability enum. A new concept
  needs no core code change.
- **The principle behind it is ADR-0001's:** Worlds owns the meaning; the vendor's
  shape never becomes product truth. Swap Sonarr for another downloader and only the
  request and mapping change. The card, the board and `media.downloads` stay.
- **Tier-1 views are fixed and accessible.** Worlds owns them, so 44px targets,
  contrast, luminance-only rank and reduced motion hold everywhere. A sandboxed
  template is a later escape hatch.
- **Status is data:** `{path, ok, warn}`. A transport failure renders as
  `unavailable`, or `stale` with the last-good time. **One provider failing never
  blanks a board.**
- **room/0 services are a provider kind.** Their cards and needs-you arrive pre-mapped.
- **Rooms remain** for integrations that genuinely need logic.
- **Recipes are data:** a provider template plus requests, mappings and suggested cards.

## Governed actions: saved request ≠ tool

```
Saved Request → optional Governed Action Binding → assistant / automation tool
```

```yaml
tool: { exposed: true, name: media.downloads, access: read,  approval: never }
tool: { exposed: true, name: service.restart, access: write, approval: always, idempotency: required }
```

- **Assistants and automation discover governed actions, never raw requests.**
  `GET /queue`, `GET /medical-records`, `POST /restart-server` and
  `DELETE /episode/1234` are all saved requests, and they are not equivalent.
- **One authority path for every caller.**

  ```
  human UI · assistant · automation → governed action → authority / approval → request execution
  ```

  This replaces today's three approval models (rooms, `ProposalStore`, deployment).
- **Defaults fail closed.**
  - A request has no binding until one is created.
  - Any method other than GET/HEAD counts as `access: write`.
  - A missing `approval` field means `always`.
- **Single dispatch:**

  ```
  approve → consume authorization → dispatch once → SUCCEEDED / FAILED / UNKNOWN
  ```

  - An approval is used up at dispatch. A potentially completed side effect is
    **never replayed** just because the result was lost, and nothing is retried
    automatically.
  - Lost after dispatch means **`UNKNOWN`**, a first-class outcome. A retry is a new,
    separately approved action.
  - Borrowed from Open Dots (an external project, not in this repo).
  - The lab demonstrates it: Connect → Actions, simulate "Connection drops after a
    write is sent".

## Memory: a core concept, not a provider

> **Memory is continuity:** things I intentionally kept, things I need to return
> to, durable things about me, and enough history to re-orient myself.

```
Memory
├── Kept      deliberate notes / remembered things
├── Later     things to return to
├── Records   durable structured personal information (sensitive ones need step-up)
├── History   journal / what happened
└── Find      deterministic local search
```

- **Core baseline (stays in Worlds):** Kept, Later, Records, History and local text
  search.
- **Acceptance:** turn off every model and every external provider. Memory still
  opens, saved things can be browsed, Later works, Records work, History can be
  browsed, and local search works.
- **Enrichment (optional, replaceable):** semantic recall, Pollen, `rylee_lore`,
  Project Home context, associations, other retrieval systems.
- **Memory is never shown as its implementation.** The prototype framed it as
  "Supabase + Pinecone + Claude". In the lab, enrichment is one quiet line ("Models:
  off · Enrichment: none connected") that deep-links to Connect.
- **The journal-gate principle survives.** Agents get deliberately narrow, governed
  answers about private memory, never arbitrary retrieval. The implementation may go;
  the rule moves into governed actions. The lab's example is `memory.later.count`:
  how many Later items there are, never their contents.

## Navigation: the stable skeleton

**Core skeleton (owner decision, revision 3):**

```
Home · Connect · Memory · Settings
```

| Landmark | Answers | Contains |
|---|---|---|
| **Home** | *What matters right now?* | **The full state of everything in one view** (owner refinement, rev 3.1): one sentence of state, a summary count by state (icon + word), a short **Needs you** action list, then **Everything**: one same-shaped tile per source (state · one number · one line · source · freshness), with details opening in place. Discovery is just another tile; "where you left off" is one line. Home is a board. It must never feel like an API dashboard |
| **Connect** | *Where does the plumbing live?* | Requests (saved requests, test/run, map, save, pin); Providers; Recipes; Actions (governed bindings); Advanced (secrets as references, connection details, raw technical state). Powerful, and never required for ordinary use |
| **Memory** | *What did I keep, and where was I?* | Kept · Later · Records · History · Find |
| **Settings** | *How does Worlds look and behave?* | Experience pack, theme, comfort/accessibility, assistant (optional, not installed by default). No plumbing |

- **Optional and personal content arrives as boards, cards and sections, never as
  new permanent navigation.** Boards (Media, Homelab…) are listed under the
  skeleton on desktop and reachable from Home on the phone. They are the person's
  own list, not product landmarks.
- **Raw API mechanics have one home: Connect.** A card or Memory may offer **View
  source** or **Configure source**. Those deep-link into Connect; no human-facing
  area embeds a mini provider console. This **reverses** revision 2's per-board
  "Sources" tab (taken from the prototype's per-room API tab).
- **Search** in the first version is Memory → Find. A global search can come later
  without a new landmark.
- **Chat** is not core navigation. It becomes an optional client of governed actions
  (Phase 5). Until then, the existing Chat screen stays reachable from Settings
  (replace before remove).

### Names: standard in core, and stable under every pack

- **One word everywhere.** The UI, code, API and files use the same plain word:
  `home`, `connect`, `memory`, `settings`, `board`, `card`, `provider`, `request`,
  `mapping`, `action`, `service`.
- **Retired:** the area id `overview` (which renders "Bridge") and the reuse of
  "room" for external services.
- **The external contract keeps its name.** The upstream Play-Nice contract is still
  `room/0`. Worlds' own code calls those things **services**. The rename is one
  mechanical PR in Phase 4.
- **Packs may not rename or move the four landmarks.** Home is still Home under
  Station. This replaces revision 2's "a pack may relabel Home as Bridge" rule.

## Personality: Station as an optional experience pack

**Invariant: changing themes or packs must not require relearning Worlds.**

| Moves into the Station / personality pack | Stays in the repo, never deleted |
|---|---|
| Station rank, XP, achievements, stickers, module codes, Bridge/operator terminology, lore, crew, Sol, companion mechanics, star-map navigation | The art, canon, characters, visual language, playful interactions and theme assets |

What a pack **may** do:

- characters report status ("Bolt: the lab's steady…")
- Sol appears in small moments
- HUD treatment (eyebrows such as "Home · deck 1", corner brackets on cards)
- a starfield backdrop
- achievements and stickers
- lore enriching empty states and transitions

What a pack **may not** do:

- move, rename, add or remove a landmark
- change card positions
- gate any function behind the pack
- lower text size or contrast

**Lab evidence:**

- With the pack off, no pack element is visible.
- With Station on, three pack elements appear.
- The navigation reads `Home · Connect · Memory · Settings` in both cases, checked
  programmatically.

**Not yet proven:** the lab uses placeholder marks, not the protected character art.
A richer pack with the real art is a later design pass, done under the same invariant.

## Accessibility: quiet means lower emphasis, not harder to read

**Kept from the prototype:**

- the dark, warm palette
- generous spacing
- restrained motion and the existing `prefers-reduced-motion` behaviour
- the low-stimulation background

**Changed** (all answered in the lab):

| Prototype | Lab |
|---|---|
| 9–11px monospace labels at 15–35% white | Labels ≥13px; secondary text uses the theme's `text-secondary`/`text-muted` tokens, which pass contrast; body text is 16px |
| Status by colour alone (dots, room colours) | Every state is icon + word: ✓ Healthy · ! Needs attention · ◷ Stale · ✕ Unavailable · ? Unknown |
| No visible focus states | A 3px focus ring on every control |
| Small tap targets | ≥44px controls; a 56px bottom bar on the phone |
| Animations on by default | One short fade, only under `prefers-reduced-motion: no-preference` |
| Important state buried in dense metadata | Failures say what went wrong and when it last worked, in a sentence |

**Lab verification:**

- axe-core (WCAG 2.0/2.1 A and AA plus best practice) reports **no violations** on all
  12 captured states: four screens in both packs, at 390px and 1280px.
- There is no horizontal overflow at 390px.
- A manual screen-reader walk is still **UNKNOWN**. It is not done and stays required
  before Phase 2 is called done.

## Editing: UI first, files underneath

```
normal use:   Connect → edit → test → save
power use:    YAML / git / bulk edit
```

**Invariant:** every UI-created configuration round-trips through the documented file
format without loss. **No hidden UI-only config database becomes canonical truth.**

- **The lab shows the file behind each request.** Its request page includes "The
  files this writes", the YAML for the request and its card, which updates as the
  mapping is edited.
- **Real configuration lives in the data/config volume, outside the public repo.**
  The repo carries only the reference provider and example recipes.

## Security boundary (unchanged)

- **Confinement:** requests go only to a provider's registered `base_url` +
  `path_prefix`.
- **Network limits:**
  - no redirects
  - response size and time caps
  - SSRF protection against link-local and metadata addresses, unless a provider is
    explicitly marked LAN
- **Credentials:**
  - stored only as references (`env:`, `vault:`, later OpenBao per ADR-0007)
  - injected server-side, and redacted in responses and logs
  - **the browser never receives a secret value**
  - the lab's Secrets view shows names and set/not-set only, with write-only replace
- **Step-up** is required for provider and secret edits. Owner-only, plus scoped agent
  tokens.
- **Governed actions** carry receipts and follow single dispatch.
- **`tests/test_public_safety.py`** still gates every change.

## First recipes

| # | Recipe | Proves |
|---|---|---|
| 1 | **Project Home** | First-party evolving API, structured project data, richer mappings, internal ecosystem integration |
| 2 | **Sonarr** | Ordinary third-party REST, auth, list data, recipe portability |
| 3 | **Homelab Health** | Many small status values, stale/degraded/unavailable, aggregation, graceful provider failure |
| later | GitHub | Its enormous API must not shape the first abstraction |

OpenAPI import comes only after these are proven by hand.

## The reference provider (Phase 1 requirement)

A built-in synthetic provider for development, CI, examples and open-source
verification only.

| Case | Proves |
|---|---|
| GET list / GET object | list and stat mappings |
| POST idempotent action | governed action, receipt, single dispatch |
| slow response | timeout → `unavailable` / `UNKNOWN` |
| 500 response | degraded card, board survives |
| malformed response | honest error, nothing guessed |
| secret-required request | secret-ref injection and redaction |
| stale result | stale + last-good display |
| redirect attempt | refused |
| oversized response | size cap holds |

**Acceptance:** the architecture works even when Rylee's infrastructure does not
exist. The whole Provider → Request → Mapping → Card → Board flow runs with no Sonarr,
no Project Home, no LAN, no personal tokens and none of the estate. The lab's
"Reference provider simulates" control previews the user-visible side of five of these
cases.

## Superseded decisions

Phase 0 edits each source in place with a dated "superseded by ADR-0008" note, so
future agents do not restore the old architecture.

| # | Source | Old decision | New decision |
|---|---|---|---|
| S1 | `docs/PRODUCT-LANGUAGE.md` § Stable skeleton; `AGENTS.md` (Workbench & Node rules, "The frontend is Worlds"); `docs/TRUE-NORTH.md` scope | `Bridge · Memory · Chat · Settings` is the required stable navigation | `Home · Connect · Memory · Settings` |
| S2 | `docs/PRODUCT-LANGUAGE.md` § Overview; `AGENTS.md` ("area id `overview` renders the **Bridge**") | Bridge/Overview is the primary home landmark | **Home**, a board; `overview` and "Bridge" retire from core vocabulary |
| S3 | `docs/PRODUCT-LANGUAGE.md`, `docs/TRUE-NORTH.md` (Chat in the core four and in G-voice) | Chat is required core navigation | Chat is an optional later client of governed actions |
| S4 | `.project/PLAN.md` Step 1b | "**Personality ships here, not later**" | Personality ships as the optional Station/experience pack, after the front door works |
| S5 | `docs/PRODUCT-LANGUAGE.md` theme principles ("Character art, a light sci-fi feel, and visible companions stay part of Worlds") | Baseline personality is structurally embedded in core | Personality is an overlay pack. **Kept:** plain never means sterile; core keeps a warm identity through type, softness and complete themes |
| S6 | ADR-0001; `framework validate` (capability-ownership, the `status_map` equality test) | Every provider must implement a core-registered capability, which forces provider semantics into core | Meaning moves into Mapping `concept` metadata; the capability enum is retired for front-door providers; a small built-in set (Memory, vault, journal) keeps its contracts |
| S7 | `.project/PLAN.md` Steps 1c–3 | Media, calendars and inboxes are built-in sources | They arrive as providers, recipes or services |
| S8 | `docs/ARCHITECTURE.md` (API-only routes `/api/lab/*` etc. as a product contract) | Removing them is off-limits | Each is removed in Phase 4 only once a recipe or service replaces it, recorded as an owner decision |
| S9 | `docs/ROOMS.md`; `AGENTS.md` (rooms) | "Room" means an external room/0 service | Worlds code calls it a **service**; the upstream contract name `room/0` is unchanged |
| S10 | This proposal, revisions 1–2 | `Home · Connect · Memory · Settings` (rev 1–2), then `Home · Needs you · Search` with packs allowed to rename landmarks and a per-board Sources tab (rev 2 addenda) | Revision 3 as written above |

## ADR-0008 draft wording

**Proposed ADR-0008: the front door — meaning, mechanics, authority**

- **Status:** proposed (lands in Phase 0 after owner approval).
- **Amends:** ADR-0001.
- **Relates to:** ADR-0006 (event envelope = journal entry), ADR-0007 (secrets).

**Decision.**

1. **Worlds owns meaning; providers own mechanics.** External systems connect as
   Providers. Requests carry transport. Mappings carry meaning as descriptive
   `concept` metadata. Cards present. Boards compose. A provider's API shape never
   becomes a Worlds concept.
2. **Core-owned concepts are few and named:** Home, Connect, Memory, Settings, and the
   Memory baseline (Kept, Later, Records, History, Find). They work with zero
   providers and zero models.
3. **ADR-0001's capability registry is retired for front-door providers.**
   Validation checks schema, secret references and confinement instead of membership
   in a capability enum.
4. **Authority is explicit.**
   - Only governed action bindings are callable by assistants or automation, and
     every caller uses one approval path.
   - Writes follow single dispatch: approve → consume → dispatch once → SUCCEEDED,
     FAILED or UNKNOWN, with no automatic replay.
   - Agents get only narrow, bound answers about private memory.
5. **Configuration is files.** Every UI-created configuration round-trips through the
   documented YAML without loss. No UI-only store is canonical.
6. **Structure is invariant under presentation.** Themes and experience packs may
   change look, voice and moments. They may not move, rename, add or remove a
   landmark, or gate a function.
7. **Replace before remove.** A subsystem is deleted only after its replacement works,
   one removal family per change.

**Consequences.**

- Provider integrations become data (recipes); Python adapters shrink.
- `framework validate` and `tests/test_framework.py` change in Phase 1.
- Room/0 integration continues unchanged as a provider kind.
- Station and character canon are preserved as a pack.

## Phases

Each phase is a vertical slice with phone and desktop screenshots. **Replace before
remove.**

| # | Slice | Includes | Done when |
|---|---|---|---|
| 0 | **Decide** | Refine the proposal (this); ADR-0008; supersession notes S1–S10; DECISIONS entry; tag `archive/pre-front-door`; delete the dead discovery engine (no behaviour change). **No production implementation** | ADR merged, conflicting docs updated, gates green |
| 1 | **Connect foundation** | Provider, Request, Mapping; YAML store with lossless round-trip; secret refs; SSRF guard; request runner and tester; the reference provider; Connect UI; a deterministic test suite | The full flow passes in CI against the reference provider, and Rylee saves a working request from her phone |
| 2 | **Human presentation** | Cards, boards, Home; stale/last-good; the mapping editor; room/0 provider support; Needs you; deep links from cards to Connect | Home shows real services and pinned cards; one broken provider doesn't blank it; a manual screen-reader walk passes |
| 3 | **Recipes, then import** | Project Home → Sonarr → Homelab Health, then OpenAPI import | Each of the three runs from a recipe with no Python adapter |
| 4 | **The cut** | One PR per removal family: personality → pack, multi-user, the rename `rooms` → `services`, then each ported provider once its recipe or service works | Target size reached; all gates green; nothing removed without a working replacement |
| 5 | **Memory enrichment + assistant** | The Memory baseline already exists. Adds provider-backed enrichment, semantic recall, governed action bindings, an optional assistant/chat client, and removal of the hand-written tool registry once its replacement is proven | Memory works with models off; Chat can be entirely absent; the assistant cannot execute arbitrary saved requests; writes use the same governed path as the human UI |
| later | — | MCP provider kind; tier-2 templates; sharing recipes | — |

## What stays, shrinks, moves, goes

| Keep (core) | Shrink | Move out (provider · recipe · service · pack) | Remove |
|---|---|---|---|
| Services reader (today's `rooms.py`), connections, secret_resolver, vault, envelope, status, sections → boards, setup, healthz, manifest + `api` CLI, journal, **Memory baseline**, themes/tokens/kit, a11y prefs, OIDC login | Auth (owner + agent tokens + OIDC), identity (single mode), prefs, briefing (→ cards), backup, push | **Provider/recipe/service:** media, lab_*, reconciler, calendar, updates, deployment, source_control, github, agent_sync, project_home, traefik, discovery (live part), reminders, learning, semantic memory, chat + tool_registry. **Pack:** crew, voice, briefing-voice, stickers, lore, theme_pack, Sol/Keeper/star-map UI | Dead discovery engine, content_db, people/invites/helpers/roles/user, the `journal_gate` implementation (policy kept), legacy `/station` redirects |

**Rough target, an estimate:** backend about 12–15k LOC and about 40 routes; UI with
4 landmarks.

## Visual style: Lamplight (rev 3.2, proposed)

> *The house is calm and dim. The window that needs you is the lit one.*
> The skeleton is right; this puts the heart back on top of it, without putting organs back into the walls.

Researched against Rylee's adopted Play-Nice contracts (library pinned at `2084747`, read in full) and against well-loved dashboards:

- Uptime Kuma: heartbeat strips
- Glance: `show-failing-only`
- Homepage: one card shape
- Home Assistant: fixed grid with titled sections; masonry dropped for unpredictability
- Apple Weather and widgets: cached values, never spinners
- Oura and Garmin readiness: word bands
- Grafana stat: hero value
- Few and Tufte: exception-based, word-sized graphics
- Calm technology (Weiser and Brown; Case)

Anti-patterns avoided:

- Grafana-style wall of panels
- red or green everywhere
- streak and ring guilt
- masonry reflow
- tiny HUD text

### The rules

| # | Rule | Contract basis | Evidence |
|---|---|---|---|
| L1 | **Luminance is attention.** Anything not healthy sits on a brighter surface with a stronger edge; healthy recedes but stays ≥4.5:1. Rank is never hue alone; tone never uses the rank channel | Luminance-only rank (`ui/THEMES.md`); tone is not priority (ROOM 46-48); no wall of green (ATTENTION_AND_QUIET 31-32) | Few, exception display; alert-fatigue analyses |
| L2 | **Status is shape + word + colour,** in that order of reliance: ● Healthy · ▲ Needs attention · ■ Unavailable · ◌ Stale · ○ Unknown, using the canonical words only | Status never by colour alone (ACCESSIBILITY 38-39); canonical vocabulary (STATUS_AND_STATE 29-36) | Astro UXDS-style shape-plus-colour system |
| L3 | **One sentence first.** A low-drama briefing in human words, then counts by state | First screen answers "what needs me" (AQ 46-47); write for a strained reader (HUMAN_RELIABILITY 42-43) | Apple Weather context lines; Oura summaries |
| L4 | **Human meaning, then state, then detail, then evidence.** "Downloads can't check in right now" → ■ Unavailable → "2 were downloading the last time I heard from it" → Last good 19:42 → *Technical evidence:* GET /api/v3/queue · Sonarr returned 500 · 212 ms | Meaning → actions → safety → implementation (DEPTH_ON_DEMAND 47-48); full technical detail within two interactions (DoD 88-89); degraded shows reason + last verified (SAS 65-66) | Glance → peek → open (calm tech; HA tile → more-info) |
| L5 | **Healthy has a vocabulary,** reassuring and never celebratory: Quietly working · All quiet · Ready when you are · Halfway through | "Nothing needed" shown explicitly, then stop (AQ 35-36); calm static confirmation (SENSORY_SAFETY 55-56) | Linear's calmer refresh; Things 3 |
| L6 | **Life sits beside machines.** Home order: lit windows (not healthy) first, then life (Interests, Memory, Reading), then quiet machines. A technically healthy Home with nothing human on it fails | What needs me / what was I working on / what's coming up (AQ 46) | HA favorites on top; the owner's Interests observation |
| L7 | **Continuity is a first-class section.** "Continue where you left off" lists threads that stopped because you stopped: a board being arranged, a half-built request, a Later item | Returning costs "no archaeology" (AQ 52-57); stopping is success (WHAT_WHY_NEXT 53-54) | — |
| L8 | **One card anatomy, fixed grid, three sizes** (S = 1 column, M = 2, L = 2 and expanded). No masonry; nothing reflows when data changes | Stable reading order (WAC 5); dense surfaces are still (SS 40) | Homepage, HA sections, Apple widget sizes |
| L9 | **Stale keeps its last value,** with a dashed edge plus "Last good 19:42". No dimming below contrast, no blank, no spinner | Stale is a state (EVENTS_AND_CACHING 33); missing stays missing (ONE_TRUTH_TWO_VIEWS 42-44); static loaders only (SS 36-38) | Apple HIG: cached data, never a spinner |
| L10 | **Density is a comfort preference, not a mode:** Calm (healthy machines fold into one "Quietly working" row), Standard, Detailed (check strips plus evidence open) | Density is a stored preference (WEB_UI 45-46, TP 35); "no accessibility mode" (TP 38-39) | Glance `collapse-after`; ADHD low-density dashboard study (ACM 2025) |
| L11 | **Edit Home is explicit and separate:** size, move earlier or later, hide, show, undo. Keyboard buttons, 44px. Glancing never rearranges anything | Customization without changing structure (TP 48-49) | Homarr no-YAML editing; HA drag-and-drop sections |
| L12 | **Presence is optional and inert.** A small mark beside the greeting that rests when quiet and looks up when something needs you. Static, `aria-hidden`, no actions, can be turned off. In Station it becomes Sol (placeholder in the lab) | Decoration carries no meaning (TP 40-42); nothing moves on its own (SS 39-40) | Calm tech: the periphery |
| L13 | **Personality never hides truth.** Station rewrites voice only: "Downloads missed their last check-in" vs Core "Downloads can't check in right now". The same evidence and timestamps appear in both | A calm surface never hides truth (HR 44-45); human wording may translate but not change meaning (SAS 47-48) | — |
| L14 | **No gamified maintenance.** Station's strip counts *discoveries* (books, albums), never connections, cleared warnings, visits or streaks | No streaks or guilt (AQ 41-42) | Apple ring-guilt complaints |
| L15 | **Quiet = lower emphasis, never lower legibility.** Body 16px, labels ≥13px, sentence-case headings, 2px teal focus ring, ≥44px targets, still by default | PLAIN_LANGUAGE 45-46 (no all-caps headings); WAC 2.4 focus; WAC 2.1 targets; SS 18 | BDA dyslexia style guide |

### Visual directions under test (rev 3.3)

Owner feedback on Lamplight: "it feels kinda … text-y". Three more visual encodings of the **same facts and the same IA** were built in the lab, each centred on visual accessibility. The lab's "Visual direction" control switches between them.

| Direction | Encoding | Strongest for | Watch-outs |
|---|---|---|---|
| **Lamplight** | Sentences: a meaning line per card | Reading on a good day; personality | Text-heavy (owner feedback) |
| **Glyph** | A large pictogram with the status shape on the icon, one big number, 2–3 words; a one-row state strip under the greeting shows every source at once | Recognition without reading; the fastest whole-state glance | The healthy status mark on the icon is small; its word is screen-reader-only, and the shape still differs from ▲ and ■ |
| **Instruments** | One row per source with a visual meter: health segments, download progress bars (striped when frozen at the last good value), reading progress, project marks, Later dots; numbers line up in one column | Scanning the whole state top to bottom; quantities; "how far along" | Densest of the four; best on desktop |
| **Big & Bold** | Two or three large cards per row, a thick status band (shape + word), 40px icons, 3rem numbers, fewest words | Low vision, 200% zoom, tired eyes, across-the-room glance | Fewer sources fit per screen |

**Checks on all directions:**

- axe reports 0 violations at 390px and 1280px, with and without Station, and with an opened card.
- The Core/Station invariance probe passes in every direction.
- Every meter carries a text equivalent.
- Drilling in (card → detail → Technical evidence) works identically in all four.

**Recommendation (superseded by the owner's choice of Instruments, below):**

- Make **Glyph the default Home**.
- Use **Instruments** as the Detailed density, which is where it naturally belongs.
- Make **Big & Bold** a comfort preference ("Larger cards"), not a theme.
- Keep Lamplight's *language* (human meaning lines, the healthy vocabulary) in the drill-in detail and the briefing sentence, where words help most.

### Home direction: Instruments (owner choice, 2026-10-01)

Owner reaction to the four directions: "I really enjoy instruments", with a request to make it more robust and warm. **Instruments is the chosen Home direction.** Lamplight's language survives inside it: meaning lines, the healthy vocabulary, the briefing.

**Row anatomy (one shape for every source):**

```
icon · name + what it means · meter · value + unit · state + freshness
```

- **Fixed groups in a fixed order:**
  - **Needs a look** comes first. These are the lit rows: brighter surface plus an accent edge (a coral edge when unavailable).
  - **Your life** comes second.
  - **Quietly working** comes last.
  - A row changes group when its state changes; the groups never move. When nothing needs a look, the first group says so explicitly ("Nothing needs a look. Everything is answering.") and stops.
- **Healthy is quiet.** Healthy rows show a plain "● Healthy" (machines) or "● Up to date" (life) with no pill. Only exceptions get a bordered badge, so there's no wall of green.
- **Every state has a meter:**

  | Meter | Used for |
  |---|---|
  | Segments | Health (Homelab: a ▲ marks the broken one) |
  | Progress bars | Each download |
  | Progress | Reading |
  | Stage marks | Projects |
  | Dots | Later |
  | Day timeline | Today, with the past shaded and a "now" line; labels sit under the track so they never collide |
  | Shelf | Interests, recent finds as spines; ✦ marks the new one |

  - **When stale or unavailable**, the meter freezes: striped, with "as of 19:42".
  - **When not set up**, the track is an honest dashed empty one with a "Set up Music" button and "Optional. Nothing is missing until you want it."
  - **Missing values show "—", never 0.**
- **Warmth:**
  - Young Serif meaning lines ("A gentle evening", "Quietly working", "Halfway through").
  - Brass-and-teal meters.
  - Icon wells tinted with the accent.
  - Life rows (Today, Reading, Interests, Memory) carry as much visual weight as machines.
- **Comfort settings:**
  - Calm folds Quietly working into one line.
  - Detailed adds a 24-check strip to machine rows and opens technical evidence by default.
  - Edit Home moves, hides, shows and undoes rows.
- **Drill-in:** row → meaning, detail and rows → Technical evidence (two interactions) → Open in Connect.
- **Checks:**
  - axe reports 0 violations in 14 states: Sonarr down, all answering, Station, Calm, Detailed with stale data, drill-in and edit, each at 390px and 1280px.
  - No horizontal overflow; one timeline-label overflow was found and fixed.
  - The Core/Station invariance probe passes.

### Core personality vs pack personality

| Core (Experience pack: None) | Station pack adds |
|---|---|
| Warm human copy; a healthy-state vocabulary; life on Home; the continuation section; a quiet presence mark; warm dark palette; Young Serif for meaning lines; the date in the eyebrow | Sol; a crew line (placed **below** the cards so nothing shifts); HUD eyebrow ("Home · deck 1 · evening watch"); corner brackets; a starfield; playful but exact copy; a discovery strip |

**Proven in the lab:** a probe compares navigation, headings, every actionable control and card order between Core and Station on all four screens, with providers both healthy and failing. It finds **no differences**. The eyebrow is the same height in both, so the greeting doesn't move.

### Tensions this resolves (from the contract read)

- **Same-shaped tiles vs "one attention list beats forty equal cards":** a separate Needs you list, luminance ranking, lit windows sorted first, and Calm density folding healthy machines.
- **Stale dimming vs contrast:** dashed edge plus a timestamp instead of dimming.
- **The fixed teal focus colour vs Daylight:** the lab uses `#72b1b1` on dark and a darker teal on Daylight, so the ring keeps 3:1. Recommend amending WAC 2.4 to "teal at ≥3:1 per theme".
- **WAC 5.2's Bridge reading order** (needs-you 4th) is superseded by the Home order above. Add it to the S2 supersession.
- **WAC 9.2 names the settings section "Customize";** the skeleton says Settings. Proposal: the landmark is **Settings**, and "Customize Home" is the Edit Home action. Record in ADR-0008.
- **No contract defines a low-capacity mode.** Lamplight answers with comfort preferences (Calm density), never a mode.

### The seven success conditions (lab status)

| Condition | Lab status |
|---|---|
| Architecture: I understand where things live | Met. Four landmarks; boards beneath; invariance probe passes |
| Low capacity: what needs me without investigating | Met in the lab. Briefing sentence, Needs you, lit windows; Calm density for bad days |
| Technical depth: drill all the way down | Met. Card → detail → Technical evidence (2 interactions) → Open in Connect |
| Continuity: return without reconstructing | Designed, with example data. Real continuation needs journal events (Phase 2) |
| Personality: my world, not a template | Designed. Needs Rylee's judgement; the lab uses placeholder art for Sol |
| Replaceability: providers disappear, concepts stay | Met. Sonarr 500 leaves `media.downloads` and the card intact, with last good shown |
| Theme boundary: Station transforms experience, not IA | Met. The probe passes on all four screens, healthy and failing |

**Known trade-off:** the richer Continue section costs vertical space. On a 1280×900 desktop the life cards start at the fold in Standard density, and Calm density brings Home back to one screen. Accepted for now; revisit with real data.

**UNKNOWN:** a manual screen-reader walk; how Lamplight looks with the real protected companion art.

## Design evidence

### The owner's Figma Make prototype (the "before")

- **File:** key `eS6fzNT9NC1hjSGWf3yFO3`. It is one React file of about 2.8k lines, and
  every call in it is simulated.
- **Kept as the "before" reference.** The Figma tools can read a Make file but cannot
  write one, so the experiments ran in a forked lab instead (below).
- **Its mock hostnames, tokens and data are never copied into this repo.**

**What the lab took from it:**

- the calm greeting
- "needs you" only when pending
- destination tiles
- the dark, warm language
- **the role idea:** each provider in a room carried a *role*, which became the
  Mapping's meaning

**What the lab relocated:**

- per-room API and Learn tabs → Connect, and the pack
- Systems' Providers/Variables/Connections/Health → Connect
- achievements and XP → the pack
- custom room types → boards (kanban deferred)

### The design lab (the "after")

- **Where:** https://claude.ai/artifact/Tjki6MHSBKXxijd6rNjiXg (private, interactive).
  The source is kept outside the repo.
- **What it is built from:** Worlds' real tokens (starfield dark, daylight light) and
  fonts (Atkinson Hyperlegible Next, Young Serif).
- **Controls:** the experience pack and the reference-provider scenario.

| Experiment | What it showed |
|---|---|
| **A: Home** | Home reads as a personal page, not a dashboard, when it leads with a sentence ("2 things need you. 1 source isn't answering; its card says so"), then Needs you, then cards. A failing provider becomes a dashed card that says what went wrong and when it last worked, and the rest of Home is unaffected. The "View source" link is the only plumbing on Home |
| **B: Connect** | One request page carries the whole loop: Run → assertions → map fields → concept → Save and pin, with the YAML it writes beside it. Actions show "9 saved requests · 4 bound as actions", which makes *saved request ≠ tool* visible. The UNKNOWN receipt reads plainly and refuses to resend |
| **C: Memory** | Kept · Later · Records · History · Find work as one deterministic place, and Find needs no model. Enrichment is a single line. Locked Records say "confirm it's you" |
| **D: Station pack** | The crew voice, HUD eyebrow, card brackets, starfield and stickers appear and vanish with the pack; navigation and layout don't move. The lab used placeholder marks, not the protected art |

**Experiment A2: Home at a glance** (owner request, rev 3.1: "simpler and easier to see the full state of everything in one view"):

- **Desktop (1280×900):** the greeting, the state sentence, the summary counts, Needs you and every source tile all fit without scrolling.
- **Phone (390px):** the summary, Needs you and the first row of tiles fit on the first screen. Tiles use two columns, and an opened tile spans the full width.
- **What it replaced:** large mixed cards, a separate discovery section and a history section. Every source now has the same tile shape, so state can be compared at a glance. Detail is one tap away, in place.
- **Checks:** axe reports 0 violations in all states, including the opened tile and the Station pack.

**Design observations for Phase 2:**

1. **Lead Home with one sentence of state before any cards.** It does more for calm
   than any visual treatment.
2. **A degraded card must say what went wrong and when it last worked, without
   leaving its slot.** A dashed border plus a word beats any colour cue.
3. **"View source" on every card is enough plumbing for Home.** More would leak.
4. **On the phone, long action names and pills need room.** Rows must wrap. The lab hit
   this, and it is fixed there.
5. **A pack's moments need a place reserved in the layout.** The crew line sits where a
   blank space would otherwise be, so turning the pack off never reflows the page.

## Owner answers and review

| Date | Decision |
|---|---|
| 2026-10-01 (taps) | Personality becomes an optional pack; just Rylee + scoped agent tokens; keep OIDC in Worlds; refine before building |
| 2026-10-01 (review 2) | Mapping as the semantic layer; governed actions with single dispatch; Memory stays core; doc conflicts resolved explicitly; UI-first with lossless YAML; Chat parked; recipes Project Home → Sonarr → Homelab Health; reference provider in Phase 1 |
| 2026-10-01 (naming) | Standard names in core, not themed ones |
| 2026-10-01 (direction) | Home direction: **Instruments**, made more robust and warm |
| 2026-10-01 (review 3) | Skeleton `Home · Connect · Memory · Settings`; raw mechanics live only in Connect; the Station pack is an overlay that never changes structure; quiet means lower emphasis, not harder to read; the Make prototype is a disposable lab |

## Open owner questions

1. **Approve revision 3 to start Phase 0?** Phase 0 is docs, the ADR, an archive tag and
   dead-code deletion only.
2. **Information, not a decision:** where Pollen and Open Dots live is UNKNOWN; neither
   is referenced in this repo. A pointer would let ADR-0008 cite them properly.

Everything else (exact Connect sub-tabs, `concept` naming such as `area.thing`, where
boards appear on the phone, card visuals) is a Claude-owned implementation call inside
this direction.
