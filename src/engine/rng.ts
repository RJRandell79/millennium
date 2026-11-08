import type { GameState } from './types';

/** Mulberry32 step. Returns [value in 0..1, next state]. Pure. */
export function mulberry32(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Draw from the game's RNG stream (mutates the draft state's rng field). */
export function rand(s: GameState): number {
  const [v, next] = mulberry32(s.rng);
  s.rng = next;
  return v;
}

export function randInt(s: GameState, min: number, max: number): number {
  return min + Math.floor(rand(s) * (max - min + 1));
}

export function chance(s: GameState, p: number): boolean {
  return rand(s) < p;
}

export function pick<T>(s: GameState, arr: T[]): T {
  return arr[Math.floor(rand(s) * arr.length)];
}
