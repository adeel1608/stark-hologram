export interface TelemetrySample {
  timestamp: number;
  source: 'simulation' | 'recorded' | 'external';
  channel: string;
  jointAngleDeg: number;
  torqueNm: number;
  temperatureC: number;
  currentA: number;
  healthPercent: number;
  cycleCount: number;
  toolStatus: 'Ready' | 'Holding' | 'Open' | 'Service';
}

export interface TelemetryProvider {
  readonly source: TelemetrySample['source'];
  sample(timestamp: number, channel: string): TelemetrySample;
  pause(): void;
  resume(): void;
  reset(): void;
  dispose(): void;
}
