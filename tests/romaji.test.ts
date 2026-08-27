import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toRomaji } from '../scripts/romaji.mjs';

const rawDir = fileURLToPath(new URL('../data/retest/snapshot/raw/', import.meta.url));
const traditional = JSON.parse(readFileSync(`${rawDir}traditional-colors.json`, 'utf-8')).colors;

describe('toRomaji', () => {
  it('converts plain gojuon syllables', () => {
    expect(toRomaji('しろ')).toBe('shiro');
    expect(toRomaji('くろ')).toBe('kuro');
    expect(toRomaji('あか')).toBe('aka');
    expect(toRomaji('あお')).toBe('ao');
  });

  it('handles dakuten/handakuten', () => {
    expect(toRomaji('もえぎ')).toBe('moegi');
    expect(toRomaji('べにばな')).toBe('benibana');
    expect(toRomaji('こんじょう')).toBe('konjou');
  });

  it('handles yōon (contracted sounds)', () => {
    expect(toRomaji('きくちば')).toBe('kikuchiba');
    expect(toRomaji('しゃしん')).toBe('shashin');
    expect(toRomaji('じょうき')).toBe('jouki');
  });

  it('handles the long-vowel う digraph literally (no macrons)', () => {
    expect(toRomaji('こう')).toBe('kou');
    expect(toRomaji('るりいろ')).toBe('ruriiro');
  });

  it('handles ん as a standalone n', () => {
    expect(toRomaji('あおぐろみ')).toBe('aoguromi');
  });

  it('handles っ (sokuon) by doubling the following consonant', () => {
    expect(toRomaji('がっこう')).toBe('gakkou');
  });

  it('passes through non-hiragana characters unchanged (defensive — should not occur in real data)', () => {
    expect(toRomaji('a1')).toBe('a1');
  });

  it('produces a non-empty, lowercase-ascii romanization for every real target reading', () => {
    for (const t of traditional) {
      const r = toRomaji(t.reading);
      expect(r.length).toBeGreaterThan(0);
      expect(r).toMatch(/^[a-z]+$/);
    }
  });

  it('produces distinct romaji for distinct readings across the real dataset (sanity check, not a hash guarantee)', () => {
    const romajiValues = traditional.map((t: { reading: string }) => toRomaji(t.reading));
    const uniqueReadings = new Set(traditional.map((t: { reading: string }) => t.reading));
    const uniqueRomaji = new Set(romajiValues);
    expect(uniqueRomaji.size).toBe(uniqueReadings.size);
  });
});
