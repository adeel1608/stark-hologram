import type { InteractionUpdate } from '../interaction/interaction-controller';
import type { TransformSnapshot } from '../rendering/twin-scene';

export interface BenchmarkRecord {
  timestamp: number;
  source: 'camera' | 'demo';
  inferenceMs: number;
  handCount: number;
  handedness: string;
  gestureState: string;
  holdMs: number;
  heuristicQuality: number;
  relativeZRaw: number;
  relativeZFiltered: number;
  depthStability: number;
  event?: string;
  modelX: number;
  modelY: number;
  modelZ: number;
}

export class BenchmarkRecorder extends EventTarget {
  #records: BenchmarkRecord[] = [];
  #recording = false;

  get recording(): boolean {
    return this.#recording;
  }

  get count(): number {
    return this.#records.length;
  }

  start(): void {
    this.#records = [];
    this.#recording = true;
    this.dispatchEvent(new Event('change'));
  }

  stop(): void {
    this.#recording = false;
    this.dispatchEvent(new Event('change'));
  }

  record(update: InteractionUpdate, transform: TransformSnapshot): void {
    if (!this.#recording) return;
    this.#records.push({
      timestamp: update.frame.timestamp,
      source: update.frame.source,
      inferenceMs: update.frame.inferenceMs,
      handCount: update.frame.hands.length,
      handedness: update.frame.hands.map((hand) => hand.handedness).join('|'),
      gestureState: update.gesture.state,
      holdMs: update.gesture.holdMs,
      heuristicQuality: update.gesture.heuristicQuality,
      relativeZRaw: update.depth.raw,
      relativeZFiltered: update.depth.filtered,
      depthStability: update.depth.stability,
      event: update.event,
      modelX: transform.x,
      modelY: transform.y,
      modelZ: transform.z,
    });
    if (this.#records.length > 36_000) this.#records.shift();
    if (this.#records.length % 30 === 0) this.dispatchEvent(new Event('change'));
  }

  toJson(): string {
    return JSON.stringify(
      {
        schema: 'spatial-hmi-benchmark/v1',
        exportedAt: new Date().toISOString(),
        notice: 'Raw observations only. No benchmark result or hardware claim is implied.',
        records: this.#records,
      },
      null,
      2,
    );
  }

  toCsv(): string {
    const keys = Object.keys(this.#records[0] ?? {}) as Array<keyof BenchmarkRecord>;
    const escape = (value: string | number | undefined) =>
      `"${String(value ?? '').replaceAll('"', '""')}"`;
    return [
      keys.join(','),
      ...this.#records.map((record) => keys.map((key) => escape(record[key])).join(',')),
    ].join('\n');
  }

  download(format: 'json' | 'csv'): void {
    const content = format === 'json' ? this.toJson() : this.toCsv();
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `spatial-hmi-benchmark-${new Date().toISOString().replaceAll(':', '-')}.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }
}
