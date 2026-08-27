<script lang="ts">
// Post-hoc comparison only. This bundle is the ONLY place that reads the current
// production dyeId (data/retest/snapshot/raw/traditional-colors.json) — it is never
// imported by App.svelte / index.html.
import type { AnalysisRow, ExistingJudgmentComparisonRow } from './lib/analysis-logic';
import { buildAnalysisRows, buildExistingJudgmentComparisonRows } from './lib/analysis-logic';
import type { SessionFile } from './lib/types';

let loading = $state(true);
let error = $state<string | null>(null);
let rows = $state<AnalysisRow[]>([]);
let existingRows = $state<ExistingJudgmentComparisonRow[]>([]);
let nameById = $state<Map<string, string>>(new Map());

async function load() {
  loading = true;
  error = null;
  try {
    const [sessions, traditionalColors, dyes, existing]: [
      SessionFile[],
      { id: string; hex: string; dyeId?: string }[],
      {
        id: string;
        name: string;
        hex: string;
        rgb: { r: number; g: number; b: number };
        tags?: string[];
      }[],
      { cases: { targetId: string; selectedDyeId: string; selectedDyeName: string }[] },
    ] = await Promise.all([
      fetch('/api/sessions/all').then((r) => r.json()),
      fetch('/data/retest/snapshot/raw/traditional-colors.json')
        .then((r) => r.json())
        .then((j) => j.colors),
      fetch('/data/retest/snapshot/raw/dyes.json')
        .then((r) => r.json())
        .then((j) => j.dyes),
      fetch('/data/existing-human-judgments/issue3-followup.json').then((r) => r.json()),
    ]);

    nameById = new Map(dyes.map((d) => [d.id, d.name]));
    rows = buildAnalysisRows({ sessions, traditionalColors, dyes });
    existingRows = buildExistingJudgmentComparisonRows({
      existingCases: existing.cases,
      retestRows: rows,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    loading = false;
  }
}

load();

const matchCount = $derived(rows.filter((r) => r.matchesCurrentDyeId).length);
</script>

<main>
  <h1>Past-data comparison (post-evaluation only)</h1>
  <p class="note">
    This page is the only place that loads the current <code>dyeId</code> (an algorithmic
    output, not a human judgment). The eval flow (<code>index.html</code>) cannot reach this
    data from its code.
  </p>

  {#if loading}
    <p>Loading…</p>
  {:else if error}
    <p class="error">Failed to load: {error}</p>
  {:else}
    <section>
      <h2>2026 retest × algorithmic-baseline (current dyeId, CIEDE2000, OKLab, Helmlab)</h2>
      <p class="summary">{matchCount} of {rows.length} match the current dyeId</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Target</th>
              <th>Evaluator</th>
              <th>Session</th>
              <th>Human pick</th>
              <th>Current dyeId</th>
              <th>Match</th>
              <th>CIEDE2000 rank</th>
              <th>OKLab rank</th>
              <th>Helmlab rank</th>
              <th>Confidence</th>
              <th>Uncertain</th>
              <th>Ties</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row (row.sessionId + row.targetId)}
              <tr>
                <td>{row.targetId}</td>
                <td>{row.evaluatorId}</td>
                <td class="mono">{row.sessionId}</td>
                <td>{row.selectedDyeId ? (nameById.get(row.selectedDyeId) ?? row.selectedDyeId) : '—'}</td>
                <td>{row.currentDyeId ? (nameById.get(row.currentDyeId) ?? row.currentDyeId) : '—'}</td>
                <td class:yes={row.matchesCurrentDyeId}>{row.matchesCurrentDyeId ? '✓' : ''}</td>
                <td>{row.ranks?.ciede2000 ?? '—'}</td>
                <td>{row.ranks?.oklab ?? '—'}</td>
                <td>{row.ranks?.helm ?? '—'}</td>
                <td>{row.confidence ?? '—'}</td>
                <td>{row.uncertain ? '✓' : ''}</td>
                <td>{row.ties.map((id) => nameById.get(id) ?? id).join(', ')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>existing-human-judgments (Issue #3 follow-up) × 2026 retest</h2>
      <p class="note">
        Cross-references the 4 pre-existing (non-blind, 3-candidate-limited) human judgments
        against the 2026 blind retest for the same targets. See
        <code>data/existing-human-judgments/README.md</code> for details.
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Target</th>
              <th>Existing pick (non-blind)</th>
              <th>2026 retest picks</th>
              <th>Match</th>
            </tr>
          </thead>
          <tbody>
            {#each existingRows as row (row.targetId)}
              <tr>
                <td>{row.targetId}</td>
                <td>{row.existingSelectedDyeName}</td>
                <td>
                  {#if row.retestPicks.length === 0}
                    (not yet evaluated)
                  {:else}
                    {row.retestPicks
                      .map(
                        (p) =>
                          `${p.evaluatorId}: ${p.selectedDyeId ? (nameById.get(p.selectedDyeId) ?? p.selectedDyeId) : '—'}`
                      )
                      .join(' / ')}
                  {/if}
                </td>
                <td class:yes={row.anyRetestMatchesExisting}>{row.anyRetestMatchesExisting ? '✓' : ''}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  .note {
    background: var(--panel-bg);
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    color: var(--ink-muted);
  }
  .error {
    color: #c0392b;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.85rem;
  }
  th,
  td {
    border: 1px solid var(--border);
    padding: 0.4rem 0.6rem;
    text-align: left;
    white-space: nowrap;
  }
  th {
    background: var(--panel-bg);
  }
  td.mono {
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
  }
  td.yes {
    color: #1a7a3c;
    font-weight: 700;
  }
</style>
