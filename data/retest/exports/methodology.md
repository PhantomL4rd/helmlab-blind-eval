# Methodology

## Evaluation method

For each traditional-color target, evaluators judged closeness to an FF14 dye in two phases:

1. **Phase 1 (explore)**: the full 97-dye candidate pool was shown at once, and the
   evaluator freely shortlisted whichever dyes looked plausible by eye (no algorithmic
   pre-filtering of any kind).
2. **Phase 2 (refine)**: the shortlisted candidates (display order randomized) were compared
   against the target in an adjacent side-by-side view, and the evaluator picked the single
   closest one. Equally-close candidates could be marked as ties, and a confidence level
   (high/medium/low) was recorded.

Evaluation was fully blind. **The current `dyeId` and past automatic assignments were never
shown. No recommendation, rank, or color-difference score from any algorithm — Helmlab,
CIEDE2000, or otherwise — was shown to evaluators during evaluation.**

## Candidate generation method

- Method: `full-pool-human-shortlist` (no algorithmic pre-filtering — evaluators see the whole pool and
  build their own shortlist)
- Candidate pool: 97 of 125 total dyes, after excluding tags
  metallic, vivid (same pool definition used to pick the current `dyeId` —
  see `EXCLUDED_TAGS` in colorant-picker's `scripts/sync-traditional-color-dyes.mjs`)
- Target count: 64
- Phase 1 pool display order: `hue-sort` (based only on each dye's own hue, unrelated
  to its distance from any particular target)

## Display conditions

- Target and candidates are shown as identically-sized, identically-shaped swatches on the same
  neutral background
- Swatch colors are rendered from the raw RGB/hex with no CSS opacity/filter or other
  manipulation
- An adjacent side-by-side detail-compare mode is available
- Candidate names/ids are hidden until evaluation is complete (hex is shown for candidates too,
  as a judgment input)

## Evaluators / sessions

Evaluators: 1
Sessions: 1
(if the same evaluator retested after a gap, each attempt is recorded as its own independent
session)

## Evaluation dates

2026-08-27 to 2026-08-27

## Constraints and caveats

- Targets are hex averages sourced from secondary references (irocore, colordic, etc.), not
  physical measurements
- Rendering depends on the evaluator's browser/OS/monitor (display environment: evaluator to
  fill in)
- Data snapshot source commit (colorant-picker): `7a94d555a6879d05e2b2f3afc559724315790d0b`
- Snapshot generation time: 2026-08-27T08:19:13.200Z
- Comparison against the current `dyeId`, Helmlab, and CIEDE2000 happens only after this
  evaluation is complete, on a separate page (`analysis.html`) that the evaluation flow cannot
  reach
