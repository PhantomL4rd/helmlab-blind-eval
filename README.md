# helmlab-blind-eval

> **Just here for the results?** You don't need to clone this, `npm install`, or run anything.
> Open `data/retest/exports/report.html` directly in a browser (double-click it, or
> `file://` the path) — a single static page with every target, human pick, current dyeId,
> and CIEDE2000/OKLab/Helmlab rank, color swatches included. That one file is enough to get
> the whole picture.
>
> The same data is also available as plain JSON/Markdown in `data/retest/exports/`, no code
> execution required either way:
> - `methodology.md` — how the data was collected
> - `human-picks.json` — the 64 human judgments (hex-keyed, no internal ids)
> - `targets.json` / `dyes.json` / `evaluation-sessions.json` — supporting data
>
> Everything else below documents the local tool that *produced* that data.

A local tool for collecting a new, algorithm-independent human-judgment dataset: for each of
64 traditional Japanese colors (from
[`colorant-picker`](https://github.com/PhantomL4rd/colorant-picker)), which FF14 dye looks
closest to a human eye? Built as an external perceptual benchmark for
[Helmlab Next Gen](https://github.com/Grkmyldz148/helmlab).

This is a research/data-collection tool, not a production service. It has no build or deploy
step — everything runs locally via `vite dev`.

## Why this exists

colorant-picker already maps each traditional color to a `dyeId`, but that mapping is
**algorithmic** (CIEDE2000/OKLab + a Helmlab fallback — see
`data/retest/snapshot/raw/PROVENANCE.md`), not a human judgment. This tool collects a real one,
fully blind to any color-distance algorithm, and keeps it clearly separated from:

- the algorithmic mapping (`dyeId` — treated here only as an "algorithmic-baseline" for
  post-hoc comparison, never as ground truth)
- one pre-existing, narrower, non-blind human judgment (`data/existing-human-judgments/` — 4
  cases from a follow-up to
  [`Grkmyldz148/helmlab#3`](https://github.com/Grkmyldz148/helmlab/issues/3))

See `data/README.md` for the full directory layout and what's in each part.

## Setup

```sh
npm install
npm run snapshot   # builds data/retest/snapshot/blind/*.json from the frozen raw snapshot
npm run dev        # http://localhost:5173 — the eval app
npm test           # vitest — all pure logic (pool/shortlist/session/export/analysis) is covered
```

`npm run snapshot` only needs to be re-run if `data/retest/snapshot/raw/` is refreshed (see its
`PROVENANCE.md`) — the blind views it emits are what the eval app actually fetches.

## Using it

1. Open `http://localhost:5173`, enter an evaluator ID, start a new session (or resume/retest
   an existing one — the same evaluator ID can run multiple independent sessions over time).
2. **Phase 1 (explore)**: for each target color, browse the full ~97-dye pool (hue-sorted, no
   algorithm involved) and shortlist whichever dyes look plausible.
3. **Phase 2 (refine)**: compare the shortlisted dyes against the target (randomized order,
   adjacent side-by-side comparison), pick the closest one, optionally mark ties, and record a
   confidence level.
4. Progress and every answer are saved to disk immediately (`data/retest/sessions/`) — safe to
   close the tab and resume later.
5. Once done, open the **エクスポート** view to download `human-picks.json`, `targets.json`,
   `dyes.json`, `evaluation-sessions.json`, and an auto-filled `methodology.md`.
6. `http://localhost:5173/analysis.html` — **only after** a retest is complete — compares the
   retest picks against the algorithmic baseline and the existing (non-blind) human judgments.
   This page is a separate bundle; the eval app never imports or fetches what it reads.

## Blindness guarantees (and their limits)

During Phase 1/2, the eval app never fetches dye names, tags, `dyeId`, scores, or ranks — only
`id`+`hex` (verified: see `data/retest/snapshot/blind/`, and `src/lib/api.ts`'s comments on
which fetches are eval-only vs. reveal/analysis-only). Dye names are revealed only in the
export view, after a session's answers are already recorded. This is a good-faith blinding
design for a local, single/few-evaluator research tool — not a defense against an adversarial
evaluator with devtools access (e.g. `data/retest/snapshot/blind/dyes.full.json` is on the same
origin and could be fetched manually). See `data/retest/README.md` for more constraints.

## Repository layout

```
data/
  existing-human-judgments/   # pre-existing, non-blind human judgment (4 cases) — see its README
  retest/                      # the 2026 blind retest this tool collects — see its README
scripts/                       # snapshot + candidate/session logic (Node, no build step)
src/                            # the two Svelte bundles: eval app (index.html) and analysis.html
tests/                          # vitest — pure logic only; UI is verified manually (see below)
```

## Development notes

- No candidate pre-filtering by any color-distance algorithm, anywhere in the eval flow — see
  `data/retest/README.md` for why, and how Phase 1/2 avoid it while staying usable across a
  ~97-dye pool.
- TDD scope: pure logic (`scripts/*.mjs`, `src/lib/*.ts`) is unit-tested with vitest. The Svelte
  UI and the dev-server HTTP glue are verified manually against a running `vite dev` server
  (golden path + edge cases: tie, uncertain, resume, re-select, multi-session retest) — this
  repo has no component-testing setup, and adding one was judged disproportionate for a
  single-purpose research tool.
- `biome check .` covers `src/`, `scripts/`, `tests/`.
