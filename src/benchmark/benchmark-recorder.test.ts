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
    const transform = {
      x: 1,
      y: 2,
      z: 3,
      rotationY: 0,
      scale: 1,
      exploded: 0,
      visualMode: 'holographic' as const,
      selectedComponentId: 'J02',
      modelLabel: 'Articulated Inspection Cell',
      modelSource: 'procedural' as const,
    };
    recorder.record(update, transform);
    expect(recorder.count).toBe(0);
    recorder.start({
      commit: 'abc123',
      browser: 'Test Browser',
      device: 'Bench laptop',
      lightingCondition: 'normal',
    });
    recorder.record(update, transform, { trackingFps: 59.5 });
    recorder.stop();
    const exported = JSON.parse(recorder.toJson()) as {
      schema: string;
      metadata: { commit: string; endedAt: string };
      records: Array<{ trackingFps: number; selectedComponent: string }>;
    };
    expect(exported.schema).toBe('spatial-hmi-benchmark/v2');
    expect(exported.metadata.commit).toBe('abc123');
    expect(exported.metadata.endedAt).toBeTruthy();
    expect(exported.records).toHaveLength(1);
    expect(exported.records[0]).toMatchObject({ trackingFps: 59.5, selectedComponent: 'J02' });
  });

  it('exports session metadata and transform fields in CSV', () => {
    const recorder = new BenchmarkRecorder();
    recorder.start({ device: 'Generic webcam' });
    recorder.record(update, {
      x: 1,
      y: 2,
      z: 3,
      rotationY: 0,
      scale: 1,
      exploded: 0.5,
      visualMode: 'blueprint',
      modelLabel: 'Test twin',
      modelSource: 'file',
    });
    expect(recorder.toCsv()).toContain('sessionId,startedAt,endedAt,appVersion,commit');
    expect(recorder.toCsv()).toContain('frameTimestamp,source,trackingFps,inferenceMs');
    expect(recorder.toCsv()).toContain('"Generic webcam"');
    expect(recorder.toCsv()).toContain('"blueprint"');
    expect(recorder.toCsv()).toContain('"3"');
  });

  it('records gesture transitions without treating the first state as a transition', () => {
    const recorder = new BenchmarkRecorder();
    const transform = {
      x: 0,
      y: 0,
      z: 0,
      rotationY: 0,
      scale: 1,
      exploded: 0,
      visualMode: 'solid' as const,
      modelLabel: 'Test twin',
      modelSource: 'procedural' as const,
    };
    recorder.start();
    recorder.record(update, transform);
    recorder.record({ ...update, gesture: { ...update.gesture, state: 'HOVER' } }, transform);
    const exported = JSON.parse(recorder.toJson()) as {
      records: Array<{ gestureTransition: string }>;
    };
    expect(exported.records.map((record) => record.gestureTransition)).toEqual(['', 'IDLE->HOVER']);
  });
});
