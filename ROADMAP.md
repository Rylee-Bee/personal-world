# Roadmap

Direction, not promises. Project Worlds is developed by one human with
an AI-agent workflow; items move between horizons freely and nothing
here is a delivery commitment. Dates exist only where a milestone has
already happened.

Grounding: every item below is recovered from the design handoff's
engineering-requirements section, implemented-but-incomplete seams in
the code, or explicit spec documents — not invention.

For the current completion target, `docs/PERSONAL-WORLD-FINISH-LINE.md`
is authoritative. This roadmap organizes direction; it does not redefine
what "finished enough to live in every day" means.

For the ordered work toward that target — phases, dependencies,
acceptance criteria, and approved decisions — see the **dated**
`docs/PERSONAL-WORLD-COMPLETION-PLAN.md` (v1, 2026-09-10; its phase
statuses predate the T15 cutover, Workshop v3, and the 2026-09-15 finish
pass — verify against code). This roadmap does not duplicate it; items
below are direction and history, not the execution plan.

## Now

Work that completes or hardens what 0.1 already promises or is required
by the current finish line:

- **Workshop v3 implementation.** Design convergence is COMPLETE
  (2026-09-13): 16 implementation frames identified in
  [`.project/design/WORKSHOP-V3-MANIFEST.yaml`](.project/design/WORKSHOP-V3-MANIFEST.yaml),
  philosophy "The world knows how loudly to exist" (17:8873), audit
  18:2. **Implementation status is partial and was consolidated
  downgrade-on-purpose (verified 2026-09-15 against the code, not the
  issue):** the first Figma-faithful build (`5837c99`) rendered the
  frames with a 1535-line Today screen, but it was not wired to real
  API data; the integration pass
  (`4b7ec55`/`565dcd1` — "wire all screens to real API") replaced it with
  genuinely data-driven screens, trading composition fidelity for truth.
  Today is therefore Quiet Day (17:481) only.
  **Referenced by current implementation code:** 17:481, 17:1014,
  17:1515, 17:1681, 17:1929, 17:2268, 17:2536, 17:2752, 17:3039,
  17:3762, 17:4565, 17:5485.
  **Not present as implemented states in the current tree:** Today
  Bad Day (17:2117) and Question (17:6245) — the canonical frames are
  recorded and `ShellModes.ts` documents their modes, but the screens do
  not render them ([issue #52](https://github.com/Rylee-Bee/personal-world/issues/52));
  Notifications (17:6369) — the only artifact was an
  unused, self-described stub, removed 2026-09-15; Journal Reading
  (17:5763) — no frame reference in the frontend (UNKNOWN whether the
  existing Journal screen covers it).
  An unfinished attempt at Bad Day/Question plus screen-level shell-mode
  switching is preserved on branch `wip/today-workshop-v3-frames`
  (not merged; it counts dirty/ahead/behind local git work as attention).
  [issue #37](https://github.com/Rylee-Bee/personal-world/issues/37) was
  CLOSED at the 16/16 engineering-gate reading and does not track the
  current gap. Owner reservations remain open: companion presence scale,
  waves-ladder/waterline placement, mobile-nav item count, chat send
  button sizing, login key icon.

- **Provider-neutral SSO / stronger authentication.** REQUIRED by the
  current finish line, not yet complete. Preserve the existing
  fail-closed bearer-token boundary while adding a provider-neutral
  identity/SSO path that can integrate with existing systems, supports
  step-up authentication for severe/destructive actions and sensitive
  vault/secure-note access, and retains recoverable bootstrap/break-glass
  access. The architecture must not depend on Authelia specifically and
  should remain suitable for future non-browser clients.
- **Theme Pack implementation.** Partially done (2026-09-07):
  companion selection and accent palettes are wired through the
  preference system with approved art served from the package. Still
  implemented: `ThemePackRegistry` loads manifest files and serves theme APIs.
  Still open: full frontend application of pack assets/state poses and per-pack
  icon families from `design/THEME_PACK_FRAMEWORK.md`'s manifest format.

## Next

Relevant remaining work and partially implemented seams:

- **Source-control enrichment.** Native Git feeds dashboard/chat context;
  GitHub enrichment (`providers/github.py` + `/api/source-control/enrichment`)
  adds remote identity, open PRs/issues, default branch via the gh CLI.
  Broader project/repository mission control remains finish-line work.
- **Ingress rollups.** `providers/traefik_ingress.py` and
  `/api/ingress/rollups` now exist. Verify configured-provider behavior in the
  deployment; implementation alone is not operational acceptance.

## Exploring

Preserved ideas, no commitment:

- Open design questions from the Workshop v3 stage beyond the
  implemented frames (per-frame composition, emotional volume, and
  the emotional-volume principle "The world knows how loudly to
  exist" — now an implementation/design principle, not copywriting;
  see [`.project/design/CURRENT.md`](.project/design/CURRENT.md)).
- Further mobile refinement; the current CSS already has phone bottom navigation
  and larger-target adaptations (see canonical responsive rules).
- Capability/accessibility interview beyond the implemented five-step setup wizard.
- The Figma remote MCP (mcp.figma.com) rejects non-catalog clients;
  if OpenCode is ever catalog-listed, the desktop-MCP bridge could be
  simplified (tracked in
  [issue #39](https://github.com/Rylee-Bee/personal-world/issues/39)).

## Completed

- 2026-09-15: project-estate vocabulary re-wired. `ProjectsScreen` now
  consumes the shared helpers (`frontend/src/lib/project-status.ts` +
  `frontend/src/lib/observation-age.ts`) instead of a local duplicate:
  a category-labelled status chip, one plain human sentence per project
  (diverged / unpublished / local work / unknown), the dated "Observed …"
  line, and technical guts behind one nested disclosure
  ([issue #51](https://github.com/Rylee-Bee/personal-world/issues/51)).

- 2026-09-15: finish pass + integration pass merged to `main`. PR #50
  (`8f061e7`) landed the D1–D3 auth/authority convergence
  (bearer/session/OIDC on one `Principal`; step-up bound to a
  credential-verified human session) and the repo/docs reorg. PR #53
  (`0445770`) landed the finish pass: honest Today capability health
  (`frontend/src/lib/capability-health.ts`), vault status reporting real
  Fernet state (fail-closed, no base64 fallback), one meaning for the
  `capabilities` API key (`declared_capabilities` split out), the
  canonical Figma implementation contracts tracked, deterministic +
  sanitized documentation screenshots, and the corrected ROADMAP/CURRENT
  claims. `main` @ `0445770`: 873 backend / 343 frontend / 54 e2e green;
  `validate` + `publish-image` CI green.

- Shipped earlier (moved here from Now/Next in the 2026-09-15 docs-truth
  pass so those horizons list only remaining work; details preserved):
  - **Secret vault** (2026-09-09): Fernet-encrypted file vault
    (`/data/vault.enc`, PBKDF2-600k) behind real unlock/lock/set/delete/
    names endpoints; the image installs `cryptography` so the container
    path encrypts. Without the crypto extra it fails closed — `unlock`
    reports `unavailable`, no secret is stored, status honestly reports
    `encrypted: false`. Native HTTP backend selection and stronger
    re-authentication remain open.
  - **Accessibility-preference → dashboard wiring** (2026-09-07):
    preferences apply live (text scale, density, targets, companion,
    accent); the floor stays test-enforced. Remaining polish: more
    granular reading preferences.
  - **Chat surface** (2026-09-07, extended 2026-09-09): first-class
    surface with a provider-neutral adapter (`ollama`/`openai_compat`),
    trimmed read-only world-context injection, honest
    not_configured/unavailable states, conversation history. Remaining:
    streaming responses, richer per-surface context.
  - **Quick actions** (2026-09-09): "Add a note" composer
    (`POST /api/journal`) + step-up writes.
  - **Apps/Services launcher** (2026-09-09): `GET/PUT /api/apps`
    registry (`data/apps.json`, step-up gated, journal-audited) +
    dashboard Services card.

- 2026-09-09: first-run setup wizard /setup-wizard (5 steps,
  low-cognition, skippable pieces; world.name fact + companion pref
  persisted on Finish; deep link from /login for fresh installs;
  11 tests pins structure).

- 2026-09-09 late: per-user preferences / journal paths behind
  PW_IDENTITY_MODE (issue #8 phase 1), /api/identity/principal
  read surface, step-up auth on prefs PUT, /api/journal pair
  route the caller's own tree. Tests: 335 passed.

- 2026-09-09 night (issue #8 phases 2+3): provisioning API
  (POST/GET/DELETE /api/identity/users, admin+step-up; token shown
  once, stored hashed); multi-mode bootstrap keeps the instance
  token as the primary person's credential; agents as owned
  principals with narrow scopes (read/write/journal/apps; token
  shown once); person-only guard refuses agents on prefs/journal;
  disable revokes access everywhere; 9 new tests prove the
  two-user acceptance core. Remaining for #8: provider-neutral
  OIDC attach, share-records UI. 361 tests passing.

- 2026-09-09 evening: subscription-usage card on Today (real Kilo
  data via the lab adapter); ChatContract.health seam; Wired the
  reminder scheduler to a single fastapi app; first-run runbook
  doc; loopback-or-private-only vault GET; source-control
  discover_repositories gains optional depth-limited recursion;
  GitHub issues #14, #15, #16, #17, #18 closed with evidence.
- 2026-09-06: core world model, CLI, API, dashboard shell, journal,
  exports, provider framework with zero-provider boot.
- 2026-09-06: standalone deployment, CI, security gates, license.
- 2026-09-06: design handoff, Figma roundtrip, canonical token
  reconciliation, companion character system, icon system, screen
  library.
- 2026-09-07: public-safety hardening, history sanitization,
  public-safety regression gate.
- 2026-09-09: container daily-use bring-up — in-container git for the
  native source-control baseline, MiMo cloud-chat verified live, real
  encrypted vault (issue: base64 fallback + missing `cryptography`
  found and closed), provider-key env passthrough, world seeded for
  first daily use, full suite green.
- 2026-09-12: trunk unification, product rename to Project Worlds,
  Play-Nice adoption, OCI image distribution via GHCR, T15 React-UI
  cutover.
- 2026-09-13: Workshop v3 becomes the implementation design authority
  (16 canonical frames + philosophy + audit committed from Figma MCP
  evidence, `ce4af01`); first Workshop v3 implementation — Today —
  Quiet Day (17:481) — landed at `874fb69` (D0–D3 pass, D4 pending
  owner review); first end-to-end proof of the Figma desktop MCP →
  SSH-reverse-tunnel → implementation workflow. Multi-frame run
  (2026-09-13): Question (17:6245) at `e682654` and Mobile Today
  (17:1929) at `ed9b3b2` implemented from preserved canonical
  evidence during the bridge outage (3/16; remaining frames blocked
  on fresh MCP retrieval).
