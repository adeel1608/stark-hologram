import { describe, expect, it } from 'vitest';
import { createDemoFrame } from './demo-provider';

describe('demo timeline', () => {
  it.each([
    [0.5, 'hover', 1],
    [2, 'grab', 1],
    [4, 'depth', 1],
    [5, 'release', 1],
    [7, 'two-hand', 2],
    [9, 'inspect', 1],
    [11, 'reset', 2],
  ] as const)('creates the %s second frame', (time, phase, handCount) => {
    const result = createDemoFrame(time, time * 1000);
    expect(result.phase).toBe(phase);
    expect(result.frame.hands).toHaveLength(handCount);
    expect(result.frame.source).toBe('demo');
  });
});
