import type {
  BlindDye,
  BlindTarget,
  FullDye,
  SessionFile,
  SessionSummary,
  SnapshotMetadata,
  TargetRecord,
} from './types';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`POST ${url} failed: ${errBody.error ?? res.status}`);
  }
  return res.json();
}

export function fetchTargetsBlind() {
  return fetchJson<BlindTarget[]>('/data/retest/snapshot/blind/targets.blind.json');
}

export function fetchDyesBlind() {
  return fetchJson<BlindDye[]>('/data/retest/snapshot/blind/dyes.blind.json');
}

export function fetchSnapshotMetadata() {
  return fetchJson<SnapshotMetadata>('/data/retest/snapshot/blind/metadata.json');
}

/** Only call this from the post-session reveal/export view — never from the Phase 1/2 eval flow. */
export function fetchDyesFull() {
  return fetchJson<FullDye[]>('/data/retest/snapshot/blind/dyes.full.json');
}

export async function createSession(params: {
  sessionId: string;
  evaluatorId: string;
  targetOrder: string[];
}): Promise<SessionFile> {
  return postJson<SessionFile>('/api/session/create', params);
}

export async function fetchSession(sessionId: string): Promise<SessionFile> {
  return fetchJson<SessionFile>(`/api/session/${encodeURIComponent(sessionId)}`);
}

export async function fetchSessionsForEvaluator(evaluatorId: string): Promise<SessionSummary[]> {
  return fetchJson<SessionSummary[]>(
    `/api/sessions?evaluatorId=${encodeURIComponent(evaluatorId)}`
  );
}

export async function fetchAllSessions(): Promise<SessionFile[]> {
  return fetchJson<SessionFile[]>('/api/sessions/all');
}

export async function saveRecord(sessionId: string, record: TargetRecord): Promise<void> {
  await postJson('/api/save', { sessionId, record });
}
