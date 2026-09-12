import { describe, expect, it } from 'vitest';
import { RecordedTelemetryProvider } from './recorded-telemetry-provider';
import { SimulationTelemetryProvider } from './simulation-telemetry-provider';
import type { TelemetrySample } from './types';

describe('telemetry providers', () => {
  it('produces deterministic, plausible simulated data', () => {
    const provider = new SimulationTelemetryProvider();
    const first = provider.sample(5000, 'joint-1');
    const second = provider.sample(5000, 'joint-1');
    expect(second).toEqual(first);
    expect(first.temperatureC).toBeGreaterThan(35);
    expect(first.healthPercent).toBeGreaterThan(95);
    expect(first.source).toBe('simulation');
  });

  it('plays back the most recent recorded sample for a channel', () => {
    const base: TelemetrySample = {
      timestamp: 0,
      source: 'recorded',
      channel: 'joint-1',
      jointAngleDeg: 1,
      torqueNm: 2,
      temperatureC: 40,
      currentA: 2,
      healthPercent: 99,
      cycleCount: 1,
      toolStatus: 'Ready',
    };
    const provider = new RecordedTelemetryProvider([
      base,
      { ...base, timestamp: 100, jointAngleDeg: 5 },
    ]);
    provider.reset();
    expect(provider.source).toBe('recorded');
    expect(provider.sample(performance.now() + 110, 'joint-1').jointAngleDeg).toBe(5);
  });

  it('indexes unsorted recordings by channel and falls back to the full timeline', () => {
    const sample = (timestamp: number, channel: string, angle: number): TelemetrySample => ({
      timestamp,
      source: 'recorded',
      channel,
      jointAngleDeg: angle,
      torqueNm: 2,
      temperatureC: 40,
      currentA: 2,
      healthPercent: 99,
      cycleCount: 1,
      toolStatus: 'Ready',
    });
    const provider = new RecordedTelemetryProvider([
      sample(100, 'joint-2', 20),
      sample(0, 'joint-1', 1),
      sample(100, 'joint-1', 10),
    ]);
    provider.reset();
    const now = performance.now();
    expect(provider.sample(now + 110, 'joint-1').jointAngleDeg).toBe(10);
    expect(provider.sample(now + 50, 'missing').jointAngleDeg).toBe(1);
  });
});
