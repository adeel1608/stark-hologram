import type { DominantHand } from '../config';

const STORAGE_KEY = 'spatial-hmi.calibration.v1';

export interface CalibrationProfile {
  version: 1;
  dominantHand: DominantHand;
  neutralPalmScale?: number;
  calibratedAt?: string;
  onboardingComplete: boolean;
}

const DEFAULT_PROFILE: CalibrationProfile = {
  version: 1,
  dominantHand: 'auto',
  onboardingComplete: false,
};

export function isCalibrationProfile(value: unknown): value is CalibrationProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    (candidate.dominantHand === 'auto' ||
      candidate.dominantHand === 'left' ||
      candidate.dominantHand === 'right') &&
    (candidate.neutralPalmScale === undefined ||
      (typeof candidate.neutralPalmScale === 'number' &&
        Number.isFinite(candidate.neutralPalmScale) &&
        candidate.neutralPalmScale > 0)) &&
    typeof candidate.onboardingComplete === 'boolean'
  );
}

export class CalibrationStore {
  load(): CalibrationProfile {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (!serialized) return { ...DEFAULT_PROFILE };
      const parsed: unknown = JSON.parse(serialized);
      return isCalibrationProfile(parsed) ? parsed : { ...DEFAULT_PROFILE };
    } catch {
      return { ...DEFAULT_PROFILE };
    }
  }

  save(profile: CalibrationProfile): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }

  reset(): CalibrationProfile {
    localStorage.removeItem(STORAGE_KEY);
    return { ...DEFAULT_PROFILE };
  }
}
