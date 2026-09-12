import type { InteractionUpdate } from '../interaction/interaction-controller';
import type { TransformSnapshot } from '../rendering/twin-scene';

const MAX_RECORDS = 36_000;

export interface BenchmarkSessionMetadata {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  appVersion: string;
  commit: string;
  browser: string;
  device: string;
  camera: string;
  cameraResolution: string;
  lightingCondition: string;
  distanceMeters?: number;
  notes: string;
}

export interface BenchmarkRecord {
  frameTimestamp: number;
  source: 'camera' | 'demo';
  trackingFps?: number;
  inferenceMs: number;
  handCount: number;
  handedness: string;
  handednessScores: string;
  gestureState: string;
  gestureTransition: string;
  holdMs: number;
  heuristicQuality: number;
  activationLatencyMs?: number;
  trackingLost: boolean;
  palmScale: number;
  relativeZRaw: number;
  relativeZFiltered: number;
  depthBaseline: number;
  depthStability: number;
  calibrationVariation: number;
  featureSpread: number;
  interactionEvent: string;
  selectedComponent: string;
  modelX: number;
  modelY: number;
  modelZ: number;
  modelRotationY: number;
  modelScale: number;
  exploded: number;
  visualMode: string;
  modelLabel: string;
  modelSource: string;
}

export type BenchmarkMetadataInput = Partial<
  Omit<BenchmarkSessionMetadata, 'sessionId' | 'startedAt' | 'endedAt'>
>;

const RECORD_COLUMNS: ReadonlyArray<keyof BenchmarkRecord> = [
  'frameTimestamp',
  'source',
  'trackingFps',
  'inferenceMs',
  'handCount',
  'handedness',
  'handednessScores',
  'gestureState',
  'gestureTransition',
  'holdMs',
  'heuristicQuality',
  'activationLatencyMs',
  'trackingLost',
  'palmScale',
  'relativeZRaw',
  'relativeZFiltered',
  'depthBaseline',
  'depthStability',
  'calibrationVariation',
  'featureSpread',
  'interactionEvent',
  'selectedComponent',
  'modelX',
  'modelY',
  'modelZ',
  'modelRotationY',
  'modelScale',
  'exploded',
  'visualMode',
  'modelLabel',
  'modelSource',
];

const METADATA_COLUMNS: ReadonlyArray<keyof BenchmarkSessionMetadata> = [
  'sessionId',
  'startedAt',
  'endedAt',
  'appVersion',
  'commit',
  'browser',
  'device',
  'camera',
  'cameraResolution',
  'lightingCondition',
  'distanceMeters',
  'notes',
];

function sessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `session-${Date.now().toString(36)}`;
  }
}

function metadata(input: BenchmarkMetadataInput): BenchmarkSessionMetadata {
  return {
    sessionId: sessionId(),
    startedAt: new Date().toISOString(),
    appVersion: input.appVersion ?? '0.2.0',
    commit: input.commit ?? 'development',
    browser: input.browser ?? 'Not recorded',
    device: input.device?.trim() || 'Not recorded',
    camera: input.camera?.trim() || 'Not active',
    cameraResolution: input.cameraResolution?.trim() || 'Not reported',
    lightingCondition: input.lightingCondition?.trim() || 'Not recorded',
    distanceMeters: input.distanceMeters,
    notes: input.notes?.trim() ?? '',
  };
}

export class BenchmarkRecorder extends EventTarget {
  #records: BenchmarkRecord[] = [];
  #writeIndex = 0;
  #capturedCount = 0;
  #recording = false;
  #metadata?: BenchmarkSessionMetadata;
  #previousGestureState?: string;

  get recording(): boolean {
    return this.#recording;
  }

  get count(): number {
    return this.#records.length;
  }

  get droppedCount(): number {
    return Math.max(this.#capturedCount - MAX_RECORDS, 0);
  }

  get sessionMetadata(): BenchmarkSessionMetadata | undefined {
    return this.#metadata ? { ...this.#metadata } : undefined;
  }

  start(input: BenchmarkMetadataInput = {}): void {
    this.#records = [];
    this.#writeIndex = 0;
    this.#capturedCount = 0;
    this.#previousGestureState = undefined;
    this.#metadata = metadata(input);
    this.#recording = true;
    this.dispatchEvent(new Event('change'));
  }

  stop(): void {
    if (!this.#recording) return;
    this.#recording = false;
    if (this.#metadata) this.#metadata = { ...this.#metadata, endedAt: new Date().toISOString() };
    this.dispatchEvent(new Event('change'));
  }

  record(
    update: InteractionUpdate,
    transform: TransformSnapshot,
    runtime: { trackingFps?: number } = {},
  ): void {
    if (!this.#recording) return;
    const transition =
      this.#previousGestureState && this.#previousGestureState !== update.gesture.state
        ? `${this.#previousGestureState}->${update.gesture.state}`
        : '';
    const record: BenchmarkRecord = {
      frameTimestamp: update.frame.timestamp,
      source: update.frame.source,
      trackingFps: runtime.trackingFps,
      inferenceMs: update.frame.inferenceMs,
      handCount: update.frame.hands.length,
      handedness: update.frame.hands.map((hand) => hand.handedness).join('|'),
      handednessScores: update.frame.hands
        .map((hand) => (hand.handednessScore === undefined ? '' : hand.handednessScore.toFixed(4)))
        .join('|'),
      gestureState: update.gesture.state,
      gestureTransition: transition,
      holdMs: update.gesture.holdMs,
      heuristicQuality: update.gesture.heuristicQuality,
      activationLatencyMs: update.activationLatencyMs,
      trackingLost: update.event === 'tracking-lost',
      palmScale: update.depth.palmScale,
      relativeZRaw: update.depth.raw,
      relativeZFiltered: update.depth.filtered,
      depthBaseline: update.depth.baseline,
      depthStability: update.depth.stability,
      calibrationVariation: update.depth.calibrationVariation,
      featureSpread: update.depth.featureSpread,
      interactionEvent: update.event ?? '',
      selectedComponent: transform.selectedComponentId ?? '',
      modelX: transform.x,
      modelY: transform.y,
      modelZ: transform.z,
      modelRotationY: transform.rotationY,
      modelScale: transform.scale,
      exploded: transform.exploded,
      visualMode: transform.visualMode,
      modelLabel: transform.modelLabel,
      modelSource: transform.modelSource,
    };
    this.#previousGestureState = update.gesture.state;
    if (this.#records.length < MAX_RECORDS) this.#records.push(record);
    else {
      this.#records[this.#writeIndex] = record;
      this.#writeIndex = (this.#writeIndex + 1) % MAX_RECORDS;
    }
    this.#capturedCount += 1;
    if (this.#capturedCount % 30 === 0) this.dispatchEvent(new Event('change'));
  }

  toJson(): string {
    return JSON.stringify(
      {
        schema: 'spatial-hmi-benchmark/v2',
        exportedAt: new Date().toISOString(),
        notice: 'Raw observations only. No benchmark result or hardware claim is implied.',
        metadata: this.#metadata,
        droppedRecordCount: this.droppedCount,
        records: this.orderedRecords(),
      },
      null,
      2,
    );
  }

  toCsv(): string {
    const escape = (value: string | number | boolean | undefined) =>
      `"${String(value ?? '').replaceAll('"', '""')}"`;
    const header = [...METADATA_COLUMNS, ...RECORD_COLUMNS].join(',');
    const session = this.#metadata;
    const rows = this.orderedRecords().map((record) =>
      [
        ...METADATA_COLUMNS.map((key) => escape(session?.[key])),
        ...RECORD_COLUMNS.map((key) => escape(record[key])),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  download(format: 'json' | 'csv'): void {
    const content = format === 'json' ? this.toJson() : this.toCsv();
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `spatial-hmi-benchmark-${new Date().toISOString().replaceAll(':', '-')}.${format}`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  private orderedRecords(): BenchmarkRecord[] {
    if (this.#records.length < MAX_RECORDS || this.#writeIndex === 0) return [...this.#records];
    return [...this.#records.slice(this.#writeIndex), ...this.#records.slice(0, this.#writeIndex)];
  }
}
