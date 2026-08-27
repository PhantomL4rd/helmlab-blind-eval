/**
 * Post-hoc comparison logic — used only by analysis.html, never by the eval flow (index.html).
 * Reads the current production `dyeId` to contextualize how a blind human pick relates to
 * the existing algorithmic mapping. This is "derived" data (freshly computed here), kept
 * separate from the original retest records.
 */
import {
  ColorSpace,
  deltaE as colorjsDeltaE,
  to as convert,
  deltaEHelmlab,
  Helmlab,
  OKLab,
  parse,
  sRGB,
} from 'colorjs.io/fn';
import type { SessionFile, TargetRecord } from './types';

ColorSpace.register(sRGB);
ColorSpace.register(OKLab);
ColorSpace.register(Helmlab);

// Matches the retest candidate pool AND the production dyeId-selection pool — both use the
// same definition now (metallic+vivid excluded), so ranks here are directly comparable to
// what the evaluator actually chose from.
export const ANALYSIS_EXCLUDED_TAGS = ['metallic', 'vivid'];

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

export interface AnalysisPoolDye {
  id: string;
  hex: string;
  tags: string[];
  color: unknown;
  oklab: unknown;
  helm: unknown;
}

export function buildAnalysisPool(
  dyes: { id: string; rgb?: { r: number; g: number; b: number }; hex?: string; tags?: string[] }[],
  excludedTags: string[] = ANALYSIS_EXCLUDED_TAGS
): AnalysisPoolDye[] {
  return dyes
    .filter((d) => !d.tags?.some((t) => excludedTags.includes(t)))
    .map((d) => {
      const hex = d.hex ?? (d.rgb ? rgbToHex(d.rgb) : '#000000');
      const color = parse(hex);
      return {
        id: d.id,
        hex,
        tags: d.tags ?? [],
        color,
        oklab: convert(color, 'oklab'),
        helm: convert(color, 'helmlab-metric'),
      };
    });
}

export interface Ranks {
  ciede2000: number;
  oklab: number;
  helm: number;
}

export function computeRanks(targetHex: string, pool: AnalysisPoolDye[]): Map<string, Ranks> {
  const target = parse(targetHex);
  const targetOklab = convert(target, 'oklab');
  const targetHelm = convert(target, 'helmlab-metric');

  const scored = pool.map((c) => ({
    id: c.id,
    ciede2000: colorjsDeltaE(target, c.color as any, '2000'),
    oklab: colorjsDeltaE(targetOklab, c.oklab as any, 'OK'),
    helm: deltaEHelmlab(targetHelm as any, c.helm as any),
  }));

  const rankOf = (key: 'ciede2000' | 'oklab' | 'helm') => {
    const sorted = [...scored].sort((a, b) => a[key] - b[key]);
    const ranks = new Map<string, number>();
    for (const [i, row] of sorted.entries()) ranks.set(row.id, i + 1);
    return ranks;
  };

  const ciedeRanks = rankOf('ciede2000');
  const oklabRanks = rankOf('oklab');
  const helmRanks = rankOf('helm');

  const result = new Map<string, Ranks>();
  for (const c of pool) {
    result.set(c.id, {
      ciede2000: ciedeRanks.get(c.id) ?? -1,
      oklab: oklabRanks.get(c.id) ?? -1,
      helm: helmRanks.get(c.id) ?? -1,
    });
  }
  return result;
}

export interface AnalysisRow {
  sessionId: string;
  evaluatorId: string;
  targetId: string;
  targetHex: string;
  selectedDyeId: string | null;
  currentDyeId: string | null;
  matchesCurrentDyeId: boolean;
  ranks: Ranks | null;
  ties: string[];
  confidence: TargetRecord['confidence'];
  uncertain: boolean;
}

export function buildAnalysisRows(params: {
  sessions: SessionFile[];
  traditionalColors: { id: string; hex: string; dyeId?: string }[];
  dyes: { id: string; rgb?: { r: number; g: number; b: number }; hex?: string; tags?: string[] }[];
}): AnalysisRow[] {
  const { sessions, traditionalColors, dyes } = params;
  const currentDyeIdByTarget = new Map(traditionalColors.map((t) => [t.id, t.dyeId ?? null]));
  const pool = buildAnalysisPool(dyes);
  const ranksCache = new Map<string, Map<string, Ranks>>();

  const completedWithEvaluator = sessions.flatMap((session) =>
    Object.values(session.records)
      .filter((record) => record.completedAt !== null)
      .map((record) => ({ record, evaluatorId: session.evaluatorId }))
  );

  return completedWithEvaluator.map(({ record, evaluatorId }): AnalysisRow => {
    const currentDyeId = currentDyeIdByTarget.get(record.targetId) ?? null;
    let ranksForTarget = ranksCache.get(record.targetId);
    if (!ranksForTarget) {
      ranksForTarget = computeRanks(record.targetHex, pool);
      ranksCache.set(record.targetId, ranksForTarget);
    }
    const ranks = record.selectedDyeId ? (ranksForTarget.get(record.selectedDyeId) ?? null) : null;

    return {
      sessionId: record.sessionId,
      evaluatorId,
      targetId: record.targetId,
      targetHex: record.targetHex,
      selectedDyeId: record.selectedDyeId,
      currentDyeId,
      matchesCurrentDyeId: record.selectedDyeId !== null && record.selectedDyeId === currentDyeId,
      ranks,
      ties: record.ties,
      confidence: record.confidence,
      uncertain: record.uncertain,
    };
  });
}

export interface ExistingJudgmentComparisonRow {
  targetId: string;
  existingSelectedDyeId: string;
  existingSelectedDyeName: string;
  retestPicks: { sessionId: string; evaluatorId: string; selectedDyeId: string | null }[];
  anyRetestMatchesExisting: boolean;
}

/** Cross-references data/existing-human-judgments cases against this retest's rows, by targetId. */
export function buildExistingJudgmentComparisonRows(params: {
  existingCases: { targetId: string; selectedDyeId: string; selectedDyeName: string }[];
  retestRows: AnalysisRow[];
}): ExistingJudgmentComparisonRow[] {
  const { existingCases, retestRows } = params;
  return existingCases.map((c) => {
    const retestPicks = retestRows
      .filter((r) => r.targetId === c.targetId)
      .map((r) => ({
        sessionId: r.sessionId,
        evaluatorId: r.evaluatorId,
        selectedDyeId: r.selectedDyeId,
      }));
    return {
      targetId: c.targetId,
      existingSelectedDyeId: c.selectedDyeId,
      existingSelectedDyeName: c.selectedDyeName,
      retestPicks,
      anyRetestMatchesExisting: retestPicks.some((p) => p.selectedDyeId === c.selectedDyeId),
    };
  });
}
