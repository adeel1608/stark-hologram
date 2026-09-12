import { describe, expect, it } from 'vitest';
import { readStoredJson, removeStoredValue, writeStoredJson } from './safe-storage';

describe('safe storage', () => {
  it('treats invalid JSON and storage failures as missing optional preferences', () => {
    const invalid = {
      getItem: () => '{bad json',
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readStoredJson(invalid, 'key')).toBeUndefined();
    expect(() => writeStoredJson(invalid, 'key', { enabled: true })).not.toThrow();
    expect(() => removeStoredValue(invalid, 'key')).not.toThrow();
  });
});
