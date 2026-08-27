import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildBlindViews,
  buildPool,
  PRODUCTION_EXCLUDED_TAGS,
} from '../scripts/snapshot-logic.mjs';

const rawDir = fileURLToPath(new URL('../data/retest/snapshot/raw/', import.meta.url));
const dyes = JSON.parse(readFileSync(`${rawDir}dyes.json`, 'utf-8')).dyes;
const traditional = JSON.parse(readFileSync(`${rawDir}traditional-colors.json`, 'utf-8')).colors;

const fixtureDyes = [
  { id: 'd_red', name: 'Red', category: 'red', rgb: { r: 220, g: 10, b: 20 }, tags: [] },
  {
    id: 'd_metallic',
    name: 'Metallic',
    category: 'red',
    rgb: { r: 210, g: 15, b: 25 },
    tags: ['metallic'],
  },
  { id: 'd_vivid', name: 'Vivid', category: 'red', rgb: { r: 255, g: 0, b: 0 }, tags: ['vivid'] },
  { id: 'd_plain', name: 'Plain', category: 'blue', rgb: { r: 10, g: 10, b: 200 }, tags: [] },
];

describe('buildPool', () => {
  it('excludes metallic and vivid, matching production (EXCLUDED_TAGS in sync-traditional-color-dyes.mjs)', () => {
    expect(PRODUCTION_EXCLUDED_TAGS).toEqual(['metallic', 'vivid']);
    const pool = buildPool(fixtureDyes);
    expect(pool.map((d) => d.id).sort()).toEqual(['d_plain', 'd_red']);
  });

  it('does not exclude dyes with no tags at all', () => {
    const pool = buildPool([{ id: 'x', name: 'X', rgb: { r: 1, g: 2, b: 3 } }]);
    expect(pool.map((d) => d.id)).toEqual(['x']);
  });
});

describe('buildBlindViews', () => {
  const { targetsBlind, dyesBlind, dyesFull, metadata } = buildBlindViews({
    dyes: fixtureDyes,
    traditional: [{ id: '赤', reading: 'あか', hex: '#ec001a', dyeId: 'd_red', note: 'secret' }],
    sourceCommit: 'abc123',
  });

  it('targetsBlind strips dyeId/note/lockDye, keeping id+reading+hex, plus a derived romaji field', () => {
    expect(targetsBlind).toEqual([{ id: '赤', reading: 'あか', hex: '#ec001a', romaji: 'aka' }]);
    expect(JSON.stringify(targetsBlind)).not.toContain('dyeId');
  });

  it('dyesBlind exposes only id+hex for the pool (no name/tags leak into the eval bundle)', () => {
    expect(dyesBlind.map((d) => d.id).sort()).toEqual(['d_plain', 'd_red']);
    for (const d of dyesBlind) expect(Object.keys(d).sort()).toEqual(['hex', 'id']);
  });

  it('dyesFull carries name/rgb/tags for post-session reveal, scoped to the same pool', () => {
    expect(dyesFull.map((d) => d.id).sort()).toEqual(dyesBlind.map((d) => d.id).sort());
    for (const d of dyesFull)
      expect(Object.keys(d).sort()).toEqual(['hex', 'id', 'name', 'rgb', 'tags']);
  });

  it('metadata records pool definition and counts, no distance-metric fields at all', () => {
    expect(metadata.poolSize).toBe(2);
    expect(metadata.totalDyes).toBe(4);
    expect(metadata.totalTargets).toBe(1);
    expect(metadata.excludedTags).toEqual(['metallic', 'vivid']);
    expect(metadata.method).toBe('full-pool-human-shortlist');
    expect(metadata.sourceCommit).toBe('abc123');
    expect(metadata).not.toHaveProperty('topN');
  });
});

describe('buildBlindViews against the real snapshot', () => {
  it('produces a 97-dye pool and 64 targets, matching production pool definition', () => {
    const { dyesBlind, targetsBlind, metadata } = buildBlindViews({ dyes, traditional });
    expect(dyesBlind).toHaveLength(97);
    expect(targetsBlind).toHaveLength(64);
    expect(metadata.poolSize).toBe(97);
    expect(metadata.totalDyes).toBe(125);
  });
});
