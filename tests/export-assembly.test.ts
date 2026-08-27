import { describe, expect, it } from 'vitest';
import {
  buildDyesExport,
  buildEvaluationSessionsExport,
  buildHumanPicksExport,
  buildMethodologyMarkdown,
  buildTargetsExport,
} from '../src/lib/export-assembly';
import type { SessionFile, SnapshotMetadata, TargetRecord } from '../src/lib/types';

const DYE_HEX_BY_ID = new Map([
  ['dye_014', '#de0b16'],
  ['dye_015', '#913b27'],
  ['dye_016', '#781a1a'],
]);

function makeRecord(overrides: Partial<TargetRecord> = {}): TargetRecord {
  return {
    sessionId: 'sess1',
    targetId: '赤',
    targetHex: '#ec001a',
    availableDyeIds: ['dye_014', 'dye_015'],
    shortlistedDyeIds: ['dye_014', 'dye_015'],
    shortlistHistory: [{ dyeId: 'dye_014', action: 'add', at: '2026-08-27T09:59:30.000Z' }],
    candidateDisplayOrder: ['dye_015', 'dye_014'],
    selectedDyeId: 'dye_014',
    selectionHistory: [{ dyeId: 'dye_014', at: '2026-08-27T10:00:00.000Z' }],
    ties: ['dye_015'],
    confidence: 'high',
    uncertain: false,
    note: '',
    phase1StartedAt: '2026-08-27T09:59:00.000Z',
    phase1CompletedAt: '2026-08-27T09:59:45.000Z',
    phase2StartedAt: '2026-08-27T09:59:45.000Z',
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
    startedAt: '2026-08-27T09:58:00.000Z',
    completedAt: '2026-08-27T10:00:00.000Z',
    records: { 赤: makeRecord() },
    ...overrides,
  };
}

describe('buildHumanPicksExport', () => {
  it('includes only completed records by default', () => {
    const sessions = [
      makeSession({
        records: {
          赤: makeRecord({ targetId: '赤' }),
          紅: makeRecord({ targetId: '紅', completedAt: null, confidence: null }),
        },
      }),
    ];
    const picks = buildHumanPicksExport(sessions, DYE_HEX_BY_ID);
    expect(picks).toHaveLength(1);
    expect(picks[0].targetId).toBe('赤');
  });

  it('flattens records across multiple sessions/evaluators', () => {
    const sessions = [
      makeSession({ sessionId: 'sess1', evaluatorId: 'eval1' }),
      makeSession({
        sessionId: 'sess2',
        evaluatorId: 'eval2',
        records: { 赤: makeRecord({ sessionId: 'sess2' }) },
      }),
    ];
    const picks = buildHumanPicksExport(sessions, DYE_HEX_BY_ID);
    expect(picks.map((p) => p.sessionId).sort()).toEqual(['sess1', 'sess2']);
  });

  it('replaces every dye-id-referencing field with its hex — no dye_NNN ids anywhere in the output', () => {
    const picks = buildHumanPicksExport([makeSession()], DYE_HEX_BY_ID);
    expect(picks[0].selectedDyeHex).toBe('#de0b16');
    expect(picks[0].shortlistedDyeHexes).toEqual(['#de0b16', '#913b27']);
    expect(picks[0].candidateDisplayOrderHexes).toEqual(['#913b27', '#de0b16']);
    expect(picks[0].tiedHexes).toEqual(['#913b27']);
    expect(JSON.stringify(picks)).not.toMatch(/dye_\d+/);
  });

  it('converts shortlistHistory and selectionHistory entries from dyeId to hex', () => {
    const picks = buildHumanPicksExport([makeSession()], DYE_HEX_BY_ID);
    expect(picks[0].shortlistHistory).toEqual([
      { hex: '#de0b16', action: 'add', at: '2026-08-27T09:59:30.000Z' },
    ]);
    expect(picks[0].selectionHistory).toEqual([{ hex: '#de0b16', at: '2026-08-27T10:00:00.000Z' }]);
  });

  it('drops availableDyeIds entirely — identical across every record in a session, so redundant here (see dyes.json export instead)', () => {
    const picks = buildHumanPicksExport([makeSession()], DYE_HEX_BY_ID);
    expect(picks[0]).not.toHaveProperty('availableDyeIds');
  });

  it('resolves selectedDyeHex to null when there is no pick (uncertain path)', () => {
    const picks = buildHumanPicksExport(
      [makeSession({ records: { 赤: makeRecord({ selectedDyeId: null, uncertain: true }) } })],
      DYE_HEX_BY_ID
    );
    expect(picks[0].selectedDyeHex).toBeNull();
  });
});

describe('buildEvaluationSessionsExport', () => {
  it('exports the session manifest (target order, timestamps) without the record bodies', () => {
    const sessions = [makeSession()];
    const out = buildEvaluationSessionsExport(sessions);
    expect(out).toEqual([
      {
        sessionId: 'sess1',
        evaluatorId: 'eval1',
        targetOrder: ['赤'],
        startedAt: '2026-08-27T09:58:00.000Z',
        completedAt: '2026-08-27T10:00:00.000Z',
      },
    ]);
  });
});

describe('buildTargetsExport', () => {
  it('strips dyeId and any other internal fields even if present on input, keeping romaji', () => {
    const raw = [
      {
        id: '赤',
        reading: 'あか',
        hex: '#ec001a',
        romaji: 'aka',
        dyeId: 'dye_014',
        note: 'secret provenance',
      },
    ];
    // @ts-expect-error — intentionally passing an over-shaped object to prove stripping
    const out = buildTargetsExport(raw);
    expect(out).toEqual([{ id: '赤', reading: 'あか', hex: '#ec001a', romaji: 'aka' }]);
    expect(JSON.stringify(out)).not.toContain('dyeId');
  });
});

describe('buildDyesExport', () => {
  it('keeps only the client-safe shape, dropping internal color objects', () => {
    const raw = [
      {
        id: 'dye_014',
        name: 'Carmine Red',
        hex: '#de0b16',
        rgb: { r: 222, g: 11, b: 22 },
        tags: ['rare'],
        oklab: { space: 'oklab', coords: [0, 0, 0] },
      },
    ];
    // @ts-expect-error — intentionally passing an over-shaped object to prove stripping
    const out = buildDyesExport(raw);
    expect(out).toEqual([
      {
        id: 'dye_014',
        name: 'Carmine Red',
        hex: '#de0b16',
        rgb: { r: 222, g: 11, b: 22 },
        tags: ['rare'],
      },
    ]);
    expect(JSON.stringify(out)).not.toContain('oklab');
  });
});

describe('buildMethodologyMarkdown', () => {
  const meta: SnapshotMetadata = {
    method: 'full-pool-human-shortlist',
    excludedTags: ['metallic', 'vivid'],
    poolSize: 97,
    totalDyes: 125,
    totalTargets: 64,
    layoutMethod: 'hue-sort',
    sourceCommit: '7a94d555a6879d05e2b2f3afc559724315790d0b',
    generatedAt: '2026-08-27T00:00:00.000Z',
  };

  it('embeds the pool definition and layout method, with no distance-metric mention', () => {
    const md = buildMethodologyMarkdown(meta, []);
    expect(md).toContain('full-pool-human-shortlist');
    expect(md).toContain('97');
    expect(md).toContain('metallic');
    expect(md).toContain('hue-sort');
  });

  it('counts distinct evaluators, not sessions (one evaluator may retest in multiple sessions)', () => {
    const sessions = [
      makeSession({ sessionId: 'sess1', evaluatorId: 'eval1' }),
      makeSession({ sessionId: 'sess2', evaluatorId: 'eval1' }), // same evaluator, a later retest
      makeSession({ sessionId: 'sess3', evaluatorId: 'eval2' }),
    ];
    const md = buildMethodologyMarkdown(meta, sessions);
    expect(md).toContain('Evaluators: 2');
    expect(md).toContain('Sessions: 3');
  });

  it('computes the date range from session-level timestamps', () => {
    const sessions = [
      makeSession({
        startedAt: '2026-08-20T00:00:00.000Z',
        completedAt: '2026-08-20T01:00:00.000Z',
      }),
      makeSession({
        startedAt: '2026-08-25T00:00:00.000Z',
        completedAt: '2026-08-25T01:00:00.000Z',
      }),
    ];
    const md = buildMethodologyMarkdown(meta, sessions);
    expect(md).toContain('2026-08-20');
    expect(md).toContain('2026-08-25');
  });

  it('never mentions any single algorithm as the "winner" or recommender', () => {
    const md = buildMethodologyMarkdown(meta, []);
    expect(md.toLowerCase()).not.toMatch(/helmlab.{0,20}(recommend|pick|winner)/);
    expect(md.toLowerCase()).not.toMatch(/ciede2000.{0,20}(recommend|pick|winner)/);
  });

  it('explicitly documents that the current dyeId / algorithmic ranks were hidden from evaluators', () => {
    const md = buildMethodologyMarkdown(meta, []);
    expect(md).toContain('dyeId');
    expect(md.toLowerCase()).toMatch(/hidden|not shown|never shown/);
  });

  it('is written in English (no Japanese characters)', () => {
    const md = buildMethodologyMarkdown(meta, []);
    expect(md).not.toMatch(/[぀-ヿ一-鿿]/);
  });
});
