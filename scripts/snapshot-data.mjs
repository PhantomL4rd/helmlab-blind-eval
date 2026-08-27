/**
 * CLI: builds the blind-safe views from the frozen raw snapshot.
 *
 *   node scripts/snapshot-data.mjs
 *
 * This does NOT re-copy from colorant-picker — data/retest/snapshot/raw/ is the frozen
 * evaluation-time snapshot and is updated manually (see PROVENANCE.md in that directory).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildBlindViews } from './snapshot-logic.mjs';

// Kept in sync with data/retest/snapshot/raw/PROVENANCE.md — update both together when
// refreshing the raw snapshot from a newer colorant-picker commit.
const SOURCE_COMMIT = '7a94d555a6879d05e2b2f3afc559724315790d0b';

const root = fileURLToPath(new URL('..', import.meta.url));
const rawDir = `${root}data/retest/snapshot/raw/`;
const blindDir = `${root}data/retest/snapshot/blind/`;

const dyes = JSON.parse(readFileSync(`${rawDir}dyes.json`, 'utf-8')).dyes;
const traditional = JSON.parse(readFileSync(`${rawDir}traditional-colors.json`, 'utf-8')).colors;

const { targetsBlind, dyesBlind, dyesFull, metadata } = buildBlindViews({
  dyes,
  traditional,
  sourceCommit: SOURCE_COMMIT,
});

mkdirSync(blindDir, { recursive: true });
writeFileSync(`${blindDir}targets.blind.json`, `${JSON.stringify(targetsBlind, null, 2)}\n`);
writeFileSync(`${blindDir}dyes.blind.json`, `${JSON.stringify(dyesBlind, null, 2)}\n`);
writeFileSync(`${blindDir}dyes.full.json`, `${JSON.stringify(dyesFull, null, 2)}\n`);
writeFileSync(`${blindDir}metadata.json`, `${JSON.stringify(metadata, null, 2)}\n`);

console.log(
  `Built blind views: ${targetsBlind.length} targets, ${dyesBlind.length}/${dyes.length} dyes in pool.`
);
console.log(`  excluded tags: ${metadata.excludedTags.join(', ')}`);
console.log(`  wrote to ${blindDir}`);
