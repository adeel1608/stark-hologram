import { describe, expect, it } from 'vitest';
import { validateModelFile, validateModelUrl } from './gltf-model-loader';

describe('GLTF model source validation', () => {
  it('accepts absolute and relative GLB/glTF HTTP URLs', () => {
    expect(validateModelUrl('https://example.com/robot.glb')).toBe('https://example.com/robot.glb');
    expect(validateModelUrl('/models/cell.gltf?revision=2', 'https://example.com/app')).toBe(
      'https://example.com/models/cell.gltf?revision=2',
    );
  });

  it('rejects unsupported protocols and ambiguous file types', () => {
    expect(() => validateModelUrl('data:model/gltf-binary;base64,AA==')).toThrow('HTTP or HTTPS');
    expect(() => validateModelUrl('https://example.com/model.zip')).toThrow('.glb or .gltf');
  });

  it('accepts only non-empty local GLB files within the size limit', () => {
    expect(() => validateModelFile({ name: 'robot.glb', size: 1024 } as File)).not.toThrow();
    expect(() => validateModelFile({ name: 'robot.gltf', size: 1024 } as File)).toThrow(
      'self-contained .glb',
    );
    expect(() => validateModelFile({ name: 'robot.glb', size: 0 } as File)).toThrow('empty');
  });
});
