# PORTING & CONTRIBUTING — the seams, so "someday" is bounded
*How to move or extend Project Worlds without breaking its soul.*

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
| Templates/personas | `config/prompts/**` (plain markdown) | your own words |

## Contributing (play nice)
- One checkout per lane; never `git add -A`; use `scripts/safe-commit.sh`.
- Tests are the gate: `uv run pytest --timeout=30` and
  `uv run personal-world framework validate --json`.
- Dev loop: `scripts/dev.sh up` / `newest` / `wipe` / `status` / `logs`.
- New user-facing copy: plain words, active voice, no guilt, no jargon.

## Porting checklist (someday)
- [ ] Keep the four soul items above.
- [ ] Re-implement against `/api/manifest`, not against internals.
- [ ] Preserve honest states + gated writes in the new home.
- [ ] Re-run the accessibility gate on the new surface.
- [ ] Ship a `QUICKSTART` equivalent: one command, wizard, no manual tokens.
