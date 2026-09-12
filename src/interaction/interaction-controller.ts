import type { DominantHand } from '../config';
import type { DepthReading } from '../depth/types';
import { RelativeDepthProvider } from '../depth/relative-depth-provider';
import { GestureEngine, type GestureSnapshot } from '../gestures/gesture-engine';
import { distance2, shortestAngleDelta } from '../gestures/math';
import type { TwinScene } from '../rendering/twin-scene';
import type { TrackingFrame } from '../vision/types';

export interface InteractionUpdate {
  frame: TrackingFrame;
  gesture: GestureSnapshot;
  depth: DepthReading;
  event?: 'grab' | 'release' | 'select' | 'reset';
}

type InteractionListener = (update: InteractionUpdate) => void;

export class InteractionController {
  readonly gestures = new GestureEngine();
  readonly depth = new RelativeDepthProvider();
  #listener?: InteractionListener;
  #previousState = 'IDLE';
  #lastPrimary?: { x: number; y: number };
  #lastDepth?: number;
  #lastTwoDistance?: number;
  #lastTwoAngle?: number;
  #lastTwoMidY?: number;
  #twoPalmSince?: number;

  constructor(private readonly scene: TwinScene) {}

  onUpdate(listener: InteractionListener): void {
    this.#listener = listener;
  }

  setDominantHand(hand: DominantHand): void {
    this.gestures.setDominantHand(hand);
  }

  process(frame: TrackingFrame): InteractionUpdate {
    const gesture = this.gestures.process(frame.hands, frame.timestamp);
    const depth = this.depth.update(gesture.primary?.hand, frame.timestamp);
    let event: InteractionUpdate['event'];

    if (gesture.state === 'GRAB_ACTIVE' && gesture.primary) {
      const point = { x: 1 - gesture.primary.pinch.point.x, y: gesture.primary.pinch.point.y };
      if (this.#previousState !== 'GRAB_ACTIVE') {
        event = this.scene.selectNormalized(point.x, point.y) ? 'select' : 'grab';
        this.#lastPrimary = point;
        this.#lastDepth = depth.filtered;
      } else if (this.#lastPrimary) {
        const dx = point.x - this.#lastPrimary.x;
        const dy = point.y - this.#lastPrimary.y;
        const dz =
          depth.available && this.#lastDepth !== undefined ? depth.filtered - this.#lastDepth : 0;
        this.scene.translate(dx * 8, -dy * 6, dz * 2.2);
        this.#lastPrimary = point;
        this.#lastDepth = depth.filtered;
      }
      this.clearTwoHandHistory();
    } else if (gesture.state === 'TWO_HAND_ACTIVE' && gesture.primary && gesture.secondary) {
      const a = gesture.primary.pinch.point;
      const b = gesture.secondary.pinch.point;
      const currentDistance = distance2(a, b);
      const currentAngle = Math.atan2(b.y - a.y, b.x - a.x);
      const currentMidY = (a.y + b.y) / 2;
      if (this.#lastTwoDistance && this.#lastTwoDistance > 0) {
        this.scene.scale(currentDistance / this.#lastTwoDistance);
      }
      if (this.#lastTwoAngle !== undefined) {
        this.scene.rotate(shortestAngleDelta(this.#lastTwoAngle, currentAngle));
      }
      if (this.#lastTwoMidY !== undefined) {
        this.scene.setExploded(this.scene.exploded + (this.#lastTwoMidY - currentMidY) * 2.2);
      }
      this.#lastTwoDistance = currentDistance;
      this.#lastTwoAngle = currentAngle;
      this.#lastTwoMidY = currentMidY;
      this.#lastPrimary = undefined;
      this.#lastDepth = undefined;
    } else {
      if (this.#previousState === 'GRAB_ACTIVE' || this.#previousState === 'TWO_HAND_ACTIVE')
        event = 'release';
      this.#lastPrimary = undefined;
      this.#lastDepth = undefined;
      this.clearTwoHandHistory();
    }

    const openPalms = gesture.hands.filter((intent) => {
      const tips = [8, 12, 16, 20];
      const wrist = intent.hand.landmarks[0];
      if (!wrist) return false;
      return tips.every((tipIndex) => {
        const tip = intent.hand.landmarks[tipIndex];
        const joint = intent.hand.landmarks[tipIndex - 2];
        return tip && joint && distance2(wrist, tip) > distance2(wrist, joint) * 1.16;
      });
    }).length;
    if (openPalms >= 2) {
      this.#twoPalmSince ??= frame.timestamp;
      if (frame.timestamp - this.#twoPalmSince > 850) {
        this.scene.reset();
        this.depth.rebaseline();
        this.#twoPalmSince = frame.timestamp + 2000;
        event = 'reset';
      }
    } else {
      this.#twoPalmSince = undefined;
    }

    this.#previousState = gesture.state;
    const update = { frame, gesture, depth, event };
    this.#listener?.(update);
    return update;
  }

  reset(): void {
    this.gestures.reset();
    this.depth.rebaseline();
    this.#previousState = 'IDLE';
    this.#lastPrimary = undefined;
    this.#lastDepth = undefined;
    this.clearTwoHandHistory();
  }

  private clearTwoHandHistory(): void {
    this.#lastTwoDistance = undefined;
    this.#lastTwoAngle = undefined;
    this.#lastTwoMidY = undefined;
  }
}
