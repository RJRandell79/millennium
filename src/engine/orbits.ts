import { BODY_BY_ID } from './data/bodies';

export const START_UTC = Date.UTC(2200, 0, 30);
const J2000_UTC = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86_400_000;
export const START_J2000 = (START_UTC - J2000_UTC) / DAY_MS;

export interface Vec { x: number; y: number }

/** Heliocentric position (AU) of a body on a game day. Moons report their parent's position. */
export function position(bodyId: string, day: number): Vec {
  const b = BODY_BY_ID[bodyId];
  if (!b || b.kind === 'star') return { x: 0, y: 0 };
  if (b.parent) return position(b.parent, day);
  const t = START_J2000 + day;
  const L = ((b.L0 + (360 * t) / b.periodDays) % 360) * (Math.PI / 180);
  return { x: b.a * Math.cos(L), y: b.a * Math.sin(L) };
}

export function distanceAU(a: string, b: string, day: number): number {
  const p = position(a, day);
  const q = position(b, day);
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** Distance from the Sun in AU (for solar power). */
export function sunDistance(bodyId: string, day: number): number {
  const p = position(bodyId, day);
  return Math.max(0.2, Math.hypot(p.x, p.y));
}

export function systemOf(bodyId: string): string {
  const b = BODY_BY_ID[bodyId];
  return b?.parent ?? bodyId;
}

export const DRIVE_SPEED = { chemical: 0.025, ion: 0.05, fusion: 0.12 } as const; // AU per day
export const RAIDER_SPEED = 0.05;

export function driveSpeed(done: string[]): number {
  if (done.includes('fusionDrive')) return DRIVE_SPEED.fusion;
  if (done.includes('ionDrive')) return DRIVE_SPEED.ion;
  return DRIVE_SPEED.chemical;
}

export function driveName(done: string[]): string {
  if (done.includes('fusionDrive')) return 'Fusion';
  if (done.includes('ionDrive')) return 'Ion';
  return 'Chemical';
}

/**
 * Travel time in whole days, aiming at where the target will be on arrival.
 * Includes 2 days for launch and orbital insertion.
 */
export function travelDays(from: string, to: string, day: number, speed: number): number {
  if (from === to) return 1;
  if (systemOf(from) === systemOf(to)) return 3; // within one planetary system (Earth–Moon, Jupiter's moons…)
  let d = distanceAU(from, to, day);
  let t = 2 + d / speed;
  for (let i = 0; i < 3; i++) {
    const p = position(from, day);
    const q = position(to, day + t);
    d = Math.hypot(p.x - q.x, p.y - q.y);
    t = 2 + d / speed;
  }
  return Math.max(2, Math.ceil(t));
}

/** Leg distance used for fuel. */
export function legDistance(from: string, to: string, day: number): number {
  if (systemOf(from) === systemOf(to)) return 0.05;
  return distanceAU(from, to, day);
}

export function dateOf(day: number): Date {
  return new Date(START_UTC + Math.floor(day) * DAY_MS);
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function formatDate(day: number): string {
  const d = dateOf(day);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
