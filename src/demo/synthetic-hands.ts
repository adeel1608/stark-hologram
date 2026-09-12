import type { Handedness, Landmark, TrackedHand } from '../vision/types';

const OPEN_HAND: ReadonlyArray<readonly [number, number]> = [
  [0, 0.42],
  [-0.18, 0.3],
  [-0.3, 0.15],
  [-0.37, -0.02],
  [-0.42, -0.18],
  [-0.2, 0.08],
  [-0.25, -0.12],
  [-0.27, -0.31],
  [-0.28, -0.48],
  [0, 0.02],
  [0, -0.2],
  [0, -0.4],
  [0, -0.58],
  [0.18, 0.07],
  [0.22, -0.13],
  [0.24, -0.31],
  [0.25, -0.47],
  [0.33, 0.16],
  [0.39, 0],
  [0.42, -0.16],
  [0.44, -0.3],
];

export function syntheticHand(
  handedness: Handedness,
  centerX: number,
  centerY: number,
  scale: number,
  pinch: boolean,
): TrackedHand {
  const mirror = handedness === 'Left' ? -1 : 1;
  const landmarks: Landmark[] = OPEN_HAND.map(([x, y]) => ({
    x: centerX + x * scale * mirror,
    y: centerY + y * scale,
    z: y * scale * 0.08,
  }));
  if (pinch) {
    const pinchX = centerX - 0.12 * scale * mirror;
    const pinchY = centerY - 0.26 * scale;
    landmarks[4] = { x: pinchX - 0.012 * scale, y: pinchY, z: -0.02 };
    landmarks[8] = { x: pinchX + 0.012 * scale, y: pinchY, z: -0.02 };
  }
  return {
    handedness,
    handednessScore: 0.98,
    landmarks,
    worldLandmarks: landmarks.map((point) => ({ ...point })),
  };
}
