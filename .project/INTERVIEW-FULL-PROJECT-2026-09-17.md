# The Whole-Project Interview Report

**Date:** 2026-09-17
**Author:** creative-director interview pass (opencode)
**Scope:** full-project interview — repository, live product, data, map, depth, companion, agent participation, voice, intent
**Type:** understanding and product model, not implementation

---

## Part 1 — What the codebase believes the product is

The codebase believes it is a **personal operating environment** built on a **stable world model** with **replaceable machinery** underneath. The evidence:

**Backend (`model.py`, `world.py`):** First-class domain objects are `Fact`, `Intent`, `Policy`, `Lore`, `Capability`, `Provider`, `Actor`, `JournalEvent`, `Pack`, `Provenance`, `Classification`. Every object carries provenance (source, observed_at, provider, authority). Every object has a classification (world, private, secret). Policies can be `cemented` — only an explicit `UserAction` may change them. Lore has a promotion path: ephemeral → suggested → confirmed, with only human action promoting to canon. This is not a CRUD app. It is an epistemic system.

**Backend (`sections.py`):** The canonical section registry defines 9 sections: `today, interests, media, projects, lab, journal, vault, chat, settings`. Each carries `capabilities` (which capability it depends on) and gets a real `status` from the capability health system. The `/api/sections` endpoint returns this list with live status per section.

**Backend (`chat_context.py`):** The chat context builder assembles a rich world snapshot for the assistant: world summary (facts, intents, policies, lore counts), capability status, connected actors, stated intents, policies, public lore, recent journal events, source control repos, and project observations. It also has `build_ui_context()` that accepts the current route, section, status, and selected entity — so the assistant knows *where you are*. This is a system designed for an assistant who understands your world.

**Backend (`api.py`):** ~110 routes exist. The Station calls 15. Unused: `/api/sections`, `/api/daily`, `/api/status`, `/api/lab/*`, `/api/native-lab/*`, `/api/actors`, `/api/tools`, `/api/memory/search`, `/api/connections/*`, `/api/exports/*`, `/api/updates`, proposal approve/reject/execute.

**Station (`sections.js`):** 5 sections: interests, journal, projects, chat, settings. Hardcoded. Does not consume `/api/sections`. Missing: Today, Media, Lab, Vault.

**The disagreement is the finding.** The backend is a world with 9 regions, a rich domain model, an assistant context system, and a proposal/approval workflow. The Station is a 5-section static site that consumes 14% of the available API surface and doesn't send UI context to the assistant. The Station is a prototype of one face of the product — but the product has many more faces than the Station shows.

### First-class domain concepts vs presentation conventions

**First-class (have models, schemas, APIs, storage):**
- Fact, Intent, Policy, Lore (world model — `model.py`, `world.py`)
- Capability, Provider, Actor (capability/provider system — `model.py`, `registry.py`)
- JournalEvent, JournalKind (journal — `model.py`, `journal.py`)
- Provenance, Classification (epistemic metadata — `model.py`, `classification.py`)
- Section, SectionSpec (section registry — `sections.py`)
- Pack (recipe — `model.py`)
- Accessibility (preference floor — `model.py`, `prefs.py`)

**Presentation conventions (UI-only, no backend model):**
- Companion orb, companion label, companion sparkle (Station chrome)
- Map node, drift, orbit ring, egg visit (Station map rendering)
- "Cruising speed" button, help dialog (Station chrome)
- Mood tinting (Station atmosphere)
- The `sections.js` config (Station-local, diverges from canonical `sections.py`)
- The `ATTN` hardcoded attention object (specimen, not real data)
- The localStorage preference system (`pw-station-*` — documented as not synced to server)

### Authoritative vs derived state

**Authoritative (persisted, server-owned):**
- World: facts, intents, policies, lore → `world.json` in data_dir
- Journal events → journal store (JSON/NDJSON)
- Preferences → prefs store
- Source control → Git repos (read-only observation)
- Chat history → chat transcript store
- Connections/config → config files
- Section layout → `world.layout["sections"]`

**Derived (computed at read time):**
- Section status → `section_status()` in `sections.py` (rolled up from capability health)
- Needs-you items → `needsYou()` in `real-data.js` (assembled from proposals + reminders)
- World summary → `world.summary()` (counts of facts/intents/policies/lore)
- Chat context → `build_world_context()` (assembled from world + journal + source control + projects)
- Staleness → `freshness()` (computed from `observed_at` vs current time)
- UI context → `build_ui_context()` (accepted from caller, trusted as hint only)

### Specimen/demo-only state

- `ATTN` in `starmap.js` — hardcoded attention counts (`projects: 1, journal: 1`)
- `DEFAULT_TREE` children's `activity`, `provenance`, `rec` — all empty strings
- `SPECIMEN_REMAINING` in `real-data.js` — explicitly lists: "Media — library and recent activity" and "Map region copy (Recently / From / Suggests)"
- `journal-view.js` — specimen journal view (superseded, `data-unused`)
- Onboarding copy mentioning "seven constellations" (now 5, should be 9)

### State that exists but is not visible in the Station

| Backend state | API endpoint | Station consumption |
|---|---|---|
| World model (facts, intents, policies, lore) | `/api/status` | NONE |
| Section registry (9 sections, real status) | `/api/sections` | NONE (uses hardcoded `sections.js`) |
| Today/daily summary | `/api/daily` | NONE |
| Lab/infrastructure health | `/api/lab/*` | NONE |
| Native lab inventory | `/api/native-lab/*` | NONE |
| Connected actors | `/api/actors` | NONE |
| Brain tool registry | `/api/tools` | NONE |
| Memory/semantic search | `/api/memory/search` | NONE |
| Connection management | `/api/connections/*` | NONE |
| Export endpoints | `/api/exports/*` | NONE |
| Update status | `/api/updates` | NONE |
| Proposal approve/reject/execute | `POST /api/proposals/{id}/*` | NONE (read-only display only) |
| Journal write | `POST /api/journal` | NONE (localStorage notes only) |
| Section layout write | `PUT /api/sections` | NONE |

### UI without corresponding domain depth

- The "Shape this map" editor edits a localStorage structure patch (`pw-map-structure`) that has no backend persistence. The backend's `PUT /api/sections` (which writes to `world.layout["sections"]`) exists but isn't consumed.
- The localStorage preference system (`pw-station-*`) has 6 preferences; only `density` has an "exact" binding to the server. The rest are device-only or partial.
- The companion system in the UI has 4 companions; the backend has 5 (including "Personal World" as the system default). The server prefs show `companion: "personal-world"` but the Station doesn't offer that option.

### Terminology disagreements

1. **Sections:** Backend has 9 (`sections.py`); Station has 5 (`sections.js`). Missing: today, media, lab, vault.
2. **Companion names:** Backend uses `personal-world, mermaid, robot, world-tree-squirrel, taco-news-truck` (prefs.py). Station uses `mermaid, ratatoskr, robot, burrito` (station.js). The `PREF_BINDING` table maps these but they're different names.
3. **Navigation:** Backend nav was `Today → Chat → World → Journal → Vault → Settings` (COMPANION_INTEGRATION.md). Station nav is `World → Interests → Journal → Projects → Chat → Settings`.
4. **"World":** In the backend, "World" is the durable structured state (`world.py`). In the Station, "World" is the map page (index.html). In the companion doc, "World" is a section/destination.
5. **Motion:** Backend pref: `off / reduced / subtle`. Station pref: `off / on`. The binding says "on" has no server equivalent.

### Intentional architecture vs historical residue

**Intentional:**
- The capability/provider/adapter boundary (ADR-0001)
- The proposal system (observe → propose → approve → act)
- The provenance/classification system
- The same-origin Station serving (station_ui.py)
- The honesty discipline (no fake data, specimen labels)
- The accessibility contract as architecture

**Historical residue:**
- The `sections.js` file (should read from `/api/sections`)
- The `ATTN` hardcoded object (should read from real data)
- The localStorage preference system (should sync to `/api/prefs`)
- The `_legacy/` directory (archived pages, correctly excluded from serving)
- The duplicate `POST /api/setup` (coexists with setup wizard — noted in surface audit)
- The `journal-view.js` specimen view (superseded, marked `data-unused`)
- The onboarding "seven constellations" copy (now 5, should be 9)

---

## Part 2 — Live product experience

Experienced through source code, live API probes, and HTML structure analysis. Browser was not available; findings are evidence-based from source and API responses.

### Someone arriving after a week away

The map shows 5 nodes with no live data — `activity: ''`, `provenance: ''`, `rec: ''` for every node. The info strip says "quiet" and "—" for everything. The Needs-you panel calls `/api/proposals` (empty) and `/api/reminders` (empty) and says "Nothing needs you right now. Both sources were checked just now — this is verified, not assumed." This is honest and correct, but the map itself carries no signal about what happened while you were gone. The journal has 2 entries from chat exchanges. The world has 0 facts, 0 intents, 0 policies, 0 lore.

**What it tells me immediately:** Nothing needs you. (True.)
**What it makes me work to discover:** Whether anything happened at all. (I'd have to go to each section page to find out.)
**What it implies that is not true:** That nothing happened. (The journal has entries; the repo has uncommitted changes. The map just doesn't show them.)

### Someone checking in briefly

The low-demand mode ("Cruising speed" → "Show me only what needs me") hides the map, notices, and presences, showing only the quiet Needs-you block. This works. But it also hides the one thing that makes the product feel like a world — the map. In low-demand mode, the product becomes a single sentence: "Nothing needs you right now."

**Where it respects my attention:** The low-demand mode is genuinely minimal.
**Where it unnecessarily demands it:** Nothing in low-demand mode. But in normal mode, the map demands visual attention while carrying no information.

### Someone wanting to explore

5 constellation nodes. Click one → navigate to a new page. The map vanishes. You're on a list page. You can read items, add drafts, see technical disclosures. There's no deeper drill — no item detail, no focus state.

**Where I lose spatial/contextual continuity:** Every map node click. The map disappears; you're on a new page with no visual connection to the space you were just in.
**Where the product becomes a normal web page:** Every section page. They're well-designed pages, but they're pages, not rooms in a space.
**Where I know what to do next:** On section pages, the add forms are clear. On the map, the nodes invite clicking. But after clicking, I'm in a new context with no breadcrumb back to the map.

### Someone wanting to write or change something

You can write a journal note (localStorage only). You can add an interest draft (localStorage). You can send a chat message (real, via ollama). But you can't write a journal entry to the server (API-006 exists, not wired). You can't approve a proposal. You can't set an intent or record a fact.

**Where I'm forced to hold state in my own memory:** I have to remember that my "journal notes" are device-only, not the real journal. I have to remember that interest drafts are local until I click "Save to your world." I have to remember which data is server-backed and which is browser-only.

### Someone asking the companion for help

The companion orb opens a chat dock. You talk to ollama. The assistant gets a rich world context (from `chat_context.py`) — but it doesn't know what page you're on, because `chat.js` doesn't call `build_ui_context()`. The assistant can tell you about your world (the chat history shows it summarizing journal/interests/projects state), but it can't contextualize its answer to the page you're viewing.

**Where it feels alive:** The chat exchange. The assistant's summary of your world state is genuinely useful.
**Where it feels static:** Everywhere else. The companion orb sits in the corner and doesn't change. It doesn't greet you when you arrive at a section. It doesn't comment on what you're looking at.

### Someone using only a keyboard

Skip link works. Tab reaches all controls. The map nodes are buttons. Arrow keys can nudge node positions. Search (Ctrl+K) is a full ARIA combobox. Esc closes dialogs.

**Where it respects my attention:** Keyboard accessibility is genuine and enforced.
**Where it unnecessarily demands it:** Nothing. This is the strongest part of the product.

### An agent trying to understand current world state

An agent can call `/api/status`, `/api/sections`, `/api/manifest`, `/api/journal`, `/api/proposals`, `/api/chat/history` directly. But from the Station's JavaScript, the only structured surfaces are `window.PW_MAP_API` (the map's internal tree with no real data), `window.PW_API` (the API client), and `window.PW_REAL_DATA` (the provider layer). There is no `window.PW_WORLD_STATE` or equivalent.

**Can an agent get the current world state?** Via API, yes. Via the Station's JavaScript, no.
**Can it determine current section?** No — the Station doesn't export this.

### Where does the product feel alive vs static?

**Alive:** The chat exchange. The Needs-you panel (when it has real data). The search/quick-jump. The map's visual design (orbs, glow, drift) — but this is visual life, not informational life.
**Static:** The map's data (empty). The companion's presence (fixed orb, no contextual behavior). The section pages (static lists, no item detail). The world model (invisible).

### Where does it feel personal vs generic?

**Personal:** The companion selection. The map's user-draggable positions. The mood tinting. The theme system. The Fraunces display face.
**Generic:** The section page layouts. The technical disclosures. The Needs-you panel copy. The empty states.

---

## Part 3 — Data inventory

### Journal
```
AUTHORITATIVE SOURCE: Journal (journal.py) → SQLite/JSON file in data_dir
FRESHNESS: real timestamps (ISO 8601)
READ/WRITE: READ via API-005 (GET /api/journal); WRITE via API-006 (POST /api/journal, gate: none)
CURRENT CONSUMERS: real-data.js renderJournal()
CURRENT UI SURFACE: journal.html (data-rd-journal="12")
PROVENANCE AVAILABLE? Yes (source, observed_at, provider, authority per entry)
CAN BE UNKNOWN? Yes (empty is valid)
CAN AN AGENT READ IT? Yes (GET /api/journal)
CAN AN AGENT ACT ON IT? Yes (POST /api/journal, gate: none; supersede: gate: step-up)
```

### Interests
```
AUTHORITATIVE SOURCE: discovery capability → API-051
FRESHNESS: real
READ/WRITE: READ via API-051-get; WRITE via API-051-add (gate: step-up)
CURRENT CONSUMERS: interests-view.js, interests.html inline script
CURRENT UI SURFACE: interests.html
PROVENANCE AVAILABLE? Partial (followed-since timestamp)
CAN BE UNKNOWN? Yes (not_configured is valid)
CAN AN AGENT READ IT? Yes
CAN AN AGENT ACT ON IT? Yes (API-051-add, gate: step-up)
```

### Projects / Source Control
```
AUTHORITATIVE SOURCE: Git (read-only) via source_control.py; agent-sync for publication state
FRESHNESS: real (last_commit_date)
READ/WRITE: READ via API-033/034; WRITE via API-035 (gate: step-up, not wired in UI)
CURRENT CONSUMERS: projects-view.js
CURRENT UI SURFACE: projects.html
PROVENANCE AVAILABLE? Yes (branch, revision, remote, dirty, ahead/behind)
CAN BE UNKNOWN? Yes (not_configured if no search paths)
CAN AN AGENT READ IT? Yes
CAN AN AGENT ACT ON IT? Yes (API-035 refresh, gate: step-up; but decision says chat may NOT mutate)
```

### Reminders
```
AUTHORITATIVE SOURCE: scheduler.py → data file
FRESHNESS: real (created_at timestamp)
READ/WRITE: READ via API-067-get; WRITE via API-067-add (gate: step-up)
CURRENT CONSUMERS: real-data.js needsYou()
CURRENT UI SURFACE: index.html (Needs-you panel)
PROVENANCE AVAILABLE? Minimal
CAN BE UNKNOWN? Yes
CAN AN AGENT READ IT? Yes
CAN AN AGENT ACT ON IT? Yes (add: gate: step-up)
```

### Proposals
```
AUTHORITATIVE SOURCE: proposal system (pending → approved → executed)
FRESHNESS: real (created_at)
READ/WRITE: READ via PROP-list; WRITE via approve/reject/execute (gate: step-up/proposal)
CURRENT CONSUMERS: real-data.js needsYou()
CURRENT UI SURFACE: index.html (Needs-you panel, read-only)
PROVENANCE AVAILABLE? Yes (type, status, reason, proposed_text)
CAN BE UNKNOWN? Yes
CAN AN AGENT READ IT? Yes
CAN AN AGENT ACT ON IT? Yes (approve/reject/execute, gate: step-up) — NOT WIRED IN UI
```

### Services / Lab State
```
AUTHORITATIVE SOURCE: lab CLI → /api/lab/state, /api/lab/health
FRESHNESS: real
READ/WRITE: READ only
CURRENT CONSUMERS: NONE (Station doesn't consume)
CURRENT UI SURFACE: NONE
PROVENANCE AVAILABLE? Yes
CAN BE UNKNOWN? Yes (unavailable if lab CLI absent)
CAN AN AGENT READ IT? Yes
CAN AN AGENT ACT ON IT? No (read-only in UI)
```

### Companion / Chat
```
AUTHORITATIVE SOURCE: chat.py + chat_registry.py → ollama provider
FRESHNESS: real
READ/WRITE: READ (history, providers); WRITE (POST /api/chat, gate: none)
CURRENT CONSUMERS: chat.js
CURRENT UI SURFACE: chat.html + mini dock on every page
PROVENANCE AVAILABLE? Yes (provider name in history)
CAN BE UNKNOWN? Yes (not_configured)
CAN AN AGENT READ IT? Yes
CAN AN AGENT ACT ON IT? Yes (POST /api/chat) — but UI context (build_ui_context) not sent
```

### Settings / Preferences
```
AUTHORITATIVE SOURCE: prefs.py → data file
FRESHNESS: real
READ/WRITE: READ via API-030-get; WRITE via API-030-put (gate: step-up)
CURRENT CONSUMERS: real-data.js renderPreferences()
CURRENT UI SURFACE: settings.html
PROVENANCE AVAILABLE? Yes (binding table in PREF_BINDING)
CAN BE UNKNOWN? Yes
CAN AN AGENT READ IT? Yes
CAN AN AGENT ACT ON IT? Yes (PUT /api/prefs, gate: step-up)
```

### World Model (Facts, Intents, Policies, Lore)
```
AUTHORITATIVE SOURCE: world.py → world.json
FRESHNESS: real
READ/WRITE: READ via /api/status; WRITE via world_write (gate: step-up)
CURRENT CONSUMERS: NONE (Station doesn't surface)
CURRENT UI SURFACE: NONE
PROVENANCE AVAILABLE? Yes (every object carries provenance)
CAN BE UNKNOWN? Yes (empty world is valid)
CAN AN AGENT READ IT? Yes (/api/status, /api/daily)
CAN AN AGENT ACT ON IT? Yes (world_write, gate: step-up)
```

### Sections (Canonical Registry)
```
AUTHORITATIVE SOURCE: sections.py → /api/sections
FRESHNESS: real (per-section status from capability health)
READ/WRITE: READ via /api/sections; WRITE via PUT /api/sections (gate: step-up)
CURRENT CONSUMERS: NONE (Station uses hardcoded sections.js)
CURRENT UI SURFACE: NONE (Station doesn't consume)
PROVENANCE AVAILABLE? Yes (status per section)
CAN BE UNKNOWN? Yes (not_configured is valid)
CAN AN AGENT READ IT? Yes
CAN AN AGENT ACT ON IT? Yes (PUT /api/sections, gate: step-up)
```

### Actors (Connected Components)
```
AUTHORITATIVE SOURCE: registry.py → /api/actors
FRESHNESS: real
READ/WRITE: READ only
CURRENT CONSUMERS: NONE (Station doesn't consume)
CURRENT UI SURFACE: NONE
PROVENANCE AVAILABLE? Yes (name, role, provider, capabilities, status, writes)
CAN BE UNKNOWN? Yes
CAN AN AGENT READ IT? Yes
```

### Tools (Brain Tool Registry)
```
AUTHORITATIVE SOURCE: tool_registry.py → /api/tools
FRESHNESS: real
READ/WRITE: READ only (tools are used by chat assistant, not directly)
CURRENT CONSUMERS: NONE (Station doesn't surface, but chat backend uses tools internally)
CURRENT UI SURFACE: NONE
PROVENANCE AVAILABLE? Yes (capability, operation, read_write, available, requires_step_up)
CAN AN AGENT READ IT? Yes
CAN AN AGENT ACT ON IT? Through chat (assistant calls tools), not directly from UI
```

### Data synthesis

**1. Which available truths never reach the map?**
- Section health/attention status (`/api/sections` — 9 sections with real status)
- World model state (facts, intents, policies, lore — `/api/status`)
- Today/daily summary (`/api/daily`)
- Lab/infrastructure health (`/api/lab/*`)
- Connected actors (`/api/actors`)
- Available tools (`/api/tools`)
- Memory search results (`/api/memory/search`)

**2. Which map states are currently static or specimen-backed?**
All of them. The `ATTN` object hardcodes `projects: 1, journal: 1`. The `DEFAULT_TREE` children have `activity: '', provenance: '', rec: ''`. The map reads from `sections.js` (static config), not from `/api/sections` (live status).

**3. Which data could make the map meaningfully alive today without new infrastructure?**
- `/api/sections` → per-node health status (healthy/not_configured/unavailable)
- `/api/journal` → recent activity count per journal
- `/api/proposals` + `/api/reminders` → already fetched by real-data.js but not fed into the map
- `/api/source-control/status` → repo health (already fetched by projects-view.js but not fed into map)
- `/api/chat/history` → recent conversation count
- `/api/status` → world summary (fact count, intent count, lore count)

**4. Which data would be misleading if surfaced without better freshness/provenance?**
- World model (0 facts, 0 intents, 0 policies, 0 lore) — showing "empty" is honest but could feel discouraging without context
- Lab state (unavailable) — needs to say "not set up" not "broken"

**5. Which useful relationships between domains can already be computed?**
- Journal entries from chat → the assistant already creates journal entries when you talk to it
- Project dirty state → proposals could be generated from git diffs
- Section status → the map could show which sections need attention (already computed by `/api/sections`)
- Chat history → could provide context for the companion's greeting

**6. What is genuinely missing versus merely unwired?**
- Unwired: section status → map, world model → any UI surface, Today, Lab, Vault, Media, proposal actions, journal write, UI context to chat, agent participation surface
- Genuinely missing: Level 3 (item-level detail/focus), inline section expansion (staying in the map space), contextual companion (per-section personality/context), agent-readable world state object

---

## Part 4 — The map

**1. What question is the map supposed to answer?**
"What is the state of my world, and where should I pay attention?"

**2. What question does it answer today?**
"Where can I navigate to?" — it's a link directory with nice graphics.

**3. If all labels were removed, would node behavior communicate anything meaningful?**
No. All nodes look the same (same size, same glow, same color per section). The only differentiator is the icon and label. The `ATTN` hardcodes attention on 2 nodes, but this is specimen data. If real attention data were wired, the orb size/glow/ring would carry meaning — but currently it doesn't.

**4. Which visual variables have semantic meaning?**
- Color (per-section identity) — semantic but arbitrary (decorative, since section identity is in the label)
- Position (organic spiral, user-draggable) — personal spatial arrangement, no semantic meaning
- Size (mass function based on child count) — would be semantic if nodes had children, but all children are `[]`
- Glow/ring (attention indicator) — would be semantic if `ATTN` were real, but it's hardcoded specimen

**5. Which are decorative only?**
- Orbit rings (decorative `span.orbit`)
- SVG thread lines (decorative, no real relationships)
- Drift animation (ambient motion, opt-in)
- Star field background (atmosphere)
- Conic gradient scan lines (decoration)
- Graticule (decoration)

**6. Can activity, recency, health, attention, and uncertainty be represented without clutter?**
Yes — the infrastructure exists in CSS (`.node.attn`, `--nscale`, the info strip) but is not wired to real data. Activity could be a text count in words. Recency could be a subtle age indicator. Health could use the existing chip vocabulary. Attention already has the grow+ring+words pattern. The key constraint is: status is always in words, never color-alone.

**7. What belongs at map depth versus section depth?**
Map depth: section identity, health/attention status, recent activity summary, navigation.
Section depth: item lists, add forms, item detail, write actions.

**8. What should happen when a node is selected?**
Currently: navigate to a separate page (loses the map). Should: open the section inline (panel/drawer), keeping the map visible, so spatial context is preserved. Or: expand the node to show its contents inline.

**9. What should remain visible while deeper content opens?**
The map. The breadcrumb. The companion orb. The topbar with region indicator.

**10. How should the map change when there is nothing to do?**
All nodes at rest. No attention rings. The info strip says "nothing needs you" (already implemented). The ambient egg (companion visit) adds life. This is already the design — it just needs real data to know when "nothing to do" is true.

**11. How should it change when something genuinely needs attention?**
The needy node grows slightly (existing `--nscale`), gets a status ring (existing `.node.attn`), and the info strip names it in words (existing `needsWords`). The Needs-you panel lists the items. This is all implemented — it just needs real `ATTN` data from `/api/proposals` + `/api/reminders` + per-section status.

**12. What should an agent be able to read from the same map state?**
A structured object: `{ sections: [{ id, label, status, attention_count, last_activity }], current_section, path, world_summary: { facts, intents, policies, lore } }`. This doesn't exist — the only surface is `PW_MAP_API` (the map's internal tree, which has no real data).

**13. What should an agent be able to contribute without becoming authoritative?**
Suggestions (display in the companion, not in canonical state), observations (fed to lore as `ephemeral` or `suggested`, never `confirmed`), navigation hints (request focus on a node, don't force it). The proposal system already provides the bounded write path — agents can propose, but only the human approves.

### Candidate Map State model

```javascript
MapState {
  sections: [
    {
      id: string
      label: string
      status: "healthy" | "needs_attention" | "unavailable" | "stale" | "unknown" | "not_configured" | "disabled"
      statusLabel: string  // plain-language word
      attentionCount: number  // items needing the user
      attentionItems: [{ kind: "proposal" | "reminder", title: string }]  // bounded
      lastActivity: { summary: string, iso: string } | null
      configured: boolean
    }
  ]
  worldSummary: {
    facts: number
    intents: number
    policies: number
    cementedPolicies: number
    lore: { confirmed: number, derived: number, suggested: number, ephemeral: number }
    providers: number
    capabilities: number
  }
  path: string[]  // current drill path
  currentSection: string | null
  needsYou: {
    status: string
    items: [...]
    unchecked: string[]  // sources that couldn't be checked
  }
  fetchedAt: string  // ISO timestamp
}
```

All of this is derivable from existing endpoints. No new infrastructure needed.

---

## Part 5 — Depth

```
                    LEVEL 1              LEVEL 2              LEVEL 3              LEVEL 4
                    (Glance)             (Browse)             (Engage/Focus)       (Technical)
─────────────────────────────────────────────────────────────────────────────────────────────────
Journal             Map node (no data)   List of entries      MISSING              details.tech
                                         (API-005 read)                            (source/provenance)

Projects            Map node (no data)   Repo status +        MISSING              details.tech
                                         commit history                            (API names)

Interests           Map node (no data)   List + add draft     MISSING              details.tech
                                         (API-051 + localStorage)                  (API names)

Chat                Map node (no data)   Full chat            Conversation IS      findingsHtml
                                         component            the engagement       (partial results)

Settings            Map node (no data)   Prefs + themes       PREF_BINDING table   details.tech
                                         + companion + backup (real-data.js)       (API names)

Lab                 MISSING              MISSING              MISSING              MISSING

Vault               MISSING              MISSING              MISSING              MISSING

Media               MISSING              MISSING              MISSING              MISSING

Today               MISSING              MISSING              MISSING              MISSING

Notifications       MISSING (but         MISSING              MISSING              MISSING
                    exists as /api/daily)
```

### Missing levels
Level 3 is almost entirely absent across all domains. Level 1 is present for 5 of 9 sections but carries no real data. Level 2 is present for 5 sections. Lab, Vault, Media, and Today have no levels at all.

### Jumps that are too large
From Level 2 (a list of items) to Level 4 (technical disclosure). There's no way to focus on a single item — you see a list, and if you want more, you get raw API endpoint names. The interesting middle — "tell me about this one journal entry, this one commit, this one interest" — doesn't exist.

### Smallest reusable Level 3 pattern

A **focus drawer** that opens inline when you select an item from a Level 2 list. It shows:
- The item's full content/summary
- Its provenance (when, from where, by what authority)
- Its classification (world/private)
- Available actions (approve, edit, supersede — gated appropriately)
- The companion's contextual observation (if any)

This pattern works for journal entries, commits, interests, proposals, reminders — anything that has a title, provenance, and optional actions. It doesn't require a new page; it opens as a non-modal drawer (per accessibility contract §3.4).

---

## Part 6 — The companion

**1. Is it primarily identity, navigation, chat, agent, narrator, guide, or something else?**
Currently: it's **identity** (a selected silhouette) and **chat** (opens a dock). It is not a guide (doesn't contextualize to the page), not a narrator (doesn't explain what's on screen), not an agent (can't suggest or observe), not navigation (doesn't move you through the world).

The design intent (COMPANION_INTEGRATION.md) is much richer: personal companion (persistent) + contextual character (per-project). The companion should be a **guide** — present in content, aware of context, able to observe and suggest.

**2. What state does it currently know?**
- Which companion is selected (localStorage `pw-station-companion`)
- Whether companions are on/off (localStorage `pw-station-companions`)
- The chat log (localStorage `pw-chat-log`, last 50 messages)

**3. What state should it know?**
- Current section/page (from `build_ui_context`)
- Current world summary (from `/api/status`)
- Recent journal events (from `/api/journal`)
- Pending proposals and reminders (from real-data.js)
- Section health (from `/api/sections`)
- Chat history (from `/api/chat/history`)

**4. What state must it never invent?**
- World facts, intents, policies (only the human or approved proposals can set these)
- Lore state (can suggest as `ephemeral`, never `confirmed`)
- Capability health (must use real status vocabulary, never guess)
- Provenance (must trace to a real source)

**5. Is companion identity persistent across surfaces?**
Yes — `pw-station-companion` localStorage persists across all pages. The orb appears on every page via `station.js injectChrome()`.

**6. Does the companion have context about the current section/item?**
No. `chat.js` sends `{message, history}` to `/api/chat`. It does not send route, section, entity, or section_status. The backend has `build_ui_context()` ready to accept this, but the frontend doesn't call it.

**7. Can it explain why it knows something?**
The chat backend assembles a world context (from `chat_context.py`) that includes provenance — "journal entries from API-005", "capability status from registry", "projects from agent-sync observation". The assistant can reference these. But the Station's chat UI doesn't surface this provenance — the `findingsHtml` disclosure shows partial tool results, not the full context provenance.

**8. Can another agent participate through the companion safely?**
Not currently. There's no mechanism for an external agent to push suggestions, observations, or navigation hints into the companion. The chat endpoint accepts messages, but there's no "agent contribution" channel.

**9. What is the difference between system fact, companion observation, companion interpretation, suggestion, action, decision?**

Currently in the codebase:
- **System fact:** World Fact (model.py) — has provenance, classification, requires explicit write
- **Companion observation:** Doesn't exist as a concept — the assistant can reference world state in chat, but observations don't persist
- **Companion interpretation:** Doesn't exist — the assistant answers from the world context but interpretations aren't stored
- **Suggestion:** Exists as Lore state `suggested` (model.py) — can be promoted to `confirmed` only by human action
- **Action:** Exists as JournalKind (observation, provider_action, etc.) — actions are journaled
- **Decision:** Exists as Policy (model.py) — `cemented` policies can only be changed by `UserAction`

The distinctions exist in the domain model. They just aren't surfaced in the UI.

**10. How should those distinctions be represented structurally?**

The existing domain model already has the right structure:
- System facts → `Fact` (provenance: observed/reported)
- Companion observations → `Lore` state: `ephemeral` (provenance: `source: "companion"`)
- Companion interpretations → `Lore` state: `suggested` (provenance: `source: "companion"`, `derivation: "..."`)
- Suggestions → `Lore` state: `suggested` (same as above)
- Actions → `JournalEvent` (kind: `provider_action`)
- Decisions → `Policy` (mutability: `cemented`)

The promotion path (ephemeral → suggested → confirmed) is the bounded channel for companion observations becoming canonical truth.

### Companion Context contract

```javascript
CompanionContext {
  identity: {
    who: string  // "mermaid" | "ratatoskr" | "robot" | "burrito" | "personal-world"
    label: string
    color: string  // CSS var
  }
  location: {
    route: string | null
    sectionId: string | null
    sectionLabel: string | null
    sectionStatus: string | null
    selectedEntity: string | null
  }
  world: {
    summary: { facts, intents, policies, lore }
    needsYou: { status, count, items }
    recentJournal: JournalEvent[]
  }
  history: {
    chatLog: { role, content }[]
    lastInteraction: string | null  // ISO timestamp
  }
}
```

This is a **derived, read-only projection** — never canonical truth. The companion reads it; never writes it. The backend's `build_ui_context()` + `build_world_context()` already construct most of this.

---

## Part 7 — Agent participation

**1. Can an agent get the current world state?**
Yes, via `/api/status`. But not from the Station's JavaScript — there's no `window.PW_WORLD_STATE`.

**2. Can it determine current section and selected object?**
Not from the Station. The map knows `path[]` and `current` internally (`PW_MAP_API`), but there's no structured export of "what section am I on, what item is selected."

**3. Can it discover available actions?**
Via `/api/tools` (the brain tool registry), but the Station doesn't surface this. An agent would need to call the API directly.

**4. Can it understand provenance/freshness?**
Via the API envelopes — every response carries `source`, `fetchedAt`, `status`, `label`. But the Station's JavaScript doesn't expose these to external readers.

**5. Can it suggest something without mutating canonical state?**
Yes — the Lore system supports `ephemeral` and `suggested` states. An agent could push a suggestion as `ephemeral` lore, which would appear but never be canonical. But there's no UI surface for displaying suggestions from agents.

**6. Can it request navigation?**
No. There's no `PW_NAVIGATE(sectionId)` or equivalent. The map's navigation is purely user-driven (click handlers).

**7. Can it contribute an observation to the companion?**
No. There's no channel for an agent to push content into the companion's presence or chat.

**8. Can it distinguish suggestion from decision?**
In the domain model, yes (Lore states, Policy mutability). In the UI, no — there's no visual or structural distinction between "the companion noticed" and "the world decided."

**9. Can multiple agents participate without overwriting one another?**
The backend supports it (per-principal scope, proposal system). The Station doesn't — there's no agent identity or participation channel.

**10. Can all of this work without coupling to a specific model/provider?**
Yes — the backend's provider/adapter architecture means any chat provider can participate. The Station's `chat.js` is provider-agnostic (it just calls `/api/chat`). The missing piece is the participation *surface* — a channel that isn't chat-specific.

### Smallest stable machine surface

```javascript
// Read-only world state (derived from existing endpoints)
window.PW_WORLD_STATE = {
  sections: [{ id, label, status, statusLabel, configured, attentionCount }],
  worldSummary: { facts, intents, policies, lore, providers, capabilities },
  needsYou: { status, count, items, unchecked },
  currentSection: string | null,
  selectedEntity: string | null,
  fetchedAt: string
}

// Agent participation channel (bounded, non-authoritative)
window.PW_SUGGEST = function(channel, content) {
  // channel: "observation" | "suggestion" | "navigation" | "context"
  // content: { summary, detail?, provenance?, priority? }
  // → dispatches a 'pw:suggest' event that the companion/map can listen to
  // → never mutates canonical state
  // → suggestions are ephemeral, visible until dismissed
}

window.PW_NAVIGATE = function(sectionId, entityId?) {
  // requests the map to focus on a section and optionally an entity
  // → dispatches a 'pw:navigate' event
  // → does not force navigation if the user is mid-action
}
```

These are **adapters**, not canonical truth. They read from the same API endpoints the UI reads from. They dispatch events that the UI can choose to honor or ignore. They never write to canonical state. An agent using these would be a **bounded participant**, not an authority.

Browser globals or JavaScript event channels may be adapters, but should not become canonical truth by accident. The canonical truth lives in the backend data stores. These surfaces are derived projections, clearly labelled as such.

---

## Part 8 — The voice

### Representative copy classified

```
"Nothing needs you right now. Both sources were checked just now — this is verified, not assumed."
  → SYSTEM FACT (clinical, precise)

"A dirty tree is information, not an emergency."
  → HUMAN EXPLANATION (warm, but still instructional)

"I've been floating here, thinking about nothing in particular. What's on your mind?"
  → COMPANION VOICE (warm, inviting)

"Your world is all still here, exactly where you left it."
  → COMPANION VOICE (warm, reassuring)

"sources: PROP-list GET /api/proposals · API-067-get GET /api/reminders"
  → TECHNICAL DETAIL

"No assistant is connected yet. This world has Ollama bundled — once a model is pulled, the assistant will answer."
  → WARNING + HUMAN EXPLANATION (honest, helpful)

"Add something when you are ready — or don't. Both are fine."
  → COMPANION VOICE (warm, permissive)

"every write goes: observe → diff → propose → approve → act → re-observe"
  → TECHNICAL DETAIL

"Show me my world ✦"
  → ACTION (direct, warm)

"Pick a mood, or just talk."
  → COMPANION VOICE (inviting)
```

### Voice analysis

**1. Where is the product too clinical?**
The Needs-you panel and the info strip. "Map note: illustrative specimen data — real sources fill this in as they connect" reads like a developer comment, not a companion. The `details.tech` disclosures are intentionally technical (correct), but the Level 2 surfaces above them adopt the same clinical tone.

**2. Where is it too whimsical?**
The ✦ symbol appears in too many places — it loses meaning. "Both are fine. ✦" and "Add ✦" and "Send ✦" — the sparkle is everywhere, so it signals nothing.

**3. Where does warmth conceal precision?**
"Your world is all still here, exactly where you left it." — This is warm but potentially misleading if the data is stale. The Needs-you panel is precise; this companion-voice follow-up doesn't carry the same timestamp/freshness information.

**4. Where does precision unnecessarily sound mechanical?**
"illustrative specimen data — real sources fill this in as they connect" — This is a developer talking to a user. The user doesn't need to know about "specimen data" or "real sources connecting." They need to know: "This is a preview. Your real data will appear here when you connect sources."

**5. Where is companion voice being used where neutral system language would be safer?**
The low-demand block: "Your world is all still here, exactly where you left it. Whenever you are ready, the map is waiting." This is companion voice for a system fact (your data persists). If the data were actually stale or partially unavailable, this warmth would be misleading.

**6. Where could companion voice make the experience meaningfully warmer?**
The Needs-you empty state. The map info strip. The section page headers. The settings labels. These are all currently SYSTEM FACT or TECHNICAL DETAIL. A companion voice layer (clearly separated from system facts) could warm them without losing precision.

### Voice model

```
TECHNICAL LAYER (Level 4 only, inside details.tech)
  → Clinical, precise, names endpoints and commands
  → No companion voice here

SYSTEM FACT LAYER (status, counts, provenance)
  → Neutral, precise, carries timestamps and source names
  → "2 proposals waiting for your decision"
  → "checked 4 minutes ago"
  → Never warm, never reassuring, never speculative

COMPANION LAYER (greetings, observations, suggestions, empty-state copy)
  → Warm, personal, uses the selected companion's voice
  → "Everything's quiet. Your world is here when you're ready."
  → "You haven't journaled in a few days — no pressure."
  → Never states system facts (defers to the system fact layer)
  → Never carries provenance or timestamps (defers to the system fact layer)

ACTION LAYER (buttons, links, form labels)
  → Direct, imperative, short
  → "Show me my world" / "Save" / "Add" / "Talk"
  → Warm but not chatty
```

---

## Part 9 — Original intent (durable ideas across iterations)

### FOUNDATIONAL (survived multiple redesigns, enforced by tests, stated in decisions)

1. **Capabilities are core-owned; providers are optional** (ADR-0001, 2026-09-06). The core survives without any provider. Enforced by `test_framework.py`. This is the most durable idea in the project.

2. **Truth before reassurance.** Status is always in words. No fake data. Honest empty/unavailable/not-configured states. Enforced by e2e tests (`station-honest-states`, `station-lang-truth`) and the `SPECIMEN_REMAINING` register.

3. **The world is quiet when healthy.** Healthy systems don't demand attention. The Needs-you panel is the only thing that may interrupt. Enforced by the low-demand mode and the attention model.

4. **Provenance is non-negotiable.** Every fact, intent, policy, lore, journal entry carries provenance. Enforced by `model.py` (Pydantic models require `Provenance`).

5. **Markdown-first durable memory.** Files are canonical. Semantic search and caches are acceleration layers. Enforced by the storage layer (JSON/NDJSON files, not a database).

6. **Accessibility is architecture.** 44px floor, WCAG AA, reduced-motion default, skip link, keyboard-only operation. Enforced by CSS, e2e tests, and the accessibility contract.

7. **Progressive disclosure.** Level 1 comprehensible alone; Level 4 always reachable. Enforced by the `details.tech` pattern and the e2e tests.

8. **The proposal system.** Every write goes: observe → diff → propose → approve → act → re-observe. Agents can propose; only humans approve. Enforced by the gate system in `api.py`.

9. **The Station is the product UI** (decision #12). Same-origin serving, no framework, no build step. Enforced by `station_ui.py` and the test suite.

10. **V1 has no current design authority** (D-003). The old React SPA's visual architecture must not constrain the Station. Workshop v3 wins. This is the decision that authorized the Station redesign.

### REPEATED BUT UNRESOLVED

1. **Contextual chat.** The Finish Line says "chat is a contextual layer across sections." The companion integration doc describes per-section companion identity. The backend has `build_ui_context()`. But the Station's chat doesn't send UI context. This has been mentioned in every handoff since September 7.

2. **The map carrying real data.** Every handoff mentions that the map should show real activity/attention. The `ATTN` object and the info strip are wired but feed from hardcoded specimen data. The `real-data.js` layer fetches the real data but doesn't feed it into the map.

3. **Today.** The Finish Line names "Today" as capability #1. The backend has `/api/daily`. The old React SPA had a Today screen. The Station has no Today. This is the largest missing surface.

4. **The world model surfaced.** Facts, intents, policies, lore — the domain model is rich, but the Station shows none of it. The world is empty (0 of everything), but even if it were populated, there's no UI to see it.

5. **Agent participation.** The docs mention agents as participants. The proposal system supports agent-proposed writes. But there's no agent-readable surface in the Station.

### EXPERIMENTAL

1. The ambient companion egg (45-second random visit) — cute but not meaningful. Could become a real "the companion noticed something" surface.

2. The mood tinting (region color override) — atmospheric but not semantic. Could become a real context indicator.

3. The "Shape this map" editor — powerful but organizing empty nodes. Will be meaningful when nodes have real content.

### SUPERSEDED

1. The React SPA (removed 2026-09-16). V1 visual architecture has no authority (D-003).
2. The old 7-constellation map (reduced to 5, then should be 9 from the backend registry).
3. The old "Distress Call" button name (renamed to "Cruising speed").

### ACCIDENTAL

1. The `sections.js` file — created as a shared config between the map and topbar, but it should read from `/api/sections` (the canonical registry). It's a local copy of a subset of the backend's section list, and they've already diverged (5 vs 9 sections).

2. The `ATTN` hardcoded object — specimen data that was never replaced with real data. It's not a design decision; it's a placeholder that was never wired.

3. The localStorage-based preference system — `pw-station-*` keys save density, theme, motion, companions, mood, demand locally. The backend has `/api/prefs` with a schema. The `PREF_BINDING` table honestly documents that most of these don't sync. This is a known gap, not a design decision.

---

## Part 10 — Synthesis

### 1. The Point

Project Worlds is a personal operating environment: one place where your information, tools, assistant, history, and capabilities come together naturally, with sophisticated machinery staying out of your way until you need it. It is not a dashboard, not a chatbot, not a portal. It is a **world** — a small, durable, honest space that knows your state, carries your history, hosts your assistant, and stays quiet when nothing needs you. The architecture is a stable core (facts, intents, policies, lore, journal, capabilities) with replaceable providers underneath. The Station is its face: a semantic star map where your world's regions appear as constellations you drift toward, where truth comes before reassurance, and where an assistant who understands your world is always present but never demanding.

### 2. The Promise

> **When the Station is working perfectly, a person can** arrive, see at a glance whether anything needs attention, drift toward the thing that interests them, engage with it deeply, ask their companion for help in the context of what they're looking at, trust that what they see is real and current, and leave knowing their world will be exactly as they left it — quiet when healthy, honest when not, warm without lying.

> **An agent participating well can** read the world's current state, understand where the person is and what they're looking at, suggest observations that appear as ephemeral contributions (never as decisions), propose actions that go through the same approval workflow as everything else, and navigate alongside the person without overwriting their intent — a bounded participant in a shared world, not a silent operator or a chatty assistant.

### 3. The Product Grammar

Derived from the actual domain model:

```
WORLD      — the durable structured state (facts, intents, policies, lore)
SECTION    — a region of the world with a capability and a status
THING      — an item in a section (journal entry, interest, commit, proposal)
STATE      — the health of a thing or section (always in words)
ATTENTION  — what needs the person right now (always bounded, always honest)
HISTORY    — what happened, when, and why (journal, audit, provenance)
PROVENANCE — who observed this, when, and with what authority
COMPANION  — who is present, what they know, what they suggest
ACTION     — a deliberate change (propose → approve → act → observe)
```

Everything in the product should compose from these. The map shows SECTIONS with STATE and ATTENTION. Section pages show THINGS with HISTORY and PROVENANCE. The companion knows STATE, ATTENTION, and HISTORY, and can offer suggestions via ACTION. An agent reads WORLD and SECTION state, suggests via COMPANION, and acts via ACTION.

### 4. Where Reality Falls Short

#### FOUNDATIONAL GAPS

1. **The Station doesn't consume the canonical section registry.** It has its own 5-section `sections.js` instead of reading from `/api/sections` (9 sections with real status). This means the map can't show real section health, can't surface Today/Media/Lab/Vault, and can't stay in sync with the backend's section model. **This is the root cause of the map feeling dead.**

2. **The map has no real data binding.** The `ATTN` object is hardcoded specimen. The `real-data.js` layer fetches real proposals, reminders, journal, and prefs — but doesn't feed any of it into the map. The bridge between the data layer and the map doesn't exist.

3. **Chat doesn't send UI context.** The backend has `build_ui_context()` ready to accept route, section, and entity. The frontend doesn't send it. The assistant can't contextualize its answers to the page you're on.

4. **The world model is invisible.** Facts, intents, policies, lore — the richest part of the domain model — has no UI surface. You can't see what your world knows. You can't set an intent. You can't see a policy. You can't browse lore.

5. **No agent participation surface.** There's no `PW_WORLD_STATE`, no `PW_SUGGEST`, no `PW_NAVIGATE`. An agent can call the API directly, but can't participate in the UI alongside the human.

#### EXPERIENCE GAPS

6. **Level 3 (engage/focus) is missing.** Every domain jumps from list (Level 2) to technical disclosure (Level 4). There's no way to focus on a single item.

7. **Navigation is page-based, not spatial.** Clicking a map node navigates to a new page. The map vanishes. Spatial context is lost. The product becomes six separate web pages instead of a world.

8. **Four sections are missing.** Today, Media, Lab, Vault — all have backend support, all have canonical section entries, all are absent from the Station.

9. **The companion is decorative, not contextual.** It doesn't change per section. It doesn't know what page you're on. It doesn't appear inside content. It's a fixed orb that opens a context-free chat.

10. **Proposal actions aren't wired.** The Needs-you panel shows proposals read-only. You can't approve, reject, or execute them from the Station.

#### POLISH GAPS

11. The ✦ symbol is overused and has lost meaning.
12. The copy is clinical where it could be warm (without losing precision).
13. The "Cute Pass" CSS is decorative warmth, not interactional warmth.
14. The onboarding mentions "seven constellations" but there are 5 (and should be 9).

### 5. The Living-World Model

```
AUTHORITATIVE SOURCES (backend)
  /api/sections          → section identity + status
  /api/status            → world summary (facts, intents, policies, lore)
  /api/journal           → recent history
  /api/proposals         → pending decisions
  /api/reminders         → active reminders
  /api/source-control/*  → repo health
  /api/chat/history      → conversation transcript
  /api/chat/providers    → assistant availability
  /api/prefs             → preferences
  /api/actors            → connected components
  /api/tools             → available actions
  /api/daily             → today summary
  /api/lab/*             → infrastructure health
                    ↓
WORLD STATE (derived, read-only)
  PW_WORLD_STATE = {
    sections: [{ id, label, status, attentionCount, lastActivity }],
    worldSummary: { facts, intents, policies, lore },
    needsYou: { status, count, items, unchecked },
    currentSection, selectedEntity, fetchedAt
  }
                    ↓
HUMAN + AGENT REPRESENTATIONS (parallel, same truth)
  Human: map nodes with real status/attention,
         section pages with item lists + focus drawers,
         companion with contextual awareness,
         proposal approve/reject/execute actions
  Agent: reads PW_WORLD_STATE,
         suggests via PW_SUGGEST (ephemeral, non-authoritative),
         navigates via PW_NAVIGATE (requests, doesn't force),
         proposes via the existing proposal system (bounded writes)
                    ↓
MAP / SECTIONS / DETAIL / COMPANION (UI surfaces)
  Map: reads PW_WORLD_STATE, shows real section health/attention
  Sections: open inline (panels/drawers), not page navigation
  Detail: focus drawer for single items (Level 3)
  Companion: reads CompanionContext (location + world + history),
             displays suggestions from agents,
             sends UI context with chat messages
```

**Canonical vs derived:**
- Canonical: backend data stores (world.json, journal, prefs, git repos)
- Derived: PW_WORLD_STATE (assembled from API reads, cached per page load)
- Never canonical: agent suggestions (ephemeral), companion observations (lore: ephemeral/suggested)

### 6. The Depth Model

```
LEVEL 1 — GLANCE (the map)
  What: all sections at a glance, with real health and attention
  How you get here: arrive at the Station
  What you see: constellation of nodes, size/glow/words carry status
  What you can do: drift toward any section, see what needs you
  How you leave: click a node → opens Level 2 inline (map contracts, doesn't vanish)

LEVEL 2 — BROWSE (the section)
  What: a section's items, honestly rendered (real data or honest empty)
  How you get here: click a map node → section opens in a panel/drawer
  What you see: item list with provenance, add form (if writable), section status
  What you can do: read items, add drafts, see the companion's contextual observation
  How you leave: click an item → opens Level 3 inline; or zoom out → back to Level 1

LEVEL 3 — ENGAGE / FOCUS (the thing)
  What: a single item in depth — full content, provenance, classification, actions
  How you get here: click an item in a Level 2 list
  What you see: the item's full text, when/where/from-whom, available actions
  What you can do: read deeply, approve/edit/supersede (if gated actions exist),
                   ask the companion about this specific thing
  How you leave: close the drawer → back to Level 2

LEVEL 4 — TECHNICAL / PROVENANCE (the disclosure)
  What: the exact API endpoint, command, and status vocabulary behind this surface
  How you get here: open the details.tech disclosure (always available)
  What you see: endpoint names, canonical vocabulary, source envelopes
  What you can do: verify, copy commands, trace provenance
  How you leave: close the disclosure → back to wherever you were
```

**Key principle:** you never lose context moving between levels. The map contracts but stays visible. The section opens as a panel, not a new page. The focus drawer opens inside the section. The technical disclosure opens inside whatever you're looking at.

### 7. The Companion Model

The companion is a **contextual guide** — present, aware, warm, but never authoritative.

**What it is:** A persistent presence (the orb) that opens a chat surface. Its identity is selected by the user and persists across pages. It changes contextual behavior based on the current section.

**What it knows (CompanionContext):**
- Its own identity (which companion, what voice)
- Where the person is (route, section, status, selected entity)
- The world's state (summary, needs-you, recent journal)
- Recent conversation (chat history, last interaction time)
- All of this is **derived, read-only** — the companion reads; it never writes.

**What it observes:** The companion can notice patterns ("you haven't journaled in a few days," "your repo is dirty," "nothing has changed since yesterday"). These observations are **ephemeral** — they appear in the companion's voice and disappear when dismissed. They never become lore without explicit human promotion.

**What it suggests:** The companion can suggest actions ("want me to draft a journal entry about today's work?"). Suggestions go through the **proposal system** — the companion proposes, the human approves. The companion never acts directly.

**What it may NOT do:**
- State system facts as if it owns them (defer to the system fact layer)
- Carry provenance or timestamps (defer to the system fact layer)
- Make decisions (only the human decides)
- Mutate canonical state (only proposals, approved by the human)
- Fabricate observations (must trace to real data)
- Become authoritative merely because it can speak

**What another agent can contribute through the companion:**
An external agent can push an observation or suggestion via `PW_SUGGEST`. These appear in the companion's voice, clearly attributed ("the lab agent noticed..."), and are ephemeral. The agent never writes to canonical state. Multiple agents can contribute without overwriting each other — each suggestion is a separate ephemeral event.

### 8. The Agent Participation Model

External agents are **bounded participants** in a shared world. They can read, suggest, and propose — but never decide, never act without approval, and never become authoritative.

**What an agent can do:**

1. **Read world state** via `PW_WORLD_STATE` — a structured, read-only JavaScript object derived from the same API endpoints the UI reads from. Never canonical; always derived.

2. **Determine current context** via `PW_WORLD_STATE.currentSection` and `PW_WORLD_STATE.selectedEntity`. The agent knows where the person is.

3. **Discover available actions** via `/api/tools` — the brain tool registry lists what the assistant can do (inspect world, search memory, propose journal entry, etc.).

4. **Suggest observations** via `PW_SUGGEST("observation", { summary, detail, provenance })`. These appear as ephemeral companion observations. Never canonical. Never announced (aria-hidden unless the companion chooses to surface them).

5. **Request navigation** via `PW_NAVIGATE(sectionId, entityId?)`. This dispatches a `pw:navigate` event. The UI may honor it (focus the node) or defer it (if the user is mid-action). The agent never forces navigation.

6. **Propose actions** via the existing proposal system. An agent calls `POST /api/proposals` with a proposed journal entry, world fact, or settings change. The proposal appears in the Needs-you panel. The human approves or rejects. This is the bounded write path — it already exists in the backend.

**What an agent may NOT do:**
- Write to canonical state directly (only via approved proposals)
- Force navigation (only request it)
- Overwrite another agent's suggestions (each is a separate ephemeral event)
- Impersonate the system (suggestions are clearly attributed to the agent, not the system)
- Escalate its own authority (step-up gates require human credentials)

**Multiple agents:** Each agent has its own identity (the backend supports per-principal scoping). Suggestions from different agents coexist as separate ephemeral events. Proposals from different agents go through the same approval queue. No agent can overwrite another's proposal — they can only propose alternatives.

**Provider independence:** The participation surface (`PW_WORLD_STATE`, `PW_SUGGEST`, `PW_NAVIGATE`) is pure JavaScript — no dependency on any specific model or provider. The chat backend routes to whatever provider is configured. The proposal system is provider-agnostic. An agent using these surfaces doesn't know or care whether the chat provider is ollama, OpenAI, or anything else.

### 9. Ten Things We Should Never Lose

1. **Honesty before warmth.** No fake data, no specimen-as-real, no "you're okay" when the system can't verify it. The status vocabulary in words. This is the product's soul.

2. **The star map as IA, not decoration.** The map is the information architecture. Sections are constellations. Navigation is drifting toward something. This metaphor is the product's identity.

3. **Quiet when healthy.** Healthy systems don't demand attention. The Needs-you panel is the only thing that may interrupt. This is the product's respect for the person's attention.

4. **Provenance on everything.** Every fact, every observation, every journal entry carries who-saw-it-when. This is the product's trustworthiness.

5. **The proposal system.** Observe → diff → propose → approve → act → re-observe. Agents propose; humans decide. This is the product's safety boundary.

6. **Accessibility as architecture.** 44px floor, WCAG AA, reduced-motion default, keyboard-only operation, skip link. This is the product's floor — never below it, ever.

7. **The stable core / replaceable machinery boundary.** Capabilities are core-owned. Providers are optional. The core survives without any provider. This is the product's durability.

8. **The companion is never authoritative.** It suggests, observes, and guides — but never decides, never mutates, never impersonates the system. This is the product's epistemic discipline.

9. **Progressive disclosure.** Level 1 comprehensible alone; Level 4 always reachable. The interesting middle (Level 3) is where engagement happens. This is the product's respect for depth.

10. **The world is personal.** This is one person's world. Not a team tool, not a SaaS dashboard, not a generic productivity app. The world knows one person's facts, intents, policies, lore, and history. This is the product's reason to exist.

### 10. Five Moves That Would Change Everything

---

**Move 1: Wire the map to the canonical section registry and real data.**

```
WHY: The map is the product's identity surface, but it reads from a hardcoded
     5-section config instead of the backend's 9-section canonical registry with
     real per-section status. This is why the map feels dead — it has no real data.

WHAT IT UNLOCKS: The map becomes the living dashboard. Each node shows real
     health (healthy/not_configured/unavailable) and real attention counts
     (from proposals + reminders). The missing sections (Today, Media, Lab,
     Vault) appear on the map as nodes with honest "not set up yet" status.
     The map and the topbar stay in sync automatically.

DEPENDENCIES: /api/sections (exists), real-data.js needsYou() (exists),
     starmap.js render() (needs to accept external state instead of ATTN).

RISK: Low. Read-only. No new infrastructure. The existing map engine already
     has the visual vocabulary for attention/health (node.attn, --nscale,
     info strip). It's just not wired to real data.

HOW WE KNOW IT WORKED: Open the Station. The map shows 9 nodes. Projects
     shows "healthy" status. Interests shows "not set up yet." The info
     strip names real attention items from proposals/reminders. The map
     changes when a proposal is created or a reminder fires.
```

---

**Move 2: Send UI context with chat messages.**

```
WHY: The backend has build_ui_context() ready to accept route, section, status,
     and entity — but chat.js sends only {message, history}. The assistant
     can't contextualize its answers. This is why the companion feels generic.

WHAT IT UNLOCKS: The companion becomes contextual. On the Projects page,
     the assistant knows you're looking at repos. On the Journal page, it
     knows you're reading entries. It can say "I see you're looking at your
     dirty repo — want me to draft a commit message?" instead of "What's
     on your mind?" This is the difference between a chatbot and a guide.

DEPENDENCIES: chat.js (add route/section/entity to the POST body),
     chat_context.py build_ui_context() (already exists),
     api.py /api/chat endpoint (already accepts these fields).

RISK: Low. Additive — the chat endpoint already supports these parameters;
     they're just not sent. No breaking change.

HOW WE KNOW IT WORKED: Send a chat message from the Projects page. The
     assistant's response references the current section. Ask "what's here?"
     and it answers about projects, not generically.
```

---

**Move 3: Expose PW_WORLD_STATE as a read-only, structured surface.**

```
WHY: There is no way for an agent to read the world's current state from the
     Station. An agent must call the API directly and reconstruct context.
     This is why agents can't participate — they have no shared surface
     with the UI.

WHAT IT UNLOCKS: An agent can read PW_WORLD_STATE.sections (which sections
     exist, their health, their attention counts), PW_WORLD_STATE.worldSummary
     (facts, intents, policies, lore counts), PW_WORLD_STATE.needsYou (what
     needs the person), and PW_WORLD_STATE.currentSection (where the person
     is). An agent can then suggest, navigate, and propose — all through
     bounded, non-authoritative channels.

DEPENDENCIES: PW_WORLD_STATE object (new, ~50 lines of JS that assembles
     from existing API reads), PW_SUGGEST() function (~20 lines, dispatches
     events), PW_NAVIGATE() function (~10 lines, dispatches events).
     No new backend.

RISK: Low. Read-only. The state object is derived from the same API reads
     the UI already makes. Suggestions are ephemeral events, not writes.
     Navigation is a request, not a command.

HOW WE KNOW IT WORKED: From the browser console, an agent (or a developer)
     can read PW_WORLD_STATE and see real section health, real needs-you,
     real world summary. Calling PW_SUGGEST("observation", {summary: "..."})
     makes the companion display the observation. Calling
     PW_NAVIGATE("projects") makes the map focus on the Projects node.
```

---

**Move 4: Open sections inline instead of navigating to new pages.**

```
WHY: Clicking a map node navigates to a completely new page. The map vanishes.
     Spatial context is lost. The product becomes six separate web pages. This
     is why the product doesn't feel like a world — it feels like a link
     directory with nice graphics.

WHAT IT UNLOCKS: The map stays visible. Sections open as panels/drawers that
     overlay or slide in beside the map. You move within a space, not between
     pages. The companion stays present. The topbar shows where you are. When
     you close the panel, the map is still there — you didn't leave.

DEPENDENCIES: The section content (already exists as separate HTML pages
     with inline scripts) needs to be loadable into a panel. The simplest
     approach: fetch the section page's HTML, extract the main content,
     render it in a drawer. No SPA refactor needed — progressive enhancement
     on top of the existing static pages.

RISK: Medium. This is the largest structural change. But it doesn't require
     a framework — fetch + innerHTML + script re-execution is vanilla JS.
     The accessibility contract (§3.4) already defines the non-modal drawer
     pattern. The risk is in script lifecycle management (re-initializing
     per-page scripts when content loads inline).

HOW WE KNOW IT WORKED: Click a map node. The map contracts but stays
     visible. The section content opens in a panel beside or over it.
     The breadcrumb updates. Close the panel — you're back at the map.
     No page reload. The companion orb stays in the corner throughout.
```

---

**Move 5: Add the focus drawer (Level 3 pattern).**

```
WHY: Every domain jumps from list (Level 2) to technical disclosure (Level 4).
     There's no way to focus on a single item — a journal entry, a commit, an
     interest. This is the most valuable depth level, and it's missing.

WHAT IT UNLOCKS: Click a journal entry → see its full text, provenance
     (when, from where, by what authority), classification (world/private),
     and available actions (supersede, if gated). Same for commits, interests,
     proposals. This is where engagement happens — where you go from browsing
     to engaging with one thing deeply. It's also where the companion becomes
     most useful — "ask me about this entry" in context.

DEPENDENCIES: A reusable focus drawer component (one pattern, used everywhere).
     The data is already available — journal entries have full content in
     the API response, commits have full diffs in the API, interests have
     notes. The drawer is non-modal (§3.4), keyboard-accessible, and opens
     inline without leaving the section.

RISK: Low-medium. Pure additive — doesn't change existing Level 2 or Level 4.
     The pattern is the same for every domain, so it's built once and reused.
     The accessibility contract already defines the drawer pattern.

HOW WE KNOW IT WORKED: In the Journal list, click an entry. A drawer opens
     showing the full entry, its provenance, and its classification. Close
     the drawer — you're back in the list. The same pattern works for commits
     in Projects, interests in Interests, proposals in Needs-you.
```

---

## Final test

If I had to explain Project Worlds to someone who had never seen it:

> Project Worlds is a personal world — one durable, honest space where your information, tools, assistant, and history live together. It is not a dashboard you visit; it is a place you inhabit. Your world's regions appear as constellations on a star map: Interests, Projects, Journal, Chat, Settings, and more. Healthy regions are quiet. When something needs you, it says so in words, and you drift toward it. An assistant who understands your world is always present — not as a chatbot, but as a companion who knows what you're looking at and can help without demanding attention. Everything carries provenance: you always know when something was observed and by whom. The machinery underneath — Git, your homelab, your assistant model — is replaceable; the world stays stable. Agents can participate as bounded contributors: they observe, suggest, and propose, but only you decide. The product is quiet when nothing needs attention, powerful when something does, deeply technical when you ask, and warm enough to feel like yours.

That doesn't sound like a dashboard, portal, chatbot, personal wiki, or generic second brain. It sounds like a **world**.
