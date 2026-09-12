import type { VisualMode } from '../config';

export type InputCommand =
  | { type: 'mode'; mode: VisualMode }
  | { type: 'explode' }
  | { type: 'reset' }
  | { type: 'fullscreen' }
  | { type: 'help' };

export function keyToCommand(key: string, shiftKey = false): InputCommand | undefined {
  const normalized = key.toLowerCase();
  if (normalized === 'h') return { type: 'mode', mode: 'holographic' };
  if (normalized === 'b') return { type: 'mode', mode: 'blueprint' };
  if (normalized === 's') return { type: 'mode', mode: 'solid' };
  if (normalized === 'd') return { type: 'mode', mode: 'diagnostic' };
  if (normalized === 'e') return { type: 'explode' };
  if (normalized === 'r') return { type: 'reset' };
  if (normalized === 'f') return { type: 'fullscreen' };
  if (normalized === '?' || (normalized === '/' && shiftKey)) return { type: 'help' };
  return undefined;
}
