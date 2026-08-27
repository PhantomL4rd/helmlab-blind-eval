import { describe, expect, it } from 'vitest';
import { createSession, mergeRecord } from '../scripts/session-store.mjs';
import type { SessionFile, TargetRecord } from '../src/lib/types';

const T1 = '2026-08-27T10:00:00.000Z';
const T2 = '2026-08-27T10:05:00.000Z';

function makeRecord(overrides: Partial<TargetRecord> = {}): TargetRecord {
  return {
    sessionId: 'sess1',
    targetId: '赤',
    targetHex: '#ec001a',
    availableDyeIds: ['dye_014', 'dye_015'],
    shortlistedDyeIds: ['dye_014'],
    shortlistHistory: [],
    candidateDisplayOrder: ['dye_014'],
    selectedDyeId: 'dye_014',
    selectionHistory: [{ dyeId: 'dye_014', at: T1 }],
    ties: [],
    confidence: 'high',
    uncertain: false,
    note: '',
    phase1StartedAt: T1,
    phase1CompletedAt: T1,
    phase2StartedAt: T1,
    completedAt: T1,
    method: 'blind-human-selection',
    ...overrides,
  };
}

describe('createSession', () => {
  it('creates an empty session shell with the given target order', () => {
    const session = createSession({
      sessionId: 'sess1',
      evaluatorId: 'eval1',
      targetOrder: ['赤', '紅'],
      now: T1,
    });
    expect(session).toEqual({
      sessionId: 'sess1',
      evaluatorId: 'eval1',
      targetOrder: ['赤', '紅'],
      startedAt: T1,
      completedAt: null,
      records: {},
    });
  });
});

describe('mergeRecord', () => {
  function baseSession(): SessionFile {
    return createSession({
      sessionId: 'sess1',
      evaluatorId: 'eval1',
      targetOrder: ['赤', '紅'],
      now: T1,
    });
  }

  it('upserts by targetId, leaving other targets untouched', () => {
    let session = mergeRecord(
      baseSession(),
      makeRecord({ targetId: '紅', selectedDyeId: 'dye_099' }),
      T1
    );
    session = mergeRecord(session, makeRecord({ targetId: '赤' }), T1);
    expect(session.records['紅'].selectedDyeId).toBe('dye_099');
    expect(session.records['赤'].selectedDyeId).toBe('dye_014');
  });

  it('overwrites a previous record for the same target', () => {
    let session = mergeRecord(baseSession(), makeRecord({ selectedDyeId: 'dye_001' }), T1);
    session = mergeRecord(session, makeRecord({ selectedDyeId: 'dye_014' }), T1);
    expect(session.records['赤'].selectedDyeId).toBe('dye_014');
  });

  it('does not mutate the input session', () => {
    const session = baseSession();
    mergeRecord(session, makeRecord(), T1);
    expect(session.records).toEqual({});
  });

  it('rejects a record whose sessionId does not match the session', () => {
    const session = baseSession();
    expect(() => mergeRecord(session, makeRecord({ sessionId: 'other' }), T1)).toThrow();
  });

  it('marks the whole session completedAt once every target in targetOrder is done', () => {
    let session = mergeRecord(baseSession(), makeRecord({ targetId: '赤' }), T1);
    expect(session.completedAt).toBeNull(); // 紅 still missing
    session = mergeRecord(session, makeRecord({ targetId: '紅' }), T2);
    expect(session.completedAt).toBe(T2);
  });

  it('un-completes the session if a completed target is edited back to incomplete', () => {
    let session = mergeRecord(baseSession(), makeRecord({ targetId: '赤' }), T1);
    session = mergeRecord(session, makeRecord({ targetId: '紅' }), T1);
    expect(session.completedAt).toBe(T1);
    session = mergeRecord(
      session,
      makeRecord({ targetId: '赤', selectedDyeId: null, confidence: null, completedAt: null }),
      T2
    );
    expect(session.completedAt).toBeNull();
  });
});
