# Plan — Worlds

This file owns **product direction**, not task state.

Current architecture: [ADR-0008 — the front door](../docs/adr/0008-front-door.md).
Current work: GitHub Issues. Current code/runtime state:
[`CURRENT.md`](CURRENT.md).

## North star

Things come to the person.

Worlds should gather what changed, what needs attention, what can wait, and
what is interesting without requiring someone to hunt through tools or remember
where everything lives.

It should stay useful on a low-capacity day and still open all the way down for
deep inspection when wanted.

Fun, personality and visual character are requirements. They do not get to
hide state, move structural landmarks, or weaken accessibility.

## Current front door

The stable landmarks are:

```text
Home · Connect · Memory · Settings
```

- **Home** gathers useful cards and calm attention.
- **Connect** describes outside systems as replaceable providers and recipes.
- **Memory** keeps durable personal state with deterministic local search and
  understandable export/restore.
- **Settings** owns configuration and comfort without lowering the
  accessibility floor.

Worlds owns meaning. Providers own mechanics.

A provider's API shape must not become the product's vocabulary.

## Experience rules

1. Real state before decorative certainty.
2. One obvious path before several clever paths.
3. Important exceptions before routine success.
4. Technical depth stays reachable through progressive disclosure.
5. Configuration round-trips through documented files. No invisible UI-only
   canon.
6. Personal state has explicit ownership.
7. Consequential actions use one authority path and leave receipts.
8. Themes and character packs may change presentation, voice and moments, not
   product structure.
9. Small slices should end in something a person can actually inspect.
10. Production cutover is an owner decision, separate from source readiness.

## Rebuild lane

`rebuild/front-door` is the active integration branch for the clean rebuild
authorized by ADR-0008.

It is not production merely because it is ahead of `main`.

The remaining bounded work is tracked in:

- #262 — finish Phase 4 retirement + cutover readiness.
- #263 — reconcile applicable `main` maintenance into the rebuild.

Anything else discovered during that work either belongs inside those
acceptance boundaries or gets its own issue. Do not grow this file into a
hidden backlog.

## Preserve

Keep recoverable:

- character and companion canon,
- deliberate artwork and source rigs,
- accessibility and human-reliability contracts,
- accepted ADRs and decision history,
- export/restore paths for durable state,
- the preserved pre-front-door source/runtime rollback handles until cutover is
  accepted and verified.

## Parked ideas are not commitments

Older plans mention specific inboxes, media integrations, social sources,
Workbench/Node ideas, visual directions and implementation sequences.

Those are idea/history sources. They do not authorize work simply because they
remain in Git.

Promote an idea by making the current architecture decision and bounded work
explicit.

## Done

A source slice can be complete without being deployed.

A production change is complete only when:

```text
source ready
→ relevant gates pass
→ review/integration complete
→ owner approves cutover/deploy
→ runtime revision verified
→ rollback remains understandable
```

Green CI is necessary evidence. It is not the same thing as "Rylee is now
running this."
