export const APP_CONFIG = {
  rendering: {
    background: 0x02070b,
    maxPixelRatio: 2,
    fov: 42,
  },
  interaction: {
    translationGain: 0.009,
    depthGain: 0.0045,
    rotationGain: 0.008,
    minScale: 0.55,
    maxScale: 1.85,
    explodeDistance: 0.55,
  },
  camera: {
    defaultWidth: 960,
    defaultHeight: 540,
    defaultFrameRate: 30,
  },
  vision: {
    maxHands: 2,
    minDetectionConfidence: 0.65,
    minPresenceConfidence: 0.62,
    minTrackingConfidence: 0.62,
    smoothingAlpha: 0.42,
    maxLandmarkJump: 0.22,
    modelUrl:
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    wasmUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
  },
  gesture: {
    pinchActivateRatio: 0.24,
    pinchReleaseRatio: 0.34,
    pinchHoldMs: 150,
    releaseHoldMs: 90,
    cooldownMs: 180,
    openPalmExtendedFingers: 4,
  },
  depth: {
    smoothingAlpha: 0.18,
    deadZone: 0.025,
    bounds: 1,
    relativeGain: 2.1,
    staleAfterMs: 350,
    calibrationSamples: 15,
    calibrationVariationLimit: 0.035,
  },
  colors: {
    cyan: 0x37e6f4,
    cyanSoft: 0x0c6f80,
    amber: 0xffb84d,
    white: 0xe7faff,
    graphite: 0x08141b,
  },
} as const;

export type VisualMode = 'holographic' | 'blueprint' | 'solid' | 'diagnostic';

export type DominantHand = 'auto' | 'left' | 'right';
