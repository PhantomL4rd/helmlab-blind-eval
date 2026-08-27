import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildAnalysisPool,
  buildAnalysisRows,
  buildExistingJudgmentComparisonRows,
  computeRanks,
} from '../src/lib/analysis-logic';
import type { SessionFile, TargetRecord } from '../src/lib/types';

const rawDir = fileURLToPath(new URL('../data/retest/snapshot/raw/', import.meta.url));
const dyes = JSON.parse(readFileSync(`${rawDir}dyes.json`, 'utf-8')).dyes;
const traditional = JSON.parse(readFileSync(`${rawDir}traditional-colors.json`, 'utf-8')).colors;

const fixtureDyes = [
  { id: 'd_red', name: 'Red', hex: '#dc001a', tags: [], rgb: { r: 220, g: 0, b: 26 } },
  { id: 'd_darkred', name: 'Dark Red', hex: '#781a1a', tags: [], rgb: { r: 120, g: 26, b: 26 } },
  { id: 'd_orange', name: 'Orange', hex: '#c8593f', tags: [], rgb: { r: 200, g: 89, b: 63 } },
  {
    id: 'd_vivid',
    name: 'Vivid Red',
    hex: '#ff0000',
    tags: ['vivid'],
    rgb: { r: 255, g: 0, b: 0 },
  },
  {
    id: 'd_metallic',
    name: 'Metallic Red',
    hex: '#d2101a',
    tags: ['metallic'],
    rgb: { r: 210, g: 16, b: 26 },
  },
];

function makeRecord(overrides: Partial<TargetRecord> = {}): TargetRecord {
  return {
    sessionId: 'sess1',
    targetId: '赤',
    targetHex: '#dc001a',
    availableDyeIds: ['d_red', 'd_darkred'],
    shortlistedDyeIds: ['d_red'],
    shortlistHistory: [],
    candidateDisplayOrder: ['d_red'],
    selectedDyeId: 'd_red',
    selectionHistory: [],
    ties: [],
    confidence: 'high',
    uncertain: false,
    note: '',
    phase1StartedAt: '2026-08-27T10:00:00.000Z',
    phase1CompletedAt: '2026-08-27T10:00:00.000Z',
    phase2StartedAt: '2026-08-27T10:00:00.000Z',
    completedAt: '2026-08-27T10:00:00.000Z',
    method: 'blind-human-selection',
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionFile> = {}): SessionFile {
  return {
    sessionId: 'sess1',
    evaluatorId: 'eval1',
    targetOrder: ['赤'],
    startedAt: '2026-08-27T09:59:00.000Z',
    completedAt: '2026-08-27T10:00:00.000Z',
    records: { 赤: makeRecord() },
    ...overrides,
  };
}

describe('buildAnalysisPool', () => {
  it('excludes metallic AND vivid — matches the production pool exactly (retest uses the same pool now)', () => {
    const pool = buildAnalysisPool(fixtureDyes);
    const ids = pool.map((d) => d.id);
    expect(ids).not.toContain('d_metallic');
    expect(ids).not.toContain('d_vivid');
  });
});

describe('computeRanks', () => {
  it('ranks the exact target color as #1 on every metric', () => {
    const pool = buildAnalysisPool(fixtureDyes);
    const ranks = computeRanks('#dc001a', pool);
    expect(ranks.get('d_red')).toEqual({ ciede2000: 1, oklab: 1, helm: 1 });
  });
});

describe('buildAnalysisRows', () => {
  const traditionalFixture = [{ id: '赤', hex: '#dc001a', dyeId: 'd_red' }];

  it('flags a match when the human pick equals the current production dyeId, and carries evaluatorId/sessionId', () => {
    const rows = buildAnalysisRows({
      sessions: [makeSession()],
      traditionalColors: traditionalFixture,
      dyes: fixtureDyes,
    });
    expect(rows[0].evaluatorId).toBe('eval1');
    expect(rows[0].sessionId).toBe('sess1');
    expect(rows[0].matchesCurrentDyeId).toBe(true);
    expect(rows[0].ranks?.ciede2000).toBe(1);
  });

  it('flags a mismatch and still reports ranks for the human pick', () => {
    const rows = buildAnalysisRows({
      sessions: [makeSession({ records: { 赤: makeRecord({ selectedDyeId: 'd_darkred' }) } })],
      traditionalColors: traditionalFixture,
      dyes: fixtureDyes,
    });
    expect(rows[0].matchesCurrentDyeId).toBe(false);
    expect(rows[0].currentDyeId).toBe('d_red');
    expect(rows[0].ranks).not.toBeNull();
  });

  it('excludes incomplete records', () => {
    const rows = buildAnalysisRows({
      sessions: [
        makeSession({ records: { 赤: makeRecord({ completedAt: null, confidence: null }) } }),
      ],
      traditionalColors: traditionalFixture,
      dyes: fixtureDyes,
    });
    expect(rows).toHaveLength(0);
  });

  it('produces one row per completed record across sessions (supports multiple evaluators/retests)', () => {
    const rows = buildAnalysisRows({
      sessions: [
        makeSession({ sessionId: 'sess1', evaluatorId: 'eval1' }),
        makeSession({
          sessionId: 'sess2',
          evaluatorId: 'eval2',
          records: { 赤: makeRecord({ sessionId: 'sess2', selectedDyeId: 'd_darkred' }) },
        }),
      ],
      traditionalColors: traditionalFixture,
      dyes: fixtureDyes,
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.evaluatorId).sort()).toEqual(['eval1', 'eval2']);
  });
});

describe('buildAnalysisRows against the real dataset (smoke test)', () => {
  it('runs over all 64 real targets without throwing', () => {
    const records: Record<string, TargetRecord> = {};
    for (const t of traditional) {
      records[t.id] = makeRecord({
        targetId: t.id,
        targetHex: t.hex,
        selectedDyeId: t.dyeId ?? dyes[0].id,
      });
    }
    const session = makeSession({
      targetOrder: traditional.map((t: { id: string }) => t.id),
      records,
    });
    const rows = buildAnalysisRows({ sessions: [session], traditionalColors: traditional, dyes });
    expect(rows).toHaveLength(64);
    expect(rows.filter((r) => r.matchesCurrentDyeId).length).toBeGreaterThan(60);
  });
});

describe('buildExistingJudgmentComparisonRows', () => {
  it('joins existing-human-judgments cases against retest rows by targetId', () => {
    const existingCases = [
      { targetId: '赤', selectedDyeId: 'd_darkred', selectedDyeName: 'Dark Red' },
      { targetId: '紅', selectedDyeId: 'd_orange', selectedDyeName: 'Orange' }, // no retest row for this one
    ];
    const retestRows = buildAnalysisRows({
      sessions: [makeSession()], // picked d_red for 赤
      traditionalColors: [{ id: '赤', hex: '#dc001a', dyeId: 'd_red' }],
      dyes: fixtureDyes,
    });
    const out = buildExistingJudgmentComparisonRows({ existingCases, retestRows });
    const akaRow = out.find((r) => r.targetId === '赤');
    expect(akaRow?.existingSelectedDyeId).toBe('d_darkred');
    expect(akaRow?.retestPicks).toEqual([
      { sessionId: 'sess1', evaluatorId: 'eval1', selectedDyeId: 'd_red' },
    ]);
    expect(akaRow?.anyRetestMatchesExisting).toBe(false);

    const kurenaiRow = out.find((r) => r.targetId === '紅');
    expect(kurenaiRow?.retestPicks).toEqual([]);
  });
});
