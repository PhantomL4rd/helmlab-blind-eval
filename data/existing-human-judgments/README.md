# existing-human-judgments

Pre-existing human judgment data, transcribed faithfully from a source that already existed
before this repository — **not** collected by this tool, and **not** part of the 2026 retest
(`data/retest/`). Kept separate on purpose; see `data/retest/README.md` for why.

## What's here

`issue3-followup.json` — 4 cases from
[`PhantomL4rd/helmlab-issue3-followup`](https://github.com/PhantomL4rd/helmlab-issue3-followup),
a follow-up to [`Grkmyldz148/helmlab#3`](https://github.com/Grkmyldz148/helmlab/issues/3). One
evaluator (PhantomL4rd) looked at 3 algorithm-proposed candidates per target (one each from
helmlab, CIEDE2000, OKLab ΔE) and picked the one that looked closest by eye.

## Why this is not comparable 1:1 with the 2026 retest

- **Not blind to algorithm identity.** Each candidate swatch was labeled with which algorithm
  proposed it. The 2026 retest hides this entirely.
- **Not a full-pool comparison.** Only 3 candidates were shown per target (the top-1 pick of
  each of 3 algorithms), not the ~97-dye pool the 2026 retest uses. If the evaluator's true
  nearest dye wasn't any algorithm's top-1, it couldn't have been picked here.
- **The 4 targets themselves are not a random sample.** They were pre-filtered to a warm/brown
  hue sector AND to cases where helmlab and CIEDE2000 disagreed on their top-1 pick — i.e. this
  is a deliberately adversarial subset, not a representative one.
- **Single evaluator, no confidence/tie data.**

## What it's still useful for

- It IS a genuine, deliberate, recorded human judgment — just under different (narrower,
  non-blind) conditions than the 2026 retest.
- It can be cross-referenced against the 2026 retest's pick for the same `targetId` (all 4
  targets — 濃赤/濃紅/濃香/黄 — exist in the current `traditional-colors.json` and the 2026
  retest covers them) to see whether the same person's eye agrees with itself under looser vs.
  blind conditions.
- It can be compared against the algorithmic baseline (current `dyeId`, freshly-computed
  CIEDE2000/OKLab/Helmlab ranks) in `analysis.html`, same as the 2026 retest data.

Do not merge this into `data/retest/exports/human-picks.json`. Keep it as its own artifact when
handing data to the Helmlab author — let them decide how much weight to give a non-blind,
narrow-candidate-set judgment versus the blind full-pool retest.
