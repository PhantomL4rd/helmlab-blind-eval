export interface SelectionHistoryEntry {
  dyeId: string;
  at: string;
}

export interface ShortlistHistoryEntry {
  dyeId: string;
  action: 'add' | 'remove';
  at: string;
}

export interface TargetRecord {
  sessionId: string;
  targetId: string;
  targetHex: string;
  /** Full pool ids shown in Phase 1 (no algorithmic pre-filter — see README). */
  availableDyeIds: string[];
  shortlistedDyeIds: string[];
  shortlistHistory: ShortlistHistoryEntry[];
  /** Phase 2 shuffled order of the shortlist — the actual order shown for comparison. */
  candidateDisplayOrder: string[];
  selectedDyeId: string | null;
  selectionHistory: SelectionHistoryEntry[];
  ties: string[];
  confidence: 'high' | 'medium' | 'low' | null;
  /** Phase 1: evaluator could not find any plausible candidate by eye. */
  uncertain: boolean;
  note: string;
  phase1StartedAt: string;
  phase1CompletedAt: string | null;
  phase2StartedAt: string | null;
  completedAt: string | null;
  method: 'blind-human-selection';
}

export interface SessionFile {
  sessionId: string;
  evaluatorId: string;
  targetOrder: string[];
  startedAt: string;
  completedAt: string | null;
  records: Record<string, TargetRecord>;
}

export interface SessionSummary {
  sessionId: string;
  evaluatorId: string;
  startedAt: string;
  completedAt: string | null;
  completedTargetCount: number;
  totalTargets: number;
}

export interface SnapshotMetadata {
  method: 'full-pool-human-shortlist';
  excludedTags: string[];
  poolSize: number;
  totalDyes: number;
  totalTargets: number;
  layoutMethod: string;
  sourceCommit: string;
  generatedAt: string;
}

export interface BlindTarget {
  id: string;
  reading: string;
  hex: string;
  /** Mechanical hiragana→romaji rendering of `reading` (modified Hepburn, no macrons). */
  romaji: string;
}

export interface BlindDye {
  id: string;
  hex: string;
}

export interface FullDye {
  id: string;
  name: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
  tags: string[];
}
