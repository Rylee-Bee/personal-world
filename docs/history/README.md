# Historical receipts and handoffs

Archived evidence from the 2026-09-13 merge/convergence epoch. These
files are **historical**, not current authority. They are preserved
because they record what an agent believed and verified at a point in
time; they are not maintained and their counts will drift from code.

For current truth, use:

- **Current state pointer:** [`../../.project/CURRENT.md`](../../.project/CURRENT.md)
- **Architecture:** [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- **Verified wiring map:** [`../repo/WIRING-READINESS.md`](../repo/WIRING-READINESS.md)
- **Repo inventory:** [`../repo/REPOSITORY-INVENTORY.md`](../repo/REPOSITORY-INVENTORY.md)

## Why these were archived

They are one-off merge receipts and pre-merge handoffs whose claims
(tool counts, test counts, screen counts, endpoint dispositions) were
superseded within the same epoch and, in several cases, contradicted
each other. `docs/repo/REPOSITORY-INVENTORY.md` records the
contradictions. Keeping them in the canonical `docs/` root made stale
numbers look like current authority.

| File | Date | What it was |
|---|---|---|
| [`FINAL-RECEIPT.md`](FINAL-RECEIPT.md) | 2026-09-13 | Merge receipt; claimed 726 tests / 29 tools / 15 screens / 18 capabilities. |
| [`FULL-SYSTEM-INVENTORY.md`](FULL-SYSTEM-INVENTORY.md) | 2026-09-13 | Earlier "generated from live codebase" inventory; claimed 663 tests / 19 read tools / 14 screens / 78 endpoints. Least current of the set. |
| [`CONNECTIONS-RECEIPT.md`](CONNECTIONS-RECEIPT.md) | 2026-09-13 | Connections/Providers audit receipt (725 tests, 18 providers). |
| [`RECONCILIATION-RECEIPT.md`](RECONCILIATION-RECEIPT.md) | 2026-09-13 | Post-Connections reconciliation receipt (HEAD `f871b2a`). |
| [`MERGE-DOCS-RECEIPT.md`](MERGE-DOCS-RECEIPT.md) | 2026-09-13 | Merge + issue closure + screenshots + docs refresh receipt (719 tests). |
| [`WIRING-COMPLETION-HANDOFF.md`](WIRING-COMPLETION-HANDOFF.md) | 2026-09-13 | Pre-merge wiring handoff with 10 open questions; header notes all were resolved. |
| [`API-WIRING-HANDOFF.md`](API-WIRING-HANDOFF.md) | 2026-09-13 | Endpoint-disposition handoff (68 endpoints, 19 tools). |

## Do not

- Do not treat any count or "status" in these files as current.
- Do not add new receipts here without also linking them from
  `docs/README.md`; new operational evidence belongs in the canonical
  docs it describes, not as a parallel narrative.