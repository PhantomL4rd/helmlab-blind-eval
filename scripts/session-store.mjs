import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Pure: a fresh, empty session shell. `targetOrder` is fixed at creation (recorded, not re-derived). */
export function createSession({ sessionId, evaluatorId, targetOrder, now }) {
  return { sessionId, evaluatorId, targetOrder, startedAt: now, completedAt: null, records: {} };
}

/** Pure: upserts `record` into `session.records[record.targetId]`. Never mutates its input. */
export function mergeRecord(session, record, now) {
  if (record.sessionId !== session.sessionId) {
    throw new Error(
      `record.sessionId (${record.sessionId}) does not match session (${session.sessionId})`
    );
  }
  const records = { ...session.records, [record.targetId]: record };
  const allDone = session.targetOrder.every((targetId) => records[targetId]?.completedAt != null);
  return { ...session, records, completedAt: allDone ? now : null };
}

export function readSessionFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/** Write-to-temp-then-rename so a crash mid-write never corrupts the previous session file. */
export function writeSessionFileAtomic(path, session) {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, `${JSON.stringify(session, null, 2)}\n`);
  renameSync(tmpPath, path);
}
