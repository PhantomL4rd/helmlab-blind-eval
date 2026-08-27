import type { BlindTarget, FullDye, SessionFile, SnapshotMetadata, TargetRecord } from './types';

export interface HexSelectionHistoryEntry {
  hex: string;
  at: string;
}

export interface HexShortlistHistoryEntry {
  hex: string;
  action: 'add' | 'remove';
  at: string;
}

export interface HumanPickExportRecord {
  sessionId: string;
  targetId: string;
  targetHex: string;
  shortlistedDyeHexes: string[];
  shortlistHistory: HexShortlistHistoryEntry[];
  candidateDisplayOrderHexes: string[];
  selectedDyeHex: string | null;
  selectionHistory: HexSelectionHistoryEntry[];
  tiedHexes: string[];
  confidence: TargetRecord['confidence'];
  uncertain: boolean;
  note: string;
  phase1StartedAt: string;
  phase1CompletedAt: string | null;
  phase2StartedAt: string | null;
  completedAt: string | null;
  method: TargetRecord['method'];
}

function resolveHex(id: string, dyeHexById: Map<string, string>): string {
  return dyeHexById.get(id) ?? '';
}

/**
 * Dye ids are FF14-internal and meaningless outside this app — every dye-referencing field is
 * resolved to hex instead (not alongside; the Helmlab author asked for hex, not ids). Ids can
 * still be cross-referenced via the accompanying dyes.json export if ever needed (hex is
 * unique across the retest pool, so this is lossless for identification purposes).
 * `availableDyeIds` is dropped entirely: it's the same ~97-dye pool on every record in a
 * session, so repeating it per-target is pure redundancy — see the dyes.json export instead.
 */
export function buildHumanPicksExport(
  sessions: SessionFile[],
  dyeHexById: Map<string, string>
): HumanPickExportRecord[] {
  return sessions.flatMap((session) =>
    Object.values(session.records)
      .filter((record) => record.completedAt !== null)
      .map(
        (record): HumanPickExportRecord => ({
          sessionId: record.sessionId,
          targetId: record.targetId,
          targetHex: record.targetHex,
          shortlistedDyeHexes: record.shortlistedDyeIds.map((id) => resolveHex(id, dyeHexById)),
          shortlistHistory: record.shortlistHistory.map(({ dyeId, action, at }) => ({
            hex: resolveHex(dyeId, dyeHexById),
            action,
            at,
          })),
          candidateDisplayOrderHexes: record.candidateDisplayOrder.map((id) =>
            resolveHex(id, dyeHexById)
          ),
          selectedDyeHex: record.selectedDyeId
            ? resolveHex(record.selectedDyeId, dyeHexById)
            : null,
          selectionHistory: record.selectionHistory.map(({ dyeId, at }) => ({
            hex: resolveHex(dyeId, dyeHexById),
            at,
          })),
          tiedHexes: record.ties.map((id) => resolveHex(id, dyeHexById)),
          confidence: record.confidence,
          uncertain: record.uncertain,
          note: record.note,
          phase1StartedAt: record.phase1StartedAt,
          phase1CompletedAt: record.phase1CompletedAt,
          phase2StartedAt: record.phase2StartedAt,
          completedAt: record.completedAt,
          method: record.method,
        })
      )
  );
}

export interface SessionManifestEntry {
  sessionId: string;
  evaluatorId: string;
  targetOrder: string[];
  startedAt: string;
  completedAt: string | null;
}

/** Session-level metadata only (order shown, timing) — the per-target answers live in human-picks.json. */
export function buildEvaluationSessionsExport(sessions: SessionFile[]): SessionManifestEntry[] {
  return sessions.map(({ sessionId, evaluatorId, targetOrder, startedAt, completedAt }) => ({
    sessionId,
    evaluatorId,
    targetOrder: [...targetOrder],
    startedAt,
    completedAt,
  }));
}

/** Strips down to the blind-safe shape. `dyeId` (or any other field) on the input is ignored, not just omitted. */
export function buildTargetsExport(
  targets: { id: string; reading: string; hex: string; romaji: string }[]
): BlindTarget[] {
  return targets.map(({ id, reading, hex, romaji }) => ({ id, reading, hex, romaji }));
}

export function buildDyesExport(
  dyes: {
    id: string;
    name: string;
    hex: string;
    rgb: { r: number; g: number; b: number };
    tags: string[];
  }[]
): FullDye[] {
  return dyes.map(({ id, name, hex, rgb, tags }) => ({ id, name, hex, rgb, tags: [...tags] }));
}

function sessionDateRange(sessions: SessionFile[]): { min: string; max: string } | null {
  const timestamps = sessions
    .flatMap((s) => [s.startedAt, s.completedAt])
    .filter((t): t is string => t !== null);
  if (timestamps.length === 0) return null;
  const sorted = [...timestamps].sort();
  return { min: sorted[0], max: sorted[sorted.length - 1] };
}

export function buildMethodologyMarkdown(meta: SnapshotMetadata, sessions: SessionFile[]): string {
  const range = sessionDateRange(sessions);
  const evaluatorCount = new Set(sessions.map((s) => s.evaluatorId)).size;
  const sessionCount = sessions.length;

  return `# Methodology

## Evaluation method

For each traditional-color target, evaluators judged closeness to an FF14 dye in two phases:

1. **Phase 1 (explore)**: the full ${meta.poolSize}-dye candidate pool was shown at once, and the
   evaluator freely shortlisted whichever dyes looked plausible by eye (no algorithmic
   pre-filtering of any kind).
2. **Phase 2 (refine)**: the shortlisted candidates (display order randomized) were compared
   against the target in an adjacent side-by-side view, and the evaluator picked the single
   closest one. Equally-close candidates could be marked as ties, and a confidence level
   (high/medium/low) was recorded.

Evaluation was fully blind. **The current \`dyeId\` and past automatic assignments were never
shown. No recommendation, rank, or color-difference score from any algorithm — Helmlab,
CIEDE2000, or otherwise — was shown to evaluators during evaluation.**

## Candidate generation method

- Method: \`${meta.method}\` (no algorithmic pre-filtering — evaluators see the whole pool and
  build their own shortlist)
- Candidate pool: ${meta.poolSize} of ${meta.totalDyes} total dyes, after excluding tags
  ${meta.excludedTags.join(', ')} (same pool definition used to pick the current \`dyeId\` —
  see \`EXCLUDED_TAGS\` in colorant-picker's \`scripts/sync-traditional-color-dyes.mjs\`)
- Target count: ${meta.totalTargets}
- Phase 1 pool display order: \`${meta.layoutMethod}\` (based only on each dye's own hue, unrelated
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

Evaluators: ${evaluatorCount}
Sessions: ${sessionCount}
(if the same evaluator retested after a gap, each attempt is recorded as its own independent
session)

## Evaluation dates

${range ? `${range.min.slice(0, 10)} to ${range.max.slice(0, 10)}` : '(no evaluations yet)'}

## Constraints and caveats

- Targets are hex averages sourced from secondary references (irocore, colordic, etc.), not
  physical measurements
- Rendering depends on the evaluator's browser/OS/monitor (display environment: evaluator to
  fill in)
- Data snapshot source commit (colorant-picker): \`${meta.sourceCommit}\`
- Snapshot generation time: ${meta.generatedAt}
- Comparison against the current \`dyeId\`, Helmlab, and CIEDE2000 happens only after this
  evaluation is complete, on a separate page (\`analysis.html\`) that the evaluation flow cannot
  reach
`;
}
