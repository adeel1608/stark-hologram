import type { TelemetryProvider, TelemetrySample } from './types';

function hash(text: string): number {
  let value = 2166136261;
  for (const character of text) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function unitNoise(seed: number): number {
  let value = seed + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export class SimulationTelemetryProvider implements TelemetryProvider {
  readonly source = 'simulation' as const;
  #pausedAt?: number;
  #pauseStarted?: number;
  #timeOffset = 0;

  sample(timestamp: number, channel: string): TelemetrySample {
    const effectiveTime = this.#pausedAt ?? timestamp - this.#timeOffset;
    const channelSeed = hash(channel);
    const phase = (channelSeed % 628) / 100;
    const seconds = effectiveTime / 1000;
    const slow = Math.sin(seconds * 0.72 + phase);
    const fast = Math.sin(seconds * 2.1 + phase * 0.7);
    const noise = unitNoise(channelSeed + Math.floor(seconds * 4)) - 0.5;
    return {
      timestamp,
      source: this.source,
      channel,
      jointAngleDeg: 18 + slow * 24 + fast * 1.2,
      torqueNm: 11.5 + Math.abs(slow) * 5.2 + noise * 0.6,
      temperatureC: 40.8 + Math.abs(slow) * 3.1 + noise * 0.2,
      currentA: 2.25 + Math.abs(fast) * 1.05 + noise * 0.08,
      healthPercent: 98.2 - Math.abs(noise) * 0.4,
      cycleCount: 4281 + Math.floor(seconds / 8),
      toolStatus: slow > 0.42 ? 'Holding' : slow < -0.62 ? 'Open' : 'Ready',
    };
  }

  pause(): void {
    if (this.#pausedAt !== undefined) return;
    this.#pauseStarted = performance.now();
    this.#pausedAt = this.#pauseStarted - this.#timeOffset;
  }

  resume(): void {
    if (this.#pauseStarted === undefined) return;
    this.#timeOffset += performance.now() - this.#pauseStarted;
    this.#pausedAt = undefined;
    this.#pauseStarted = undefined;
  }

  reset(): void {
    this.#pausedAt = undefined;
    this.#pauseStarted = undefined;
    this.#timeOffset = performance.now();
  }

  dispose(): void {
    this.#pausedAt = undefined;
    this.#pauseStarted = undefined;
  }
}
