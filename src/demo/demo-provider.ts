import { syntheticHand } from './synthetic-hands';
import type { TrackingFrame, TrackingListener } from '../vision/types';

export type DemoPhase = 'hover' | 'grab' | 'depth' | 'release' | 'two-hand' | 'inspect' | 'reset';

export interface DemoFrame {
  phase: DemoPhase;
  frame: TrackingFrame;
}

export const DEMO_DURATION_SECONDS = 12;

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
  #active = false;
  #paused = false;
  #frameHandle = 0;
  #startedAt = 0;
  #positionSeconds = 0;
  #speed = 1;
  #listener?: TrackingListener;
  #phase?: DemoPhase;

  start(listener: TrackingListener): void {
    this.stop();
    this.#listener = listener;
    this.#startedAt = performance.now();
    this.#positionSeconds = 0;
    this.#active = true;
    this.#paused = false;
    this.tick();
  }

  stop(): void {
    this.#active = false;
    this.#paused = false;
    if (this.#frameHandle) cancelAnimationFrame(this.#frameHandle);
    this.#frameHandle = 0;
    this.#phase = undefined;
    this.#positionSeconds = 0;
    this.#listener = undefined;
  }

  get running(): boolean {
    return this.#active;
  }

  get paused(): boolean {
    return this.#paused;
  }

  get speed(): number {
    return this.#speed;
  }

  get progress(): number {
    return this.currentPosition(performance.now()) / DEMO_DURATION_SECONDS;
  }

  pause(): void {
    if (!this.#active || this.#paused) return;
    this.#positionSeconds = this.currentPosition(performance.now());
    this.#paused = true;
    if (this.#frameHandle) cancelAnimationFrame(this.#frameHandle);
    this.#frameHandle = 0;
    this.dispatchEvent(new Event('playstatechange'));
  }

  resume(): void {
    if (!this.#active || !this.#paused) return;
    this.#startedAt = performance.now();
    this.#paused = false;
    this.dispatchEvent(new Event('playstatechange'));
    this.tick();
  }

  restart(): void {
    if (!this.#active) return;
    this.#positionSeconds = 0;
    this.#startedAt = performance.now();
    this.#phase = undefined;
    this.emitFrame(0, performance.now());
    this.dispatchEvent(new Event('playstatechange'));
  }

  setSpeed(value: number): void {
    if (!Number.isFinite(value)) return;
    const now = performance.now();
    this.#positionSeconds = this.currentPosition(now);
    this.#startedAt = now;
    this.#speed = Math.min(2, Math.max(0.25, value));
    this.dispatchEvent(new Event('playstatechange'));
  }

  private tick = (): void => {
    if (!this.#active || this.#paused) return;
    const now = performance.now();
    this.emitFrame(this.currentPosition(now), now);
    this.#frameHandle = requestAnimationFrame(this.tick);
  };

  private currentPosition(now: number): number {
    if (!this.#active || this.#paused) return this.#positionSeconds;
    return (
      (this.#positionSeconds + ((now - this.#startedAt) / 1000) * this.#speed) %
      DEMO_DURATION_SECONDS
    );
  }

  private emitFrame(elapsed: number, now: number): void {
    const { frame, phase } = createDemoFrame(elapsed, now);
    if (phase !== this.#phase) {
      this.#phase = phase;
      this.dispatchEvent(new CustomEvent<DemoPhase>('phasechange', { detail: phase }));
    }
    this.#listener?.(frame);
  }
}
