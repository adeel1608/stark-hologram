import type { DominantHand } from '../config';
import {
  browserStorage,
  readStoredJson,
  removeStoredValue,
  type SafeStorage,
  writeStoredJson,
} from '../storage/safe-storage';

const STORAGE_KEY = 'spatial-hmi.calibration.v1';

export interface CalibrationProfile {
  version: 1;
  dominantHand: DominantHand;
  neutralPalmScale?: number;
  neutralPalmFeatures?: number[];
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
    (candidate.neutralPalmFeatures === undefined ||
      (Array.isArray(candidate.neutralPalmFeatures) &&
        candidate.neutralPalmFeatures.length === 5 &&
        candidate.neutralPalmFeatures.every(
          (feature) => typeof feature === 'number' && Number.isFinite(feature) && feature > 0,
        ))) &&
    typeof candidate.onboardingComplete === 'boolean'
  );
}

export class CalibrationStore {
  constructor(private readonly storage: SafeStorage | undefined = browserStorage()) {}

  load(): CalibrationProfile {
    const parsed = readStoredJson(this.storage, STORAGE_KEY);
    return isCalibrationProfile(parsed) ? parsed : { ...DEFAULT_PROFILE };
  }

  save(profile: CalibrationProfile): void {
    writeStoredJson(this.storage, STORAGE_KEY, profile);
  }

  reset(): CalibrationProfile {
    removeStoredValue(this.storage, STORAGE_KEY);
    return { ...DEFAULT_PROFILE };
  }
}
