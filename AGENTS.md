# AGENTS.md

Before substantive work, read [`AGENT_POLICY.md`](AGENT_POLICY.md) and
[`AGENT_CONTRACTS.md`](AGENT_CONTRACTS.md), then load only the contracts
that apply.

**What the repository shows beats what you infer. UNKNOWN is valid.**

## Worlds in one paragraph

Worlds is a public, self-hosted personal front door.

Repository: `personal-world`  
Package: `personal_world`  
Environment prefix: `PW_`

Current architecture is [ADR-0008](docs/adr/0008-front-door.md):

```text
Home · Connect · Memory · Settings
```

Worlds owns meaning. Providers own mechanics.

## Branches

Two code lines are active for now:

- `main` — default/pre-front-door application and maintenance line.
- `rebuild/front-door` — clean front-door rebuild; not production until
  explicit cutover.

Do not silently read one branch's behavior into the other.

Derive divergence:

```sh
git fetch origin
git rev-list --left-right --count origin/main...origin/rebuild/front-door
```

Current work belongs in GitHub Issues. See `.project/CURRENT.md`.

## Map

| Path | Owns |
| --- | --- |
| `src/personal_world/` | Python application/runtime |
| `tests/` | backend + public-safety verification |
| `ui/` | browser interface |
| `config/` | public/synthetic configuration and recipes |
| `.project/CURRENT.md` | current-state routing |
| `.project/PLAN.md` | product direction |
| `.project/DECISIONS.md`, `docs/adr/` | durable decisions |
| `.project/contracts/adoption.yaml` | Play-Nice adoption pin |
| `docs/` | contracts, architecture, operations and history |
| `design/` | deliberate design/art sources |
| `.agents/skills/` | repo-local task skills |

Generated output stays generated. Do not hand-edit generated token/API/build
artifacts when their owning generator exists.

## Checks

Use the branch's checked-in workflows as the authority. Common gates are:

```sh
uv sync --frozen --extra test --extra crypto
uv run pytest --timeout=30
uv run personal-world framework validate --json

cd ui
npm ci
npx tsc -b
npm run lint
npx vitest run
npm run build
npx playwright test
```

Run the relevant subset locally and let GitHub CI run the repository's full
required set.

A green source check is not runtime verification.

## Work discipline

- Use a topic branch/worktree for bounded work.
- Parallel lanes use separate worktrees.
- Never `git add -A` across shared/concurrent work.
- Stage explicit paths.
- One issue owns durable unfinished work when the work must survive a session.
- One PR is the integration/evidence packet for a coherent slice.
- Do not manufacture a dated handoff as routine session ceremony.

Dated `.project/HANDOFF-*` files are history/evidence. They do not outrank
current code, issues, ADRs or `.project/CURRENT.md`.

## Sources of truth

- Current routing: `.project/CURRENT.md`
- Direction: `.project/PLAN.md`
- Front-door architecture: `docs/adr/0008-front-door.md`
- Security/public boundary: `SECURITY.md`
- Accessibility: `docs/accessibility/ACCESSIBILITY_CONTRACT.md`
- Human reliability: `docs/HUMAN_RELIABILITY_CONTRACT.md`
- Play-Nice: `.project/contracts/adoption.yaml`
- Decisions: `.project/DECISIONS.md` + `docs/adr/`
- Work queue: GitHub Issues
- Live runtime: the running app's revision evidence, never prose

Older TRUE-NORTH, product-language, finish-line, roadmap and handoff documents
are useful history/idea sources where not explicitly preserved by current
decisions. ADR-0008 wins on front-door structure.

## Front-door rules

- Landmarks are `Home · Connect · Memory · Settings`.
- Configuration is files and must round-trip without a hidden UI-only canon.
- Memory has a deterministic local baseline and understandable export/restore.
- Consequential actions use one explicit authority path.
- A saved request is not automatically an agent tool.
- Dispatch is at-most-once per consumed authorization; retry is a new action.
- Project Home remains canonical for operations it governs.
- Themes/Station/character packs may change presentation and voice, not
  structure or accessibility floors.
- External `room/0` systems remain supported as a provider kind. Worlds code
  calls them services; do not rebuild their mechanics inside Worlds.

## External mechanics / Workbench boundary

These rules remain binding even though older Workbench/Node product plans are
not current front-door navigation:

- Prefer documented APIs/CLIs/open protocols over embedding another product's
  UI.
- No core capability may depend on an Enterprise-only feature.
- Foundational dependencies need a usable self-hosted open-source path.
- Copyleft services stay behind a clean external-service boundary.
- Do not create duplicate identity, secrets, networking, storage, build or
  remote-access infrastructure when the estate already owns it.
- Valuable state is explicit; containers are replaceable.
- Any terminal/exec capability must be capability-scoped and confined. Never
  expose a raw container socket or arbitrary host shell as routine mechanics.
- Remote failures are visible `unavailable`/`stale`, not hidden.

## Public repository boundary

This repo is public.

Never commit:

- credentials or tokens,
- secret values,
- private addresses/topology,
- personal journals/memory,
- private provider payloads,
- runtime logs containing private data.

Use synthetic/reserved examples. `tests/test_public_safety.py` is the
regression gate.

## Cross-repo boundary

Do not silently mutate sibling repositories as part of Worlds work.

When another repo owns a required change, use or create its issue/work packet.
Worlds should carry only the interface/boundary it owns.

## Owner gates

Explicit owner approval is required for:

- production cutover/deploy,
- real secrets/tokens,
- production data mutation/deletion,
- destructive remote-branch/data removal,
- deliberate artwork/source-rig replacement,
- contract re-pinning outside the normal pin workflow when policy requires
  review.

## Done

Substantial work ends with the report shape from `AGENT_POLICY.md`:

- **CHANGED**
- **VERIFIED**
- **CONTRACTS**
- **ACCESSIBILITY**
- **OWNERSHIP/SECURITY**
- **UNKNOWN**
- **DEFERRED**
- **NEXT**

Keep source-ready, merged, published, deployed and runtime-verified as distinct
states.
