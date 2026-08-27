import { describe, expect, it } from 'vitest';
import { seededShuffle } from '../src/lib/shuffle';

const ITEMS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

describe('seededShuffle', () => {
  it('is deterministic for the same seed', () => {
    const a = seededShuffle(ITEMS, 'evaluator1:赤');
    const b = seededShuffle(ITEMS, 'evaluator1:赤');
    expect(a).toEqual(b);
  });

  it('differs across seeds (for a large enough input)', () => {
    const a = seededShuffle(ITEMS, 'evaluator1:赤');
    const b = seededShuffle(ITEMS, 'evaluator2:赤');
    const c = seededShuffle(ITEMS, 'evaluator1:紅');
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('returns a permutation of the input (same elements, same length)', () => {
    const shuffled = seededShuffle(ITEMS, 'seed');
    expect(shuffled).toHaveLength(ITEMS.length);
    expect([...shuffled].sort()).toEqual([...ITEMS].sort());
  });

  it('does not mutate the input array', () => {
    const original = [...ITEMS];
    seededShuffle(ITEMS, 'seed');
    expect(ITEMS).toEqual(original);
  });

  it('handles empty and single-element arrays', () => {
    expect(seededShuffle([], 'seed')).toEqual([]);
    expect(seededShuffle(['only'], 'seed')).toEqual(['only']);
  });
});
