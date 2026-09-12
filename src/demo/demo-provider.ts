import { syntheticHand } from './synthetic-hands';
import type { TrackingFrame, TrackingListener } from '../vision/types';

export type DemoPhase = 'hover' | 'grab' | 'depth' | 'release' | 'two-hand' | 'inspect' | 'reset';

export interface DemoFrame {
  phase: DemoPhase;
  frame: TrackingFrame;
}

export function createDemoFrame(elapsed: number, timestamp: number): DemoFrame {
  let phase: DemoPhase;
  let hands;
  if (elapsed < 1.2) {
    phase = 'hover';
    hands = [syntheticHand('Right', 0.53, 0.55, 0.28, false)];
  } else if (elapsed < 3.2) {
    phase = 'grab';
    const progress = (elapsed - 1.2) / 2;
    hands = [syntheticHand('Right', 0.53 - progress * 0.14, 0.55 - progress * 0.08, 0.28, true)];
  } else if (elapsed < 4.8) {
    phase = 'depth';
    const progress = (elapsed - 3.2) / 1.6;
    hands = [syntheticHand('Right', 0.39, 0.47, 0.28 + Math.sin(progress * Math.PI) * 0.09, true)];
  } else if (elapsed < 5.6) {
    phase = 'release';
    hands = [syntheticHand('Right', 0.39, 0.47, 0.28, false)];
  } else if (elapsed < 8.4) {
    phase = 'two-hand';
    const progress = (elapsed - 5.6) / 2.8;
    const spread = 0.12 + progress * 0.11;
    const angle = progress * 0.7;
    const dx = Math.cos(angle) * spread;
    const dy = Math.sin(angle) * spread;
    hands = [
      syntheticHand('Left', 0.5 - dx, 0.55 - dy - progress * 0.07, 0.25, true),
      syntheticHand('Right', 0.5 + dx, 0.55 + dy - progress * 0.07, 0.25, true),
    ];
  } else if (elapsed < 10.1) {
    phase = 'inspect';
    hands = [syntheticHand('Left', 0.42, 0.5, 0.27, false)];
  } else {
    phase = 'reset';
    hands = [
      syntheticHand('Left', 0.35, 0.55, 0.25, false),
      syntheticHand('Right', 0.65, 0.55, 0.25, false),
    ];
  }
  return { phase, frame: { timestamp, hands, inferenceMs: 0, source: 'demo' } };
}

export class DemoProvider extends EventTarget {
  #running = false;
  #frameHandle = 0;
  #startedAt = 0;
  #listener?: TrackingListener;
  #phase?: DemoPhase;

  start(listener: TrackingListener): void {
    this.stop();
    this.#listener = listener;
    this.#startedAt = performance.now();
    this.#running = true;
    this.tick();
  }

  stop(): void {
    this.#running = false;
    if (this.#frameHandle) cancelAnimationFrame(this.#frameHandle);
    this.#frameHandle = 0;
    this.#phase = undefined;
  }

  get running(): boolean {
    return this.#running;
  }

  private tick = (): void => {
    if (!this.#running) return;
    const now = performance.now();
    const elapsed = ((now - this.#startedAt) / 1000) % 12;
    const { frame, phase } = createDemoFrame(elapsed, now);
    if (phase !== this.#phase) {
      this.#phase = phase;
      this.dispatchEvent(new CustomEvent<DemoPhase>('phasechange', { detail: phase }));
    }
    this.#listener?.(frame);
    this.#frameHandle = requestAnimationFrame(this.tick);
  };
}
