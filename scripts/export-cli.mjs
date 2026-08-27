/**
 * CLI export: reuses the same (tested) export-assembly.ts logic the browser export view
 * uses, so there is exactly one implementation of the transformation — no risk of the CLI
 * and browser paths drifting apart. Reads every session under data/retest/sessions/.
 *
 *   node scripts/export-cli.mjs [outDir]   # defaults to data/retest/exports
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildDyesExport,
  buildEvaluationSessionsExport,
  buildHumanPicksExport,
  buildMethodologyMarkdown,
  buildTargetsExport,
} from '../src/lib/export-assembly.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const sessionsDir = `${root}data/retest/sessions/`;
const blindDir = `${root}data/retest/snapshot/blind/`;
const outDir = process.argv[2] ? `${process.argv[2]}/` : `${root}data/retest/exports/`;

const sessionFiles = readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
const sessions = sessionFiles.map((f) => JSON.parse(readFileSync(`${sessionsDir}${f}`, 'utf-8')));

const targetsBlind = JSON.parse(readFileSync(`${blindDir}targets.blind.json`, 'utf-8'));
const dyesBlind = JSON.parse(readFileSync(`${blindDir}dyes.blind.json`, 'utf-8'));
const dyesFull = JSON.parse(readFileSync(`${blindDir}dyes.full.json`, 'utf-8'));
const metadata = JSON.parse(readFileSync(`${blindDir}metadata.json`, 'utf-8'));
const dyeHexById = new Map(dyesBlind.map((d) => [d.id, d.hex]));

mkdirSync(outDir, { recursive: true });
writeFileSync(
  `${outDir}human-picks.json`,
  `${JSON.stringify(buildHumanPicksExport(sessions, dyeHexById), null, 2)}\n`
);
writeFileSync(
  `${outDir}targets.json`,
  `${JSON.stringify(buildTargetsExport(targetsBlind), null, 2)}\n`
);
writeFileSync(`${outDir}dyes.json`, `${JSON.stringify(buildDyesExport(dyesFull), null, 2)}\n`);
writeFileSync(
  `${outDir}evaluation-sessions.json`,
  `${JSON.stringify(buildEvaluationSessionsExport(sessions), null, 2)}\n`
);
writeFileSync(`${outDir}methodology.md`, buildMethodologyMarkdown(metadata, sessions));

console.log(`Exported ${sessions.length} session(s) to ${outDir}`);
