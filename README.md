# Worlds

> **Branch note:** this README describes the active `rebuild/front-door`
> application. It is source-ready work in progress, **not the production
> cutover**. Current routing: [`.project/CURRENT.md`](.project/CURRENT.md).

**Worlds is a calm personal front door.** It gathers useful state, memory and
outside services without making the person learn every provider underneath.

The stable landmarks are:

```text
Home · Connect · Memory · Settings
```

## What owns what

**Worlds owns meaning. Providers own mechanics.**

- **Home** composes useful cards and attention.
- **Connect** describes providers, mappings and requests in files.
- **Memory** keeps durable personal state, deterministic local search,
  history, export and restore.
- **Settings** holds configuration and comfort.
- **Companion** is presentation/conversation around the product, not a second
  authority path.
- External `room/0` systems continue as a provider kind. Worlds calls them
  services and does not absorb their implementation.

Provider API shapes do not become Worlds concepts.

## Authority

Consequential actions use one governed path:

```text
request
→ approve
→ durably consume authorization
→ dispatch at most once
→ SUCCEEDED | FAILED | UNKNOWN
```

A retry is a new action.

Project Home stays canonical for operations it governs. Other provider actions
remain explicitly owner-authorized through Worlds' own boundary.

## Configuration

Configuration is files.

UI-created configuration must round-trip through the documented YAML without
loss. Secret material is referenced symbolically and supplied at runtime.

The public repository never contains real credentials, personal memory,
private provider payloads or private deployment topology. See
[`SECURITY.md`](SECURITY.md).

## Memory

The rebuild treats Memory as durable product state from day one.

It supports the baseline:

- Kept
- Later
- Records
- History
- Find

Local deterministic search works with providers and models off. Backup/restore
is a current front-door path, not the retired old-app bundle format.

See [`docs/rebuild/DURABILITY.md`](docs/rebuild/DURABILITY.md).

## Companion and presentation

Conversation identity is durable product state.

Model, harness and inference sessions are replaceable machinery and must not
become the identity of a conversation.

Themes, Station and character packs may change look, voice and moments. They
may not change the structural landmarks, hide state, or lower the accessibility
floor.

## Current state

The rebuild branch contains the foundation, authority, provider/recipe model,
Home/Connect/Memory experience, room integration, Memory durability work and
the Phase 4 re-anchoring completed through PR #257 plus the Companion
conversation-identity clarification in #258.

Remaining durable work:

- [#262](https://github.com/Rylee-Bee/personal-world/issues/262) — finish
  Phase 4 retirement and cutover readiness.
- [#263](https://github.com/Rylee-Bee/personal-world/issues/263) — reconcile
  applicable `main` maintenance into the rebuild before cutover.

The rebuild is not production until the owner explicitly approves cutover and
the running revision is verified afterward.

## Quick start and operations

Use the branch's current guides rather than old CLI examples:

- [Quick start](docs/QUICKSTART.md)
- [Operations](docs/OPERATIONS.md)
- [Front-door contracts](docs/rebuild/CONTRACTS.md)
- [Durability](docs/rebuild/DURABILITY.md)
- [ADR-0008](docs/adr/0008-front-door.md)

## Play-Nice

Worlds adopts Play-Nice through
[`.project/contracts/adoption.yaml`](.project/contracts/adoption.yaml).

That manifest owns the current pin and applicable contract set. Contract
versions/SHAs are deliberately not duplicated in this README.

Worlds-specific floors remain authoritative in their owning sources:

- [Accessibility](docs/accessibility/ACCESSIBILITY_CONTRACT.md)
- [Human Reliability](docs/HUMAN_RELIABILITY_CONTRACT.md)
- [Security/public boundary](SECURITY.md)
- [Agent policy](AGENT_POLICY.md)

## Validation

The checked-in GitHub workflows are the authority for the complete gate set.
Common local checks:

```sh
uv sync --frozen --extra test --extra crypto
uv run pytest --timeout=30
uv run personal-world framework validate --json

cd ui
npm ci
npx tsc -b
npm run lint
npx vitest run
npm run build
npx playwright test
```

A green source check is not deployment evidence.

## Deeper map

| Need | Source |
| --- | --- |
| current state | [`.project/CURRENT.md`](.project/CURRENT.md) |
| direction | [`.project/PLAN.md`](.project/PLAN.md) |
| architecture | [ADR-0008](docs/adr/0008-front-door.md) |
| docs index | [`docs/INDEX.md`](docs/INDEX.md) |
| decisions | [`.project/DECISIONS.md`](.project/DECISIONS.md) + [ADRs](docs/adr/) |
| security | [`SECURITY.md`](SECURITY.md) |
| contribution | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

Licensed under [Apache-2.0](LICENSE).
