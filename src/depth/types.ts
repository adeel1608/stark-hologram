import type { TrackedHand } from '../vision/types';

export interface DepthReading {
  timestamp: number;
  available: boolean;
  raw: number;
  filtered: number;
  baseline: number;
  palmScale: number;
  stability: number;
}

export interface DepthProvider {
  update(hand: TrackedHand | undefined, timestamp: number): DepthReading;
  rebaseline(): void;
  getReading(): DepthReading;
}
