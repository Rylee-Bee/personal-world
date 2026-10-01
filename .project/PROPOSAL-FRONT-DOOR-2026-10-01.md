# Proposal — Worlds as the universal front door (2026-10-01)

> **Status:** PROPOSED (not approved). Owner: Rylee. Drafted by Claude from a
> full backend + UI + provider-machinery inventory and an open-source survey.
> If approved, it supersedes `.project/PLAN.md` Step 1c onward and gets an ADR
> (ADR-0008) plus a `DECISIONS.md` entry. Nothing here is implemented yet.

## The idea in one paragraph

Worlds becomes a small, fast, accessible **front door that speaks APIs
natively**. You register a **provider** (any HTTP API, a Play-Nice room, later
MCP), then **list** what it offers, **query** it, **test** it, and **save** the
request. Any saved request can be **pinned as a card**. Boards of cards are
home. Your projects, interests, homelab and memory all arrive this way, as
providers, never as code Worlds must ship to boot.

## Why now: what the inventory found

| Fact | Evidence |
|---|---|
| Backend is 41.8k LOC, 228 routes; `api.py` alone is 6.1k LOC / 192 routes | wc + route grep |
| Only ~1.4k LOC of route body serves the front-door core (connections, rooms, vault, sections, manifest, status, setup, apps) | backend inventory |
| ~2.5k LOC of `discovery/` is **dead** (old candy-dispenser engine, imported by nothing) | import graph |
| ~5.3k LOC auth stack: ~1.1k needed for one owner, ~2.4k multi-user, ~1.6k OIDC | backend inventory |
| 17 UI screens; 10 are persona/feature screens (Crew, Stickers, Lore, RoughNight, Library…) | UI inventory |
| Connection test/save/schema hooks **exist but no screen uses them** | `ui/src/data/hooks.ts` |
| ~7 partial "generic HTTP" primitives, 2 provider registries that disagree, 3 approval models, 3 capability lists | provider inventory |
| No request runner, no saved requests, no OpenAPI import, no MCP client | grep |
| `rooms.py` is the one solid generic layer (registry, token-by-env-name, caching, `unreachable`/`incompatible`, receipts, idempotency) | provider inventory |

Conclusion: the bones are good; the bloat is integrations and persona
features baked into core. The fix is **one generic model replacing many
specific ones**, not a rewrite.

## The core model (four nouns)

| Noun | What it is | Stored as |
|---|---|---|
| **Provider** | `id, name, kind (http · openapi · room · mcp-later), base_url, auth {type, secret_ref}, path_prefix, tls, timeout` | `config/providers/<id>.yaml` |
| **Request** | `provider, method, path, params, headers, body, assertions[], ttl` | `config/requests/<provider>/<id>.yaml` (Bruno-style, git-diffable) |
| **Card** | `request(s) + view (stat · list · table · status · link · markdown) + mappings[] + status rule` | `config/cards/<id>.yaml` |
| **Board** | ordered cards, sections; "Home" is a board | `config/boards/<id>.yaml` |

Four verbs everywhere: **list · query · test · save**. Plus **pin**.

- **Mapping, tier 1 (no code):** Homepage-style `{path (JSONPath), label,
  format, unit, remap}` into a fixed set of accessible views. Tier 2 (later):
  sandboxed template.
- **Status rule as data:** `{path, ok:[...], warn:[...]}`. Transport failure →
  `unavailable`/`stale` with last-good time. One provider never blanks a board.
- **Room/0 is just a provider kind** whose cards and needs-you come
  pre-mapped. Existing rooms keep working unchanged.
- **Recipes:** a provider template + suggested requests + cards, as data
  (e.g. `recipes/sonarr.yaml`). Plex/Sonarr/Gitea/Project Home become
  recipes, not Python adapters. Rooms remain for things that need logic.
- **Writes** (POST/PUT/PATCH/DELETE) are `ask_first`: confirm, idempotency
  key, receipt, journal entry. One approval model, reused from rooms.

## Security boundary (non-negotiable)

- Requests go **only** to the provider's registered `base_url` + `path_prefix`;
  no redirects; size and time caps; link-local/metadata addresses blocked
  unless the provider is explicitly marked LAN.
- Credentials are **references** (`env:NAME`, `vault:name`, later OpenBao per
  ADR-0007). The server injects them; responses and logs redact them; the
  browser never sees them.
- Adding/editing providers or secrets needs step-up. Owner-only by default.
- `tests/test_public_safety.py` still gates; provider YAML in the repo carries
  examples only, real ones live in the data/config volume.

## What stays, shrinks, moves, goes

| Keep (core) | Shrink | Move out (provider/recipe/room) | Remove |
|---|---|---|---|
| rooms reader, connections, secret_resolver, vault, envelope, status, sections→boards, setup, healthz, manifest + `api` CLI, journal (as audit log), themes/tokens/kit, a11y prefs, OIDC login (owner decision) | auth (owner + agent tokens + OIDC), identity (single mode only), prefs, briefing (→ a "summary" card), backup, push | media, lab_*, reconciler, calendar, updates, deployment, source_control, github, agent_sync, project_home, traefik, discovery (live part), reminders, records, memory/recall, learning, chat + tool_registry | dead discovery engine, content_db (personal paths), crew/voice/briefing-voice/stickers/lore/theme_pack code, people/invites/helpers/roles/user, journal_gate, legacy `/station` redirects |

Art, character canon and the Station theme are **kept in the repo** (PLAN rule 6);
only their code leaves core. Target size, a rough estimate: backend ~12–15k LOC,
~40 routes; UI 4–5 screens.

## New navigation

`Home (boards) · Connect (providers, requests, recipes) · Memory · Settings`

Connect is the workshop where raw API work happens. Home shows only human-shaped
cards. That keeps AGENT_POLICY's "not an admin console" rule true for daily use.

## Phases (each one is a vertical slice with phone + desktop screenshots)

| # | Slice | Done when |
|---|---|---|
| 0 | **Decide + record.** ADR-0008, DECISIONS entry, PLAN update, tag `archive/pre-front-door`. Delete the dead discovery engine (no behaviour change) | ADR merged; pytest green |
| 1 | **Query · test · save.** `frontdoor/` backend module (providers, requests, run, test, SSRF guard, secret refs, YAML store) + Connect screen: add provider → Test → build request → Run → JSON viewer → add assertion → Save → list | You connect one real service and save a working request from your phone |
| 2 | **Pin + boards.** Cards, mapping editor (click a JSON field to map it), status rules, TTL cache + stale, Home = board. Room/0 as a provider kind | Your Home shows your real rooms + 3 pinned cards |
| 3 | **Import + recipes.** OpenAPI import → request catalogue; first 3 recipes for services you actually use | Add Sonarr (or similar) in under 2 minutes, no code |
| 4 | **The cut.** One PR per removal group, tests removed with code: persona layer → multi-user → ported providers (only after their recipe/room replacement works) | Backend and UI at target size; all gates green |
| 5 | **Memory + assistant as providers.** Journal stays core as audit; Memory/recall become a provider; chat (optional) can call saved requests as tools, replacing `tool_registry` | Memory works with all models off; chat off doesn't break anything |
| Later | MCP provider kind; tier-2 templates; sharing recipes | — |

## Invariants this must change (needs the ADR)

- `framework validate` fixes the capability set and requires each connection's
  capability to be declared. The front door needs a generic provider kind →
  ADR-0008 amends ADR-0001 (capabilities stay for the few built-ins; providers
  no longer need a hard-coded capability).
- `/api/lab/*` etc. are a declared API-only product contract; removing them is a
  product decision (yours) in phase 4.
- room/0 is pinned upstream in Play-Nice; this plan does not change it.

## Owner answers (2026-10-01, tap-questions)

| Question | Answer |
|---|---|
| Personality layer (crew, Keeper, stickers, Sol, star map, lore) | **Optional theme pack.** Out of core code; returns later as a switchable pack on the clean dashboard. Art and canon stay in the repo |
| Who uses Worlds | **Just Rylee + scoped agent tokens.** People, invites, helpers, roles and multi-user identity go |
| Built-in SSO | **Keep OIDC in Worlds** (`oidc.py` stays; login = OIDC or local bootstrap, then session + step-up) |
| How to start | **Refine the plan first.** Nothing built yet; this doc stays PROPOSED |

## Still open (refinement)

1. What "Memory" means in the new world: journal + records + recall as one provider, or core?
2. Where you edit: UI-first (writes YAML behind the scenes) vs files-first.
3. Chat/assistant: optional provider that can run saved requests as tools, or parked.
4. First three real services for recipes.
