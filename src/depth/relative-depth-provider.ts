import { APP_CONFIG } from '../config';
import { clamp, median } from '../gestures/math';
import { palmScale } from '../gestures/recognizers';
import type { TrackedHand } from '../vision/types';
import type { DepthProvider, DepthReading } from './types';

export class RelativeDepthProvider implements DepthProvider {
  #baselineSamples: number[] = [];
  #recentFiltered: number[] = [];
  #reading: DepthReading = {
    timestamp: 0,
    available: false,
    raw: 0,
    filtered: 0,
    baseline: 0,
    palmScale: 0,
    stability: 0,
  };

  update(hand: TrackedHand | undefined, timestamp: number): DepthReading {
    if (!hand) {
      const stale = timestamp - this.#reading.timestamp > APP_CONFIG.depth.staleAfterMs;
      if (stale) this.#reading = { ...this.#reading, available: false, timestamp };
      return this.getReading();
    }
    const scale = palmScale(hand.landmarks);
    if (!Number.isFinite(scale) || scale <= 0.01) {
      this.#reading = { ...this.#reading, available: false, timestamp };
      return this.getReading();
    }
    if (this.#baselineSamples.length < 15) {
      this.#baselineSamples.push(scale);
    }
    const baseline = median(this.#baselineSamples);
    if (baseline <= 0) return this.getReading();
    let raw = clamp(
      (baseline / scale - 1) * APP_CONFIG.depth.relativeGain,
      -APP_CONFIG.depth.bounds,
      APP_CONFIG.depth.bounds,
    );
    if (Math.abs(raw) < APP_CONFIG.depth.deadZone) raw = 0;
    const filtered =
      this.#reading.filtered + (raw - this.#reading.filtered) * APP_CONFIG.depth.smoothingAlpha;
    this.#recentFiltered.push(filtered);
    if (this.#recentFiltered.length > 24) this.#recentFiltered.shift();
    const center = median(this.#recentFiltered);
    const deviation = median(this.#recentFiltered.map((value) => Math.abs(value - center)));
    this.#reading = {
      timestamp,
      available: this.#baselineSamples.length >= 8,
      raw,
      filtered,
      baseline,
      palmScale: scale,
      stability: clamp(1 - deviation * 8, 0, 1),
    };
    return this.getReading();
  }

  setBaseline(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.#baselineSamples = Array.from({ length: 15 }, () => value);
    this.#reading = { ...this.#reading, baseline: value };
  }

  rebaseline(): void {
    this.#baselineSamples = [];
    this.#recentFiltered = [];
    this.#reading = {
      ...this.#reading,
      available: false,
      raw: 0,
      filtered: 0,
      baseline: 0,
      stability: 0,
    };
  }

  getReading(): DepthReading {
    return { ...this.#reading };
  }
}
