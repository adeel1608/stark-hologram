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

  it('preserves a pending pinch across a handedness-label flip', () => {
    const engine = new GestureEngine();
    const first = engine.process([syntheticHand('Right', 0.5, 0.5, 0.25, true)], 0);
    const confirmed = engine.process([syntheticHand('Left', 0.5, 0.5, 0.25, true)], 160);
    expect(confirmed.state).toBe('GRAB_ACTIVE');
    expect(confirmed.primary?.key).toBe(first.primary?.key);
  });

  it('prefers an active pinch over an idle dominant hand', () => {
    const engine = new GestureEngine();
    engine.setDominantHand('left');
    const result = engine.process(
      [syntheticHand('Left', 0.3, 0.5, 0.25, false), syntheticHand('Right', 0.7, 0.5, 0.25, true)],
      0,
    );
    expect(result.primary?.hand.handedness).toBe('Right');
    expect(result.state).toBe('PINCH_CANDIDATE');
  });

  it('enforces a cooldown after a confirmed release', () => {
    const engine = new GestureEngine();
    const pinched = syntheticHand('Right', 0.5, 0.5, 0.25, true);
    const open = syntheticHand('Right', 0.5, 0.5, 0.25, false);
    engine.process([pinched], 0);
    engine.process([pinched], 160);
    engine.process([open], 200);
    engine.process([open], 300);
    expect(engine.process([pinched], 310).state).toBe('HOVER');
    expect(engine.process([pinched], 500).state).toBe('PINCH_CANDIDATE');
  });

  it('resets temporal state when timestamps move backwards', () => {
    const engine = new GestureEngine();
    const pinched = syntheticHand('Right', 0.5, 0.5, 0.25, true);
    engine.process([pinched], 1000);
    expect(engine.process([pinched], 900).state).toBe('PINCH_CANDIDATE');
    expect(engine.process([pinched], 910).holdMs).toBe(10);
  });
});
