// Logistics: freighter routes as a shared schedule, what each departure carries out,
// what each return trip brings home, and what Moonbase has committed to the colonies.
//
// Two calculations are kept apart on purpose (Rob, 13 Nov 2026):
//  - Colony survival: what a colony needs to stay supplied until its next viable delivery.
//  - Moonbase demand: what Moonbase needs from that colony.
// The second never takes from the first.

import type { GameState, Installation, MaterialId, Ship, ShipType, Stock } from './types';
import { HAUL_PRIORITY, LS_MATS, MATERIAL_IDS, emptyStock, stockTotal } from './data/materials';
import { BLUEPRINT_BY_ID, SHIP_SPECS } from './data/blueprints';
import { driveSpeed, legDistance, travelDays } from './orbits';
import { lsNeed, miningRates, TERRAFORM_FEED } from './economy';
import { emptyEquipment, emptyReport, moonbase } from './util';

type LsMat = 'oxygen' | 'water' | 'nitrogen';
const LS = LS_MATS as LsMat[];

/** Days of supplies a delivery aims to leave beyond the next scheduled arrival. */
export const SAFETY_DAYS = 30;
/** Days of its own life support Moonbase keeps back from colony loads and (under Surplus only) from the engines. */
export const MOONBASE_RESERVE_DAYS = 60;
/** How far ahead Moonbase demand looks when choosing what a freighter brings home. */
export const DEMAND_HORIZON = 120;

// ---------------------------------------------------------------- capacity and fuel

/** Bulk Freight Holds: every freighter carries more, and burns more hydrogen doing it. */
export const BULK_FREIGHT_CAPACITY = 200000;
export const BULK_FREIGHT_FUEL = 1.5;

const hasBulk = (s: GameState, type: ShipType) => type === 'freighter' && s.research.done.includes('bulkFreight');

/** Cargo capacity of a ship type in kg, after research. */
export function shipCapacity(s: GameState, type: ShipType): number {
  return hasBulk(s, type) ? BULK_FREIGHT_CAPACITY : SHIP_SPECS[type].capacity;
}

/** Hydrogen per AU for a ship type, after research. */
export function fuelPerAU(s: GameState, type: ShipType): number {
  return SHIP_SPECS[type].fuelPerAU * (hasBulk(s, type) ? BULK_FREIGHT_FUEL : 1);
}

// ---------------------------------------------------------------- routes

/** Freighters serving a colony: routed to it, or waiting for a colony ship to land on its body. */
export function routeFreighters(s: GameState, col: { id: string; bodyId: string }): Ship[] {
  return Object.values(s.ships).filter((sh) => sh.type === 'freighter' && (sh.routeTo === col.id || sh.routeBody === col.bodyId));
}

/** One-way days from the Moon to a body, leaving on a given day, at today's drive. */
export function legDays(s: GameState, bodyId: string, day: number, from = 'moon'): number {
  return travelDays(from, bodyId, day, driveSpeed(s.research.done));
}

/** Days for a round trip leaving the Moon on `day`, including a day to turn round at Moonbase. */
export function roundTripDays(s: GameState, bodyId: string, day: number): number {
  const out = legDays(s, bodyId, day);
  return out + legDays(s, 'moon', day + out, bodyId) + 1;
}

/** Days between departures on a route: the round trip shared across its freighters. */
export function routeInterval(s: GameState, bodyId: string, freighters: number, day = s.day): number {
  return Math.max(1, Math.ceil(roundTripDays(s, bodyId, day) / Math.max(1, freighters)));
}

/** The route's next departure slot: the last departure plus the interval for however many freighters it has now. */
export function nextSlot(s: GameState, col: { id: string; bodyId: string }): number {
  const last = s.routes?.[col.id]?.lastDeparture;
  if (last === undefined) return s.day;
  const n = routeFreighters(s, col).length;
  if (n <= 1) return s.day; // a lone freighter goes as soon as it's back
  return Math.max(s.day, last + routeInterval(s, col.bodyId, n, last));
}

/** Earliest departure on or after `from` that arrives no earlier than `notBefore` (a colony ship's landing). */
export function departureToArriveAfter(s: GameState, bodyId: string, from: number, notBefore: number): number {
  for (let d = from; d < from + 2000; d++) if (d + legDays(s, bodyId, d) >= notBefore) return d;
  return from;
}

/** A colony ship on its way to a body, if any. */
export function colonyShipTo(s: GameState, bodyId: string): Ship | undefined {
  return Object.values(s.ships).find((sh) => sh.type === 'colonyShip' && sh.status === 'transit' && sh.transit?.purpose === 'colonise' && sh.transit.to === bodyId);
}

/** A colony as it will be on landing: 50 founders and an empty store. Used to plan a pending route's first load. */
export function foundingColony(s: GameState, bodyId: string, colonists = 50): Installation {
  return {
    id: `pending-${bodyId}`, name: 'Pending colony', bodyId, isMoonBase: false, population: colonists, founders: colonists, commissioning: 0,
    stock: emptyStock(), depts: { lifeSupport: { online: true, damage: 0 }, refinery: { online: true, damage: 0 } },
    equipment: emptyEquipment(),
    foundedDay: s.day, report: emptyReport(), shortageDays: 0,
  };
}

// ---------------------------------------------------------------- colony survival

/** Daily shortfall of each life-support material the colony doesn't make for itself (with a 10% margin). */
export function colonyDeficit(s: GameState, col: Installation): Record<LsMat, number> {
  const need = lsNeed(col);
  const mined = col.report.mined && Object.keys(col.report.mined).length ? col.report.mined : miningRates(s, col, 1);
  const out = { oxygen: 0, water: 0, nitrogen: 0 };
  for (const m of LS) out[m] = Math.max(0, need[m] * 1.1 - (mined[m] ?? 0));
  return out;
}

/** Life-support cargo already on its way to a colony. */
export function inFlightTo(s: GameState, bodyId: string): Stock {
  const out = emptyStock();
  for (const sh of Object.values(s.ships)) {
    if (sh.type !== 'freighter' || sh.status !== 'transit' || sh.transit?.purpose !== 'haulOut' || sh.transit.to !== bodyId) continue;
    for (const id of MATERIAL_IDS) out[id] += sh.cargo[id];
  }
  return out;
}

/**
 * What a departure leaving today should carry to a colony: enough that, on arrival, the colony holds
 * its shortfall for the gap until the following delivery plus a safety margin, counting what's
 * already in its store and already in flight. Not limited by Moonbase's stock or the hold.
 */
export function plannedLoad(s: GameState, col: Installation, arrivalDay: number, interval: number): Record<LsMat, number> {
  const deficit = colonyDeficit(s, col);
  const flying = inFlightTo(s, col.bodyId);
  const out = { oxygen: 0, water: 0, nitrogen: 0 };
  for (const m of LS) {
    if (deficit[m] <= 0) continue;
    const atArrival = Math.max(0, col.stock[m] + flying[m] - deficit[m] * Math.max(0, arrivalDay - s.day));
    out[m] = Math.max(0, deficit[m] * (interval + SAFETY_DAYS) - atArrival);
  }
  return out;
}

/** What a colony keeps back from a homebound freighter: enough of its own life support to last until its next viable delivery. */
export function colonyKeep(col: Installation, interval: number): Record<LsMat, number> {
  const need = lsNeed(col);
  const days = Math.max(60, interval + SAFETY_DAYS * 2);
  return { oxygen: need.oxygen * 1.1 * days, water: need.water * 1.1 * days, nitrogen: need.nitrogen * 1.1 * days };
}

// ---------------------------------------------------------------- Moonbase demand and commitments

/** Cargo on its way to Moonbase. */
export function inboundToMoon(s: GameState): Stock {
  const out = emptyStock();
  for (const sh of Object.values(s.ships)) {
    if (sh.status !== 'transit' || sh.transit?.to !== 'moon') continue;
    for (const id of MATERIAL_IDS) out[id] += sh.cargo[id];
  }
  return out;
}

/** Colonies with freighters and the load each route's next departure is due to carry. */
export function colonyCommitments(s: GameState): { total: Record<LsMat, number>; byColony: Record<string, Record<LsMat, number>> } {
  const total = { oxygen: 0, water: 0, nitrogen: 0 };
  const byColony: Record<string, Record<LsMat, number>> = {};
  for (const col of Object.values(s.installations)) {
    if (col.isMoonBase) continue;
    const n = routeFreighters(s, col).length;
    if (!n) continue;
    const dep = nextSlot(s, col);
    const interval = routeInterval(s, col.bodyId, n, dep);
    const load = plannedLoad(s, col, dep + legDays(s, col.bodyId, dep), interval);
    byColony[col.id] = load;
    for (const m of LS) total[m] += load[m];
  }
  // Freighters waiting for a colony ship: the founding colony's first load.
  const pending = new Set(Object.values(s.ships).filter((sh) => sh.routeBody).map((sh) => sh.routeBody!));
  for (const bodyId of pending) {
    if (s.bodies[bodyId]?.installationId) continue;
    const ship = colonyShipTo(s, bodyId);
    if (!ship) continue;
    const n = Object.values(s.ships).filter((sh) => sh.routeBody === bodyId).length;
    const land = ship.transit!.arriveDay;
    const dep = departureToArriveAfter(s, bodyId, s.day, land + 1);
    const load = plannedLoad(s, foundingColony(s, bodyId, ship.colonists), dep + legDays(s, bodyId, dep), routeInterval(s, bodyId, n, dep));
    byColony[`pending-${bodyId}`] = load;
    for (const m of LS) total[m] += load[m];
  }
  return { total, byColony };
}

/** What Moonbase is holding back from the engines: its own reserve plus the next load for every routed colony. */
export function moonbaseCommitted(s: GameState): Record<LsMat, number> {
  const own = lsNeed(moonbase(s));
  const c = colonyCommitments(s).total;
  return {
    oxygen: own.oxygen * MOONBASE_RESERVE_DAYS + c.oxygen,
    water: own.water * MOONBASE_RESERVE_DAYS + c.water,
    nitrogen: own.nitrogen * MOONBASE_RESERVE_DAYS + c.nitrogen,
  };
}

/**
 * What Moonbase still needs from outside over the demand horizon: its own life support, engine feed,
 * colony supply runs, freighter fuel and the build queue, less what's in stock and already inbound.
 */
export function moonbaseDemand(s: GameState): Partial<Record<MaterialId, number>> {
  const mb = moonbase(s);
  const target: Partial<Record<MaterialId, number>> = {};
  const add = (m: MaterialId, v: number) => { if (v > 0) target[m] = (target[m] ?? 0) + v; };
  const own = lsNeed(mb);
  for (const m of LS) add(m, own[m] * DEMAND_HORIZON);
  const e = s.earth;
  if (e.engines > 0 && e.progress < 100) for (const [m, v] of Object.entries(TERRAFORM_FEED)) add(m as MaterialId, v * e.engines * DEMAND_HORIZON);
  for (const col of Object.values(s.installations)) {
    if (col.isMoonBase) continue;
    const n = routeFreighters(s, col).length;
    if (!n) continue;
    const d = colonyDeficit(s, col);
    for (const m of LS) add(m, d[m] * DEMAND_HORIZON);
    const fuel = legDistance('moon', col.bodyId, s.day) * fuelPerAU(s, 'freighter') * 2;
    add('hydrogen', (fuel * n * DEMAND_HORIZON) / Math.max(1, roundTripDays(s, col.bodyId, s.day)));
  }
  for (const q of s.queue) {
    if (q.started) continue;
    for (const [m, v] of Object.entries(BLUEPRINT_BY_ID[q.blueprintId].cost)) add(m as MaterialId, v ?? 0);
  }
  const inbound = inboundToMoon(s);
  const out: Partial<Record<MaterialId, number>> = {};
  for (const [m, v] of Object.entries(target)) {
    const left = (v ?? 0) - mb.stock[m as MaterialId] - inbound[m as MaterialId];
    if (left > 0) out[m as MaterialId] = left;
  }
  return out;
}

/**
 * The order a homebound freighter fills its hold: the route's preferred material first if Moonbase
 * still needs it, then whatever Moonbase is shortest of, then the most valuable of the rest.
 * Returns how much of each to take (respecting the colony's keep and the hold).
 */
export function homeboundLoad(s: GameState, col: Installation, capacity: number, interval: number): Partial<Record<MaterialId, number>> {
  const keep = colonyKeep(col, interval);
  const available = (m: MaterialId) => Math.max(0, col.stock[m] - ((LS as MaterialId[]).includes(m) ? keep[m as LsMat] : 0));
  const demand = moonbaseDemand(s);
  const mb = moonbase(s);
  const urgency = (m: MaterialId) => (demand[m] ?? 0) / Math.max(1, (demand[m] ?? 0) + mb.stock[m]);
  const wanted = (Object.keys(demand) as MaterialId[]).filter((m) => available(m) > 0).sort((a, b) => urgency(b) - urgency(a));
  const prefer = s.routes?.[col.id]?.prefer;
  if (prefer && wanted.includes(prefer)) { wanted.splice(wanted.indexOf(prefer), 1); wanted.unshift(prefer); }
  const out: Partial<Record<MaterialId, number>> = {};
  let room = capacity;
  const take = (m: MaterialId, max: number) => {
    const amt = Math.max(0, Math.min(max - (out[m] ?? 0), available(m) - (out[m] ?? 0), room));
    if (amt > 0) { out[m] = (out[m] ?? 0) + amt; room -= amt; }
  };
  for (const m of wanted) take(m, demand[m] ?? 0);
  // Room left: bring home what's most valuable, as before. A preference never forces cargo Moonbase doesn't need.
  for (const m of HAUL_PRIORITY) { if (room <= 0) break; take(m, Infinity); }
  return out;
}

// ---------------------------------------------------------------- forecast for the player

export interface RouteArrival { shipId: string; shipName: string; arriveDay: number; carrying: boolean }
export interface SupplyLine { mat: LsMat; perDay: number; stock: number; inFlight: number; runsOutDay: number | null }
export interface SupplyForecast {
  freighters: number;
  pending: boolean;
  roundTrip: number;
  interval: number;
  nextDeparture: number | null;
  arrivals: RouteArrival[];
  lines: SupplyLine[];
  /** first life-support material to run out before a delivery can arrive, if any */
  gap: { mat: LsMat; runsOutDay: number; nextArrival: number | null } | null;
  /** tonnes a day the colony mines, and how much its freighters can bring home */
  producedPerDay: number;
  homePerDay: number;
}

/** Next arrival at the colony for each freighter on its route, using projected planetary positions. */
function arrivalsFor(s: GameState, col: Installation, ships: Ship[], interval: number): RouteArrival[] {
  const out: RouteArrival[] = [];
  let slot = nextSlot(s, col);
  const queue: { ship: Ship; ready: number }[] = [];
  for (const sh of ships) {
    if (sh.status === 'transit' && sh.transit?.purpose === 'haulOut' && sh.transit.to === col.bodyId) {
      out.push({ shipId: sh.id, shipName: sh.name, arriveDay: sh.transit.arriveDay, carrying: true });
    } else {
      const ready = sh.status === 'transit' && sh.transit ? sh.transit.arriveDay + 1 : sh.status === 'docked' && sh.at === 'moon' ? s.day : s.day + 3;
      queue.push({ ship: sh, ready });
    }
  }
  queue.sort((a, b) => a.ready - b.ready);
  for (const q of queue) {
    const dep = Math.max(slot, q.ready);
    out.push({ shipId: q.ship.id, shipName: q.ship.name, arriveDay: dep + legDays(s, col.bodyId, dep), carrying: false });
    slot = dep + interval;
  }
  return out.sort((a, b) => a.arriveDay - b.arriveDay);
}

export function supplyForecast(s: GameState, col: Installation): SupplyForecast {
  const ships = routeFreighters(s, col);
  const n = ships.length;
  const roundTrip = roundTripDays(s, col.bodyId, s.day);
  const interval = routeInterval(s, col.bodyId, n);
  const deficit = colonyDeficit(s, col);
  const flying = inFlightTo(s, col.bodyId);
  const arrivals = n ? arrivalsFor(s, col, ships, interval) : [];
  const lines: SupplyLine[] = LS.map((m) => ({
    mat: m,
    perDay: deficit[m],
    stock: col.stock[m],
    inFlight: flying[m],
    runsOutDay: deficit[m] > 0 ? s.day + Math.floor(col.stock[m] / deficit[m]) : null,
  }));
  // A gap: the store runs out before the next arrival that can bring more (cargo in flight counts at its arrival).
  let gap: SupplyForecast['gap'] = null;
  for (const l of lines) {
    if (l.runsOutDay === null) continue;
    const next = arrivals[0]?.arriveDay ?? null;
    if (next === null || l.runsOutDay < next) {
      if (!gap || l.runsOutDay < gap.runsOutDay) gap = { mat: l.mat, runsOutDay: l.runsOutDay, nextArrival: next };
    }
  }
  const mined = col.report.mined && Object.keys(col.report.mined).length ? col.report.mined : miningRates(s, col, 1);
  return {
    freighters: n,
    pending: false,
    roundTrip,
    interval,
    nextDeparture: n ? nextSlot(s, col) : null,
    arrivals,
    lines,
    gap,
    producedPerDay: stockTotal(Object.assign(emptyStock(), mined)) / 1000,
    homePerDay: (n * shipCapacity(s, 'freighter')) / roundTrip / 1000,
  };
}
