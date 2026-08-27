import { describe, expect, it } from 'vitest';
import { hexToHue } from '../src/lib/hue';

describe('hexToHue', () => {
  it('places red near 0°, green near 120°, blue near 240°', () => {
    expect(hexToHue('#ff0000')).toBeCloseTo(0, 0);
    expect(hexToHue('#00ff00')).toBeCloseTo(120, 0);
    expect(hexToHue('#0000ff')).toBeCloseTo(240, 0);
  });

  it('returns 0 for achromatic colors (no hue to sort by)', () => {
    expect(hexToHue('#808080')).toBe(0);
    expect(hexToHue('#ffffff')).toBe(0);
  });
});
