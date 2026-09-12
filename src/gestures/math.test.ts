import { describe, expect, it } from 'vitest';
import { clamp, median, shortestAngleDelta } from './math';

describe('gesture math', () => {
  it('calculates robust medians', () => {
    expect(median([100, 2, 3])).toBe(3);
    expect(median([1, 3, 5, 7])).toBe(4);
    expect(median([])).toBe(0);
  });

  it('clamps and wraps angle deltas', () => {
    expect(clamp(3, -1, 1)).toBe(1);
    expect(shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  });
});
