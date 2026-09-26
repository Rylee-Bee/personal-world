# PORTING & CONTRIBUTING — the seams, so "someday" is bounded

> **Status:** Reference · **Verified:** 2026-09-26 · **Canonical for:** the swap-and-contribute seams (what any port must keep) · **Read this if:** you want to move, extend, or contribute to Worlds without breaking its non-negotiables.

**In short:** this names the four things any port must preserve (the DNA,
the accessibility floor, honesty, the Play-Nice contracts) and the seams
you may swap underneath them. It is a how-to, not a roadmap.

*How to move or extend Worlds without breaking its soul.*

## What must survive any port (the soul)
1. **The DNA:** smallest-reliable-first · depth-on-demand · soft-by-default ·
   everyone-at-any-level-included.
2. **The accessibility floor** (`docs/accessibility/ACCESSIBILITY_CONTRACT.md`) —
   non-negotiable, enforced by tests.
3. **Honesty:** no fake data; explicit empty/loading/not_configured/unavailable/
   stale/unknown states; writes always gated (observe→propose→approve→act).
4. **The Play-Nice contracts** (`.project/contracts/adoption.yaml`).

## The seams (swap these; keep everything else)
| Seam | Where | Swap it for |
|---|---|---|
| Frontend | `ui/` (React rebuild, served at `/`) | any UI that speaks the API |
| API surface | `/api/manifest` (the "Lego box") | your own client |
| Capabilities | `src/personal_world/providers/` + registry | any backend/external service |
| Brain | `reasoning` capability (local Ollama default) | any model that can tool-call |
| Storage | `data/` boundary (`docs/IDENTITY-BOUNDARY.md`) | any durable store |
| Auth | local token/session **or** generic OIDC | any IdP |
| Rooms | the Play-Nice ROOM contract `room/0` (`.project/contracts/adoption.yaml`) | any independent service that serves the contract |
| Templates/personas | `config/prompts/**` (plain markdown) | your own words |

## Contributing (play nice)
- One checkout per lane; never `git add -A`; use `scripts/safe-commit.sh`.
- Tests are the gate: `uv run --extra test --extra crypto pytest --timeout=60 -o addopts="" -q`
  and `uv run personal-world framework validate --json`.
- Dev loop: `scripts/dev.sh up` / `newest` / `wipe` / `status` / `logs`.
- New user-facing copy: plain words, active voice, no guilt, no jargon.

## Porting checklist (someday)
- [ ] Keep the four soul items above.
- [ ] Re-implement against `/api/manifest`, not against internals.
- [ ] Keep accurate state labels and gated writes in the new location.
- [ ] Re-run the accessibility gate on the new surface.
- [ ] Ship a `QUICKSTART` equivalent: one command, wizard, no manual tokens.
