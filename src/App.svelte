<script lang="ts">
import {
  createSession as apiCreateSession,
  fetchAllSessions,
  fetchDyesBlind,
  fetchDyesFull,
  fetchSession,
  fetchSessionsForEvaluator,
  fetchSnapshotMetadata,
  fetchTargetsBlind,
  saveRecord,
} from './lib/api';
import CandidateGrid from './lib/components/CandidateGrid.svelte';
import CompareModal from './lib/components/CompareModal.svelte';
import Phase1Grid from './lib/components/Phase1Grid.svelte';
import {
  buildDyesExport,
  buildEvaluationSessionsExport,
  buildHumanPicksExport,
  buildMethodologyMarkdown,
  buildTargetsExport,
} from './lib/export-assembly';
import { hexToHue } from './lib/hue';
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
} from './lib/record';
import { seededShuffle } from './lib/shuffle';
import type {
  BlindTarget,
  FullDye,
  SessionFile,
  SessionSummary,
  SnapshotMetadata,
  TargetRecord,
} from './lib/types';

const now = () => new Date().toISOString();
const EVALUATOR_KEY = 'helmlab-blind-eval:evaluatorId';
const MIN_SHORTLIST = 2;

type View = 'landing' | 'eval' | 'export';
let view = $state<View>('landing');
let evaluatorIdInput = $state(localStorage.getItem(EVALUATOR_KEY) ?? '');
let evaluatorId = $state('');

let loading = $state(false);
let loadError = $state<string | null>(null);
let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');

let targets = $state<BlindTarget[]>([]);
let dyesBlindById = $state<Map<string, string>>(new Map());
let metadata = $state<SnapshotMetadata | null>(null);
let session = $state<SessionFile | null>(null);
let sessionSummaries = $state<SessionSummary[]>([]);

let currentIndex = $state(0);
let compareCandidateId = $state<string | null>(null);

// export view state
let allSessions = $state<SessionFile[]>([]);
let dyesFull = $state<FullDye[] | null>(null);
let exportLoading = $state(false);

const poolIds = $derived([...dyesBlindById.keys()]);
const phase1Layout = $derived(
  [...dyesBlindById.entries()].sort((a, b) => hexToHue(a[1]) - hexToHue(b[1])).map(([id]) => id)
);

const currentTargetId = $derived(session ? session.targetOrder[currentIndex] : null);
const currentTarget = $derived(
  currentTargetId ? (targets.find((t) => t.id === currentTargetId) ?? null) : null
);

const currentRecord = $derived.by((): TargetRecord | null => {
  if (!session || !currentTarget) return null;
  const existing = session.records[currentTarget.id];
  if (existing) return existing;
  return createDraftRecord({
    sessionId: session.sessionId,
    targetId: currentTarget.id,
    targetHex: currentTarget.hex,
    availableDyeIds: poolIds,
    now: now(),
  });
});

const inPhase2 = $derived(currentRecord ? currentRecord.phase1CompletedAt !== null : false);

const phase1Candidates = $derived(
  phase1Layout.map((id) => ({ id, hex: dyesBlindById.get(id) ?? '#888888' }))
);
const phase2Candidates = $derived(
  currentRecord
    ? currentRecord.candidateDisplayOrder
        .map((id) => ({ id, hex: dyesBlindById.get(id) ?? '#888888' }))
        .filter((c) => dyesBlindById.has(c.id))
    : []
);

const completedCount = $derived(
  session ? Object.values(session.records).filter((r) => r.completedAt !== null).length : 0
);

function statusFor(targetId: string): 'done' | 'draft' | 'unanswered' {
  if (!session) return 'unanswered';
  const r = session.records[targetId];
  if (!r) return 'unanswered';
  if (r.completedAt) return 'done';
  if (r.shortlistedDyeIds.length > 0) return 'draft';
  return 'unanswered';
}

async function persist(record: TargetRecord) {
  if (!session) return;
  session = { ...session, records: { ...session.records, [record.targetId]: record } };
  saveState = 'saving';
  try {
    await saveRecord(session.sessionId, record);
    saveState = 'saved';
  } catch (err) {
    console.error(err);
    saveState = 'error';
  }
}

async function withRecord(mutate: (r: TargetRecord) => TargetRecord) {
  if (!currentRecord) return;
  await persist(mutate(currentRecord));
}

async function onToggleShortlist(dyeId: string) {
  await withRecord((r) => toggleShortlist(r, dyeId, now()));
}

async function onEnterPhase2() {
  if (!currentRecord || !session) return;
  const order = seededShuffle(
    currentRecord.shortlistedDyeIds,
    `${session.sessionId}:${currentRecord.targetId}`
  );
  await withRecord((r) => enterPhase2(r, order, now()));
}

async function onBackToPhase1() {
  compareCandidateId = null;
  await withRecord((r) => backToPhase1(r));
}

function onOpenCompare(dyeId: string) {
  compareCandidateId = dyeId;
}
function closeCompare() {
  compareCandidateId = null;
}
async function confirmCompare() {
  if (!compareCandidateId) return;
  await withRecord((r) => selectDye(r, compareCandidateId as string, now()));
  compareCandidateId = null;
}
async function toggleCompareTie() {
  if (!compareCandidateId) return;
  await withRecord((r) => toggleTie(r, compareCandidateId as string, now()));
}

async function onSetConfidence(level: 'high' | 'medium' | 'low') {
  await withRecord((r) => setConfidence(r, level, now()));
}
async function onSetUncertain(value: boolean) {
  await withRecord((r) => setUncertain(r, value, now()));
}
async function onNoteInput(value: string) {
  await withRecord((r) => setNote(r, value));
}

function goPrev() {
  compareCandidateId = null;
  currentIndex = Math.max(0, currentIndex - 1);
}
function goNext() {
  if (!session) return;
  compareCandidateId = null;
  currentIndex = Math.min(session.targetOrder.length - 1, currentIndex + 1);
}
function jumpTo(i: number) {
  compareCandidateId = null;
  currentIndex = i;
}

async function loadStaticData() {
  const [t, d, m] = await Promise.all([
    fetchTargetsBlind(),
    fetchDyesBlind(),
    fetchSnapshotMetadata(),
  ]);
  targets = t;
  dyesBlindById = new Map(d.map((x) => [x.id, x.hex]));
  metadata = m;
}

async function checkEvaluator() {
  const id = evaluatorIdInput.trim();
  if (!id) return;
  loading = true;
  loadError = null;
  try {
    await loadStaticData();
    sessionSummaries = await fetchSessionsForEvaluator(id);
    evaluatorId = id;
    localStorage.setItem(EVALUATOR_KEY, id);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  } finally {
    loading = false;
  }
}

async function startNewSession() {
  if (!evaluatorId) return;
  const sessionId = `${evaluatorId}__${Date.now().toString(36)}`;
  const targetOrder = seededShuffle(
    targets.map((t) => t.id),
    sessionId
  );
  loading = true;
  try {
    session = await apiCreateSession({ sessionId, evaluatorId, targetOrder });
    currentIndex = 0;
    view = 'eval';
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  } finally {
    loading = false;
  }
}

async function resumeSession(sessionId: string) {
  loading = true;
  try {
    const s = await fetchSession(sessionId);
    session = s;
    const firstIncomplete = s.targetOrder.findIndex((id) => s.records[id]?.completedAt == null);
    currentIndex = firstIncomplete === -1 ? 0 : firstIncomplete;
    view = 'eval';
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  } finally {
    loading = false;
  }
}

async function openExport() {
  view = 'export';
  exportLoading = true;
  try {
    const [sessions, full] = await Promise.all([fetchAllSessions(), fetchDyesFull()]);
    allSessions = sessions;
    dyesFull = full;
  } finally {
    exportLoading = false;
  }
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadHumanPicks() {
  downloadText(
    'human-picks.json',
    `${JSON.stringify(buildHumanPicksExport(allSessions, dyesBlindById), null, 2)}\n`
  );
}
function downloadTargets() {
  downloadText('targets.json', `${JSON.stringify(buildTargetsExport(targets), null, 2)}\n`);
}
function downloadDyes() {
  if (!dyesFull) return;
  downloadText('dyes.json', `${JSON.stringify(buildDyesExport(dyesFull), null, 2)}\n`);
}
function downloadSessions() {
  downloadText(
    'evaluation-sessions.json',
    `${JSON.stringify(buildEvaluationSessionsExport(allSessions), null, 2)}\n`
  );
}
function downloadMethodology() {
  if (!metadata) return;
  downloadText('methodology.md', buildMethodologyMarkdown(metadata, allSessions));
}
</script>

{#if view === 'landing'}
  <main class="landing">
    <h1>helmlab blind eval — 2026 retest</h1>
    <p>
      A blind evaluation tool for picking the closest-looking FF14 dye for each of 64
      traditional colors. Dye names, IDs, color-difference scores, algorithm rankings, and the
      current <code>dyeId</code> are never shown until evaluation is complete. First gather
      plausible dyes into a shortlist (Phase 1), then refine within that shortlist to pick one
      (Phase 2).
    </p>
    {#if !evaluatorId}
      <label>
        Evaluator ID
        <input
          type="text"
          bind:value={evaluatorIdInput}
          placeholder="e.g. PhantomL4rd"
          onkeydown={(e) => e.key === 'Enter' && checkEvaluator()}
        />
      </label>
      <button class="primary" onclick={checkEvaluator} disabled={!evaluatorIdInput.trim() || loading}
        >{loading ? 'Checking…' : 'Continue'}</button
      >
      {#if loadError}<p class="error">{loadError}</p>{/if}
    {:else if loading}
      <p>Loading…</p>
    {:else}
      <p>Evaluator: <strong>{evaluatorId}</strong></p>
      {#if sessionSummaries.length > 0}
        <h2>Past sessions</h2>
        <ul class="session-list">
          {#each sessionSummaries as s (s.sessionId)}
            <li>
              <span class="session-id">{s.sessionId}</span>
              <span>{s.completedTargetCount} / {s.totalTargets}</span>
              <button onclick={() => resumeSession(s.sessionId)}
                >{s.completedAt ? 'Review' : 'Resume'}</button
              >
            </li>
          {/each}
        </ul>
      {/if}
      <button class="primary" onclick={startNewSession}>Start a new session</button>
    {/if}
  </main>
{:else if view === 'eval'}
  <main class="eval">
    {#if !session || !currentTarget || !currentRecord}
      <p>Loading…</p>
    {:else}
      <header class="progress">
        <div class="progress-text">
          {completedCount} / {session.targetOrder.length} done — evaluator: {evaluatorId}
          <span class="save-state {saveState}">
            {#if saveState === 'saving'}Saving…{:else if saveState === 'saved'}Saved{:else if saveState === 'error'}Save failed{/if}
          </span>
        </div>
        <div class="minimap">
          {#each session.targetOrder as targetId, i (targetId)}
            <button
              class="dot {statusFor(targetId)}"
              class:current={i === currentIndex}
              onclick={() => jumpTo(i)}
              aria-label={`${targetId} (${statusFor(targetId)})`}
            ></button>
          {/each}
        </div>
        <button onclick={openExport}>Go to export</button>
      </header>

      <section class="target-panel">
        <span class="swatch big" style:background-color={currentTarget.hex}></span>
        <div class="target-meta">
          <div class="target-name">{currentTarget.id} ({currentTarget.romaji})</div>
          <div class="hex-label">{currentTarget.hex}</div>
        </div>
      </section>

      {#if !inPhase2}
        <section class="phase phase1">
          <p class="phase-label">
            Phase 1: Explore — add plausible dyes to the shortlist ({currentRecord.shortlistedDyeIds
              .length} selected, at least {MIN_SHORTLIST} needed to refine)
          </p>
          <Phase1Grid
            candidates={phase1Candidates}
            shortlisted={currentRecord.shortlistedDyeIds}
            onToggle={onToggleShortlist}
          />
          <label class="checkbox">
            <input
              type="checkbox"
              checked={currentRecord.uncertain}
              onchange={(e) => onSetUncertain((e.target as HTMLInputElement).checked)}
            />
            No plausible dye found
          </label>
          <button
            class="primary"
            onclick={onEnterPhase2}
            disabled={currentRecord.shortlistedDyeIds.length < MIN_SHORTLIST}
          >
            Refine ({currentRecord.shortlistedDyeIds.length}/{MIN_SHORTLIST}+ needed)
          </button>
        </section>
      {:else}
        <section class="phase phase2">
          <p class="phase-label">Phase 2: Refine</p>
          <button class="link" onclick={onBackToPhase1}>← Edit shortlist</button>
          <CandidateGrid
            candidates={phase2Candidates}
            ties={currentRecord.ties}
            selectedDyeId={currentRecord.selectedDyeId}
            onOpenCompare={onOpenCompare}
          />
          <section class="judgment">
            <fieldset>
              <legend>Confidence</legend>
              {#each ['high', 'medium', 'low'] as const as level}
                <label>
                  <input
                    type="radio"
                    name="confidence"
                    checked={currentRecord.confidence === level}
                    onchange={() => onSetConfidence(level)}
                  />
                  {level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low'}
                </label>
              {/each}
            </fieldset>
            <label class="note">
              Note (optional)
              <textarea
                value={currentRecord.note}
                oninput={(e) => onNoteInput((e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </label>
          </section>

          {#if compareCandidateId}
            <CompareModal
              targetHex={currentTarget.hex}
              candidateHex={dyesBlindById.get(compareCandidateId) ?? '#888888'}
              isTied={currentRecord.ties.includes(compareCandidateId)}
              onConfirm={confirmCompare}
              onToggleTie={toggleCompareTie}
              onClose={closeCompare}
            />
          {/if}
        </section>
      {/if}

      <nav class="pager">
        <button onclick={goPrev} disabled={currentIndex === 0}>← Previous</button>
        <div class="next-group">
          {#if currentRecord.completedAt === null && currentRecord.phase2StartedAt}
            <span class="incomplete-hint">
              {#if currentRecord.selectedDyeId === null && currentRecord.ties.length < 2}
                Pick a candidate (or tie 2+) to continue
              {:else}
                Set a confidence level to continue
              {/if}
            </span>
          {/if}
          <button
            onclick={goNext}
            disabled={currentIndex === session.targetOrder.length - 1 || currentRecord.completedAt === null}
          >
            Next →
          </button>
        </div>
      </nav>
    {/if}
  </main>
{:else if view === 'export'}
  <main class="export">
    <h1>Export</h1>
    <button onclick={() => (view = 'eval')}>Back to evaluation</button>
    {#if exportLoading}
      <p>Loading…</p>
    {:else}
      <p>
        Sessions: {allSessions.length} (evaluators: {new Set(allSessions.map((s) => s.evaluatorId))
          .size})
      </p>
      <div class="export-buttons">
        <button onclick={downloadHumanPicks}>human-picks.json</button>
        <button onclick={downloadTargets}>targets.json</button>
        <button onclick={downloadDyes}>dyes.json</button>
        <button onclick={downloadSessions}>evaluation-sessions.json</button>
        <button onclick={downloadMethodology}>methodology.md</button>
      </div>
    {/if}
  </main>
{/if}

<style>
  main {
    max-width: 780px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .landing {
    max-width: 560px;
    padding-top: 4rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.9rem;
  }
  input[type='text'],
  textarea {
    font: inherit;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--border);
  }
  button.primary {
    background: var(--accent);
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-weight: 600;
    width: fit-content;
  }
  button.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .session-list {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .session-list li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
  }
  .session-id {
    font-family: ui-monospace, monospace;
    color: var(--ink-muted);
  }
  .progress {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .save-state {
    margin-left: 0.5rem;
    font-size: 0.8rem;
  }
  .save-state.error {
    color: #c0392b;
  }
  .minimap {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    border: none;
    background: #999;
    padding: 0;
  }
  .dot.done {
    background: var(--accent);
  }
  .dot.draft {
    background: #d0a030;
  }
  .dot.current {
    outline: 2px solid var(--ink);
  }
  .target-panel {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }
  .swatch.big {
    width: 140px;
    height: 140px;
    border-radius: 6px;
    border: 1px solid var(--border);
  }
  .target-name {
    font-size: 1.2rem;
    font-weight: 600;
  }
  .phase-label {
    font-weight: 600;
    margin: 0;
  }
  .link {
    background: none;
    border: none;
    color: var(--accent);
    text-decoration: underline;
    padding: 0;
    width: fit-content;
  }
  .judgment {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  fieldset {
    display: flex;
    gap: 1rem;
    border: none;
    padding: 0;
  }
  .pager {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .next-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .incomplete-hint {
    font-size: 0.8rem;
    color: var(--ink-muted);
  }
  .export-buttons {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .error {
    color: #c0392b;
  }
</style>
