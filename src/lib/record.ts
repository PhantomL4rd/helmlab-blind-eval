import type { TargetRecord } from './types';

const MIN_SHORTLIST_SIZE = 2;

function withCompletedAt(record: TargetRecord, now: string): TargetRecord {
  // A winner isn't required if 2+ candidates are marked tied — "these are equally close" is
  // itself a valid, recordable judgment. A single tie doesn't count: "tied with nothing" isn't
  // a judgment.
  const hasWinner = record.selectedDyeId !== null || record.ties.length >= 2;
  const done = record.uncertain || (hasWinner && record.confidence !== null);
  return { ...record, completedAt: done ? now : null };
}

export function createDraftRecord(params: {
  sessionId: string;
  targetId: string;
  targetHex: string;
  availableDyeIds: string[];
  now: string;
}): TargetRecord {
  return {
    sessionId: params.sessionId,
    targetId: params.targetId,
    targetHex: params.targetHex,
    availableDyeIds: params.availableDyeIds,
    shortlistedDyeIds: [],
    shortlistHistory: [],
    candidateDisplayOrder: [],
    selectedDyeId: null,
    selectionHistory: [],
    ties: [],
    confidence: null,
    uncertain: false,
    note: '',
    phase1StartedAt: params.now,
    phase1CompletedAt: null,
    phase2StartedAt: null,
    completedAt: null,
    method: 'blind-human-selection',
  };
}

export function toggleShortlist(record: TargetRecord, dyeId: string, now: string): TargetRecord {
  const onList = record.shortlistedDyeIds.includes(dyeId);
  const shortlistedDyeIds = onList
    ? record.shortlistedDyeIds.filter((id) => id !== dyeId)
    : [...record.shortlistedDyeIds, dyeId];
  const shortlistHistory = [
    ...record.shortlistHistory,
    { dyeId, action: (onList ? 'remove' : 'add') as 'add' | 'remove', at: now },
  ];

  let next: TargetRecord = { ...record, shortlistedDyeIds, shortlistHistory };
  if (onList && record.selectedDyeId === dyeId) {
    // Confidence was recorded for this specific pick — dropping the pick without dropping
    // confidence would let a later re-pick complete instantly on a stale judgment.
    next = {
      ...next,
      selectedDyeId: null,
      confidence: null,
      ties: next.ties.filter((id) => id !== dyeId),
    };
  } else if (onList) {
    next = { ...next, ties: next.ties.filter((id) => id !== dyeId) };
  }
  return withCompletedAt(next, now);
}

export function enterPhase2(
  record: TargetRecord,
  candidateDisplayOrder: string[],
  now: string
): TargetRecord {
  if (record.shortlistedDyeIds.length < MIN_SHORTLIST_SIZE) {
    throw new Error(`shortlist needs at least ${MIN_SHORTLIST_SIZE} candidates to enter Phase 2`);
  }
  return { ...record, phase1CompletedAt: now, phase2StartedAt: now, candidateDisplayOrder };
}

export function backToPhase1(record: TargetRecord): TargetRecord {
  return { ...record, phase1CompletedAt: null, phase2StartedAt: null };
}

export function selectDye(record: TargetRecord, dyeId: string, now: string): TargetRecord {
  const changed = record.selectedDyeId !== dyeId;
  const selectionHistory = changed
    ? [...record.selectionHistory, { dyeId, at: now }]
    : record.selectionHistory;
  return withCompletedAt({ ...record, selectedDyeId: dyeId, selectionHistory }, now);
}

export function setConfidence(
  record: TargetRecord,
  confidence: 'high' | 'medium' | 'low',
  now: string
): TargetRecord {
  return withCompletedAt({ ...record, confidence }, now);
}

export function toggleTie(record: TargetRecord, dyeId: string, now: string): TargetRecord {
  const ties = record.ties.includes(dyeId)
    ? record.ties.filter((id) => id !== dyeId)
    : [...record.ties, dyeId];
  return withCompletedAt({ ...record, ties }, now);
}

export function setUncertain(record: TargetRecord, value: boolean, now: string): TargetRecord {
  return withCompletedAt({ ...record, uncertain: value }, now);
}

export function setNote(record: TargetRecord, note: string): TargetRecord {
  return { ...record, note };
}
