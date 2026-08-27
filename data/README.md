# data/

Two independent kinds of human-judgment data, kept deliberately separate — do not merge them.

```
existing-human-judgments/   pre-existing, non-blind, 4 cases — see its README
retest/                      the 2026 blind retest this tool collects — see its README
```

## Why they're separate

- **Different protocols.** `existing-human-judgments` was elicited non-blind, with only 3
  algorithm-labeled candidates per target. `retest` is fully blind, full-pool, two-phase
  (explore → refine).
- **Different scope.** `existing-human-judgments` covers 4 pre-selected disagreement cases.
  `retest` covers all 64 current traditional-color targets.
- **Comparability is a downstream question, not a given.** `analysis.html` can cross-reference
  them by `targetId` after a retest is complete, but treating them as interchangeable data
  points would misrepresent how each was collected.

Neither directory should ever be treated as ground truth on its own — the current production
`dyeId` (in `retest/snapshot/raw/traditional-colors.json`) is a third, clearly separate
category: an **algorithmic baseline**, not a human judgment at all. See that file's
`PROVENANCE.md` for why.
