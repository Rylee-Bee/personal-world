## Mandatory agent preflight

Before doing substantive work, read [`AGENT_POLICY.md`](./AGENT_POLICY.md) and follow the canonical contract/index system it references.

**What the repo shows beats what you infer. "Unknown" is a valid answer. Say you don't know rather than guess.**

# AGENTS.md

> **Status:** Reference · **Verified:** 2026-09-26 · **Canonical for:** the working-tree rules and where each kind of source of truth is · **Read this if:** you are about to edit, stage, or commit in this repo.

**In short:** the repo's shared-working-tree rules (one worktree per lane, stage explicit paths, never `git add -A`) and where to find the source of truth for current state, direction, design, accessibility and security. Read it before you edit or commit.

Working-tree rules, and where to find each source of truth, for every agent
and human working in this repo. Keep it short: add a rule only when it is
needed.

## Shared checkouts and worktrees

Parallel epochs run concurrent agents against this repository. A
shared checkout is a hazard: one agent's `git add -A` sweeps another
agent's WIP into its commit. The rules:

- **Workers use separate worktrees.** One checkout per lane:
  `git worktree add ../pw-<lane> <branch>`. Never run two lanes in the
  same directory.
- **Never `git add -A`** in a shared checkout. It stages whatever
  else is in flight — including another agent's half-finished edits.
- **Stage explicit paths only**: `git add src/... tests/...`, or use
  `scripts/safe-commit.sh -m "message" <path> ...` which stages named
  paths, refuses when >5 unrelated files are modified outside them
  (override: `--force`), and runs pytest before committing.

## Where the sources of truth are (read before trusting anything else)

- **Current state:** `.project/CURRENT.md` is the one current-state
  pointer. It routes to the canonical files below; when it and a
  canonical file disagree, the canonical file wins. `STATUS.md` and
  `.agent/STATE.md` are retired pointers to it.
- **Play-Nice adoption:** `.project/contracts/adoption.yaml` is the one
  adoption manifest (declared by `.project/project.yaml`). Contracts
  are in the shared library; none are copied here.
- **Figma-to-code workflow:** use
  [personal-world-implement-figma](.agents/skills/personal-world-implement-figma/SKILL.md)
  for approved-frame implementation, repo token/component/art reuse, and
  region-by-region browser comparison. It routes to the canonical contracts;
  it does not replace them.

- **Current architecture:** `docs/ARCHITECTURE.md`. World model and
  invariants: `docs/NATIVE-BASELINE-AND-ENRICHMENT.md` (normative,
  enforced by `personal-world framework validate`).
- **Canonical direction:** `.project/PLAN.md` (owner-approved 2026-09-25)
  supersedes `docs/TRUE-NORTH.md`'s scope and sequencing; TRUE-NORTH's
  accuracy and accessibility principles still hold. TRUE-NORTH
  (2026-09-22) owns vision, the five commitments, the daily home loop,
  and the recut alpha gates; ADRs and the contract system retain their
  own authority, and `.project/DECISIONS.md` remains the append-only
  decision history.
- **Product finish line (historical target):**
  `docs/PERSONAL-WORLD-FINISH-LINE.md` — superseded as direction by
  `docs/TRUE-NORTH.md` (2026-09-22); remains the target-experience detail
  where TRUE-NORTH is silent. It does not override architecture, security,
  accessibility, or human-reliability contracts.
- **First-release product language & IA:** `docs/PRODUCT-LANGUAGE.md`
  (owner-approved 2026-09-21). Canonical product-facing vocabulary, the stable
  nav landmarks (`Bridge · Memory · Chat · Settings`), the personal-section model, the
  Records-vs-Vault distinction, plain dark-warm theme principles, and the theme
  boundary. The area id `overview` renders the **Bridge** — the home screen
  (Keeper + briefing + rooms) — not the older `Overview.tsx`, which remains in
  the repo but is not rendered (`ui/src/app/App.tsx`). Where PRODUCT-LANGUAGE
  and the finish line differ, it is the current product language.
- **Design truth:** `design/tokens.json` is canonical for token values;
  `docs/DESIGN-HANDOFF.md` is the **V0.1 historical baseline** (superseded
  by `.project/CURRENT.md`); `ui/THEMES.md` is the theme-pack and
  token-consumption contract for the live interface, and
  `ui/dist-kit/` ships the Worlds kit. `docs/PERSONAL-WORLD-FINISH-LINE.md` supplies
  target-completion detail where TRUE-NORTH is silent. `design/handoff/` is
  an archived spec package — historical, never edit it to change design.
  `design/COMPANION_INTEGRATION.md` is the current companion/chat
  architecture. Companion display names and crew ids (with the old keys they
  replace) are canonical in `docs/COMPANION-CANON.md`. Character and voice
  rules (who each resident is, the two voices, and the attention voices)
  are canonical in `docs/CHARACTER-HANDBOOK.md`.
- **Accessibility is non-negotiable and canonical at
  `docs/accessibility/ACCESSIBILITY_CONTRACT.md`.** Any UI change —
  screens, components, CSS, tokens — answers that contract first
  (44px targets, luminance-only rank encoding, motion reduced by
  default, dark-mode default; OS `prefers-reduced-motion` overrides
  application motion preferences). The screen-reader walkthrough,
  responsive rules, and the minimum preference schema are next to
  it in `docs/accessibility/`. Do not edit files under
  `design/handoff/` to change accessibility rules; the canonical
  copies are in `docs/accessibility/`.
- **Do not casually regenerate:** the Mermaid master
  (`design/assets/mermaid-companion-master.lottie` — byte-identical
  by decision), all companion source rigs, the icon library, and the
  screen SVGs. They are deliberate artwork, not generated output.
- **Specs are not implementations.** Check `README.md`, `ROADMAP.md`,
  the current code, and live behavior before deciding whether a designed
  feature exists. Chat and preference-driven customization already have
  implemented portions; do not regress them or assume the Finish Line's
  richer target behavior is already complete.
- **Security boundary:** no private endpoints, credentials, personal
  data or deployment topology in any tracked file.
  `tests/test_public_safety.py` is the regression gate; read
  `SECURITY.md` for the full contract.
- **Validation command:** `uv run pytest --timeout=30` and
  `uv run personal-world framework validate --json` from the repo
  root. CI runs the same.
- **UI behaviour gate:** `cd ui && npx playwright test`. Playwright boots
  the real app against the seeded fixture API (`ui/scripts/e2e-api.mjs`)
  and runs the accessibility / accurate-state / keyboard / motion / reflow
  suite, including axe with color-contrast ENABLED. The old `frontend/`
  suite was removed 2026-09-16; `ui/` IS the interface (2026-09-22 flip).
- **Trunk:** `origin/main`. A local `main` ref can lag it by many
  commits; check `git rev-list --left-right --count main...origin/main`
  before comparing against "main".
- **Where future plans live:** `docs/TRUE-NORTH.md` owns direction;
  `ROADMAP.md` is the historical horizon record (superseded 2026-09-22).
  Do not treat roadmap items as commitments or authorization; current
  implementation evidence determines what remains to be built.

## Workbench & Node direction (rules)

Owner direction 2026-09-21 (D21–D24); rationale in `docs/adr/0003`–`0007` and
`.project/DECISIONS.md`. These extend ADR-0001 to the primary-viewport limb; they do not
replace any contract above.

- **Worlds owns the experience; tools provide mechanics.** Prefer wrapping a stable CLI /
  documented API / open protocol over embedding another product's web UI. Adopt mechanics,
  own semantics (projects, context, authorization, orchestration, relationships, UX).
- **CLI/API-first dependencies.** Between equivalent dependencies, prefer the one with a
  stable CLI, documented API, or open protocol and the smallest permanent operational footprint.
- **No core paid gate.** No core Worlds capability may require a commercial/Enterprise-only
  feature. Commercial hosting/support around an open tool is fine; an essential capability
  behind a paid gate is not suitable as foundational infrastructure.
- **Licensing minimum.** A foundational dependency must provide every capability Worlds relies on
  in its self-hosted open-source distribution under an OSI-recognized license. Copyleft
  (AGPL/GPL) is acceptable **only as an external service behind a clean API boundary** — never
  linked into or absorbed by Worlds.
- **Replaceable adapters.** External infrastructure sits behind a Worlds-owned contract
  wherever practical (e.g. `NetworkOverlay` → `HeadscaleAdapter`).
- **No duplicate infrastructure.** Do not create new storage, identity, secrets, networking,
  build, or remote-access systems when an existing project or the homelab estate already
  provides the mechanics (OpenBao/SOPS, Authelia, Traefik, restic, AmneziaWG, `ai-distrobox`).
- **Containers are replaceable.** Persist valuable state explicitly; runtime containers are
  reproducible and disposable.
- **Terminal/exec broker boundary.** Workbench terminal/exec go through a capability-scoped
  broker (allow-listed commands, scoped workdir, container-confined) — never a raw
  Podman/Docker socket, never arbitrary host shell. "Open Host Shell" is an explicit,
  separate privileged path.
- **Remote failures are reported, not hidden.** Losing a remote Node, edge VPS, or external
  capability must not break Worlds Core; show `unavailable` or `stale` (Play-Nice
  `failure-and-degradation`).
- **The Agent is the enabler, not the product.** The Workbench / primary-viewport experience
  is the product direction; the Node/Agent/network layer extends it and must not turn Worlds
  into an RMM.
- **The frontend is Worlds; Station is a theme.** The stable skeleton (`Bridge · Memory · Chat ·
  Settings` + personal sections; the Bridge's area id is still `overview`) is the navigation — **not** a star-map/constellation drill (that model
  belongs to the later Station theme package; Station is kept, never deleted). The default is a
  **complete existing theme pack** (full color; "plain" means a simple layout, not colorless), never a
  hand-built partial shell or the aubergine station palette. See `docs/PRODUCT-LANGUAGE.md`.

## No new ports into Worlds

Worlds is the main app plus its own personal screens (Keeper, memory, journal,
briefing). It never copies another tool's code. New capabilities arrive as
rooms that serve the Play-Nice ROOM interface contract — `room/0`:
`GET /room`, `/room/cards`, `/room/needs-you`, `/room/actions`,
`POST /room/actions/{id}` — and Worlds renders them. Existing ported
providers are being moved out per the estate plan
`docs/orchestration/ORCHESTRATION-PLAN-2026-09-25.md` in the estate root;
reference that path, do not copy it here.

Rooms, in one breath (full guide: `docs/ROOMS.md`):

- The room list comes from Project Home's registry at runtime
  (`PW_ROOMS_REGISTRY_URL`); `PW_ROOMS` is only a fallback. Rooms not on
  `room/0` show as `incompatible`; unreachable ones as `unreachable` with a
  last-seen time. Never let one room blank the rest.
- Room tokens are env var **names** matching `^PW_ROOM_[A-Z0-9_]+_TOKEN$`;
  values live only on the host. Never forward the human's session token or
  `PW_API_TOKEN` to a room.
- Per-person rooms (`forward_principal: true`, Candy first) get
  `X-Worlds-Principal` alongside their own token; keep one person's cards out
  of another's answer.
- Room links open on the room's own site in a new tab; there is no proxy.
- Discovery, media, calendars and notifications are moving to the **Candy**
  room. They still exist in Worlds today; remove them only in the planned
  order, never ad hoc.
- The look is exported as the Worlds kit (`ui/dist-kit/`, `npm run kit:check`
  in CI). Other repos vendor it with `npm run kit:stamp`; never hand-edit a
  vendored copy.
