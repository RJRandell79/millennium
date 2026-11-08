import type { GameState } from './types';
import { SAVE_VERSION } from './newGame';

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(json: string): GameState {
  const s = JSON.parse(json) as GameState;
  if (!s || typeof s !== 'object' || typeof s.day !== 'number' || !s.installations?.moonbase) throw new Error('Not a Millennium save file');
  if (s.version > SAVE_VERSION) throw new Error('This save is from a newer version of the game');
  s.stats.named ??= {};
  return s;
}
