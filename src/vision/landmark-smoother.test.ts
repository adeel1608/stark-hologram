import { describe, expect, it } from 'vitest';
import { syntheticHand } from '../demo/synthetic-hands';
import { LandmarkSmoother } from './landmark-smoother';

describe('LandmarkSmoother', () => {
  it('applies EMA to normal movement', () => {
    const smoother = new LandmarkSmoother({ alpha: 0.5, maxJump: 1 });
    smoother.process([syntheticHand('Right', 0.4, 0.5, 0.2, false)]);
    const output = smoother.process([syntheticHand('Right', 0.6, 0.5, 0.2, false)]);
    expect(output[0]?.landmarks[0]?.x).toBeCloseTo(0.5, 3);
  });

  it('accepts large jumps immediately instead of smearing invalid tracks', () => {
    const smoother = new LandmarkSmoother({ alpha: 0.1, maxJump: 0.05 });
    smoother.process([syntheticHand('Right', 0.2, 0.5, 0.2, false)]);
    const output = smoother.process([syntheticHand('Right', 0.8, 0.5, 0.2, false)]);
    expect(output[0]?.landmarks[0]?.x).toBeCloseTo(0.8, 3);
  });
});
