import { describe, expect, it } from 'vitest';
import { syntheticHand } from '../demo/synthetic-hands';
import { extendedFingerCount, palmScale, recognizePinch } from './recognizers';

describe('gesture recognizers', () => {
  it('normalizes pinch distance by palm scale', () => {
    const small = recognizePinch(syntheticHand('Right', 0.5, 0.5, 0.18, true));
    const large = recognizePinch(syntheticHand('Right', 0.5, 0.5, 0.35, true));
    expect(small.active).toBe(true);
    expect(large.active).toBe(true);
    expect(Math.abs(small.ratio - large.ratio)).toBeLessThan(0.02);
  });

  it('rejects an open hand as a pinch', () => {
    const recognition = recognizePinch(syntheticHand('Left', 0.5, 0.5, 0.25, false));
    expect(recognition.active).toBe(false);
    expect(extendedFingerCount(syntheticHand('Left', 0.5, 0.5, 0.25, false).landmarks)).toBe(4);
  });

  it('measures positive palm scale', () => {
    expect(palmScale(syntheticHand('Right', 0.5, 0.5, 0.25, false).landmarks)).toBeGreaterThan(
      0.05,
    );
  });
});
