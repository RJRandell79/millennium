import type { DayReport, DeptId, DeptState, Equipment, GameState, Installation, Message, MessageKind } from './types';
import { COLONY_DEPTS, MOON_DEPTS } from './types';
import { emptyStock } from './data/materials';
import { BODY_BY_ID } from './data/bodies';

export function newId(s: GameState, prefix: string): string {
  s.nextId += 1;
  return `${prefix}${s.nextId}`;
}

export function msg(s: GameState, kind: MessageKind, title: string, text: string, ref?: string): Message {
  s.nextMsg += 1;
  const m: Message = { id: s.nextMsg, day: s.day, kind, title, text, ref };
  s.messages.push(m);
  if (s.messages.length > 250) s.messages.splice(0, s.messages.length - 250);
  s.unread += 1;
  return m;
}

export function hasFlag(s: GameState, f: string): boolean {
  return s.flags.includes(f);
}

export function setFlag(s: GameState, f: string): boolean {
  if (s.flags.includes(f)) return false;
  s.flags.push(f);
  return true;
}

export function emptyEquipment(): Equipment {
  return { solar: 0, reactor: 0, fusion: 0, habitat: 0, refinery: 0, labs: 0, factories: 0, lasers: 0, shields: 0, fightersMk1: 0, fightersMk2: 0 };
}

export function emptyReport(): DayReport {
  return { powerGen: 0, powerDemand: 0, deptEff: {}, mined: {}, consumed: {}, lifeSupportOk: true, daysOfSupplies: 999 };
}

export function makeInstallation(s: GameState, bodyId: string, isMoonBase: boolean, population: number): Installation {
  const depts: Partial<Record<DeptId, DeptState>> = {};
  for (const d of isMoonBase ? MOON_DEPTS : COLONY_DEPTS) depts[d] = { online: true, damage: 0 };
  const inst: Installation = {
    id: isMoonBase ? 'moonbase' : newId(s, 'col'),
    name: isMoonBase ? 'Moonbase' : `${BODY_BY_ID[bodyId].name} Colony`,
    bodyId,
    isMoonBase,
    population,
    stock: emptyStock(),
    depts,
    equipment: emptyEquipment(),
    foundedDay: s.day,
    report: emptyReport(),
    shortageDays: 0,
  };
  s.installations[inst.id] = inst;
  s.bodies[bodyId].installationId = inst.id;
  return inst;
}

export function popCap(inst: Installation): number {
  return inst.isMoonBase ? 100 * Math.max(1, inst.equipment.habitat) : 100;
}

export function moonbase(s: GameState): Installation {
  return s.installations.moonbase;
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}

export function fmtKg(n: number): string {
  const v = Math.round(n);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  return v.toLocaleString('en-GB');
}
