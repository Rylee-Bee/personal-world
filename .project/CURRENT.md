# Current State — Worlds

This file is the **current-state router** for the front-door rebuild.

Do not turn it into a session diary, test transcript or merge ledger. Git,
GitHub, the running app, ADRs and focused docs own those facts.

## This branch

`rebuild/front-door` is the active clean rebuild authorized by
[ADR-0008](../docs/adr/0008-front-door.md).

It is **not production**.

The stable landmarks are:

```text
Home · Connect · Memory · Settings
```

Worlds owns meaning. Providers own mechanics. Configuration is files. Memory
is durable. Consequential actions use one explicit authority path.

## Rebuild progress

The rebuild has landed the main foundation and experience lanes, including:

- front-door contracts and application foundation,
- owner/agent authority + confined dispatch,
- Home, Connect and Memory paths,
- provider/recipe model,
- room/0 service integration,
- Memory backup/restore and deterministic search,
- production-app assembly,
- framework validation re-anchored onto the new app,
- restore drill + generated OpenAPI/route inventory on the new app,
- trimmed CLI and front-door container entrypoint,
- durable Companion conversation identity.

Those statements describe source progress, not a production cutover.

## Current work

GitHub Issues is the durable queue:

- **#262** — finish Phase 4 retirement and cutover readiness.
- **#263** — reconcile applicable `main` maintenance into this branch before
  cutover.

There are no routine session handoffs to resume.

## Relationship to main

`main` remains the default/pre-front-door application and maintenance line.

Derive the relationship:

```sh
git fetch origin
git rev-list --left-right --count origin/main...origin/rebuild/front-door
```

At the 2026-10-04 reconcile, this branch was 145 commits ahead and 3 commits
behind `main`. Issue #263 preserves that dated observation and owns the
meaningful reconciliation.

Do not blindly merge old-app prose or compatibility into this clean rebuild.

## What is deployed

The front-door rebuild has not been cut over.

A merge, CI run or published image is not proof of the running instance.
Current runtime revision must come from the running application's `/healthz`
evidence through the private operator path.

If that evidence has not been checked, runtime state is **UNKNOWN**.

Production cutover requires explicit owner approval.

## Canonical routes

| Need | Source |
| --- | --- |
| rebuild code truth | Git + GitHub on `rebuild/front-door` |
| live runtime revision | running `/healthz`, not prose |
| architecture | `docs/adr/0008-front-door.md` |
| rebuild contracts | `docs/rebuild/CONTRACTS.md` |
| durability | `docs/rebuild/DURABILITY.md` |
| product direction | `.project/PLAN.md` |
| durable decisions | `.project/DECISIONS.md` + `docs/adr/` |
| current work | GitHub Issues |
| security/public boundary | `SECURITY.md` |
| accessibility | `docs/accessibility/ACCESSIBILITY_CONTRACT.md` |
| agent rules | `AGENT_POLICY.md` + `AGENT_CONTRACTS.md` + `AGENTS.md` |

## Historical records

Dated `HANDOFF-*` files and pre-ADR-0008 plans are provenance.

They answer "how did we get here?", not "what should I do now?"

## Resume

```sh
git fetch origin
git status --short
git log --oneline --decorate -12 origin/rebuild/front-door
git rev-list --left-right --count origin/main...origin/rebuild/front-door
gh issue list --repo Rylee-Bee/personal-world --state open
```

Then inspect #262 / #263 and the current branch code.

If evidence is missing, say **UNKNOWN**.
