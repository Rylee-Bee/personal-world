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
acceptance criteria, approved decisions, and what is next — see
`docs/PERSONAL-WORLD-COMPLETION-PLAN.md`. This roadmap does not duplicate
it; items below are direction and history, not the execution plan.

## Now

Work that completes or hardens what 0.1 already promises or is required
by the current finish line:

- **Workshop v3 implementation.** STARTED (2026-09-13): the design
  convergence is complete (16/16 canonical frames identified in
  [`.project/design/WORKSHOP-V3-MANIFEST.yaml`](.project/design/WORKSHOP-V3-MANIFEST.yaml),
  philosophy "The world knows how loudly to exist" (17:8873), audit
  18:2 — all revised frames READY FOR IMPLEMENTATION), and the first
  frame is implemented: **Today — Quiet Day (17:481)** at `874fb69`
  (D0–D3 pass; D4 human review pending). Remaining: the other canonical
  surfaces/states — Mobile Today 17:1929 is the natural next slice —
  via the [personal-world-implement-figma](.agents/skills/personal-world-implement-figma/SKILL.md)
  workflow. Tracked in
  [issue #37](https://github.com/Rylee-Bee/personal-world/issues/37).
  Two owner reservations remain open from the first slice: companion
  presence scale, and the waves-ladder decoration (fetched, unplaced).

- **Secret vault.** DONE (2026-09-09): Fernet-encrypted file vault
  (`/data/vault.enc`, PBKDF2-600k) behind real unlock/lock/set/
  delete/names endpoints; the image now installs `cryptography` so
  container path includes encryption. Minimal installs without the crypto extra
  still fall back to base64; native HTTP backend selection and stronger
  re-authentication remain incomplete. See `docs/ARCHITECTURE.md` for the current
  boundary. The UI lists names rather than redisplaying stored values.

- **Accessibility-preference → dashboard wiring.** DONE (2026-09-07):
  preferences render server-side and apply live in the dashboard
  (text scale, density, targets, companion, accent); the floor stays
  test-enforced. Remaining polish: more granular reading preferences.
- **Chat surface.** DONE (2026-09-07, extended 2026-09-09): Chat is a
  first-class surface with a provider-neutral adapter (`ollama` or
  `openai_compat` connections), a trimmed read-only world-context
  injection, honest not_configured/unavailable states, and
  conversation history. Verified end-to-end in-container against the
  Xiaomi MiMo cloud endpoint (2026-09-09); provider keys reach the
  core by env indirection. Remaining: streaming responses, richer
  per-surface context.
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
- **"Last observed" age display** for stale surfacing.
- Quick actions — DONE 2026-09-09: "Add a note" composer (POST /api/journal) + step-up writes; more verbs can follow.
- Apps/Services launcher — DONE 2026-09-09: GET/PUT /api/apps registry (data/apps.json, step-up gated, journal-audited) + dashboard Services card.

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
  SSH-reverse-tunnel → implementation workflow.
