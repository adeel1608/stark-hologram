import { describe, expect, it } from 'vitest';
import { keyToCommand } from './keymap';

describe('keyToCommand', () => {
  it('maps visual mode keys', () => {
    expect(keyToCommand('B')).toEqual({ type: 'mode', mode: 'blueprint' });
    expect(keyToCommand('d')).toEqual({ type: 'mode', mode: 'diagnostic' });
  });

  it('maps interaction and help keys', () => {
    expect(keyToCommand('e')).toEqual({ type: 'explode' });
    expect(keyToCommand('/', true)).toEqual({ type: 'help' });
    expect(keyToCommand('x')).toBeUndefined();
  });
});
