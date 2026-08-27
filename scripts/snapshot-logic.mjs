/**
 * Builds the blind-safe views the eval app is allowed to fetch, from the already-frozen
 * raw snapshot (data/retest/snapshot/raw/). No color-distance computation happens here —
 * per policy, candidate generation is NOT pre-filtered by any algorithm; Phase 1 of the
 * eval flow shows the entire pool and the human builds their own shortlist.
 */
import { toRomaji } from './romaji.mjs';

// Matches EXCLUDED_TAGS in colorant-picker's scripts/sync-traditional-color-dyes.mjs —
// the same pool the current production dyeId was picked from. Kept identical on purpose
// so the retest and algorithmic-baseline comparison (analysis.html) share one pool
// definition; see the top-level README for the rationale/trade-off.
export const PRODUCTION_EXCLUDED_TAGS = ['metallic', 'vivid'];

function rgbToHex(rgb) {
  const h = (n) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

export function buildPool(dyes, excludedTags = PRODUCTION_EXCLUDED_TAGS) {
  return dyes.filter((dye) => !dye.tags?.some((tag) => excludedTags.includes(tag)));
}

export function buildBlindViews({
  dyes,
  traditional,
  excludedTags = PRODUCTION_EXCLUDED_TAGS,
  sourceCommit,
  generatedAt,
}) {
  const pool = buildPool(dyes, excludedTags);

  const targetsBlind = traditional.map((t) => ({
    id: t.id,
    reading: t.reading,
    hex: t.hex,
    romaji: toRomaji(t.reading),
  }));
  const dyesBlind = pool.map((d) => ({ id: d.id, hex: rgbToHex(d.rgb) }));
  const dyesFull = pool.map((d) => ({
    id: d.id,
    name: d.name,
    hex: rgbToHex(d.rgb),
    rgb: d.rgb,
    tags: d.tags ?? [],
  }));

  const metadata = {
    method: 'full-pool-human-shortlist',
    excludedTags,
    poolSize: pool.length,
    totalDyes: dyes.length,
    totalTargets: traditional.length,
    layoutMethod: 'hue-sort',
    sourceCommit,
    generatedAt: generatedAt ?? new Date().toISOString(),
  };

  return { targetsBlind, dyesBlind, dyesFull, metadata };
}
