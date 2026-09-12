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
  }

  process(hands: TrackedHand[], timestamp: number): GestureSnapshot {
    const occurrences = new Map<string, number>();
    const currentKeys = new Set<string>();
    const intents = hands.map((hand) => {
      const occurrence = occurrences.get(hand.handedness) ?? 0;
      occurrences.set(hand.handedness, occurrence + 1);
      const key = `${hand.handedness}-${occurrence}`;
      currentKeys.add(key);
      const previous = this.#intentByKey.get(key);
      const pinch = recognizePinch(hand, previous?.confirmed ?? false);
      const intent: HandIntent = {
        key,
        hand,
        pinch,
        confirmed: previous?.confirmed ?? false,
        candidateSince: previous?.candidateSince,
        releaseSince: previous?.releaseSince,
      };

      if (pinch.active) {
        intent.releaseSince = undefined;
        intent.candidateSince ??= timestamp;
        if (timestamp - intent.candidateSince >= APP_CONFIG.gesture.pinchHoldMs)
          intent.confirmed = true;
      } else {
        intent.candidateSince = undefined;
        if (intent.confirmed) {
          intent.releaseSince ??= timestamp;
          if (timestamp - intent.releaseSince >= APP_CONFIG.gesture.releaseHoldMs) {
            intent.confirmed = false;
            intent.releaseSince = undefined;
          }
        }
      }
      this.#intentByKey.set(key, intent);
      return intent;
    });
    for (const key of this.#intentByKey.keys())
      if (!currentKeys.has(key)) this.#intentByKey.delete(key);

    const confirmed = intents.filter((intent) => intent.confirmed);
    const primary = this.choosePrimary(intents);
    const secondary = confirmed.find((intent) => intent !== primary);
    let next: GestureState;
    if (confirmed.length >= 2) next = 'TWO_HAND_ACTIVE';
    else if (primary?.confirmed && primary.pinch.active) next = 'GRAB_ACTIVE';
    else if (primary?.confirmed) next = 'RELEASE_CANDIDATE';
    else if (intents.some((intent) => intent.pinch.active)) next = 'PINCH_CANDIDATE';
    else if (intents.some((intent) => isOpenPalm(intent.hand))) next = 'OPEN_PALM';
    else if (intents.length > 0) next = 'HOVER';
    else next = 'IDLE';

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

  private choosePrimary(intents: HandIntent[]): HandIntent | undefined {
    const confirmed = intents.filter((intent) => intent.confirmed);
    const candidates = confirmed.length ? confirmed : intents;
    if (this.#dominantHand === 'auto') return candidates[0];
    const preferred = this.#dominantHand === 'left' ? 'Left' : 'Right';
    return candidates.find((intent) => intent.hand.handedness === preferred) ?? candidates[0];
  }
}
