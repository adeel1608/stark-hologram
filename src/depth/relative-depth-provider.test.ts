import { describe, expect, it } from 'vitest';
import { syntheticHand } from '../demo/synthetic-hands';
import { RelativeDepthProvider } from './relative-depth-provider';

describe('RelativeDepthProvider', () => {
  it('builds a baseline and reports normalized non-metric depth', () => {
    const provider = new RelativeDepthProvider();
    for (let index = 0; index < 15; index += 1) {
      provider.update(syntheticHand('Right', 0.5, 0.5, 0.25, false), index * 16);
    }
    const baseline = provider.getReading();
    expect(baseline.available).toBe(true);
    expect(baseline.raw).toBeCloseTo(0, 3);
    const closer = provider.update(syntheticHand('Right', 0.5, 0.5, 0.34, false), 300);
    expect(closer.raw).toBeLessThan(0);
    expect(closer.raw).toBeGreaterThanOrEqual(-1);
  });

  it('supports a persisted baseline and explicit rebaseline', () => {
    const provider = new RelativeDepthProvider();
    provider.setBaseline(0.2);
    expect(provider.update(syntheticHand('Right', 0.5, 0.5, 0.25, false), 0).available).toBe(true);
    provider.rebaseline();
    expect(provider.getReading().available).toBe(false);
  });

  it('fails gracefully when tracking is absent', () => {
    const provider = new RelativeDepthProvider();
    expect(provider.update(undefined, 1000).available).toBe(false);
  });

  it('does not lock a baseline while apparent hand scale is moving', () => {
    const provider = new RelativeDepthProvider();
    for (let index = 0; index < 30; index += 1) {
      const scale = index % 2 === 0 ? 0.19 : 0.34;
      provider.update(syntheticHand('Right', 0.5, 0.5, scale, false), index * 16);
    }
    expect(provider.getReading().available).toBe(false);
    expect(provider.getReading().calibrationProgress).toBe(1);
  });

  it('uses a robust multi-feature baseline despite an isolated outlier', () => {
    const provider = new RelativeDepthProvider();
    for (let index = 0; index < 15; index += 1) {
      const scale = index === 4 ? 0.38 : 0.25;
      provider.update(syntheticHand('Right', 0.5, 0.5, scale, false), index * 16);
    }
    const reading = provider.getReading();
    expect(reading.available).toBe(true);
    expect(reading.baselineFeatures).toHaveLength(5);
    expect(reading.calibrationVariation).toBe(0);
  });

  it('retains a reading briefly then marks it stale after tracking loss', () => {
    const provider = new RelativeDepthProvider();
    for (let index = 0; index < 15; index += 1) {
      provider.update(syntheticHand('Right', 0.5, 0.5, 0.25, false), index * 16);
    }
    expect(provider.update(undefined, 400).available).toBe(true);
    expect(provider.update(undefined, 700).available).toBe(false);
  });
});
