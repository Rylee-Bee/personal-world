# Project Worlds — Participant Packs

*(Renamed from "Personal World" 2026-09-12 — product identity only.)*

One directory per regular collaborator: a shared boundary document —
"what does this participant and this project know about working together?"

Current packs:

| Participant | Type | Pack status | Contract gate | Commitment |
|---|---|---|---|---|
| `figma` | design-service | **ACCEPTED** | PASS | ACTIVE |
| `big-pickle` | agent | **OPTIONAL / NON-AUTHORITATIVE** | N/A | NONE (no act of adoption) |
| `kilo` | agent-harness (application layer) | **OBSERVED** (not a contract adopter) | N/A | N/A |
| `minimax` | agent-brain (model layer) | **OPTIONAL / NON-AUTHORITATIVE** | N/A | NONE (no act of adoption) |

- 2026-09-12 (re-pass): Figma re-relayed her six corrected files in a
  second pass (9 + 6 task-impact sentences). The foreman verified her
  bundle identifiers and D0–D4 references against the canonical library
  on disk, applied her fully-specified corrections with provenance
  (`attestation.yaml`, `participant.yaml`, `capabilities.yaml`,
  `references.yaml`, `interaction.md`, `help-routing.yaml`), and promoted
  the pack: **ACCEPTED / PASS / ACTIVE**. See
  `figma/contract-return/RE-PASS.md` and
  `figma/help-response-write-persistence.json` for the full
  reported-complete → verified-not-on-disk → re-pass → verified → promoted
  lifecycle. This table previously lagged the promotion (stale pointer,
  corrected 2026-09-12 during a UI-convergence session cross-check).
- Acceptance is self-attested by Figma and hand-applied to disk by the
  foreman (her sandbox filesystem does not persist writes) — a recorded
  participant limitation, not wrongdoing. Treat her authority per
  `figma/participant.yaml`'s `authoritative_for` / `not_authoritative_for`
  regardless of gate status; a pack never overrides accessibility,
  runtime evidence, or repo-canonical token values.
- 2026-09-12 cross-check: `figma/references.yaml` had a structural YAML
  bug (44 of 47 frame entries were missing the `provenance:` parent key,
  making the file fail to parse) — fixed in place, re-validated (48
  entries, all with `provenance`, parses clean with PyYAML).
- 2026-09-12: `big-pickle/participant.yaml` added as **optional,
  non-authoritative** routing metadata assembled from the play-nice
  verification walk (65/65 contracts read; 62 accepted without
  reservation, 3 with MODIFY-grade reservations). No new schema — mirrors
  the figma pack structure. NOT a self-attested acceptance gate and no
  ACTIVE commitment; real mutation tasks still run the full task gate in
  the pack's `attestation:` block.
- 2026-09-12: `kilo/` added as the **application-layer harness profile**
  (`participant.yaml`, `capabilities.yaml`, `interaction.md`,
  `help-routing.yaml`, `ONBOARDING.md`). It describes the Kilo
  CLI/TUI independently of whichever brain is loaded; its authority
  is over the tool surface, confirmation policy, and session
  lifecycle, NOT over reasoning quality. A future Kilo session can
  bootstrap itself by reading `kilo/ONBOARDING.md`. The pack is
  intentionally not a contract adopter.
- 2026-09-12: `minimax/` added as the **brain-layer profile for the
  MiniMax-M3 model** running inside the Kilo harness in a single
  onboarding experiment session. **Optional, non-authoritative,
  PROVISIONAL** — claims derive from one session's observed behavior
  only. Coexists with `big-pickle/` (different session, different
  variant per its own provenance) rather than replacing it; both are
  preserved so future sessions can see observations from multiple
  brains without rewriting history.
- A pack NEVER becomes canonical project truth. Deleting any pack directory
  must not corrupt this project.
- Packs carry no secrets — authentication is symbolic references only.

## Adding or modifying a participant pack

Authoring guidance — not a new canonical contract. Derived from
observed session friction (2026-09-12) and enforced by the
`personal-world framework validate-packs` CLI subcommand plus the
`pack-id-collision` rule in `src/personal_world/framework.py`.

Before writing:

1. Discover global and applicable project-local participant packs
   (list `.project/participants/` and read its `README.md`).
2. Check whether the participant ID or scope already exists. If a pack
   with the same `id` already exists, you are in a collision case —
   go to the collision block below.
3. If ownership or identity is ambiguous (e.g. another pack's
   provenance suggests a different session, model, or host), preserve
   both and ask before writing.
4. Validate before committing:
   `uv run personal-world framework validate-packs` (or the
   equivalent `uv run pytest tests/test_framework.py::TestParticipantPackValidation`).

If there is a collision, valid outcomes are:

```text
UPDATE EXISTING      only with explicit owner authority and provenance
CREATE SIBLING       keep both packs, add a NEW id, cross-reference
ABORT / ASK FOR HELP surface the collision and let the owner decide
```

Never silently merge, overwrite, or replace another participant's
evidence. The harness exposes file-write; the project authorizes it.