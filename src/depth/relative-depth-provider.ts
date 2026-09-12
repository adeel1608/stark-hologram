import { APP_CONFIG } from '../config';
import { clamp, median } from '../gestures/math';
import { palmScaleFeatures } from '../gestures/recognizers';
import type { TrackedHand } from '../vision/types';
import type { DepthProvider, DepthReading, RelativeDepthCalibration } from './types';

function medianAbsoluteDeviation(values: number[]): number {
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
}

function relativeTrimmedRange(values: number[], center: number): number {
  if (values.length < 3 || center <= 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.max(Math.floor(sorted.length * 0.1), 1);
  const low = sorted[trim] ?? center;
  const high = sorted[sorted.length - 1 - trim] ?? center;
  return Math.max(high - low, 0) / center;
}

function validFeatures(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 5 &&
    value.every((feature) => typeof feature === 'number' && Number.isFinite(feature) && feature > 0)
  );
}

export class RelativeDepthProvider implements DepthProvider {
  #baselineSamples: number[][] = [];
  #baselineFeatures?: number[];
  #baselineScale = 0;
  #recentFiltered: number[] = [];
  #reading: DepthReading = {
    timestamp: 0,
    available: false,
    raw: 0,
    filtered: 0,
    baseline: 0,
    palmScale: 0,
    stability: 0,
    calibrationProgress: 0,
    calibrationVariation: 0,
    featureSpread: 0,
  };

  update(hand: TrackedHand | undefined, timestamp: number): DepthReading {
    if (!hand) {
      const stale = timestamp - this.#reading.timestamp > APP_CONFIG.depth.staleAfterMs;
      if (stale) this.#reading = { ...this.#reading, available: false, timestamp };
      return this.getReading();
    }
    const features = palmScaleFeatures(hand.landmarks);
    const scale = median(features);
    if (!validFeatures(features) || !Number.isFinite(scale) || scale <= 0.01) {
      this.#reading = { ...this.#reading, available: false, timestamp };
      return this.getReading();
    }
    if (!this.#baselineFeatures && this.#baselineScale <= 0) {
      this.#baselineSamples.push(features);
      if (this.#baselineSamples.length > APP_CONFIG.depth.calibrationSamples) {
        this.#baselineSamples.shift();
      }
      const scales = this.#baselineSamples.map((sample) => median(sample));
      const baseline = median(scales);
      const variation = relativeTrimmedRange(scales, baseline);
      const progress = Math.min(
        this.#baselineSamples.length / APP_CONFIG.depth.calibrationSamples,
        1,
      );
      if (
        this.#baselineSamples.length === APP_CONFIG.depth.calibrationSamples &&
        variation <= APP_CONFIG.depth.calibrationVariationLimit
      ) {
        this.#baselineFeatures = features.map((_, index) =>
          median(this.#baselineSamples.map((sample) => sample[index] ?? 0)),
        );
        this.#baselineScale = median(this.#baselineFeatures);
      } else {
        this.#reading = {
          ...this.#reading,
          timestamp,
          available: false,
          baseline,
          palmScale: scale,
          stability: clamp(1 - variation / APP_CONFIG.depth.calibrationVariationLimit, 0, 1),
          calibrationProgress: progress,
          calibrationVariation: variation,
          featureSpread: 0,
        };
        return this.getReading();
      }
    }

    const baselineFeatures = this.#baselineFeatures;
    if (this.#baselineScale <= 0) return this.getReading();
    const relativeFeatures = baselineFeatures
      ? features.map((feature, index) => (baselineFeatures[index] ?? feature) / feature - 1)
      : [this.#baselineScale / scale - 1];
    const relativeScale = median(relativeFeatures);
    let raw = clamp(
      relativeScale * APP_CONFIG.depth.relativeGain,
      -APP_CONFIG.depth.bounds,
      APP_CONFIG.depth.bounds,
    );
    if (Math.abs(raw) < APP_CONFIG.depth.deadZone) raw = 0;
    const filtered = this.#reading.available
      ? this.#reading.filtered + (raw - this.#reading.filtered) * APP_CONFIG.depth.smoothingAlpha
      : raw;
    this.#recentFiltered.push(filtered);
    if (this.#recentFiltered.length > 24) this.#recentFiltered.shift();
    const deviation = medianAbsoluteDeviation(this.#recentFiltered);
    const featureSpread = medianAbsoluteDeviation(relativeFeatures);
    this.#reading = {
      timestamp,
      available: true,
      raw,
      filtered,
      baseline: this.#baselineScale,
      palmScale: scale,
      stability: clamp(1 - deviation * 8 - featureSpread * 4, 0, 1),
      calibrationProgress: 1,
      calibrationVariation: 0,
      featureSpread,
      baselineFeatures: baselineFeatures ? [...baselineFeatures] : undefined,
    };
    return this.getReading();
  }

  setBaseline(value: number | RelativeDepthCalibration): void {
    const palmScale = typeof value === 'number' ? value : value.palmScale;
    if (!Number.isFinite(palmScale) || palmScale <= 0) return;
    const features = typeof value === 'number' ? undefined : value.features;
    this.#baselineFeatures = validFeatures(features) ? [...features] : undefined;
    this.#baselineScale = palmScale;
    const baselineFeatures = this.#baselineFeatures;
    this.#baselineSamples = baselineFeatures
      ? Array.from({ length: APP_CONFIG.depth.calibrationSamples }, () => [...baselineFeatures])
      : [];
    this.#recentFiltered = [];
    this.#reading = {
      ...this.#reading,
      available: false,
      raw: 0,
      filtered: 0,
      baseline: palmScale,
      stability: 0,
      calibrationProgress: 1,
      calibrationVariation: 0,
      featureSpread: 0,
      baselineFeatures: this.#baselineFeatures ? [...this.#baselineFeatures] : undefined,
    };
  }

  rebaseline(): void {
    this.#baselineSamples = [];
    this.#baselineFeatures = undefined;
    this.#baselineScale = 0;
    this.#recentFiltered = [];
    this.#reading = {
      ...this.#reading,
      available: false,
      raw: 0,
      filtered: 0,
      baseline: 0,
      palmScale: 0,
      stability: 0,
      calibrationProgress: 0,
      calibrationVariation: 0,
      featureSpread: 0,
      baselineFeatures: undefined,
    };
  }

  getReading(): DepthReading {
    return {
      ...this.#reading,
      baselineFeatures: this.#reading.baselineFeatures
        ? [...this.#reading.baselineFeatures]
        : undefined,
    };
  }
}
