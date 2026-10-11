# Current State — Worlds

> **Live state** (last commit, CI on main, open PRs, recent merges, missions): `lab enter` at session start, or `now-block --print .` from this repo. This file keeps only what a command cannot tell you.

This file is the **current-state router** for Worlds.

Do not turn it into a session diary, test transcript or merge ledger. Git,
GitHub, the running app, ADRs and focused docs own those facts.

## Main is the front door

`main` carries the front-door rebuild authorized by
[ADR-0008](../docs/adr/0008-front-door.md). It was merged from
`rebuild/front-door` in PR #277 (2026-10-06). That is a **source** cutover.

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

Those statements describe source on `main`, not the running instance.

## Current work

Issues #262 (finish Phase 4 retirement and cutover readiness) and #263
(main maintenance reconciliation) were closed as not planned on 2026-10-07.
Their remainder is carried in [docs/BACKLOG.md](../docs/BACKLOG.md). #263 is
largely overtaken by the merge of the rebuild into `main`.

There are no routine session handoffs to resume.

## What is deployed

Merging to `main` publishes the image; it does not deploy. Deploying the
front door is a deliberate manual step.

A merge, CI run or published image is not proof of the running instance.
Current runtime revision must come from the running application's `/healthz`
evidence through the private operator path.

If that evidence has not been checked, runtime state is **UNKNOWN**.

Deploying to production requires explicit owner approval.

## Canonical routes

| Need | Source |
| --- | --- |
| code truth | Git + GitHub on `main` |
| live runtime revision | running `/healthz`, not prose |
| architecture | `docs/adr/0008-front-door.md` |
| rebuild contracts | `docs/rebuild/CONTRACTS.md` |
| durability | `docs/rebuild/DURABILITY.md` |
| product direction | `.project/PLAN.md` |
| durable decisions | `.project/DECISIONS.md` + `docs/adr/` |
| current work | GitHub Issues + `docs/BACKLOG.md` |
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
git log --oneline --decorate -12 origin/main
gh issue list --repo rylee-bee-labs/personal-world --state open
```

Then read [docs/BACKLOG.md](../docs/BACKLOG.md) and the current code.

If evidence is missing, say **UNKNOWN**.
