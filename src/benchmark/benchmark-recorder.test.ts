import { describe, expect, it } from 'vitest';
import type { InteractionUpdate } from '../interaction/interaction-controller';
import { BenchmarkRecorder } from './benchmark-recorder';

const update: InteractionUpdate = {
  frame: {
    timestamp: 123,
    source: 'demo',
    inferenceMs: 0,
    hands: [],
  },
  gesture: {
    timestamp: 123,
    state: 'IDLE',
    hands: [],
    holdMs: 25,
    heuristicQuality: 0,
  },
  depth: {
    timestamp: 123,
    available: false,
    raw: 0,
    filtered: 0,
    baseline: 0,
    palmScale: 0,
    stability: 0,
    calibrationProgress: 0,
    calibrationVariation: 0,
    featureSpread: 0,
  },
};

describe('BenchmarkRecorder', () => {
  it('records only during an explicit session and exports versioned JSON', () => {
    const recorder = new BenchmarkRecorder();
    const transform = { x: 1, y: 2, z: 3, rotationY: 0, scale: 1 };
    recorder.record(update, transform);
    expect(recorder.count).toBe(0);
    recorder.start();
    recorder.record(update, transform);
    recorder.stop();
    const exported = JSON.parse(recorder.toJson()) as { schema: string; records: unknown[] };
    expect(exported.schema).toBe('spatial-hmi-benchmark/v1');
    expect(exported.records).toHaveLength(1);
  });

  it('exports a CSV header and recorded transform values', () => {
    const recorder = new BenchmarkRecorder();
    recorder.start();
    recorder.record(update, { x: 1, y: 2, z: 3, rotationY: 0, scale: 1 });
    expect(recorder.toCsv()).toContain('timestamp,source,inferenceMs');
    expect(recorder.toCsv()).toContain('"3"');
  });
});
