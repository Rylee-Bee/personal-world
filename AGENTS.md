## Mandatory agent preflight

Before doing substantive work, read [`AGENT_POLICY.md`](./AGENT_POLICY.md) and follow the canonical contract/index system it references ([`AGENT_CONTRACTS.md`](./AGENT_CONTRACTS.md)).

**What the repo shows beats what you infer. "Unknown" is a valid answer. Say you don't know rather than guess.**

# AGENTS.md

> **Status:** Reference · **Verified:** 2026-09-29 · **Canonical for:** the working-tree rules, commands, boundaries and where each kind of source of truth is · **Read this if:** you are about to edit, stage, or commit in this repo.

**In short:** Worlds (repo `personal-world`, package `personal_world`, env prefix `PW_`) is a personal control plane: a FastAPI backend (`src/personal_world/`) plus the React interface (`ui/`). It owns the Worlds app, its personal screens and the Worlds kit; it does not own rooms (other repos), the Play-Nice contracts, the shared CI workflows, or the homelab. Estate-wide rules live in `~/.agents/AGENTS.md`; they are not repeated here.

## Map

| Path | What | Open it? |
| --- | --- | --- |
| `src/personal_world/` | Python backend + CLI (`personal-world`, entry `cli.py`) | source, yes |
| `tests/` | pytest suite; `test_public_safety.py` is the public-repo gate | source, yes |
| `ui/` | React interface (Vite, Vitest, Storybook, Playwright `ui/e2e/`) | source, yes |
| `ui/src/generated/` | tokens generated from `design/themes/*.json` | generated: `npm run tokens:generate`, never hand-edit |
| `ui/dist-kit/` | committed Worlds kit other repos vendor | generated: `npm run kit:build`, never hand-edit |
| `src/personal_world/static/app/` | staged UI build (gitignored) | generated: `scripts/build-app.sh` |
| `.project/` | durable project context: `CURRENT.md`, `PLAN.md`, `DECISIONS.md`, handoffs, contract adoption | docs, yes |
| `docs/` | architecture, contracts, runbooks; `docs/INDEX.md` marks each doc's status | docs, as needed |
| `design/` | tokens, themes, artwork, screens (29 MB); `design/handoff/` is archived | assets: open for design work only |
| `docs/gallery/` | screenshots (14 MB) for review | assets: only when asked |
| `config/` | example connection/OIDC config and prompt texts | config, as needed |
| `.agents/skills/` | repo skill(s), e.g. Figma-to-code | when the task matches |

## Commands (run from the repo root unless noted)

| Check | Command | Defined in |
| --- | --- | --- |
| Python env | `uv sync --frozen --extra test --extra crypto` | `CONTRIBUTING.md`, `validate.yml` |
| Backend tests | `uv run pytest --timeout=30` | `validate.yml` (test job) |
| Framework invariants | `uv run personal-world framework validate --json` | `validate.yml` (framework-gates) |
| UI install | `cd ui && npm ci && npx playwright install chromium` (vitest's Storybook project needs Chromium) | `ci.yml` |
| UI gates | `cd ui && npm run tokens:check && npm run kit:check && npx tsc -b && npm run lint && npx vitest run && npm run build` | `ci.yml` |
| UI behaviour | `cd ui && npx playwright test` (boots the seeded fixture API `ui/scripts/e2e-api.mjs`; axe with color-contrast on) | `validate.yml` (browser) |
| Kit preview | `cd ui && npm run kit:test:e2e` | `ci.yml` |
| Container | `docker compose config -q` and `docker build -t personal-world:ci .` | `validate.yml` (compose) |
| Commit helper | `scripts/safe-commit.sh -m "msg" <path> ...` | the script |

Run the backend tests + framework validate for any backend change, and the UI gates + Playwright for any `ui/` change, before calling work done. The old `frontend/` suite was removed 2026-09-16; `ui/` IS the interface.

## Shared checkouts and worktrees

Parallel epochs run concurrent agents against this repository (often 20+ linked worktrees; `git worktree list` shows them). A shared checkout is a hazard: one agent's `git add -A` sweeps another agent's WIP into its commit.

- **Workers use separate worktrees.** One checkout per lane: `git worktree add ../pw-<lane> <branch>`. Never run two lanes in the same directory; never touch another lane's tree.
- **Never `git add -A`** in a shared checkout. **Stage explicit paths only**, or use `scripts/safe-commit.sh`, which stages named paths, refuses when >5 unrelated files are modified outside them (override `--force`), and runs pytest before committing.
- **Trunk:** `origin/main`. A local `main` can lag by many commits; check `git rev-list --left-right --count main...origin/main` before comparing against "main".

## Where the sources of truth are (read before trusting anything else)

- **Current state:** `.project/CURRENT.md` is the one current-state pointer. It routes to the canonical files below; when it and a canonical file disagree, the canonical file wins. `STATUS.md` and `.agent/STATE.md` are retired pointers to it.
- **Play-Nice adoption:** `.project/contracts/adoption.yaml` is the one adoption manifest (declared by `.project/project.yaml`). Contracts are in the shared library; none are copied here.
- **Figma-to-code workflow:** use [personal-world-implement-figma](.agents/skills/personal-world-implement-figma/SKILL.md) for approved-frame implementation, repo token/component/art reuse, and region-by-region browser comparison. It routes to the canonical contracts; it does not replace them.
- **Current architecture:** `docs/ARCHITECTURE.md`. World model and invariants: `docs/NATIVE-BASELINE-AND-ENRICHMENT.md` (normative, enforced by `personal-world framework validate`).
- **Canonical direction:** `.project/PLAN.md` (owner-approved 2026-09-25) supersedes `docs/TRUE-NORTH.md`'s scope and sequencing; TRUE-NORTH's accuracy and accessibility principles still hold. TRUE-NORTH (2026-09-22) owns vision, the five commitments, the daily home loop, and the recut alpha gates; ADRs and the contract system retain their own authority, and `.project/DECISIONS.md` remains the append-only decision history.
- **Product finish line (historical target):** `docs/PERSONAL-WORLD-FINISH-LINE.md` — superseded as direction by TRUE-NORTH; remains the target-experience detail where TRUE-NORTH is silent. It does not override architecture, security, accessibility, or human-reliability contracts.
- **Plans and roadmap:** `ROADMAP.md` is the historical horizon record (superseded 2026-09-22). Roadmap items are not commitments or authorization; current implementation evidence determines what remains to be built.
- **First-release product language & IA:** `docs/PRODUCT-LANGUAGE.md` (owner-approved 2026-09-21): product vocabulary, the stable nav landmarks (`Bridge · Memory · Chat · Settings`), the personal-section model, Records-vs-Vault, plain dark-warm theme principles, and the theme boundary. The area id `overview` renders the **Bridge** (`ui/src/screens/Bridge/`, Keeper + briefing + rooms); the old `Overview.tsx` screen was removed 2026-09-29 (only `ui/src/screens/Overview/home-loop.ts` remains). Where PRODUCT-LANGUAGE and the finish line differ, PRODUCT-LANGUAGE wins.
- **Design truth:** `design/tokens.json` is canonical for token values; `.project/design/CURRENT.md` is the current design authority (Workshop v3); `docs/history/DESIGN-HANDOFF.md` is the V0.1 historical baseline; `ui/THEMES.md` is the theme-pack and token-consumption contract. `design/handoff/` is an archived spec package — never edit it to change design. `design/COMPANION_INTEGRATION.md` is the current companion/chat architecture. Companion display names and crew ids are canonical in `docs/COMPANION-CANON.md`; character and voice rules in `docs/CHARACTER-HANDBOOK.md`.
- **Accessibility is non-negotiable and canonical at `docs/accessibility/ACCESSIBILITY_CONTRACT.md`.** Any UI change — screens, components, CSS, tokens — answers that contract first (44px targets, luminance-only rank encoding, motion reduced by default, dark-mode default; OS `prefers-reduced-motion` overrides application motion preferences). The screen-reader walkthrough, responsive rules, and the preference schema sit next to it in `docs/accessibility/`.
- **Do not casually regenerate:** the Mermaid master (estate root `media_files/designs/personal-world/mermaid-companion-master.lottie` — byte-identical by decision), all companion source rigs, the icon library, and the screen SVGs. They are deliberate artwork, not generated output.
- **Specs are not implementations.** Check `README.md`, the current code, and live behavior before deciding whether a designed feature exists. Chat and preference-driven customization already have implemented portions; do not regress them or assume the Finish Line's richer target is complete.
- **Security boundary:** no private endpoints, credentials, personal data or deployment topology in any tracked file (this repo is public). `tests/test_public_safety.py` is the regression gate; `SECURITY.md` is the full contract.

## Workbench & Node direction (rules)

Owner direction 2026-09-21 (D21–D24); rationale in `docs/adr/0003`–`0007` and `.project/DECISIONS.md`. These extend ADR-0001 to the primary-viewport limb; they do not replace any contract above.

- **Worlds owns the experience; tools provide mechanics.** Prefer wrapping a stable CLI / documented API / open protocol over embedding another product's web UI. Adopt mechanics, own semantics (projects, context, authorization, orchestration, relationships, UX).
- **CLI/API-first dependencies.** Between equivalent dependencies, prefer the one with a stable CLI, documented API, or open protocol and the smallest permanent operational footprint.
- **No core paid gate.** No core Worlds capability may require a commercial/Enterprise-only feature.
- **Licensing minimum.** A foundational dependency must provide every capability Worlds relies on in its self-hosted open-source distribution under an OSI-recognized license. Copyleft (AGPL/GPL) is acceptable **only as an external service behind a clean API boundary** — never linked into or absorbed by Worlds.
- **Replaceable adapters.** External infrastructure sits behind a Worlds-owned contract wherever practical (e.g. `NetworkOverlay` → `HeadscaleAdapter`).
- **No duplicate infrastructure.** Do not create new storage, identity, secrets, networking, build, or remote-access systems when an existing project or the homelab estate already provides the mechanics (OpenBao/SOPS, Authelia, Traefik, restic, AmneziaWG, `ai-distrobox`).
- **Containers are replaceable.** Persist valuable state explicitly; runtime containers are reproducible and disposable.
- **Terminal/exec broker boundary.** Workbench terminal/exec go through a capability-scoped broker (allow-listed commands, scoped workdir, container-confined) — never a raw Podman/Docker socket, never arbitrary host shell. "Open Host Shell" is an explicit, separate privileged path.
- **Remote failures are reported, not hidden.** Losing a remote Node, edge VPS, or external capability must not break Worlds Core; show `unavailable` or `stale` (Play-Nice `failure-and-degradation`).
- **The Agent is the enabler, not the product.** The Workbench / primary-viewport experience is the product direction; the Node/Agent/network layer must not turn Worlds into an RMM.
- **The frontend is Worlds; Station is a theme.** The stable skeleton (`Bridge · Memory · Chat · Settings` + personal sections) is the navigation — **not** a star-map/constellation drill (that belongs to the later Station theme package; Station is kept, never deleted). The default is a **complete existing theme pack** (full color; "plain" means a simple layout, not colorless), never a hand-built partial shell or the aubergine station palette.

## No new ports into Worlds

Worlds is the main app plus its own personal screens (Keeper, memory, journal, briefing). It never copies another tool's code. New capabilities arrive as rooms that serve the Play-Nice ROOM interface contract — `room/0`: `GET /room`, `/room/cards`, `/room/needs-you`, `/room/actions`, `POST /room/actions/{id}` — and Worlds renders them. Existing ported providers are being moved out per the estate plan `docs/orchestration/ORCHESTRATION-PLAN-2026-09-25.md` in the estate root; reference that path, do not copy it here.

Rooms, in one breath (full guide: `docs/ROOMS.md`):

- The room list comes from Project Home's registry at runtime (`PW_ROOMS_REGISTRY_URL`); `PW_ROOMS` is only a fallback. Rooms not on `room/0` show as `incompatible`; unreachable ones as `unreachable` with a last-seen time. Never let one room blank the rest.
- Room tokens are env var **names** matching `^PW_ROOM_[A-Z0-9_]+_TOKEN$`; values live only on the host. Never forward the human's session token or `PW_API_TOKEN` to a room.
- Per-person rooms (`forward_principal: true`, Candy first) get `X-Worlds-Principal` alongside their own token; keep one person's cards out of another's answer.
- Room links open on the room's own site in a new tab; there is no proxy.
- **Candy** is intended to be only the backend for the Interests category (discovery); it is not implemented quite right yet. Media, calendars and notifications are **not** Candy's scope. Discovery still exists in Worlds today; remove it only in the planned order, never ad hoc.

## Cross-repo boundaries

Change sibling repos only with explicit authorization; otherwise record the companion change in your handoff.

- **Worlds kit → other tool UIs:** `ui/dist-kit/` is produced here (`npm run kit:build`, drift-gated by `kit:check` in CI); consumers vendor it with `npm run kit:stamp`. Never hand-edit a vendored copy; a kit change affects every vendoring repo.
- **Play-Nice → here:** `adoption.yaml` pins a library revision; the pin robot (play-nice-contracts `tools/pin-sync`) opens the pin PR. Re-pinning by hand is a manual, attested ritual, not a sync job. `contract-freshness` going red after upstream moved is a correct alarm.
- **ci-harness → here:** `validate.yml` and `uat-live.yml` call `Rylee-Bee/ci-harness` reusable workflows by pinned SHA; change the job inputs here, the workflow bodies there.
- **Project Home → here:** the rooms registry (`PW_ROOMS_REGISTRY_URL`) and the one-tap deploy of `ghcr.io/rylee-bee/personal-world` (`docs/OPERATIONS.md`).

## Needs Rylee's approval here

Production deploys (Project Home's ask-first "What's live" deploy; the production host); anything touching real secrets, tokens or the production data directory; re-pinning Play-Nice outside the pin robot; editing or regenerating the deliberate artwork above; removing Discovery or ported providers out of the planned order. General gates: the estate constitution.

## Done means

Required local checks from **Commands** pass (show the command and its output); for UI work, the accessibility contract is answered and Playwright/axe passes; the `AGENT_POLICY.md` final report (CHANGED / VERIFIED / CONTRACTS / … / NEXT) is given with `UNKNOWN` kept visible. A passing local check is not evidence of a deployed runtime: deployed means merged, published by `publish-image`, rolled out, and `GET /healthz` → `commit` shows the SHA.

## Handoff

Session state goes to `.project/` (update `CURRENT.md` when current truth changes; dated `HANDOFF-<TOPIC>-<date>.md` for session handoffs; decisions append to `DECISIONS.md`). Do not write state into the retired `STATUS.md` or `.agent/STATE.md`.
