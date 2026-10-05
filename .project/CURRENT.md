# Current State — Worlds

> **Live state** (last commit, CI on main, open PRs, recent merges, missions): `lab enter` at session start, or `now-block --print .` from this repo. This file keeps only what a command cannot tell you.

This file is the **current-state router**. It should stay short.

Do not turn it into a session diary, a test transcript, a deployment ledger,
or a second roadmap. Git, GitHub, the running app, ADRs, and focused docs own
those facts.

## The two active code lines

Worlds currently has two legitimate code states:

| Ref | Job | Authority |
| --- | --- | --- |
| `main` | current public/default branch and pre-front-door application | truth for what `main` actually contains |
| `rebuild/front-door` | active clean rebuild authorized by ADR-0008 | truth for the next front-door application until cutover |

Do not silently read behavior from one branch into the other.

Derive the relationship instead of copying SHAs here:

```sh
git fetch origin
git rev-list --left-right --count origin/main...origin/rebuild/front-door
```

At the 2026-10-04 repository reconcile, the rebuild was 145 commits ahead and
3 commits behind `main`. That observation is preserved in GitHub issue #263;
the live command above is the current answer.

## Direction

The current architecture decision is
[`docs/adr/0008-front-door.md`](../docs/adr/0008-front-door.md).

The stable front-door landmarks are:

```text
Home · Connect · Memory · Settings
```

Worlds owns meaning. Providers own mechanics. Configuration is files. Memory
is durable. Consequential actions use one explicit authority path.

The owner-approved product intent and experience rules are routed through
[`.project/PLAN.md`](PLAN.md). Older plans, handoffs and design epochs remain
evidence, not current direction.

## What is deployed

A merge or published image is **not** proof of the running instance.

The last runtime evidence recorded in this repository before this reconcile
named the preserved pre-front-door build. That is dated evidence only.

For a current runtime claim, inspect the running instance's `/healthz`
commit/revision through the private operator path. If that evidence is not
available, runtime state is **UNKNOWN**.

Production cutover of the front-door rebuild still requires explicit owner
approval.

## Current work

GitHub Issues is the durable work queue.

- **#262** — finish Phase 4 retirement and cutover readiness.
- **#263** — reconcile applicable `main` maintenance into
  `rebuild/front-door` before cutover.

Do not bury unfinished work in a handoff, PLAN paragraph, or "Next:" section
when it needs to survive the session.

## Canonical routes

| Need | Source |
| --- | --- |
| current branch/code truth | Git + GitHub |
| live runtime revision | running `/healthz` evidence, not prose |
| front-door architecture | `docs/adr/0008-front-door.md` |
| product direction | `.project/PLAN.md` |
| durable decisions | `.project/DECISIONS.md` + `docs/adr/` |
| current work | GitHub Issues |
| public/security boundary | `SECURITY.md` |
| agent policy | `AGENT_POLICY.md` + `AGENT_CONTRACTS.md` |
| accessibility | `docs/accessibility/ACCESSIBILITY_CONTRACT.md` |
| human reliability | `docs/HUMAN_RELIABILITY_CONTRACT.md` |
| operations | `docs/OPERATIONS.md` |
| document map | `docs/INDEX.md` |

## Handoffs and dated records

Files named `HANDOFF-*`, dated receipts, old CURRENT sections, and historical
plans are provenance.

They may explain **how we got here**. They do not determine **what is true
now**.

Routine work should leave truth in code, a PR, an issue, an ADR/decision when
needed, and this router only when a stable pointer changes. Do not create a
handoff merely to relay session state.

## Resume

```sh
git fetch origin
git status --short
git log --oneline --decorate -12 origin/main
git rev-list --left-right --count origin/main...origin/rebuild/front-door
gh issue list --repo Rylee-Bee/personal-world --state open
```

Then inspect the branch you are actually changing.

If evidence is missing, say **UNKNOWN**.
