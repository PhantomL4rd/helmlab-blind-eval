/**
 * Static, self-contained HTML report of retest results — no server, no `npm run dev`. Reuses
 * the same (tested) analysis-logic.ts as analysis.html, so there's one implementation of the
 * match/rank logic, not two. Intended for handing off to someone who should never need to run
 * this repo's code, only read a file.
 *
 *   node scripts/generate-report.mjs   # writes data/retest/exports/report.html
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildAnalysisRows,
  buildExistingJudgmentComparisonRows,
  rgbToHex,
} from '../src/lib/analysis-logic.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const sessionsDir = `${root}data/retest/sessions/`;
const rawDir = `${root}data/retest/snapshot/raw/`;
const blindDir = `${root}data/retest/snapshot/blind/`;
const outDir = `${root}data/retest/exports/`;
const templatePath = fileURLToPath(new URL('./report-template.html', import.meta.url));

const sessionFiles = readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
const sessions = sessionFiles.map((f) => JSON.parse(readFileSync(`${sessionsDir}${f}`, 'utf-8')));

const traditionalColors = JSON.parse(
  readFileSync(`${rawDir}traditional-colors.json`, 'utf-8')
).colors;
const dyes = JSON.parse(readFileSync(`${rawDir}dyes.json`, 'utf-8')).dyes;
const existing = JSON.parse(
  readFileSync(`${root}data/existing-human-judgments/issue3-followup.json`, 'utf-8')
);
const blindTargets = JSON.parse(readFileSync(`${blindDir}targets.blind.json`, 'utf-8'));
const metadata = JSON.parse(readFileSync(`${blindDir}metadata.json`, 'utf-8'));

const nameById = Object.fromEntries(dyes.map((d) => [d.id, d.name]));
const hexById = Object.fromEntries(dyes.map((d) => [d.id, d.hex ?? rgbToHex(d.rgb)]));
const romajiById = Object.fromEntries(blindTargets.map((t) => [t.id, t.romaji]));

const rows = buildAnalysisRows({ sessions, traditionalColors, dyes });
const existingRows = buildExistingJudgmentComparisonRows({
  existingCases: existing.cases,
  retestRows: rows,
});

const reportData = {
  metadata,
  rows,
  existingRows,
  nameById,
  hexById,
  romajiById,
  matchCount: rows.filter((r) => r.matchesCurrentDyeId).length,
  totalCount: rows.length,
};

// `<` -> < defuses `</script>` (or any other tag) appearing inside a string value — safe
// no-op for JSON.parse either way, since < decodes back to `<`.
const dataJson = JSON.stringify(reportData).replace(/</g, '\\u003c');

const template = readFileSync(templatePath, 'utf-8');
if (!template.includes('__REPORT_DATA__')) {
  throw new Error(`${templatePath} is missing the __REPORT_DATA__ placeholder`);
}
const html = template.replace('__REPORT_DATA__', dataJson);

mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}report.html`;
writeFileSync(outPath, html);
console.log(`wrote ${outPath} (${rows.length} rows, ${existingRows.length} existing rows)`);
