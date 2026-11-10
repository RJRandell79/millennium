import type { Cost, DeptId, GameState, GrowthPolicy, Installation, MaterialId } from './types';
import { LS_MATS, LS_PER_PERSON, canAfford, pay } from './data/materials';
import { BLUEPRINT_BY_ID } from './data/blueprints';
import { RESEARCH_BY_ID } from './data/research';
import { STORY, FRAGMENTS } from './data/lore';
import { sunDistance } from './orbits';
import { msg, popCap, setFlag } from './util';
import { addShip } from './newGame';

/** Power allocation order: the first departments get power first. */
export const POWER_ORDER: DeptId[] = ['lifeSupport', 'defence', 'flightDeck', 'refinery', 'production', 'research'];

export const MINE_BASE = 250; // kg/day per abundance point

/**
 * Population policy per installation: operational settings, not a ladder. Each keeps an advantage
 * and a cost at every population level, including when the installation is full.
 *  - grow:   full growth. At Moonbase, growth carries on past housing capacity into a reserve of up to
 *            10%: trainees and dependants who eat but aren't on the duty roster. Raids and colony ships
 *            take from the reserve first. Life support +10% a head while numbers are rising.
 *  - steady: 40% growth, a reserve of up to 5%, no life-support surcharge.
 *  - hold:   no growth and no reserve kept: anyone in reserve goes on the duty roster. Below capacity
 *            it is a crisis footing: life support -10% and the crew works 10% harder.
 * Colonies have no reserve (their 100 cap is unchanged); there, policies only differ below capacity.
 */
export const GROWTH_POLICIES: Record<GrowthPolicy, { name: string; rate: number; reserve: number; lsMult: number; crisisWork: number; blurb: string }> = {
  grow:   { name: 'Grow',   rate: 1,   reserve: 0.10, lsMult: 1.1, crisisWork: 1,   blurb: 'Full growth. Moonbase grows past capacity into a reserve of up to 10%, off the duty roster, that absorbs raid losses and colony ship departures. Life support +10% a head while numbers are rising.' },
  steady: { name: 'Steady', rate: 0.4, reserve: 0.05, lsMult: 1,   crisisWork: 1,   blurb: 'Slow growth with no life-support surcharge. Moonbase keeps a reserve of up to 5%.' },
  hold:   { name: 'Hold',   rate: 0,   reserve: 0,    lsMult: 0.9, crisisWork: 1.1, blurb: 'No growth and no reserve: everyone is on the duty roster. Below capacity, tighter rationing cuts life-support use by 10% and the crew works 10% harder.' },
};
export const DEFAULT_GROWTH: GrowthPolicy = 'grow';
export const growthPolicy = (inst: Installation): GrowthPolicy => inst.growth ?? DEFAULT_GROWTH;
/** Base daily growth rate before policy. */
export const baseGrowthRate = (inst: Installation): number => (inst.isMoonBase ? 0.004 : 0.0025);
/** Highest population the policy grows towards: housing capacity plus the reserve (Moonbase only). */
export const growthLimit = (inst: Installation): number =>
  popCap(inst) * (1 + (inst.isMoonBase ? GROWTH_POLICIES[growthPolicy(inst)].reserve : 0));
/** People beyond housing capacity. On Grow and Steady they are off the duty roster. */
export const reserveOf = (inst: Installation): number => Math.max(0, inst.population - popCap(inst));
/** People on the duty roster. */
export function onDuty(inst: Installation): number {
  return growthPolicy(inst) === 'hold' ? inst.population : Math.min(inst.population, popCap(inst));
}
const belowCap = (inst: Installation) => inst.population < popCap(inst);

/** Moonbase's long-range listening watch, powered as part of Life Support. */
export const COMMS_WATCH_MW = 0.4;

export function deptHealth(inst: Installation, d: DeptId): number {
  const st = inst.depts[d];
  if (!st) return 0;
  return 1 - st.damage / 100;
}

export function solarPerArray(s: GameState, inst: Installation): number {
  const r = sunDistance(inst.bodyId, s.day);
  let out = 2 / (r * r);
  if (inst.bodyId === 'titan') out *= 0.2; // haze
  if (s.modifiers.some((m) => m.kind === 'solarFlare') && r < 2 && inst.equipment.shields === 0) out *= 0.4;
  return out;
}

export function powerGeneration(s: GameState, inst: Installation): number {
  const e = inst.equipment;
  const raw = e.solar * solarPerArray(s, inst) + e.reactor * 10 + e.fusion * 40;
  const energy = inst.depts.energy;
  if (!energy || !energy.online) return 0;
  return raw * deptHealth(inst, 'energy');
}

export function deptDemand(inst: Installation, d: DeptId): number {
  const st = inst.depts[d];
  if (!st || !st.online) return 0;
  const e = inst.equipment;
  switch (d) {
    case 'lifeSupport': return 0.5 + 0.02 * inst.population + (inst.commsWatch ? COMMS_WATCH_MW : 0);
    case 'defence': return 0.5 + 0.5 * e.lasers + 2 * e.shields;
    case 'flightDeck': return inst.isMoonBase ? 1 : 0.5;
    case 'refinery': return (inst.isMoonBase ? 4 : 2) + e.refinery;
    case 'production': return 3 * (1 + e.factories);
    case 'research': return 2 * (1 + e.labs);
    default: return 0;
  }
}

export function workforce(inst: Installation): number {
  const crew = onDuty(inst);
  const base = inst.isMoonBase ? 0.6 + 0.4 * (crew / 100) : 0.3 + 1.2 * (crew / 100);
  return base * (belowCap(inst) ? GROWTH_POLICIES[growthPolicy(inst)].crisisWork : 1);
}

export function lsNeed(inst: Installation): Record<'oxygen' | 'water' | 'nitrogen', number> {
  const pol = growthPolicy(inst);
  // Grow's surcharge only while numbers are rising; Hold's rationing only below capacity.
  const mult = pol === 'grow' ? (inst.population < growthLimit(inst) ? GROWTH_POLICIES.grow.lsMult : 1)
    : pol === 'hold' ? (belowCap(inst) ? GROWTH_POLICIES.hold.lsMult : 1) : 1;
  const p = inst.population * mult;
  return { oxygen: p * LS_PER_PERSON.oxygen, water: p * LS_PER_PERSON.water, nitrogen: p * LS_PER_PERSON.nitrogen };
}

/** Expected mining output per day at current efficiency. */
export function miningRates(s: GameState, inst: Installation, eff: number): Cost {
  const body = s.bodies[inst.bodyId];
  const rich = body.richUntil && body.richUntil > s.day ? 1.5 : 1;
  const mult = MINE_BASE * (1 + 0.3 * inst.equipment.refinery) * eff * workforce(inst) * rich;
  const out: Cost = {};
  for (const [k, v] of Object.entries(body.composition)) {
    if (v && v > 0) out[k as MaterialId] = v * mult;
  }
  return out;
}

/** Run one day of power, life support, mining, repair (+ research & production at Moonbase). */
export function runInstallation(s: GameState, inst: Installation): void {
  const gen = powerGeneration(s, inst);
  let left = gen;
  let demand = 0;
  const eff: Partial<Record<DeptId, number>> = {};
  for (const d of POWER_ORDER) {
    if (!inst.depts[d]) continue;
    const need = deptDemand(inst, d);
    demand += need;
    if (need <= 0) { eff[d] = 0; continue; }
    const alloc = Math.min(need, left);
    left -= alloc;
    eff[d] = (alloc / need) * deptHealth(inst, d);
  }
  eff.energy = inst.depts.energy?.online ? deptHealth(inst, 'energy') : 0;

  // Mining
  const mined: Cost = {};
  if ((eff.refinery ?? 0) > 0) {
    const rates = miningRates(s, inst, eff.refinery!);
    for (const [k, v] of Object.entries(rates)) {
      inst.stock[k as MaterialId] += v!;
      mined[k as MaterialId] = v!;
      s.stats.kgMined += v!;
    }
  }

  // Life support
  const need = lsNeed(inst);
  const lsEff = eff.lifeSupport ?? 0;
  // A struggling life-support plant recycles less: up to 2× losses.
  const lossMult = 1 + (1 - lsEff);
  const consumed: Cost = {};
  let ok = lsEff >= 0.5;
  let daysOfSupplies = 999;
  for (const m of LS_MATS) {
    const n = need[m as 'oxygen'] * lossMult;
    const take = Math.min(n, inst.stock[m]);
    inst.stock[m] -= take;
    consumed[m] = take;
    if (take < n - 0.001) ok = false;
    const net = (mined[m] ?? 0) - n;
    if (net < 0) daysOfSupplies = Math.min(daysOfSupplies, inst.stock[m] / -net);
  }

  if (!ok && inst.population > 0) {
    inst.shortageDays += 1;
    if (inst.shortageDays === 1) {
      msg(s, 'alert', `${inst.name}: life support failing`, lsEff < 0.5
        ? 'Life support is short of power. Bring departments offline or build more power generation.'
        : 'Oxygen, water or nitrogen has run out. Get supplies there now.', inst.id);
    }
    if (inst.shortageDays > 2) {
      const deaths = Math.max(1, Math.ceil(inst.population * 0.03));
      inst.population = Math.max(0, inst.population - deaths);
      if (inst.shortageDays % 5 === 3) msg(s, 'warn', `${inst.name}: casualties`, `${deaths} people died today. Population ${Math.floor(inst.population)}.`, inst.id);
    }
  } else {
    if (inst.shortageDays > 0) msg(s, 'good', `${inst.name}: life support restored`, 'Supplies and power are back to normal.', inst.id);
    inst.shortageDays = 0;
    const limit = growthLimit(inst);
    const rate = baseGrowthRate(inst) * GROWTH_POLICIES[growthPolicy(inst)].rate;
    if (lsEff >= 0.95 && inst.population < limit && rate > 0) {
      inst.population = Math.min(limit, inst.population + Math.max(0.05, inst.population * rate));
    }
  }

  // Repairs (auto, uses titanium + aluminium)
  const repairRate = inst.isMoonBase ? 3 : 1.5;
  for (const d of Object.keys(inst.depts) as DeptId[]) {
    const st = inst.depts[d]!;
    if (st.damage <= 0) continue;
    const pts = Math.min(st.damage, repairRate);
    const cost = { titanium: pts * 40, aluminium: pts * 20 };
    if (canAfford(inst.stock, cost)) {
      pay(inst.stock, cost);
      st.damage = Math.max(0, st.damage - pts);
    } else {
      // Improvised repairs without metal: slow.
      st.damage = Math.max(0, st.damage - 0.5);
    }
  }

  inst.report = { powerGen: gen, powerDemand: demand, deptEff: eff, mined, consumed, lifeSupportOk: ok, daysOfSupplies };

  if (inst.isMoonBase) {
    runResearch(s, inst, eff.research ?? 0);
    runProduction(s, inst, eff.production ?? 0);
  }
}

export function researchRate(inst: Installation, eff: number): number {
  return (1 + inst.equipment.labs) * eff * workforce(inst);
}

function runResearch(s: GameState, inst: Installation, eff: number): void {
  const r = s.research;
  if (!r.current) return;
  const def = RESEARCH_BY_ID[r.current];
  r.progress += researchRate(inst, eff);
  if (r.progress >= def.days) {
    r.done.push(def.id);
    r.current = undefined;
    r.progress = 0;
    msg(s, 'good', `Research complete: ${def.name}`, `Unlocked: ${def.unlocks}.`);
    recoverFragments(s, 'research', def.id);
    if (def.id === 'signalAnalysis') { setFlag(s, 'intel'); msg(s, 'story', STORY.signalAnalysis.title, STORY.signalAnalysis.text); }
    if (def.id === 'mutationStudy') msg(s, 'story', STORY.mutationStudy.title, STORY.mutationStudy.text);
  }
}

/** File any archive documents released by this trigger. Quiet: no message, no pause; the Archive tab shows a badge. */
export function recoverFragments(s: GameState, kind: 'research', id: string): void {
  for (const f of FRAGMENTS) {
    if (f.trigger.kind !== kind || f.trigger.id !== id) continue;
    if (s.archive.some((e) => e.id === f.id)) continue;
    s.archive.push({ id: f.id, day: s.day, opens: 0 });
  }
}

export function productionRate(inst: Installation, eff: number): number {
  return eff * workforce(inst);
}

function runProduction(s: GameState, inst: Installation, eff: number): void {
  let slots = 1 + inst.equipment.factories;
  const work = productionRate(inst, eff);
  const finished: string[] = [];
  for (const item of s.queue) {
    if (slots <= 0) break;
    const bp = BLUEPRINT_BY_ID[item.blueprintId];
    if (!item.started) {
      if (!canAfford(inst.stock, bp.cost)) continue; // waits for materials; later items may proceed
      pay(inst.stock, bp.cost);
      item.started = true;
    }
    slots -= 1;
    item.progress += work;
    if (item.progress >= bp.days) finished.push(item.id);
  }
  for (const id of finished) {
    const idx = s.queue.findIndex((q) => q.id === id);
    const item = s.queue[idx];
    s.queue.splice(idx, 1);
    completeBuild(s, item.blueprintId, item.targetId);
    if (item.repeat) s.queue.push({ ...item, id: `${item.id}r${s.day}`, progress: 0, started: false });
  }
}

export function completeBuild(s: GameState, blueprintId: string, targetId: string): void {
  const bp = BLUEPRINT_BY_ID[blueprintId];
  if (bp.ship) {
    const ship = addShip(s, bp.ship, 'moon');
    s.stats.shipsBuilt += 1;
    msg(s, 'good', `${bp.name} ready`, `${ship.name} is docked on the flight deck.`, ship.id);
    return;
  }
  if (bp.terraformer) {
    s.earth.engines += 1;
    if (s.earth.engines === 1) msg(s, 'story', STORY.terraformStart.title, STORY.terraformStart.text, 'earth');
    else msg(s, 'good', 'Terraforming Engine landed', `${s.earth.engines} engines are now working on Earth.`, 'earth');
    return;
  }
  if (bp.equip) {
    const target = s.installations[targetId];
    if (!target) return;
    if (target.isMoonBase) {
      target.equipment[bp.equip] += 1;
      msg(s, 'info', `${bp.name} installed`, `Installed at Moonbase.`);
    } else {
      s.consignments.push({ id: `cn${s.nextId++}`, blueprintId, installationId: targetId });
      msg(s, 'info', `${bp.name} crated`, `Waiting on the flight deck for the next freighter to ${target.name}.`, targetId);
    }
  }
}
