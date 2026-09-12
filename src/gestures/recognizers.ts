import { APP_CONFIG } from '../config';
import type { Landmark, TrackedHand } from '../vision/types';
import { clamp, distance2, median } from './math';

export interface PinchRecognition {
  active: boolean;
  ratio: number;
  quality: number;
  point: { x: number; y: number };
}

export function palmScale(landmarks: Landmark[]): number {
  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const middleMcp = landmarks[9];
  const pinkyMcp = landmarks[17];
  if (!wrist || !indexMcp || !middleMcp || !pinkyMcp) return 0;
  return median([
    distance2(wrist, middleMcp),
    distance2(indexMcp, pinkyMcp),
    distance2(wrist, indexMcp),
    distance2(wrist, pinkyMcp),
  ]);
}

export function recognizePinch(hand: TrackedHand, wasActive = false): PinchRecognition {
  const thumb = hand.landmarks[4];
  const index = hand.landmarks[8];
  const scale = palmScale(hand.landmarks);
  if (!thumb || !index || scale <= 0) {
    return {
      active: false,
      ratio: Number.POSITIVE_INFINITY,
      quality: 0,
      point: { x: 0.5, y: 0.5 },
    };
  }
  const ratio = distance2(thumb, index) / scale;
  const threshold = wasActive
    ? APP_CONFIG.gesture.pinchReleaseRatio
    : APP_CONFIG.gesture.pinchActivateRatio;
  return {
    active: ratio <= threshold,
    ratio,
    quality: clamp(1 - ratio / APP_CONFIG.gesture.pinchReleaseRatio, 0, 1),
    point: { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 },
  };
}

export function extendedFingerCount(landmarks: Landmark[]): number {
  const wrist = landmarks[0];
  if (!wrist) return 0;
  const joints: ReadonlyArray<readonly [number, number]> = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];
  return joints.reduce((count, [tipIndex, jointIndex]) => {
    const tip = landmarks[tipIndex];
    const joint = landmarks[jointIndex];
    if (!tip || !joint) return count;
    return count + (distance2(wrist, tip) > distance2(wrist, joint) * 1.16 ? 1 : 0);
  }, 0);
}

export function isOpenPalm(hand: TrackedHand): boolean {
  return extendedFingerCount(hand.landmarks) >= APP_CONFIG.gesture.openPalmExtendedFingers;
}
