# Project Worlds — Durable Decisions

Decisions that are RESOLVED and durable — the "why it is this way"
record. Current implementation state lives in
[`.project/CURRENT.md`](./CURRENT.md); the cooperation constitution
lives in [`contracts/adoption.yaml`](./contracts/adoption.yaml)
(Play-Nice Contracts, upstream at
[github.com/Rylee-Bee/play-nice-contracts](https://github.com/Rylee-Bee/play-nice-contracts)).

Each entry records the decision, the date, and the standing reason.
Nothing here is silently reopened; changing a decision means a new
dated entry superseding the old one (append-only, like the journal).

## Product identity

- **2026-09-06 — Capabilities are core-owned; providers are optional
  implementations or enrichments.** (ADR-0001) The core must survive
  the disappearance of every optional integration; enforced by
  `personal-world framework validate` and `tests/test_framework.py`.
  Reason: a personal control plane must never become a disguised
  dependency on one external system.

- **2026-09-13 — "The world knows how loudly to exist" is an
  implementation/design principle, not copywriting.** Workshop v3
  (file `Wbg1rdt9fVCjWAXEKI1pTc`, philosophy artifact 17:8873,
  convergence audit 18:2) is the current implementation design
  authority for all 16 canonical frames, and its emotional-volume
  system (GENEROUS → AMBIENT → PRACTICAL → ATTENTIVE → QUIET) governs
  how loudly any surface may speak. Screens must be evaluated for
  what is visually loudest and whether importance reads as urgency —
  recorded per frame as AUTOMATED/AGENT REVIEW vs OWNER EXPERIENCE,
  never collapsed into one claim. Reason: the convergence process
  (Rylee described the converged design as more magical than she had
  imagined; the audit's register lines) produced volume rules that
  are the design's substance, and tonight's first implementation
  proved they are enforceable in code, not just prose.

- **2026-09-13 — The design-to-code guardrail held, and that outcome
  is the precedent.** The first unattended implementation attempt
  produced zero code because Figma evidence was unavailable. Rather
  than weakening the guardrail, the project established the full
  chain: Figma evidence (both `get_design_context` and
  `get_screenshot` from the desktop Dev Mode MCP server) → repository
  authority (`.project/design/CURRENT.md` + `WORKSHOP-V3-MANIFEST.yaml`)
  → MCP bridge (SSH reverse tunnel, no credentials in tracked files)
  → implementation skill (`personal-world-implement-figma`) → visual
  comparison → D0–D4 report. With the chain in place, the first
  implementation (Today — Quiet Day, `1a1e6ef`) completed in one
  session because ambiguity had been removed in advance. Reason:
  evidence-first made honesty cheaper than fabrication; keep the
  chain mandatory.

- **2026-09-12 — The product is "Project Worlds"; the companion
  character keeps the name "Personal World."** "Project Worlds is the
  environment; Personal World is the companion inside it." Technical
  identifiers intentionally stay `personal-world` (repo slug,
  `personal_world` package, `personal-world` CLI, compose services,
  schema URIs); historical references are preserved rather than
  rewritten. Reason: continuity of tooling and truthful history.

## Milestones

- **2026-09-13 — Workshop v3 implementation milestone: the bridge works.** Today — Quiet Day (Figma node `17:481`) became the first canonical Workshop v3 frame implemented in the working product at commit `1a1e6ef`. This does **not** mark the Workshop v3 rollout complete: design convergence is 16/16, while implementation is 1/16. It establishes that the full design-to-product path works end-to-end: approved Figma design → repository design authority → Figma MCP → `personal-world-implement-figma` → canonical repository components/assets → rendered comparison → D0–D4 acceptance. The first unattended attempt correctly produced zero code when canonical evidence was unavailable; the project fixed the evidence chain rather than weakening the guardrail. Once that evidence existed, the implementation completed quickly while preserving truthful data, accessibility, repository behavior, and explicit reservations where design and implementation authority differed. Engineering acceptance reached D0–D3 PASS; D4 remained intentionally pending owner review. This is the point where Workshop v3 stopped being only a design language and became part of the working world. **The world knows how loudly to exist.**

## Source of truth

- **2026-09-12 — Project Worlds does not compute repository
  publication state itself. It consumes the read-only agent-sync
  project-state interface.** `agent-sync status --all --format json`
  (the pickle project's adapter layer, schema
  `play-nice/repo-status-v1`) is the single authoritative interpreter
  of Rylee's project estate: Git owns Git truth; agent-sync computes
  publication/safe-to-leave/work-state from it; Project Worlds'
  `AgentSyncProjectSensor` only invokes, parses, and normalizes that
  observation (unknown preserved, closed vocabularies enforced,
  exit-1 treated as a valid work-to-do signal); Projects presents,
  Today summarizes, Personal World explains. No second Git-state
  implementation exists inside Project Worlds, and an agent-sync bug
  is recorded + deferred to pickle, never worked around by
  duplicating Git logic. Reason: one computation, one authority —
  drift between tools showing "project state" is a truth failure
  no UI can repair.

- **2026-09-12 — Personal World may understand project state without
  gaining repository mutation authority.** The chat context carries a
  bounded read-only projection of the agent-sync observation; the
  assistant may summarize, explain, compare, and point to Projects.
  It may NOT push, commit, reset, rebase, stash, or clean, and no
  conversational phrasing is interpreted as Git authorization. The
  projects slice added understanding only, not capability; mutation-
  oriented proposal objects are out of scope until a real,
  owner-authorized Projects mutation workflow exists to prepare into.
  Reason: helpful understanding and dangerous reach must be built as
  separate layers — the seam stays closed until it can open with
  provenance.

- **2026-09-12 — Project-state truth and project-state freshness are
  separate dimensions.** WHAT agent-sync observed (publish_state,
  safe_to_leave, tree counts) and WHEN it observed it
  (`observed_at`, rendered as age) never collapse into each other:
  a stale observation of "diverged" is still a diverged observation,
  just not current evidence — staleness never converts state to
  unknown, and state never hides age. The stale marker is calm
  provenance ("may be stale"), never error vocabulary. Reason: old
  evidence is not false evidence, but it must never impersonate
  current evidence — and confusing the two dimensions would lie in
  both directions at once.

- **2026-09-12 — Project Worlds preserves the observation timestamp
  from agent-sync instead of presenting cached/previous observations
  as timeless current truth.** agent-sync's own `observed_at` is the
  only freshness source (no second clock, no freshness database, no
  polling); age is DERIVED at render time (backend
  `agent_sync.freshness()`, ONE frontend helper
  `lib/observation-age.ts`), the staleness threshold reuses the
  product-wide lab_state 30-minute `FRESHNESS` convention
  (asserted by test; no settings surface), and missing/invalid
  timestamps render as honestly unknown rather than fabricating an
  age. Every project-status surface (Projects glance + guts, Today,
  the assistant context) shows WHEN the estate was observed so the
  user never mistakes an old observation for current truth. Reason:
  truth has a timestamp; the UI must carry it, not invent it.

- **2026-09-15 — One Play Nice adoption manifest, at the project-context
  path, re-pinned to the library HEAD at adoption time.** The project had
  two adoption manifests with different pins
  (`.project/contracts/adoption.yaml` v0.6.0 @ `0cee0652` vs a root
  `.contracts/adoption.yaml` @ `1c05de4`), and nothing machine-read
  either. Resolved to `.project/contracts/adoption.yaml` — the layout the
  Play-Nice project-context framework itself uses, the path declared by
  `.project/project.yaml`, and the path the session workflow resolves
  against; the duplicate was deleted and every document points at the one
  manifest. The same pass re-pinned v0.6.0 → **v0.7.0** @ `f825ffb`
  (library HEAD at adoption; adds the always-applicable `assume-unknown`
  contract) and re-attested with the real `contractctl` tool:
  `adopt` = ADOPTION VALID, `commit` = CONTRACT COMMITMENT ACTIVE. Reason:
  one authority per subject — a second manifest with a different pin is
  drift no reader can reconcile, and a pin that lags the library silently
  understates the floors the project claims to implement.


## Container distribution

- **2026-09-12 — Project Worlds is distributed as a versioned OCI
  image through GitHub Container Registry.** The portable Compose
  deployment consumes the published image; machine-specific
  integrations live in optional overrides. Tags: `:latest`
  (mutable convenience, refreshed on each successful main publish)
  and `:sha-<full SHA>` (immutable; documented rollback handle).
  Workflow `.github/workflows/publish-image.yml` triggers via
  `workflow_run` after `validate` passes on `main`; it uses
  `GITHUB_TOKEN` with `packages: write` + `contents: read`, no PAT.
  Compose layout: `compose.yaml` is the portable base (image-only,
  no host paths); `compose.dev.yaml` adds `build: .` for local
  development; `compose.homelab.yaml` carries the optional Rylee-only
  enrichment (Lab CLI + Kilo auth file) that previously lived in the
  base file. Rollback by pinning `PW_IMAGE` to a known-good
  `:sha-...` tag. Reason: a single CI build produces an appliance
  that boots on any Docker/Podman host with only a token and a data
  volume; the previous recipe required cloning the source tree and
  binding WSL-only host paths, both of which made the appliance
  non-portable in practice despite its header.

- **2026-09-12 — The published image is `linux/amd64` only.** The
  single host that currently runs Project Worlds is amd64; ARM is not
  in scope. Multi-arch would roughly double CI build cost and time
  without a real consumer. Revisit when an ARM deployment target
  appears. Reason: cheapest path that still meets the actual use;
  Play-Nice `dependency-discipline` and `search-before-inventing`
  forbid speculating complexity.

- **2026-09-12 — The GHCR package is public.** The image carries
  source only — no secrets, no private endpoints, no deployment
  topology (verified preflight against `SECURITY.md` and
  `tests/test_public_safety.py`). Discoverability is a feature, not a
  boundary. Reversible from the GHCR web UI at any time. Reason:
  no security boundary is crossed by publishing the source image
  publicly; private visibility would add an access-handling layer
  for no defensive gain.

## UAT data discipline

- **2026-09-12 — No persisted user data in the test environment until
  the owner calls the product at least beta.** Standing rule (owner
  directive during UAT, task `project-worlds-test-environment` and
  successors): the isolated `project-worlds-test` deployment must not
  accumulate real/persistent personal data. Every UAT walk starts
  from a verified clean slate (`podman compose -p
  project-worlds-test down -v` then `up -d`, with `GET /healthz`
  showing `setup_needed:true` as the proof, printed to the owner).
  Persistence in the test instance is only allowed for a specific,
  named test use case that requires surviving state (e.g. verifying
  restart persistence), and the volume is wiped again immediately
  after that check. Fixture/synthetic data only — `pw-safety`
  discipline applies. Real data waits for a deployment the owner
  has explicitly designated as persistent, which does not exist yet.
  Reason: during UAT the person must never wonder whether what they
  see is leftover state; a confusing slate is a trust failure, and
  Rylee's real data is too valuable to rest in a system whose
  persistence and auth seams are still being walked.
