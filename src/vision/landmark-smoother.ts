import type { Landmark, TrackedHand } from './types';

export interface LandmarkSmoothingOptions {
  alpha: number;
  maxJump: number;
}

function distance3(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function smoothPoint(previous: Landmark, current: Landmark, alpha: number): Landmark {
  return {
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
    z: previous.z + (current.z - previous.z) * alpha,
    visibility: current.visibility,
  };
}

export class LandmarkSmoother {
  readonly #previous = new Map<string, Landmark[]>();

  constructor(private readonly options: LandmarkSmoothingOptions) {}

  process(hands: TrackedHand[]): TrackedHand[] {
    const occurrences = new Map<string, number>();
    const seen = new Set<string>();
    const output = hands.map((hand) => {
      const occurrence = occurrences.get(hand.handedness) ?? 0;
      occurrences.set(hand.handedness, occurrence + 1);
      const key = `${hand.handedness}-${occurrence}`;
      seen.add(key);
      const previous = this.#previous.get(key);
      const landmarks = hand.landmarks.map((current, index) => {
        const prior = previous?.[index];
        if (!prior || distance3(prior, current) > this.options.maxJump) return { ...current };
        return smoothPoint(prior, current, this.options.alpha);
      });
      this.#previous.set(key, landmarks);
      return { ...hand, landmarks };
    });
    for (const key of this.#previous.keys()) if (!seen.has(key)) this.#previous.delete(key);
    return output;
  }

  reset(): void {
    this.#previous.clear();
  }
}
