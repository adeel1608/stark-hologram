import { describe, expect, it } from 'vitest';
import { APP_CONFIG } from './config';
import { validateConfig } from './config-validation';

describe('configuration validation', () => {
  it('accepts the shipped configuration', () => {
    expect(validateConfig()).toEqual([]);
  });

  it('detects inverted pinch hysteresis', () => {
    const invalid = {
      ...APP_CONFIG,
      gesture: { ...APP_CONFIG.gesture, pinchActivateRatio: 0.5, pinchReleaseRatio: 0.3 },
    } as unknown as typeof APP_CONFIG;
    expect(validateConfig(invalid)).toContain(
      'Pinch activation ratio must be lower than the release ratio.',
    );
  });
});
