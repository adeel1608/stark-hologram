import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_DURATION_SECONDS, DemoProvider, createDemoFrame } from './demo-provider';

describe('demo timeline', () => {
  afterEach(() => vi.unstubAllGlobals());

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

  it('exposes deterministic transport state with bounded playback speed', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const provider = new DemoProvider();
    provider.setSpeed(8);
    expect(provider.speed).toBe(2);
    provider.start(() => undefined);
    provider.pause();
    expect(provider.running).toBe(true);
    expect(provider.paused).toBe(true);
    expect(provider.progress).toBeGreaterThanOrEqual(0);
    expect(provider.progress).toBeLessThanOrEqual(1);
    provider.restart();
    expect(provider.progress).toBeLessThan(0.01);
    provider.resume();
    expect(provider.paused).toBe(false);
    provider.stop();
    expect(provider.running).toBe(false);
    expect(DEMO_DURATION_SECONDS).toBe(12);
  });
});
