import type { TelemetryProvider, TelemetrySample } from './types';

export class RecordedTelemetryProvider implements TelemetryProvider {
  readonly source = 'recorded' as const;
  #paused = false;
  #startedAt = performance.now();
  #pausedAt = 0;

  constructor(private readonly samples: TelemetrySample[]) {
    if (samples.length === 0) throw new Error('Recorded telemetry requires at least one sample');
  }

  sample(timestamp: number, channel: string): TelemetrySample {
    const elapsed = this.#paused ? this.#pausedAt : timestamp - this.#startedAt;
    const matching = this.samples.filter((sample) => sample.channel === channel);
    const source = matching.length > 0 ? matching : this.samples;
    const finalTimestamp = source.at(-1)?.timestamp ?? 0;
    const previousTimestamp = source.at(-2)?.timestamp ?? 0;
    const duration = finalTimestamp + Math.max(finalTimestamp - previousTimestamp, 1);
    const playhead = elapsed % Math.max(duration, 1);
    const initial = source[0];
    if (!initial) throw new Error('Recorded telemetry contains no usable sample');
    let current = initial;
    for (const candidate of source) {
      if (candidate.timestamp <= playhead) current = candidate;
      else break;
    }
    return { ...current, timestamp };
  }

  pause(): void {
    if (this.#paused) return;
    this.#pausedAt = performance.now() - this.#startedAt;
    this.#paused = true;
  }

  resume(): void {
    if (!this.#paused) return;
    this.#startedAt = performance.now() - this.#pausedAt;
    this.#paused = false;
  }

  reset(): void {
    this.#startedAt = performance.now();
    this.#pausedAt = 0;
  }
}
