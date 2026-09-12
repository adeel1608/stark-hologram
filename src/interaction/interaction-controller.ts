import type { DominantHand } from '../config';
import type { DepthReading } from '../depth/types';
import { RelativeDepthProvider } from '../depth/relative-depth-provider';
import { GestureEngine, type GestureSnapshot } from '../gestures/gesture-engine';
import { distance2, shortestAngleDelta } from '../gestures/math';
import { isOpenPalm } from '../gestures/recognizers';
import type { TwinScene } from '../rendering/twin-scene';
import type { TrackingFrame } from '../vision/types';

export interface InteractionUpdate {
  frame: TrackingFrame;
  gesture: GestureSnapshot;
  depth: DepthReading;
  event?: 'grab' | 'release' | 'select' | 'translate' | 'transform' | 'tracking-lost' | 'reset';
  activationLatencyMs?: number;
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
    let activationLatencyMs: number | undefined;

    if (gesture.state === 'GRAB_ACTIVE' && gesture.primary) {
      const point = { x: 1 - gesture.primary.pinch.point.x, y: gesture.primary.pinch.point.y };
      if (this.#previousState !== 'GRAB_ACTIVE') {
        event = this.scene.selectNormalized(point.x, point.y) ? 'select' : 'grab';
        activationLatencyMs =
          gesture.primary.candidateSince === undefined
            ? undefined
            : frame.timestamp - gesture.primary.candidateSince;
        this.#lastPrimary = point;
        this.#lastDepth = depth.filtered;
      } else if (this.#lastPrimary) {
        const dx = point.x - this.#lastPrimary.x;
        const dy = point.y - this.#lastPrimary.y;
        const dz =
          depth.available && this.#lastDepth !== undefined ? depth.filtered - this.#lastDepth : 0;
        this.scene.translate(dx * 8, -dy * 6, dz * 2.2);
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 0.0001) event = 'translate';
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
        event = 'transform';
      }
      if (this.#lastTwoAngle !== undefined) {
        this.scene.rotate(shortestAngleDelta(this.#lastTwoAngle, currentAngle));
        event = 'transform';
      }
      if (this.#lastTwoMidY !== undefined) {
        this.scene.setExploded(this.scene.exploded + (this.#lastTwoMidY - currentMidY) * 2.2);
        event = 'transform';
      }
      this.#lastTwoDistance = currentDistance;
      this.#lastTwoAngle = currentAngle;
      this.#lastTwoMidY = currentMidY;
      this.#lastPrimary = undefined;
      this.#lastDepth = undefined;
    } else {
      if (this.#previousState === 'GRAB_ACTIVE' || this.#previousState === 'TWO_HAND_ACTIVE') {
        event = frame.hands.length === 0 ? 'tracking-lost' : 'release';
      }
      this.#lastPrimary = undefined;
      this.#lastDepth = undefined;
      this.clearTwoHandHistory();
    }

    const openPalms = gesture.hands.filter((intent) => isOpenPalm(intent.hand)).length;
    if (openPalms >= 2) {
      this.#twoPalmSince ??= frame.timestamp;
      if (frame.timestamp - this.#twoPalmSince > 850) {
        this.scene.reset();
        this.#twoPalmSince = frame.timestamp + 2000;
        event = 'reset';
      }
    } else {
      this.#twoPalmSince = undefined;
    }

    this.#previousState = gesture.state;
    const update = { frame, gesture, depth, event, activationLatencyMs };
    this.#listener?.(update);
    return update;
  }

  reset(options: { rebaseline?: boolean } = {}): void {
    this.gestures.reset();
    if (options.rebaseline) this.depth.rebaseline();
    this.#previousState = 'IDLE';
    this.#lastPrimary = undefined;
    this.#lastDepth = undefined;
    this.#twoPalmSince = undefined;
    this.clearTwoHandHistory();
  }

  private clearTwoHandHistory(): void {
    this.#lastTwoDistance = undefined;
    this.#lastTwoAngle = undefined;
    this.#lastTwoMidY = undefined;
  }
}
