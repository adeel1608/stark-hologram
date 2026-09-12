import { describe, expect, it } from 'vitest';
import { syntheticHand } from '../demo/synthetic-hands';
import { GestureEngine } from './gesture-engine';

describe('GestureEngine', () => {
  it('moves through candidate, confirmed grab and release candidate states', () => {
    const engine = new GestureEngine();
    const pinched = syntheticHand('Right', 0.5, 0.5, 0.25, true);
    const open = syntheticHand('Right', 0.5, 0.5, 0.25, false);
    expect(engine.process([pinched], 0).state).toBe('PINCH_CANDIDATE');
    expect(engine.process([pinched], 160).state).toBe('GRAB_ACTIVE');
    expect(engine.process([open], 200).state).toBe('RELEASE_CANDIDATE');
    expect(engine.process([open], 310).state).toBe('OPEN_PALM');
  });

  it('confirms two hand interaction only after temporal gating', () => {
    const engine = new GestureEngine();
    const hands = [
      syntheticHand('Left', 0.35, 0.5, 0.25, true),
      syntheticHand('Right', 0.65, 0.5, 0.25, true),
    ];
    expect(engine.process(hands, 0).state).toBe('PINCH_CANDIDATE');
    expect(engine.process(hands, 170).state).toBe('TWO_HAND_ACTIVE');
  });

  it('respects dominant hand preference', () => {
    const engine = new GestureEngine();
    engine.setDominantHand('left');
    const hands = [
      syntheticHand('Right', 0.65, 0.5, 0.25, false),
      syntheticHand('Left', 0.35, 0.5, 0.25, false),
    ];
    expect(engine.process(hands, 0).primary?.hand.handedness).toBe('Left');
  });
});
