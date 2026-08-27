/**
 * vite dev server middleware providing the tiny local persistence API this tool needs.
 * Only active under `vite dev` — this app has no build/deploy step.
 *
 * Mounted under '/api/session' (singular) and '/api/sessions' (plural) with NO trailing
 * slash, one middleware each — connect strips the matched prefix from req.url before the
 * handler sees it, and a bare '/api/session' does not prefix-match '/api/sessions' (the
 * character right after the match must be '/' or end-of-string). Branching inside each
 * middleware on the remaining req.url avoids relying on finer-grained mount-path overlap
 * rules, which are easy to get subtly wrong.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createSession,
  mergeRecord,
  readSessionFile,
  writeSessionFileAtomic,
} from './session-store.mjs';

const sessionsDir = fileURLToPath(new URL('../data/retest/sessions/', import.meta.url));

function sanitizeId(id, label) {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safe) throw new Error(`${label} must not be empty`);
  return safe;
}

function sessionPath(sessionId) {
  return `${sessionsDir}${sanitizeId(sessionId, 'sessionId')}.json`;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function listAllSessions() {
  let files = [];
  try {
    files = readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return files.map((f) => readSessionFile(`${sessionsDir}${f}`)).filter((s) => s !== null);
}

function toSummary(session) {
  const targetIds = Object.keys(session.records);
  const completedTargetCount = targetIds.filter(
    (id) => session.records[id].completedAt != null
  ).length;
  return {
    sessionId: session.sessionId,
    evaluatorId: session.evaluatorId,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    completedTargetCount,
    totalTargets: session.targetOrder.length,
  };
}

export function blindEvalApiPlugin() {
  return {
    name: 'blind-eval-api',
    configureServer(server) {
      // req.url here is already stripped of the '/api/session' mount prefix by connect.
      server.middlewares.use('/api/session', async (req, res, next) => {
        const [pathPart] = req.url.split('?');

        if (req.method === 'POST' && pathPart === '/create') {
          try {
            const { sessionId, evaluatorId, targetOrder } = await readJsonBody(req);
            if (!sessionId || !evaluatorId || !Array.isArray(targetOrder)) {
              throw new Error('sessionId, evaluatorId, and targetOrder are required');
            }
            const path = sessionPath(sessionId);
            const existing = readSessionFile(path);
            if (existing) return sendJson(res, 200, existing);
            const created = createSession({
              sessionId,
              evaluatorId,
              targetOrder,
              now: new Date().toISOString(),
            });
            writeSessionFileAtomic(path, created);
            return sendJson(res, 200, created);
          } catch (err) {
            return sendJson(res, 400, { ok: false, error: String(err.message ?? err) });
          }
        }

        if (req.method === 'GET' && pathPart.length > 1) {
          const sessionId = decodeURIComponent(pathPart.slice(1));
          try {
            const session = readSessionFile(sessionPath(sessionId));
            if (!session) return sendJson(res, 404, { ok: false, error: 'not found' });
            return sendJson(res, 200, session);
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: String(err.message ?? err) });
          }
        }

        return next();
      });

      // req.url here is stripped of the '/api/sessions' mount prefix.
      server.middlewares.use('/api/sessions', (req, res, next) => {
        if (req.method !== 'GET') return next();
        const [pathPart, query] = req.url.split('?');

        if (pathPart === '/all') {
          try {
            return sendJson(res, 200, listAllSessions());
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: String(err.message ?? err) });
          }
        }

        if (pathPart === '' || pathPart === '/') {
          const evaluatorId = new URLSearchParams(query ?? '').get('evaluatorId');
          try {
            const sessions = listAllSessions().filter(
              (s) => !evaluatorId || s.evaluatorId === evaluatorId
            );
            return sendJson(res, 200, sessions.map(toSummary));
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: String(err.message ?? err) });
          }
        }

        return next();
      });

      server.middlewares.use('/api/save', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { sessionId, record } = await readJsonBody(req);
          if (!sessionId || !record) throw new Error('sessionId and record are required');
          const path = sessionPath(sessionId);
          const existing = readSessionFile(path);
          if (!existing)
            throw new Error(`session ${sessionId} does not exist — call /api/session/create first`);
          const updated = mergeRecord(existing, record, new Date().toISOString());
          writeSessionFileAtomic(path, updated);
          sendJson(res, 200, { ok: true, session: updated });
        } catch (err) {
          sendJson(res, 400, { ok: false, error: String(err.message ?? err) });
        }
      });
    },
  };
}
