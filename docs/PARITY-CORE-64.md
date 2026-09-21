# PARITY-CORE-64 — orphan-route adjudication spine

**Track A (contract & parity), overnight run 2026-09-20/21 · branch
`feat/station-vnext-foundation` · base HEAD `9e798c3` · remote
`github.com/Rylee-Bee/personal-world` (PR #60).**

This is the parity spine the morning handoff surfaces: every route from the
`CONTRACT-TRIAGE-2026-09-20.md` "UNCONSUMED & UNDOCUMENTED (36)" list, judged
**fix / document / deprecate** against the actual code in this worktree — each
handler read, its decorators and auth dependencies checked, never guessed.

## Method (repeatable)

- Ground truth = the live FastAPI route table of `create_app()`, cross-checked
  against the curated `ENDPOINTS` table in
  [`src/personal_world/api_manifest.py`](../src/personal_world/api_manifest.py)
  and the generated spec `ui/src/generated/openapi.json`
  (`uv run --extra crypto python scripts/gen-openapi.py`).
- Per-handler: read the function, its `dependencies=[...]`, and its docstring;
  verify the curated row's capability/kind/gate/auth or add a correct one.

### Triage correction (evidence, not opinion)

The triage file's static analysis predates this branch's manifest state. As of
base HEAD, `api_manifest.py` curates **114 rows, all `present: true` — zero
ghost rows** — and 30 of the 36 "undocumented" routes already carry accurate
curated rows (the triage parser counted 112 rows and matched `/{param}` paths
literally, so it missed the multi-line `_e(...)` rows and named path
templates). The genuinely row-less orphans were 6: `GET /`,
`GET /api/templates`, and the four static-asset routes. No route on the list
is dead: every one is registered and serves; **zero deletions tonight (rail)**.

## Verdict vocabulary

| Verdict | Meaning |
| --- | --- |
| kept-with-row | curated manifest row exists (or was added) and matches the code; route stays on the public surface |
| documented-internal | route stays working but is not part of the Lego-box API surface (UI shell / static assets); rationale recorded here and, where it was missing, a docstring in the code |
| deprecate-candidate | nothing consumes or needs it — flagged for the owner's tap, left running (no deletions tonight) |

## The 36, judged

### A1 — routes 1–9

| Method | Path | Verdict | Row / action | Rationale |
| --- | --- | --- | --- | --- |
| GET | `/` | documented-internal | none (by design) | Station entry redirect (303 → `/setup` while first-run, 302 → `/station/` after; owner decisions #11/#12). Non-`/api` surface; the manifest curates only the `/api/*` Lego box (`endpoint_manifest` filters the rest by design). |
| GET | `/api/backup` | kept-with-row | API-028 verified; added missing handler docstring | `require_auth` read under `exports`; payload includes private state — docstring and row note both say "encrypt externally, never share raw" (matches `export.backup_payload`). |
| GET | `/api/brain/provenance` | kept-with-row | API-077-provenance verified | `require_auth` read under `brain`; reports `TemplateRegistry.provenance(...)` for Nerd Mode. |
| POST | `/api/chat/test` | kept-with-row | API-012 verified | `require_auth` only; POST verb curated as `kind=read` **with the required justification note**: it changes no local state, it does spend provider quota (docstring says the same). |
| POST | `/api/connections/config/{key}` | kept-with-row | API-022 verified | `require_step_up` in code ⇒ write/step-up row is accurate. (Triage listed it as `config/{}` — named param binds the same template.) |
| GET | `/api/exports/settings` | kept-with-row | API-025 verified; added missing handler docstring | `require_auth` read; "shareable blueprint; never personal data" — docstring now states which fields that means (bones, not the person). |
| GET | `/api/exports/story` | kept-with-row | API-027 verified; added missing handler docstring | `require_auth` read; route always renders with `include_private=False` (`StoryRenderer` excludes private entries), now stated in the code. |
| GET | `/api/exports/world` | kept-with-row | API-026 verified; added missing handler docstring | `require_auth` read; portable personal config, raw secrets structurally absent (vault-stored), output still personal data — all three claims trace to `export.world_export`. |
| GET | `/api/ingress/rollups` | kept-with-row | API-078 verified | `require_auth` read over the optional Traefik provider; unconfigured ⇒ honest `not_configured`, no crash (contract already in the docstring). |

### A2 — routes 10–18 (lab + native-lab reads)

All nine are registered `GET` routes with `dependencies=[Depends(require_auth)]`,
matching their curated rows exactly; the payloads ride on read-only providers
that shell out to the external `lab` CLI or observe native state — none of them
mutate. Consumer note: none is on the CORE-64 consumed list (they serve the
homelab/Lab screens), which is why they surfaced as "unconsumed" — they stay on
the surface because the manifest contract (decision #17) is the Lego box, not
a UI-traffic hit list.

| Method | Path | Verdict | Row / action | Rationale |
| --- | --- | --- | --- | --- |
| GET | `/api/lab/deploy` | kept-with-row | API-042 verified | `require_auth` read; `LabDeploy.observe()` via lab CLI — deploy status/history, no mutation. |
| GET | `/api/lab/health` | kept-with-row | API-041 verified | `require_auth` read; `LabHealth.observe()` across services. |
| GET | `/api/lab/resources` | kept-with-row | API-044 verified | `require_auth` read; `LabResources.observe()` (VM usage). |
| GET | `/api/lab/secrets` | kept-with-row | API-043 verified | `require_auth` read; provider returns audit metadata/counts only — row note "names/metadata only; never resolved values" is true in code. |
| GET | `/api/lab/settings` | kept-with-row | API-038 verified | `require_auth` read; docstring "Settings Reconciler status via lab CLI" matches `LabSettings.observe()` (`lab settings status --json`). |
| GET | `/api/lab/settings/diff/{service}` | kept-with-row | API-040 verified | `require_auth` read; desired-vs-live drift for one service via `lab settings diff`. |
| GET | `/api/lab/state` | kept-with-row | API-037 verified | `require_auth` read; presentation-only operator packet from the lab layer (`lab-lowbw/1`). |
| GET | `/api/native-lab/health` | kept-with-row | API-046 verified | `require_auth` read; `NativeLabHealth` over the native inventory — no homelab dependency. |
| GET | `/api/native-lab/inventory` | kept-with-row | API-045 verified | `require_auth` read; `NativeLabInventory.observe()`. |

### A3 — routes 19–27

_(appended by batch A3)_

### A4 — routes 28–36

_(appended by batch A4)_

## Full live-route spine

_(appended at A5 once all 36 are judged)_
