# Project Worlds — Documentation

Start here. This page answers **where truth lives**, so a new reader
(agent or human) can navigate the repository without archaeology.

Project Worlds was renamed from "Personal World" on 2026-09-12;
technical identifiers (package `personal_world`, CLI `personal-world`,
repo `Rylee-Bee/personal-world`) are intentionally unchanged.

## Canonical sources of truth

One authority per subject. Where a summary and its source disagree, the
source wins.

| Subject | Canonical source | Notes |
|---|---|---|
| Current state | [`.project/CURRENT.md`](../.project/CURRENT.md) | The single current-state pointer. Routes; does not duplicate. When it and a canonical file disagree, the canonical file wins. |
| Architecture | [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) | Current structure: world model, API surface, identity/auth, Vault, daily loop, export contracts. |
| World-model invariant | [`docs/NATIVE-BASELINE-AND-ENRICHMENT.md`](NATIVE-BASELINE-AND-ENRICHMENT.md) | Normative; enforced by `personal-world framework validate`. |
| Contracts index | [`AGENT_CONTRACTS.md`](../AGENT_CONTRACTS.md) | Registry of every contract, trigger, and authority. |
| Accessibility | [`docs/accessibility/ACCESSIBILITY_CONTRACT.md`](accessibility/ACCESSIBILITY_CONTRACT.md) | Non-negotiable. Siblings: walkthrough, responsive rules, preference schema. |
| Human reliability | [`docs/HUMAN_RELIABILITY_CONTRACT.md`](HUMAN_RELIABILITY_CONTRACT.md) | Calm defaults, honest status, recoverability. |
| Security / public boundary | [`SECURITY.md`](../SECURITY.md) | Gate: `tests/test_public_safety.py`. |
| Provider-neutral rule | [`docs/NATIVE-BASELINE-AND-ENRICHMENT.md`](NATIVE-BASELINE-AND-ENRICHMENT.md) + [ADR 0001](adr/0001-capabilities-core-owned-providers-optional.md) | Capabilities core-owned; providers optional. |
| Providers (how to add) | [`docs/PROVIDERS.md`](PROVIDERS.md) | Plus [`docs/surfaces/PROVIDER-MATRIX.md`](surfaces/PROVIDER-MATRIX.md) for the current map. |
| Design (current) | [`.project/design/CURRENT.md`](../.project/design/CURRENT.md) | Workshop v3 authority; 16 canonical frames in [`.project/design/WORKSHOP-V3-MANIFEST.yaml`](../.project/design/WORKSHOP-V3-MANIFEST.yaml). |
| Design tokens | [`design/tokens.json`](../design/tokens.json) | Consumed by `frontend/src/tokens.css` (generated via `frontend/scripts/gen-tokens.mjs`). |
| V0.1 design baseline | [`docs/DESIGN-HANDOFF.md`](DESIGN-HANDOFF.md) | Dated baseline, not a current feature inventory. |
| Surfaces (UI/API/CLI/tool/storage/auth) | [`docs/surfaces/MASTER-SURFACE-REGISTRY.md`](surfaces/MASTER-SURFACE-REGISTRY.md) | Extraction index; all IDs resolve here. Verified map: [`docs/repo/WIRING-READINESS.md`](repo/WIRING-READINESS.md). |
| Operations / deployment | [`docs/OPERATIONS.md`](OPERATIONS.md) | Local run, containers, health. |
| Product target | [`docs/PERSONAL-WORLD-FINISH-LINE.md`](PERSONAL-WORLD-FINISH-LINE.md) | What "finished enough to live in" means. |
| Completion plan | [`docs/PERSONAL-WORLD-COMPLETION-PLAN.md`](PERSONAL-WORLD-COMPLETION-PLAN.md) | Dependency-ordered phases toward the finish line. |
| Decisions | [`.project/DECISIONS.md`](../.project/DECISIONS.md) + [`docs/adr/`](adr/) | Durable decisions and ADRs. |
| Repo inventory | [`docs/repo/REPOSITORY-INVENTORY.md`](repo/REPOSITORY-INVENTORY.md) | What every major artifact is, and its status. |
| Wiring readiness | [`docs/repo/WIRING-READINESS.md`](repo/WIRING-READINESS.md) | GREEN/YELLOW/RED/GRAY per subsystem for the next wiring pass. |
| Historical receipts | [`docs/history/`](history/README.md) | Archived one-off merge receipts and handoffs (2026-09-13). |

## The full map

[`docs/INDEX.md`](INDEX.md) is the exhaustive document index with the
status vocabulary (Canonical / Normative / Spec / Archived).

## Repository layers

| Layer | Location | Holds |
|---|---|---|
| Product docs | `docs/` | Architecture, contracts, accessibility, product, surfaces, operations, history. |
| Durable project context | `.project/` | Current-state pointer, decisions, design authority, Play-Nice participants. |
| Contracts (shared library) | `.contracts/` + `.project/contracts/` | Play-Nice adoption manifests (see the duplicate note in the inventory). |
| Runtime | `src/personal_world/` | FastAPI app, CLI, providers, domain modules. |
| Frontend | `frontend/` | React + Vite + TypeScript SPA. |
| Design art | `design/` | Tokens, frames, companions, icons. `design/handoff/` is archived (do not edit). |

## Working rules

- [`AGENTS.md`](../AGENTS.md) — worktrees, staging discipline, no `git add -A`.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — how to propose changes.
- Validation: `uv run pytest --timeout=30` and
  `uv run personal-world framework validate --json`.