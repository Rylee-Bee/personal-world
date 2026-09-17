# Current State — Project Worlds

**This is the canonical current-state pointer for this project**, per
the Play-Nice `stable-truth-replaceable-machinery` rule ("one canonical
current truth; other documents may point to it"). `STATUS.md` and
`.agent/STATE.md` were retired to point here 2026-09-12 after being
found stale and mutually inconsistent. This file routes — canonical
truth lives in the files it names. When this file and a canonical file
disagree, the canonical file wins.

## 2026-09-17 — current state

Single source of truth for NOW; everything below this section is
historical. Verified against the repo and running code:

- **Repository:** single branch, `main` is the trunk
  (`origin/main`). Older branches were retired 2026-09-16 as
  annotated `archive/2026-09-16/*` tags; the superseded React SPA, its
  `/legacy-react` route, catch-all SPA fallback, and dist build
  pipeline were removed the same day.
- **Product UI:** the **Station**, served same-origin at `/station/`
  from `design/opendesign-exploration/station/`; `/login` and
  `/setup` are server-rendered. Honest partial states (verified
  2026-09-17 language pass): chat send is wired to the real `POST
  /api/chat` (no streaming yet), projects and interests read real
  APIs with honest empty/not-set-up states, the journal's specimen
  panel is unmounted (real API-005 read + browser-local "Notes on
  this device"); remaining specimen blocks (media, map region
  detail) stay labelled until real data exists (see `ROADMAP.md`).
- **Deployment shape:** one compose appliance — core service + bundled
  `ollama` + a one-shot `ollama-pull` init (local qwen3:1.7b, no API
  key), persistent `data` + `config` + model volumes.
- **Authentication:** OIDC-capable, passkey-first SSO is the primary
  path; local access code is the collapsed fallback. App capability,
  not a statement about any single provider — see `docs/oidc.md`.
- **Production exists** as a private deployment; its topology
  (hostnames, addresses) lives in private operator documentation and
  deliberately not in this repository. The homelab side records the
  identity-provider client wiring in that private estate's PR #14 —
  details there by design, not here.

Canonicity pointers: architecture → `docs/ARCHITECTURE.md`; target
experience → `docs/PERSONAL-WORLD-FINISH-LINE.md`; verified direction
→ `ROADMAP.md`; design truth → `design/tokens.json` +
`docs/DESIGN-HANDOFF.md` (V0.1 baseline) + `docs/accessibility/`;
companion/chat architecture → `design/COMPANION_INTEGRATION.md`;
decisions → `.project/DECISIONS.md` + `docs/adr/`.

---

## Historical — earlier epochs

**Everything below this line describes superseded states.** It is
preserved for provenance (dated narratives, world-model decisions, the
2026-09-12 identity pass, sanitization history) and was already being
ended here, in sanitized and labelled form, before the 2026-09-17
router above existed. Where it disagrees with the 2026-09-17 section
or the live code, they win. Identifiers below (`PW_FRONTEND`,
React-era test counts) appear only as historical terminology or
point-in-time measurements.

- The superseded React-era state of this file (2026-09-16 and earlier
  sections) was consolidated into
  [`docs/history/CONSTRUCTION-AND-EPOCH-NARRATIVE.md`](../docs/history/CONSTRUCTION-AND-EPOCH-NARRATIVE.md)
  as per the pre-router route; that narrative remains the detailed
  provenance record.

---

## 2026-09-16 — Station is the product UI; the repo is single-branch `main` (historical snapshot, 2026-09-16)

The current direction is the **Station** UI (served same-origin at
`/station/` from `design/opendesign-exploration/station/`). `/login` and
`/setup` are server-rendered. The superseded React SPA, its `/legacy-react`
route, its catch-all SPA fallback, and its dist build pipeline were removed
on 2026-09-16.

The repository is now a single branch, `main` (`28a948c` == `origin/main`).
Every other branch was retired and archived as an annotated tag
`archive/2026-09-16/<branch>` on origin, and its linked worktree removed:
`feat/fleet-ferrier`, `feat/worlds-next-ui`, `redesign/prototype-v1`,
`feat/workshop-v3-final-convergence`, `wip/today-workshop-v3-frames`.
Superseded prototype/exploration files that existed only in the working
tree were archived out of the repo (a local backup was kept).

Sections below are historical. Where one disagrees with this section, this
section and the live code win.

> **2026-09-12, UAT round 1 PASSED — T15 cutover landed.** The React
> frontend is the only product UI (legacy deleted, no fallback), the
> no-immutable revalidation contract is deployed, and the standing
> UAT-data-discipline rule is in `.project/DECISIONS.md`. Full closure,
> deployment truth, known defects, and next actions live in
> **[`.project/HANDOFF-UAT-ROUND-1.md`](./HANDOFF-UAT-ROUND-1.md)** —
> the next agent starts there. Sections below predate the cutover and
> describe the T10–T14 construction era; the handoff supersedes them
> for current state.

Verified 2026-09-12 by bcode/claude (evidence: `git log`/`git
merge-base`/`git rev-parse` against the real GitHub repository, `gh pr`
CI status, `contractctl` tool output, live CDP-driven browser checks —
not memory, not narrative).

## 2026-09-15 finish-pass truth (read from the code, not from handoffs)

**Baseline** (`main` @ `0445770`, after PR #50 (`8f061e7` — the D1–D3
auth/authority convergence + repo/docs reorg) and PR #53 (`0445770` —
this finish pass) merged; `uv sync --extra test --extra crypto`):
backend **873 pytest pass**, frontend **343 vitest pass**, `vite build`
clean, Playwright **54/54 pass** (incl. axe with color-contrast
ENABLED), `tokens:check` clean, `framework validate` 0 violations.
`main`'s own `validate` and `publish-image` CI runs are green at
`0445770`. (Baselines are a point-in-time measurement, not a promise;
re-run the gates rather than trusting these numbers.)

**What Today actually implements:** Today — Quiet Day (17:481) only. The
Workshop v3 Bad Day (17:2117) and Question (17:6245) states are **not
rendered** by the current screen (tracked in
[issue #52](https://github.com/Rylee-Bee/personal-world/issues/52));
`ShellModes.ts` records their modes but nothing switches to them. The
first Figma-faithful build (`5837c99`, a 1535-line Today with Bad Day +
Question + Mobile) was replaced during the integration pass (`4b7ec55` /
`565dcd1`, "wire all screens to real API") because it was not driven by
real data. An unfinished attempt to re-add Bad Day + Question is archived
as annotated tag `archive/2026-09-16/wip/today-workshop-v3-frames` (the
branch was retired on 2026-09-16; the repo is single-branch `main` now, so
it no longer counts as dirty/ahead/behind local git work). This is why
`ROADMAP.md` no longer says "16/16 implemented".

**Capability health:** Today classifies capabilities by the canonical
`src/personal_world/status.py` vocabulary via
`frontend/src/lib/capability-health.ts`. `not_configured`/`disabled` are
quiet, `unavailable`/`stale` earn one calm sentence, and only
`needs_attention`/`warning` count as attention. The provider-owned `ok`
flag is inconsistent (some providers report `ok: true` with
`status: not_configured`; others `ok: false`) and is deliberately not the
decision input.

**Vault:** fails closed without the `cryptography` extra — there is no
base64 fallback. `/api/vault/status`, `Vault.audit()`, and the brain tool
`inspect_vault_status` all report actual Fernet state.

**Historical, not current:** `HANDOFF-UAT-ROUND-1.md` (2026-09-12; test
counts 578/356/43 and its NEXT list) and the T10–T14 construction-era
narrative describe a superseded state; that narrative now lives in
[`docs/history/CONSTRUCTION-AND-EPOCH-NARRATIVE.md`](../docs/history/CONSTRUCTION-AND-EPOCH-NARRATIVE.md),
not below. `DECISIONS.md` remains the durable decisions record.
`origin/main` is the trunk; local `main` tracks it.

**Project estate (resolved 2026-09-15):** the shared helpers
`frontend/src/lib/project-status.ts` and
`frontend/src/lib/observation-age.ts` are now consumed by
`ProjectsScreen` — the local `agentSyncStatus()` duplicate is gone. The
estate panel renders a category-labelled status chip, one plain human
sentence per project (diverged / unpublished / local work / unknown),
the dated "Observed …" line, and technical guts behind one nested
disclosure. Today still surfaces project attention from source-control
state and agent work state (different dimensions), not the publication
estate ([issue #51](https://github.com/Rylee-Bee/personal-world/issues/51),
Completed in [`ROADMAP.md`](../ROADMAP.md)).

**Known drift the next agent should resolve explicitly, not silently:**

- A personal-world container already runs on this host at `:8000`
  (the owner's instance); the repo's Playwright server uses `:8731`.## Identity

- **Product name:** Project Worlds (renamed from "Personal World"
  2026-09-12 — a product re-anchoring, not a new codebase; see
  "Identity pass" below for exactly what did and didn't change).
- **Repository / package / CLI identifiers:** unchanged
  (`Rylee-Bee/personal-world`, `personal_world` Python package,
  `personal-world` CLI command, `personal-world-frontend` npm package).
  Renaming these is a separate, deliberately deferred migration — it
  breaks remotes, automation, links, and external state, and nothing
  about the product rename requires it yet.
- **North Star:** "Project Worlds is a calm, accessible, slightly
  whimsical personal environment where my information, tools,
  assistant, history, and capabilities come together naturally — and
  where sophisticated machinery stays out of my way until I actually
  need it." Dual acceptance test: understandable at a glance when
  barely able to focus; fully inspectable down to the technical guts on
  demand. Calm does not mean shallow — complexity is available on
  demand, not forced into the default experience.

## Trunk

**One canonical trunk: `main`.** Unified 2026-09-12 by merging, in
order (preserving full commit ancestry, not squashed, not
cherry-picked):

1. PR #22 (`p1/integration`, T10–T13 screens/tests) → `main` at
   `ba2ae6cae2cfb3919dce69b70f6bb9c9de07d9ea` (merge commit).
2. PR #24 (`uat/t14-warmth`, T14 composition/a11y convergence +
   Play-Nice context, itself built directly on PR #22's tip) → `main`
   at `70ab495890b5ba73a429876a029134e8bed00615` (merge commit).

Both merges were verified independently after landing, not assumed from
green PR checks alone: `main` @ `70ab495` passes 511/511 backend tests,
291/291 frontend tests, clean build, clean lint, `tokens:check` clean,
`framework validate` healthy, and both accessibility fixes (recorded in
the archived narrative) were re-confirmed live via CDP-driven headless
Chrome against this exact merged state — not just via source inspection.

`uat/t14-warmth` and `p1/integration` were fully contained in `main` and
have since been deleted. No other branch needed reconciling into the
trunk at that pass.

## What works today (moved)

The dated feature narrative that used to live here — 2026-09-12 slices
(Projects workspace, journal audit/supersede, assistant-drafted
corrections, agent-sync estate sensor, observation age, Gitea
retirement, GitHub enrichment, GHCR distribution) — is preserved for
provenance in
[`docs/history/CONSTRUCTION-AND-EPOCH-NARRATIVE.md`](../docs/history/CONSTRUCTION-AND-EPOCH-NARRATIVE.md).
For current implemented scope read [`README.md`](../README.md) and
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Design truth

`design/tokens.json` (canonical tokens; repo-owned), `docs/DESIGN-HANDOFF.md`
(V0.1 baseline reference, partly superseded), `docs/accessibility/`
(non-negotiable floor). `design/handoff/` is an archived Figma spec
package — historical, never edit to change design. `.project/design/CURRENT.md`
answers "what is approved right now" in more detail, including
frame-by-frame approval status.

**Workshop v3 is the current implementation design authority
(2026-09-13).** See `.project/design/WORKSHOP-V3-MANIFEST.yaml` for the
16 canonical frames with exact node IDs, philosophy/audit artifacts, and
the 8 verbatim reservations. **Today — Quiet Day = node `17:481` in file
`Wbg1rdt9fVCjWAXEKI1pTc` — implementation target #1** (not `13:14`, not
V0.1 `3:722`).

## Figma bridge (how to reach the design evidence)

- **Remote MCP** (`https://mcp.figma.com/mcp`) rejects opencode — Figma
  allowlists only catalog-listed clients (Claude Code, Cursor, VS Code…;
  opencode is not yet in the catalog; new clients register via the Figma
  account team). Configured in `~/.config/opencode/opencode.jsonc` but
  unusable until Figma allowlists opencode.
- **Working path (verified 2026-09-13):** the Figma **desktop Dev Mode MCP
  server** (localhost:3845) on the operator's Figma machine (a separate
  LAN host; coordinates live in the operator's user-level config
  `~/.ssh/config` / host aliases, never in tracked files). Expose it via
  an SSH reverse tunnel to this box: run on the Figma machine
  `ssh -N -R 13845:127.0.0.1:3845 figma-tunnel@<this-box>` (one-time
  bridge account; password set by the owner, not stored in any tracked
  file). Then the MCP endpoint is `http://127.0.0.1:13845/mcp`.
  Requires Figma desktop open with the Workshop file and
  *Preferences → Enable Dev Mode MCP Server* on.
- NOTE: sshd on this box can bind reverse-forward port 13845 because it
  was SELinux-labeled `ssh_port_t` (Bazzite/Fedora default policy denied
  `sshd_session_t` binds; `sudo semanage port -a -t ssh_port_t -p tcp
  13845`). If the forward fails again after a policy relabel, that is
  the first thing to re-check.
- The desktop server exposes `get_design_context`, `get_screenshot`,
  `get_metadata`, `get_variable_defs`, `get_motion_context`, `get_figjam`
  — the retrieval roles `personal-world-implement-figma` requires.
  Retrieval verified against the Workshop v3 file on 2026-09-13.
- **`get_design_context` requires the target frame to be selected/open in
  Figma Dev Mode.** Unlike `get_metadata` and `get_screenshot` (which
  accept a `nodeId` and work without selection), `get_design_context`
  returns `"Nothing is selected"` (isError) if no frame is active in
  Dev Mode. If you see this error, select the frame in Figma and retry.
  Discovered 2026-09-13 during the multi-frame implementation run —
  the bridge was healthy, metadata/screenshots worked, but design
  context silently failed until frames were selected.
- The Figma machine's LAN address is private topology; per SECURITY.md
  it must not enter tracked files. This note describes the mechanism
  (SSH alias/tunnel), and these files deliberately reference
  "the operator's Figma machine" rather than pinning addresses or
  credentials.

## Play-Nice adoption

Pinned to **v0.7.0** @ `79cadaceb8654279f7b2be135fcd67ba138728fb`
(`.project/contracts/adoption.yaml`; the manifest records the full bump
history v0.3.0 → v0.5.0 → v0.6.0 → v0.7.0). Delta at this bump: new
always-applicable `assume-unknown` contract; the founding
`play-nice-together` 1.5.0 → 1.6.0 with its receipt rotated. No other
adopted contract changed meaning. Gate **PASS**, commitment **ACTIVE**
for task `project-worlds-play-nice-0.7.0-repin` (bundle
`dovetail-harbor-prairie`; session artifact under the gitignored
`.project/contracts/.contracts/`). Verified with the real `contractctl`
tool against the pinned revision: `adopt` = ADOPTION VALID
(personal-world: always=11 triggers=9); `commit` = CONTRACT COMMITMENT
ACTIVE.

## Figma participant pack

`.project/participants/figma/` — status: **accepted** (contract gate
PASS; commitment ACTIVE), but her attestation is scoped to the bundle
she actually read (revision `0c0ab7c5`, v0.3.0) — now three bumps
behind the current v0.6.0 pin. Not fabricated forward on her behalf;
see `figma/contract-return/NEXT-REVISION-NOTE.md` for the exact,
non-blocking gap and the tiny re-pass needed if a live Figma session
becomes available. This does not block anything: participant packs are
enrichment, never canonical project truth.

Her pack's **participant relationship** (design-service role,
authoritative_for/not_authoritative_for boundaries, help routing) is
unaffected by the product rename and was not touched. Her
**project-specific references** (`references.yaml`: file
`VATVojyJZT9HKx0CrDS0yr`, frame IDs) were reviewed during this identity
pass and left as-is — they describe the same design file and the same
screens; nothing about renaming the product invalidates them. If a
future Figma session finds the file/frame identity itself has changed,
mark the specific reference `unknown`/`stale` at that point rather than
assuming now.

**OCI image distribution via GHCR + portable Compose deployment
(2026-09-12, slice complete):** Project Worlds is now distributed as a
versioned OCI image through GitHub Container Registry and the tracked
`compose.yaml` consumes the published image instead of rebuilding
locally. New workflow: `.github/workflows/publish-image.yml`, triggered
via `workflow_run` after `validate` succeeds on `main`; tags
`:latest` (mutable convenience) and `:sha-<full SHA>` (immutable;
rollback handle). Public visibility — Rylee-Bee/personal-world is a
public repo and the image carries source only (no secrets, no private
endpoints, no deployment topology; verified preflight against
`SECURITY.md` and `tests/test_public_safety.py`). Compose layout: the
tracked `compose.yaml` is now the portable base (image-only, no host
paths), `compose.dev.yaml` adds `build: .` for local development, and
`compose.homelab.yaml` carries the optional Rylee-only enrichment
(Lab CLI + Kilo auth file) that previously lived in the base file.
Container validated end-to-end: built locally, boots clean with only
image + token + volume, `/healthz` returns
`{"ok":true,"auth_configured":true,"setup_needed":true}`, healthcheck
green, volume persists across restarts. CI: 554/554 tests pass except
the pre-existing `test_docs.py` link to `.project/DECISIONS.md`, which
was created in the same pass. Decision recorded at
`.project/DECISIONS.md` (D-001, D-002).

## Identity pass (2026-09-12) — moved

The full classification of what changed vs what intentionally did not
during the "Personal World" → "Project Worlds" rename is preserved in
[`docs/history/CONSTRUCTION-AND-EPOCH-NARRATIVE.md`](../docs/history/CONSTRUCTION-AND-EPOCH-NARRATIVE.md).
Product identity changed; technical identifiers (repo slug, package,
CLI command, schema URIs) intentionally did not. The companion keeps the
name "Personal World": Project Worlds is the environment, Personal World
is the companion inside it.

The old "In-flight / untracked" note is retired: `frontend-v2/` no longer
exists, and `.bcode/`, `node_modules/`, `test-results/`, and
`data.bak.*/` are gitignored local scratch.

## UNKNOWN

- **RESOLVED (owner decision, 2026-09-12): the companion keeps the
  name "Personal World".** Interpretation: "Project Worlds is the
  environment. Personal World is the companion inside it." The
  character, her slots/artwork/rig, the companion-selection lists, and
  the "A conversation with Personal World" journal humanizers all keep
  her name. This unblocked the runtime brand pass (below).
- Whether/when the repository slug, Python package, and CLI command
  should follow the product rename — explicitly deferred, not decided
  (same for runtime UI strings; see identity-pass section).
- Live production/deployment state of this trunk outside this checkout
  — not verified this pass (local + CI evidence only).

## Remaining implementation gaps (surveyed 2026-09-12, implementation run)

Everything below needs owner input, external infrastructure, or a
product decision — not silently guessable from repo truth:

- **Further approval workflows:** two are now proven (repository
  status refresh; journal correction/supersede). Journal cleanup
  capabilities NOT yet implemented: bulk deletion (deliberately —
  deletion is a separate owner decision), mass corrections, retention
  policy, and assistant-drafted correction suggestions (the endpoint
  would accept them, but no assistant proposal UI exists yet). Destructive
  Git actions remain out of scope until the owner says otherwise.
- **Interests / Candy Dispenser and Media sections**: require real
  discovery/media provider connections (external infrastructure) or
  explicit interest-feed configuration; honest EmptyStates remain until
  then. Feed-building-via-chat is design work.
- **SSO / provider-neutral authentication**: a secure real-world path
  needs a chosen identity provider (Authelia or other) and deployment
  decisions — security-sensitive, owner-scoped.
- **Lab repair workflows, dependency/topology, service config UI**:
  depend on the real Lab CLI deployment and what homelab operations
  Rylee wants surfaced; backend routes exist for several but the
  product shape is owner input.

Resolved since this survey (recorded so the survey is not mistaken for
current): the T15 cutover is done — the legacy server-rendered pages and
the `PW_FRONTEND` mode switch were deleted; `PW_FRONTEND_DIST` is the
only frontend environment variable and a stray `PW_FRONTEND` value is
inert (`tests/test_frontend_serving.py` guards this). *(This whole
block is superseded by the 2026-09-16 Station cutover: the React SPA
and its dist build were deleted, `PW_FRONTEND_DIST` was removed with
them, and the product UI is the server-served Station — kept as
history, not current truth.)* The runtime
product-brand pass is complete: product strings say "Project Worlds",
while companion identity intentionally keeps "Personal World".

## Integration truth pass (2026-09-13/14) — moved

The full narrative is preserved in
[`docs/history/CONSTRUCTION-AND-EPOCH-NARRATIVE.md`](../docs/history/CONSTRUCTION-AND-EPOCH-NARRATIVE.md).
Durable items it records: `ToolRegistry.invoke()` structurally blocks
execution tools (the model proposes but cannot approve or execute); the
step-up routes use `Depends(require_step_up)` (a previously unawaited
check was fixed); `ConnectionManager` is the canonical config resolver;
the vault fails closed without `cryptography`; and step-up is trust
elevation, not fresh re-authentication (a known gap).
