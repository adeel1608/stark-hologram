import { APP_CONFIG, type DominantHand } from '../config';
import type { TrackedHand } from '../vision/types';
import { isOpenPalm, recognizePinch, type PinchRecognition } from './recognizers';

export type GestureState =
  | 'IDLE'
  | 'HOVER'
  | 'PINCH_CANDIDATE'
  | 'GRAB_ACTIVE'
  | 'RELEASE_CANDIDATE'
  | 'TWO_HAND_ACTIVE'
  | 'OPEN_PALM';

export interface HandIntent {
  key: string;
  hand: TrackedHand;
  pinch: PinchRecognition;
  confirmed: boolean;
  candidateSince?: number;
  releaseSince?: number;
  cooldownUntil?: number;
}

export interface GestureSnapshot {
  timestamp: number;
  state: GestureState;
  primary?: HandIntent;
  secondary?: HandIntent;
  hands: HandIntent[];
  holdMs: number;
  heuristicQuality: number;
}

export class GestureEngine {
  readonly #intentByKey = new Map<string, HandIntent>();
  #state: GestureState = 'IDLE';
  #stateSince = 0;
  #dominantHand: DominantHand = 'auto';
  #nextTrackId = 1;
  #lastTimestamp?: number;

  get dominantHand(): DominantHand {
    return this.#dominantHand;
  }

  setDominantHand(value: DominantHand): void {
    this.#dominantHand = value;
  }

  reset(): void {
    this.#intentByKey.clear();
    this.#state = 'IDLE';
    this.#stateSince = 0;
    this.#lastTimestamp = undefined;
  }

  process(hands: TrackedHand[], timestamp: number): GestureSnapshot {
    if (this.#lastTimestamp !== undefined && timestamp < this.#lastTimestamp) this.reset();
    const firstFrame = this.#lastTimestamp === undefined;
    this.#lastTimestamp = timestamp;
    const currentKeys = new Set<string>();
    const intents = this.matchHands(hands).map(({ hand, key, previous }) => {
      currentKeys.add(key);
      const pinch = recognizePinch(hand, previous?.confirmed ?? false);
      const intent: HandIntent = {
        key,
        hand,
        pinch,
        confirmed: previous?.confirmed ?? false,
        candidateSince: previous?.candidateSince,
        releaseSince: previous?.releaseSince,
        cooldownUntil: previous?.cooldownUntil,
      };

      if (pinch.active) {
        intent.releaseSince = undefined;
        if ((intent.cooldownUntil ?? 0) <= timestamp) {
          intent.candidateSince ??= timestamp;
          if (timestamp - intent.candidateSince >= APP_CONFIG.gesture.pinchHoldMs)
            intent.confirmed = true;
        } else {
          intent.candidateSince = undefined;
        }
      } else {
        intent.candidateSince = undefined;
        if (intent.confirmed) {
          intent.releaseSince ??= timestamp;
          if (timestamp - intent.releaseSince >= APP_CONFIG.gesture.releaseHoldMs) {
            intent.confirmed = false;
            intent.releaseSince = undefined;
            intent.cooldownUntil = timestamp + APP_CONFIG.gesture.cooldownMs;
          }
        }
      }
      this.#intentByKey.set(key, intent);
      return intent;
    });
    for (const key of this.#intentByKey.keys())
      if (!currentKeys.has(key)) this.#intentByKey.delete(key);

    const confirmed = intents.filter((intent) => intent.confirmed);
    const primary = this.choosePrimary(intents, timestamp);
    const secondary = confirmed.find((intent) => intent !== primary);
    let next: GestureState;
    if (confirmed.length >= 2) next = 'TWO_HAND_ACTIVE';
    else if (primary?.confirmed && primary.pinch.active) next = 'GRAB_ACTIVE';
    else if (primary?.confirmed) next = 'RELEASE_CANDIDATE';
    else if (
      intents.some((intent) => intent.pinch.active && (intent.cooldownUntil ?? 0) <= timestamp)
    )
      next = 'PINCH_CANDIDATE';
    else if (intents.some((intent) => isOpenPalm(intent.hand))) next = 'OPEN_PALM';
    else if (intents.length > 0) next = 'HOVER';
    else next = 'IDLE';

    if (firstFrame) this.#stateSince = timestamp;
    if (next !== this.#state) {
      this.#state = next;
      this.#stateSince = timestamp;
    }
    return {
      timestamp,
      state: this.#state,
      primary,
      secondary,
      hands: intents,
      holdMs: timestamp - this.#stateSince,
      heuristicQuality: primary?.pinch.quality ?? 0,
    };
  }

  private choosePrimary(intents: HandIntent[], timestamp: number): HandIntent | undefined {
    const confirmed = intents.filter((intent) => intent.confirmed);
    const active = intents.filter(
      (intent) => intent.pinch.active && (intent.cooldownUntil ?? 0) <= timestamp,
    );
    const candidates = confirmed.length ? confirmed : active.length ? active : intents;
    if (this.#dominantHand === 'auto') return candidates[0];
    const preferred = this.#dominantHand === 'left' ? 'Left' : 'Right';
    return candidates.find((intent) => intent.hand.handedness === preferred) ?? candidates[0];
  }

  private matchHands(
    hands: TrackedHand[],
  ): Array<{ hand: TrackedHand; key: string; previous?: HandIntent }> {
    const prior = [...this.#intentByKey.entries()];
    const candidates: Array<{ handIndex: number; priorIndex: number; score: number }> = [];
    hands.forEach((hand, handIndex) => {
      const wrist = hand.landmarks[0];
      if (!wrist) return;
      prior.forEach(([, intent], priorIndex) => {
        const previousWrist = intent.hand.landmarks[0];
        if (!previousWrist) return;
        const handednessPenalty =
          hand.handedness !== 'Unknown' &&
          intent.hand.handedness !== 'Unknown' &&
          hand.handedness !== intent.hand.handedness
            ? 0.12
            : 0;
        candidates.push({
          handIndex,
          priorIndex,
          score:
            Math.hypot(wrist.x - previousWrist.x, wrist.y - previousWrist.y) + handednessPenalty,
        });
      });
    });
    candidates.sort((a, b) => a.score - b.score);
    const handAssignments = new Map<number, number>();
    const usedPrior = new Set<number>();
    for (const candidate of candidates) {
      if (
        candidate.score > 0.42 ||
        handAssignments.has(candidate.handIndex) ||
        usedPrior.has(candidate.priorIndex)
      )
        continue;
      handAssignments.set(candidate.handIndex, candidate.priorIndex);
      usedPrior.add(candidate.priorIndex);
    }
    return hands.map((hand, handIndex) => {
      const priorIndex = handAssignments.get(handIndex);
      const match = priorIndex === undefined ? undefined : prior[priorIndex];
      const key = match?.[0] ?? `hand-${this.#nextTrackId++}`;
      return { hand, key, previous: match?.[1] };
    });
  }
}
