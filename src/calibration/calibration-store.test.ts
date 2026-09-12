import { describe, expect, it } from 'vitest';
import { isCalibrationProfile } from './calibration-store';

describe('calibration profile validation', () => {
  it('accepts a valid versioned profile', () => {
    expect(
      isCalibrationProfile({
        version: 1,
        dominantHand: 'right',
        neutralPalmScale: 0.2,
        onboardingComplete: true,
      }),
    ).toBe(true);
  });

  it('rejects malformed or non-positive baselines', () => {
    expect(
      isCalibrationProfile({ version: 1, dominantHand: 'either', onboardingComplete: true }),
    ).toBe(false);
    expect(
      isCalibrationProfile({
        version: 1,
        dominantHand: 'auto',
        neutralPalmScale: 0,
        onboardingComplete: false,
      }),
    ).toBe(false);
  });
});
