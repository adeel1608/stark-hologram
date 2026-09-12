import { APP_CONFIG } from './config';

interface ConfigShape {
  gesture: { pinchActivateRatio: number; pinchReleaseRatio: number };
  depth: { smoothingAlpha: number };
  vision: { maxHands: number };
  interaction: { minScale: number; maxScale: number };
}

export function validateConfig(config: ConfigShape = APP_CONFIG): string[] {
  const errors: string[] = [];
  if (config.gesture.pinchActivateRatio >= config.gesture.pinchReleaseRatio) {
    errors.push('Pinch activation ratio must be lower than the release ratio.');
  }
  if (config.depth.smoothingAlpha <= 0 || config.depth.smoothingAlpha > 1) {
    errors.push('Depth smoothing alpha must be in (0, 1].');
  }
  if (config.vision.maxHands < 1 || config.vision.maxHands > 2) {
    errors.push('Vision maxHands must be between 1 and 2.');
  }
  if (config.interaction.minScale >= config.interaction.maxScale) {
    errors.push('Minimum interaction scale must be lower than maximum scale.');
  }
  return errors;
}
