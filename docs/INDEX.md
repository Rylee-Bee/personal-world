# Project Worlds — Documentation Index

(Formerly "Personal World" — product renamed 2026-09-12; technical identifiers unchanged.)

The map. Every document is one sentence away; depth lives behind the
links. If a path you need is missing from this index, that is a bug —
open an issue.

## Start here

| Doc | What it is |
|---|---|
| [docs/README.md](README.md) | Where truth lives: canonical source per subject, and the repo's layers. Read this first. |
| [README](../README.md) | The front door: what this is, quick start, navigation. |
| [CHANGELOG](../CHANGELOG.md) | Curated project milestones, newest first. |
| [ROADMAP](../ROADMAP.md) | Now / Next / Exploring — direction, not promises. The single gap list. |
| [ROADMAP-AND-TODO.md](ROADMAP-AND-TODO.md) | Owner-facing alpha-status snapshot, dated; links to the canonical roadmap. |
| [PERSONAL-WORLD-FINISH-LINE.md](PERSONAL-WORLD-FINISH-LINE.md) | Canonical target daily-use experience; requirements, not implementation claims. |
| [PERSONAL-WORLD-COMPLETION-PLAN.md](PERSONAL-WORLD-COMPLETION-PLAN.md) | Dated execution plan (v1, 2026-09-10): approved decisions, dependency-ordered phases P0–P14, acceptance criteria, model routing. Phase status predates the T15 cutover / Workshop v3 — verify against code. |
| [p1/FOUNDATION-SPEC.md](p1/FOUNDATION-SPEC.md) | Historical (P1 complete) | Approved P1 implementation contract: sections API, primitive contracts, parity checklist, bounded tasks. Preserved for provenance. |
| [AGENT_POLICY.md](../AGENT_POLICY.md) | Mandatory agent preflight and decision policy. |
| [AGENT_CONTRACTS.md](../AGENT_CONTRACTS.md) | Canonical contract registry: applicability, authority, and exact entry points. |
| [STATUS.md](../STATUS.md) | Retired current-state entry point; now a pointer to [`.project/CURRENT.md`](../.project/CURRENT.md). |
| [Contributing](../CONTRIBUTING.md) | How to propose changes (humans and agents). |
| [Security](../SECURITY.md) | Reporting boundaries and the public-repo safety contract. |

## Architecture

| Doc | Status | What it is |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Canonical current | World model, current APIs/layout, identity and Vault limits, daily loop, target auth distinction. |
| [IDENTITY-BOUNDARY.md](IDENTITY-BOUNDARY.md) | Canonical current | Per-user vs instance-global state boundary (decision #13), legacy path mapping, and the sync-friendliness rule (decision #15). |
| [NATIVE-BASELINE-AND-ENRICHMENT.md](NATIVE-BASELINE-AND-ENRICHMENT.md) | Normative | The core invariant: capabilities core-owned, providers optional. Enforced by `framework validate`. |
| [adr/0001](adr/0001-capabilities-core-owned-providers-optional.md) | Accepted | Why the capability-ownership rule became test-enforced. |
| [adr/0002](adr/0002-default-brain-selection.md) | Accepted | Default brain selection (Qwen3 1.7B with an LFM2.5 fallback). |
| [PROVIDERS.md](PROVIDERS.md) | Canonical | How to add a provider, step by step. |
| [OPERATIONS.md](OPERATIONS.md) | Canonical | Running it locally: CLI, web API, containers, health. |
| [ALPHA-ACCEPTANCE.md](ALPHA-ACCEPTANCE.md) | Runbook | Owner checklist for declaring private technical alpha; evidence stays outside the repo. |
| [OPERATIONS-FIRST-RUN.md](OPERATIONS-FIRST-RUN.md) | Operational reference | First-run procedure and dated bring-up evidence; reverify in the actual deployment. |
| [HUMAN_RELIABILITY_CONTRACT.md](HUMAN_RELIABILITY_CONTRACT.md) | Canonical | How the system stays safe and operable without demanding maximum operator attention. |
| [DESIGN-HANDOFF.md](DESIGN-HANDOFF.md) | V0.1 design baseline | Dated design-stage reference, not a current feature inventory; see README/Architecture for implemented scope. |

## Design

| Doc | Status | What it is |
|---|---|---|
| [Workshop v3 design authority](../.project/design/CURRENT.md) | Canonical current | The current implementation design authority: 16 canonical frames in `.project/design/WORKSHOP-V3-MANIFEST.yaml` (file `Wbg1rdt9fVCjWAXEKI1pTc`), the "The world knows how loudly to exist" principle, approvals, and reservations. Implementation workflow: [personal-world-implement-figma](../.agents/skills/personal-world-implement-figma/SKILL.md). |
| [tokens.json](../design/tokens.json) | Canonical | The repo-owned token file implementations consume. |
| [COMPANION_INTEGRATION.md](../design/COMPANION_INTEGRATION.md) | Canonical design + baseline/target notes | Five residents and identity design; current standalone Chat versus target contextual/global chat. |
| [THEME_PACK_FRAMEWORK.md](../design/THEME_PACK_FRAMEWORK.md) | Spec; partial implementation | Pack invariants; manifest registry exists, full frontend pack integration remains incomplete. |
| [RYLEE_THEME_PACK.md](../design/RYLEE_THEME_PACK.md) | Spec | The personal Mermaid theme pack. |
| [LOTTIEFILES_HANDOFF.md](../design/LOTTIEFILES_HANDOFF.md) | Canonical | Production lessons for Lottie Creator workflows. |
| [Asset index](../design/assets/README.md) | Canonical | Icons, companion rigs, the Mermaid master animation. |
| [Companion collection](../design/assets/companions/README.md) | Canonical | Source rigs and per-companion animation handoffs. |
| [Screen library](../design/screens/) | Canonical | Today/Journal/Settings/Chat screens, both themes, narrow + desktop. |
| [Exports (0.1)](../design/exports/0.1/) | Canonical visual source | The Figma export set the palette reconciliation targeted. |
| [handoff/](../design/handoff/README.md) | Archived | The original 0.1 spec package, preserved verbatim. Canonical accessibility docs now live under [docs/accessibility/](accessibility/ACCESSIBILITY_CONTRACT.md). |
| [FIGMA-HANDOFF-LESSONS.md](FIGMA-HANDOFF-LESSONS.md) | Canonical lessons | Composition drift is not caught by token gates; browser-side visual comparison is required before composition work merges. |

## Accessibility

| Doc | Status | What it is |
|---|---|---|
| [ACCESSIBILITY_CONTRACT.md](accessibility/ACCESSIBILITY_CONTRACT.md) | Canonical (all 9 sections) | The non-negotiable accessibility contract. |
| [SCREEN_READER_WALKTHROUGH.md](accessibility/SCREEN_READER_WALKTHROUGH.md) | Canonical current + requirements | Source labels/order, current gaps, target overlay semantics; not a manual speech transcript. |
| [RESPONSIVE_RULES.md](accessibility/RESPONSIVE_RULES.md) | Canonical current + requirements | Actual rail/banner/phone CSS cascade, accessibility requirements, target overlays. |
| [PREFERENCES_SCHEMA.json](accessibility/PREFERENCES_SCHEMA.json) | Canonical | The preference schema with its accessibility floor. |

## Development

| Doc | What it is |
|---|---|
| [AGENTS.md](../AGENTS.md) | Working-tree rules for agents and humans (worktrees, staging discipline). |
| [safe-commit.sh](../scripts/safe-commit.sh) | Stages named paths only; refuses unrelated-file sweeps. |
| [Validation commands](../README.md#validation) | `pytest`, `framework validate` — the canonical checks. |

## Surfaces, inventories & history

| Doc | Status | What it is |
|---|---|---|
| [repo/REPOSITORY-INVENTORY.md](repo/REPOSITORY-INVENTORY.md) | Canonical inventory | Every major artifact, its purpose, status, and canonical location. |
| [repo/WIRING-READINESS.md](repo/WIRING-READINESS.md) | Canonical assessment | GREEN/YELLOW/RED/GRAY per subsystem for the wiring pass. |
| [surfaces/MASTER-SURFACE-REGISTRY.md](surfaces/MASTER-SURFACE-REGISTRY.md) | Current reference | Extraction index of every UI/API/CLI/tool/provider/storage surface. |
| [surfaces/AUTH-MATRIX.md](surfaces/AUTH-MATRIX.md) | Current reference | Auth per surface (D1/D2/D3 convergence). |
| [surfaces/PROVIDER-MATRIX.md](surfaces/PROVIDER-MATRIX.md) | Current reference | Capability ↔ provider registration map. |
| [surfaces/STORAGE-MATRIX.md](surfaces/STORAGE-MATRIX.md) | Current reference | Storage paths, readers/writers, backup coverage. |
| [surfaces/UI-API-MATRIX.md](surfaces/UI-API-MATRIX.md) | Current reference | UI ↔ API wiring. |
| [surfaces/CLI-DOMAIN-MATRIX.md](surfaces/CLI-DOMAIN-MATRIX.md) | Current reference | CLI ↔ domain/API parity. |
| [surfaces/TOOL-DOMAIN-MATRIX.md](surfaces/TOOL-DOMAIN-MATRIX.md) | Current reference | Chat tool ↔ domain targets. |
| [surfaces/DUPLICATES.md](surfaces/DUPLICATES.md) | Current reference | Competing/duplicate systems (auth entries resolved by D1–D3). |
| [surfaces/ORPHANS.md](surfaces/ORPHANS.md) | Current reference | Orphaned/partial/superseded surfaces. |
| [surfaces/CALL-CHAINS.md](surfaces/CALL-CHAINS.md) | Current reference | Compact call chains per major flow. |
| [surfaces/COHERENCE-DECISION-PREP.md](surfaces/COHERENCE-DECISION-PREP.md) | Historical | Pre-wiring decision preparation; inputs absorbed into `repo/WIRING-READINESS.md`. |
| [history/](history/README.md) | Archived | 2026-09-13 merge receipts and handoffs. Superseded; kept for provenance. |
| [INDEX.md](INDEX.md) | This documentation index. |

## Status vocabulary used above

- **Canonical** — authoritative within its stated scope. Current descriptions,
  mandatory contracts, and target product requirements are distinct; an authoritative
  target does not prove implementation. Contradictions within scope are bugs.
- **Normative** — enforced by `personal-world framework validate` or tests.
- **Spec** — agreed direction; implementation may not exist yet.
- **Archived** — historical reference, preserved verbatim, do not edit.
