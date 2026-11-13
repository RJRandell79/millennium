import type { GameState, Installation, Ship } from './types';
import { RESEARCH, RESEARCH_BY_ID, type ResearchDef } from './data/research';
import { BLUEPRINTS, type Blueprint } from './data/blueprints';
import { BODY_BY_ID } from './data/bodies';
import { colonyRequirementMet } from './fleet';
import { driveSpeed, travelDays } from './orbits';
import { moonbase } from './util';

export type ResearchStatus = 'done' | 'current' | 'available' | 'locked' | 'hidden';

export function researchStatus(s: GameState, r: ResearchDef): ResearchStatus {
  if (s.research.done.includes(r.id)) return 'done';
  if (s.research.current === r.id) return 'current';
  if (r.flag && !s.flags.includes(r.flag)) return 'hidden';
  if (!r.requires.every((q) => s.research.done.includes(q))) return 'locked';
  if (r.minSalvage && s.threat.salvage < r.minSalvage) return 'locked';
  return 'available';
}

export function researchList(s: GameState) {
  return RESEARCH.map((r) => ({ def: r, status: researchStatus(s, r) })).filter((x) => x.status !== 'hidden');
}

export function blueprintUnlocked(s: GameState, bp: Blueprint): boolean {
  return !bp.requires || s.research.done.includes(bp.requires);
}

export function availableBlueprints(s: GameState): Blueprint[] {
  return BLUEPRINTS.filter((b) => blueprintUnlocked(s, b));
}

/** Installed + queued + crated for a given equipment blueprint at an installation. */
export function equipCount(s: GameState, bp: Blueprint, inst: Installation): number {
  if (!bp.equip) return 0;
  const queued = s.queue.filter((q) => q.blueprintId === bp.id && q.targetId === inst.id).length;
  const crated = s.consignments.filter((c) => c.blueprintId === bp.id && c.installationId === inst.id).length
    + Object.values(s.ships).reduce((a, sh) => a + sh.consignments.filter((c) => c.blueprintId === bp.id && c.installationId === inst.id).length, 0);
  return inst.equipment[bp.equip] + queued + crated;
}

export function validTargetsFor(s: GameState, bp: Blueprint): Installation[] {
  const all = Object.values(s.installations);
  if (bp.install === 'moon') return [moonbase(s)];
  if (bp.install === 'colony') return all.filter((i) => !i.isMoonBase);
  if (bp.install === 'any') return all;
  return [];
}

export interface MissionOption { bodyId: string; label: string; ok: boolean; reason?: string; days: number }

/** Possible destinations for a docked ship. */
export function missionsFor(s: GameState, ship: Ship): MissionOption[] {
  const speed = driveSpeed(s.research.done);
  const out: MissionOption[] = [];
  const add = (bodyId: string, ok: boolean, reason?: string) =>
    out.push({ bodyId, label: BODY_BY_ID[bodyId].name, ok, reason, days: travelDays(ship.at, bodyId, s.day, speed) });
  const bodies = Object.values(BODY_BY_ID).filter((b) => b.kind !== 'star' && b.id !== 'moon');
  switch (ship.type) {
    case 'probe':
      for (const b of bodies) {
        const k = s.bodies[b.id].knowledge;
        if (b.id === 'earth') add(b.id, !s.earth.probed, s.earth.probed ? 'Already probed' : undefined);
        else if (b.id === 'mars') add(b.id, !s.flags.includes('marsProbed'), s.flags.includes('marsProbed') ? 'Already probed' : undefined);
        else if (!b.parent) add(b.id, k === 0, k > 0 ? 'Already probed' : undefined);
      }
      break;
    case 'surveyor':
      for (const b of bodies) {
        if (b.mineable !== 'colony' || b.id === 'mars') continue;
        const k = s.bodies[b.id].knowledge;
        add(b.id, k === 1, k === 0 ? 'Probe it first' : k === 2 ? 'Already surveyed' : undefined);
      }
      break;
    case 'colonyShip':
      for (const b of bodies) {
        if (b.mineable !== 'colony' || b.id === 'mars') continue;
        const k = s.bodies[b.id].knowledge;
        if (k < 1) continue;
        const req = colonyRequirementMet(s, b.id);
        add(b.id, k === 2 && req.ok, k < 2 ? 'Survey it first' : req.reason);
      }
      if (moonbase(s).population < 80) out.forEach((o) => { o.ok = false; o.reason = 'Moonbase needs 80+ people to spare 50'; });
      break;
    case 'miner':
      for (const b of bodies) if (b.kind === 'asteroid') add(b.id, true);
      break;
    case 'gasScoop':
      for (const b of bodies) if (b.mineable === 'scoop') add(b.id, true);
      break;
    case 'freighter':
      break; // routes are set to colonies (see colonies list)
    case 'hospitalShip':
      add('mars', s.threat.status === 'hostile', s.threat.status !== 'hostile' ? 'The war is over' : undefined);
      break;
    default:
      break;
  }
  return out;
}

export function totalPopulation(s: GameState): number {
  return Object.values(s.installations).reduce((a, i) => a + Math.floor(i.population), 0);
}

export function researchDef(id: string) { return RESEARCH_BY_ID[id]; }

export function score(s: GameState): number {
  const colonies = Object.keys(s.installations).length - 1;
  const base = totalPopulation(s) * 10 + colonies * 500 + s.research.done.length * 100 + s.stats.raidsRepelled * 150 + Math.floor(s.earth.progress) * 50;
  const winBonus = s.outcome?.result === 'won' ? Math.max(0, 20000 - s.day * 8) : 0;
  return base + winBonus;
}

/**
 * Archive engagement, for playtests: how much was recovered, opened, and how soon.
 * Documents back-filled when an older save was upgraded are counted separately and left out of the rest.
 */
export function archiveStats(s: GameState) {
  const inPlay = s.archive.filter((e) => !e.backfilled);
  const found = inPlay.length;
  const read = inPlay.filter((e) => e.firstReadDay !== undefined);
  const delays = read.map((e) => e.firstReadDay! - e.day).sort((a, b) => a - b);
  const median = delays.length ? delays[Math.floor((delays.length - 1) / 2)] : null;
  return {
    found,
    backfilled: s.archive.length - found,
    read: read.length,
    unread: found - read.length,
    reopened: inPlay.filter((e) => e.opens > 1).length,
    interruptedPlay: read.filter((e) => e.firstReadWhileRunning).length,
    medianDaysToOpen: median,
  };
}
