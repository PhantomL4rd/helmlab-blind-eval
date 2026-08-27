import { describe, expect, it } from 'vitest';
import {
  backToPhase1,
  createDraftRecord,
  enterPhase2,
  selectDye,
  setConfidence,
  setNote,
  setUncertain,
  toggleShortlist,
  toggleTie,
} from '../src/lib/record';

const T1 = '2026-08-27T10:00:00.000Z';
const T2 = '2026-08-27T10:05:00.000Z';
const T3 = '2026-08-27T10:10:00.000Z';

function draft() {
  return createDraftRecord({
    sessionId: 'sess1',
    targetId: '赤',
    targetHex: '#ec001a',
    availableDyeIds: ['dye_014', 'dye_015', 'dye_016', 'dye_017'],
    now: T1,
  });
}

describe('createDraftRecord', () => {
  it('starts incomplete with an empty shortlist and empty histories', () => {
    const r = draft();
    expect(r.shortlistedDyeIds).toEqual([]);
    expect(r.shortlistHistory).toEqual([]);
    expect(r.selectedDyeId).toBeNull();
    expect(r.confidence).toBeNull();
    expect(r.uncertain).toBe(false);
    expect(r.completedAt).toBeNull();
    expect(r.phase1StartedAt).toBe(T1);
    expect(r.phase1CompletedAt).toBeNull();
    expect(r.phase2StartedAt).toBeNull();
    expect(r.method).toBe('blind-human-selection');
  });
});

describe('toggleShortlist', () => {
  it('adds a dye to the shortlist and records the history', () => {
    const r = toggleShortlist(draft(), 'dye_014', T1);
    expect(r.shortlistedDyeIds).toEqual(['dye_014']);
    expect(r.shortlistHistory).toEqual([{ dyeId: 'dye_014', action: 'add', at: T1 }]);
  });

  it('removes a dye already on the shortlist', () => {
    let r = toggleShortlist(draft(), 'dye_014', T1);
    r = toggleShortlist(r, 'dye_014', T2);
    expect(r.shortlistedDyeIds).toEqual([]);
    expect(r.shortlistHistory).toEqual([
      { dyeId: 'dye_014', action: 'add', at: T1 },
      { dyeId: 'dye_014', action: 'remove', at: T2 },
    ]);
  });

  it('clears selectedDyeId (and completedAt) if the currently-selected dye is removed from the shortlist', () => {
    let r = draft();
    r = toggleShortlist(r, 'dye_014', T1);
    r = toggleShortlist(r, 'dye_015', T1);
    r = enterPhase2(r, ['dye_014', 'dye_015'], T1);
    r = selectDye(r, 'dye_014', T1);
    r = setConfidence(r, 'high', T1);
    expect(r.completedAt).toBe(T1);

    r = toggleShortlist(r, 'dye_014', T2); // remove the selected one
    expect(r.selectedDyeId).toBeNull();
    expect(r.completedAt).toBeNull();
  });

  it('also clears confidence when the selected dye is removed from the shortlist, so a later re-pick cannot inherit a stale confidence', () => {
    let r = draft();
    r = toggleShortlist(r, 'dye_014', T1);
    r = toggleShortlist(r, 'dye_015', T1);
    r = enterPhase2(r, ['dye_014', 'dye_015'], T1);
    r = selectDye(r, 'dye_014', T1);
    r = setConfidence(r, 'high', T1);

    r = toggleShortlist(r, 'dye_014', T2); // remove the selected one
    expect(r.confidence).toBeNull();

    r = selectDye(r, 'dye_015', T3);
    expect(r.completedAt).toBeNull(); // must not auto-complete on the old confidence
  });

  it('removes a removed dye from ties too', () => {
    let r = draft();
    r = toggleShortlist(r, 'dye_014', T1);
    r = toggleShortlist(r, 'dye_015', T1);
    r = toggleTie(r, 'dye_015', T1);
    expect(r.ties).toEqual(['dye_015']);
    r = toggleShortlist(r, 'dye_015', T2);
    expect(r.ties).toEqual([]);
  });
});

describe('enterPhase2', () => {
  it('requires at least 2 shortlisted candidates', () => {
    let r = draft();
    r = toggleShortlist(r, 'dye_014', T1);
    expect(() => enterPhase2(r, ['dye_014'], T2)).toThrow();
  });

  it('sets phase1CompletedAt, phase2StartedAt, and the display order once shortlist has 2+', () => {
    let r = draft();
    r = toggleShortlist(r, 'dye_014', T1);
    r = toggleShortlist(r, 'dye_015', T1);
    r = enterPhase2(r, ['dye_015', 'dye_014'], T2);
    expect(r.phase1CompletedAt).toBe(T2);
    expect(r.phase2StartedAt).toBe(T2);
    expect(r.candidateDisplayOrder).toEqual(['dye_015', 'dye_014']);
  });
});

describe('backToPhase1', () => {
  it('resets phase1CompletedAt and phase2StartedAt so Phase 1 can be revised', () => {
    let r = draft();
    r = toggleShortlist(r, 'dye_014', T1);
    r = toggleShortlist(r, 'dye_015', T1);
    r = enterPhase2(r, ['dye_014', 'dye_015'], T2);
    r = backToPhase1(r);
    expect(r.phase1CompletedAt).toBeNull();
    expect(r.phase2StartedAt).toBeNull();
    expect(r.shortlistedDyeIds).toEqual(['dye_014', 'dye_015']); // shortlist itself preserved
  });
});

describe('selectDye / setConfidence / completedAt gating', () => {
  function shortlisted() {
    let r = draft();
    r = toggleShortlist(r, 'dye_014', T1);
    r = toggleShortlist(r, 'dye_015', T1);
    return enterPhase2(r, ['dye_014', 'dye_015'], T1);
  }

  it('does not complete on selection alone (confidence still missing)', () => {
    const r = selectDye(shortlisted(), 'dye_014', T2);
    expect(r.completedAt).toBeNull();
  });

  it('completes once both selection and confidence are present', () => {
    let r = shortlisted();
    r = selectDye(r, 'dye_014', T2);
    r = setConfidence(r, 'high', T3);
    expect(r.completedAt).toBe(T3);
  });

  it('records selectionHistory only when the selected dye actually changes', () => {
    let r = shortlisted();
    r = selectDye(r, 'dye_014', T1);
    r = selectDye(r, 'dye_014', T2);
    expect(r.selectionHistory).toEqual([{ dyeId: 'dye_014', at: T1 }]);
    r = selectDye(r, 'dye_015', T3);
    expect(r.selectionHistory).toEqual([
      { dyeId: 'dye_014', at: T1 },
      { dyeId: 'dye_015', at: T3 },
    ]);
  });

  it('re-selecting after completion refreshes completedAt', () => {
    let r = shortlisted();
    r = selectDye(r, 'dye_014', T1);
    r = setConfidence(r, 'high', T1);
    r = selectDye(r, 'dye_015', T3);
    expect(r.completedAt).toBe(T3);
  });
});

describe('tie-only completion (no single winner picked)', () => {
  function shortlisted() {
    let r = draft();
    r = toggleShortlist(r, 'dye_014', T1);
    r = toggleShortlist(r, 'dye_015', T1);
    return enterPhase2(r, ['dye_014', 'dye_015'], T1);
  }

  it('completes on 2+ ties plus confidence, with no selectedDyeId required', () => {
    let r = shortlisted();
    r = toggleTie(r, 'dye_014', T1);
    r = toggleTie(r, 'dye_015', T1);
    r = setConfidence(r, 'medium', T2);
    expect(r.selectedDyeId).toBeNull();
    expect(r.completedAt).toBe(T2);
  });

  it('does not complete on a single tie even with confidence set', () => {
    let r = shortlisted();
    r = toggleTie(r, 'dye_014', T1);
    r = setConfidence(r, 'medium', T2);
    expect(r.completedAt).toBeNull();
  });

  it('un-tying below 2 clears completedAt again', () => {
    let r = shortlisted();
    r = toggleTie(r, 'dye_014', T1);
    r = toggleTie(r, 'dye_015', T1);
    r = setConfidence(r, 'medium', T2);
    expect(r.completedAt).toBe(T2);

    r = toggleTie(r, 'dye_015', T3); // back down to 1 tie
    expect(r.completedAt).toBeNull();
  });

  it('removing a tied dye from the shortlist (dropping ties below 2) clears completedAt', () => {
    let r = shortlisted();
    r = toggleTie(r, 'dye_014', T1);
    r = toggleTie(r, 'dye_015', T1);
    r = setConfidence(r, 'medium', T2);
    expect(r.completedAt).toBe(T2);

    r = toggleShortlist(r, 'dye_015', T3); // remove one of the tied candidates
    expect(r.ties).toEqual(['dye_014']);
    expect(r.completedAt).toBeNull();
  });
});

describe('setUncertain', () => {
  it('marks the target complete via the uncertain path, without requiring a pick', () => {
    const r = setUncertain(draft(), true, T1);
    expect(r.uncertain).toBe(true);
    expect(r.completedAt).toBe(T1);
    expect(r.selectedDyeId).toBeNull();
  });

  it('un-marking uncertain clears completedAt again if no pick exists', () => {
    let r = setUncertain(draft(), true, T1);
    r = setUncertain(r, false, T2);
    expect(r.completedAt).toBeNull();
  });
});

describe('setNote', () => {
  it('stores free text', () => {
    const r = setNote(draft(), 'すべて彩度が高すぎる');
    expect(r.note).toBe('すべて彩度が高すぎる');
  });
});
