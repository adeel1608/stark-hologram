export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type Handedness = 'Left' | 'Right' | 'Unknown';

export interface TrackedHand {
  handedness: Handedness;
  handednessScore?: number;
  landmarks: Landmark[];
  worldLandmarks?: Landmark[];
}

export interface TrackingFrame {
  timestamp: number;
  hands: TrackedHand[];
  inferenceMs: number;
  source: 'camera' | 'demo';
}

export interface TrackingMetrics {
  inferenceMs: number;
  trackingFps: number;
  frameTimestamp: number;
  handCount: number;
}

export type TrackingListener = (frame: TrackingFrame) => void;
