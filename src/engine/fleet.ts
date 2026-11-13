import type { GameState, Installation, MaterialId, Purpose, Ship } from './types';
import { BODY_BY_ID, MOONS_OF } from './data/bodies';
import { LS_MATS, MATERIAL_IDS, emptyStock, stockTotal } from './data/materials';
import { BLUEPRINT_BY_ID } from './data/blueprints';
import { STORY } from './data/lore';
import { driveSpeed, legDistance, travelDays } from './orbits';
import { COMMISSION_PER_DAY, COMMISSION_PER_DELIVERY, commissioningOf, lsNeed, solarPerArray } from './economy';
import {
  MOONBASE_RESERVE_DAYS, colonyShipTo, departureToArriveAfter, foundingColony, fuelPerAU, homeboundLoad, legDays,
  nextSlot, plannedLoad, routeFreighters, routeInterval, shipCapacity,
} from './logistics';
import { makeInstallation, moonbase, msg, setFlag } from './util';
import { chance, rand } from './rng';

export const SURVEY_DAYS = 8;
export const MINING_RATE = 2500; // kg/day for miners & scoops

/** Does a loop (there and back) for this purpose get paid up front? */
const ROUND_TRIP: Purpose[] = ['survey', 'mine', 'haulOut', 'assault', 'accord'];

export function fuelFor(s: GameState, ship: Ship, to: string, purpose: Purpose): number {
  const d = legDistance(ship.at, to, s.day);
  return Math.ceil(d * fuelPerAU(s, ship.type) * (ROUND_TRIP.includes(purpose) ? 2 : 1));
}

/** Low-level launch. Pays fuel only when departing Moonbase. Returns false if fuel is short. */
export function launch(s: GameState, ship: Ship, to: string, purpose: Purpose): boolean {
  if (ship.at === 'moon') {
    const fuel = fuelFor(s, ship, to, purpose);
    const mb = moonbase(s);
    if (mb.stock.hydrogen < fuel) return false;
    mb.stock.hydrogen -= fuel;
  }
  const days = travelDays(ship.at, to, s.day, driveSpeed(s.research.done));
  ship.transit = { from: ship.at, to, departDay: s.day, arriveDay: s.day + days, purpose };
  ship.status = 'transit';
  return true;
}

export function returnHome(s: GameState, ship: Ship): void {
  launch(s, ship, 'moon', ship.type === 'freighter' ? 'haulBack' : 'return');
}

function revealBody(s: GameState, bodyId: string): void {
  const b = s.bodies[bodyId];
  if (b.knowledge < 1) b.knowledge = 1;
  for (const m of MOONS_OF(bodyId)) if (s.bodies[m.id].knowledge < 1) s.bodies[m.id].knowledge = 1;
  const def = BODY_BY_ID[bodyId];
  if (def.parent && s.bodies[def.parent].knowledge < 1) s.bodies[def.parent].knowledge = 1;
}

export function colonyRequirementMet(s: GameState, bodyId: string): { ok: boolean; reason?: string } {
  const def = BODY_BY_ID[bodyId];
  if (def.colony === 'never') return { ok: false, reason: def.mineable === 'miner' ? 'Too small — use asteroid miners' : 'Cannot be colonised' };
  if (def.colony === 'special') return { ok: false, reason: bodyId === 'earth' ? 'Must be terraformed first' : 'Held by the enemy' };
  if (!s.research.done.includes('colonyPods')) return { ok: false, reason: 'Research Colony Pod Systems' };
  if (def.colony !== 'none' && !s.research.done.includes(def.colony)) {
    const names: Record<string, string> = { thermalShielding: 'Thermal Shielding', aerostats: 'Aerostat Habitats', radiationHardening: 'Radiation Hardening', cryoHabitats: 'Cryogenic Habitats' };
    return { ok: false, reason: `Research ${names[def.colony]}` };
  }
  if (s.bodies[bodyId].installationId) return { ok: false, reason: 'Already colonised' };
  return { ok: true };
}

/** Load a freighter at Moonbase for its colony: crated equipment + life-support top-up. */
export function loadOutbound(s: GameState, ship: Ship, col: Installation, arrivalDay: number, interval: number): void {
  const mb = moonbase(s);
  const mine = s.consignments.filter((c) => c.installationId === col.id);
  ship.consignments.push(...mine);
  s.consignments = s.consignments.filter((c) => c.installationId !== col.id);
  const cap = shipCapacity(s, 'freighter');
  const mbNeed = lsNeed(mb);
  // Sized to last the colony until the delivery after this one, counting its store and cargo already in flight.
  const plan = plannedLoad(s, col, arrivalDay, interval);
  for (const m of LS_MATS) {
    const k = m as 'oxygen' | 'water' | 'nitrogen';
    const spare = mb.stock[m] - mbNeed[k] * MOONBASE_RESERVE_DAYS;
    const room = cap - stockTotal(ship.cargo);
    const amt = Math.max(0, Math.min(plan[k], spare, room));
    if (amt > 0) { mb.stock[m] -= amt; ship.cargo[m] += amt; }
  }
}

/** At a colony: unload, then fill the hold with ore (keeping the colony's life-support reserve). */
function exchangeAtColony(s: GameState, ship: Ship, col: Installation): void {
  for (const id of MATERIAL_IDS) { col.stock[id] += ship.cargo[id]; }
  const c = commissioningOf(col);
  if (c < 1) {
    col.commissioning = Math.min(1, c + COMMISSION_PER_DELIVERY);
    msg(s, 'good', col.commissioning >= 1 ? `${col.name} fully commissioned` : `${col.name}: commissioning ${Math.round(col.commissioning * 100)}%`,
      col.commissioning >= 1 ? `${ship.name}'s delivery finished the job: full ore output, and the population can grow.`
        : `${ship.name}'s delivery brought the colony from ${Math.round(c * 100)}% to ${Math.round(col.commissioning * 100)}% commissioned.`, col.id);
  }
  ship.cargo = emptyStock();
  for (const c of ship.consignments) {
    const bp = BLUEPRINT_BY_ID[c.blueprintId];
    if (bp.equip) col.equipment[bp.equip] += 1;
    msg(s, 'good', `${bp.name} delivered`, `${ship.name} installed a ${bp.name} at ${col.name}.`, col.id);
  }
  ship.consignments = [];
  // Homebound: what Moonbase is short of first, never what the colony needs to last until its next delivery.
  const interval = routeInterval(s, col.bodyId, routeFreighters(s, col).length);
  const load = homeboundLoad(s, col, shipCapacity(s, 'freighter'), interval);
  for (const [m, amt] of Object.entries(load)) {
    if (!amt) continue;
    col.stock[m as MaterialId] -= amt;
    ship.cargo[m as MaterialId] += amt;
  }
}

function unloadAtMoon(s: GameState, ship: Ship): void {
  const mb = moonbase(s);
  for (const id of MATERIAL_IDS) mb.stock[id] += ship.cargo[id];
  ship.cargo = emptyStock();
  if (ship.colonists > 0) { mb.population += ship.colonists; ship.colonists = 0; }
  // Undelivered crates go back into the depot.
  if (ship.consignments.length) { s.consignments.push(...ship.consignments); ship.consignments = []; }
}

function destroyShip(s: GameState, ship: Ship): void {
  delete s.ships[ship.id];
}

/** Process arrivals and on-site work for every ship. */
export function runFleet(s: GameState): void {
  for (const ship of Object.values(s.ships)) {
    if (ship.status === 'transit' && ship.transit && ship.transit.arriveDay <= s.day) {
      const t = ship.transit;
      ship.at = t.to;
      ship.status = 'docked';
      ship.transit = undefined;
      arrive(s, ship, t.purpose);
    } else if (ship.status === 'working') {
      work(s, ship);
    }
  }
  dispatchLoops(s);
}

function arrive(s: GameState, ship: Ship, purpose: Purpose): void {
  const body = BODY_BY_ID[ship.at];
  switch (purpose) {
    case 'probe': {
      if (ship.at === 'mars') {
        s.bodies.mars.knowledge = 1;
        revealBody(s, 'mars');
        setFlag(s, 'marsProbed');
        msg(s, 'story', STORY.marsProbe.title, STORY.marsProbe.text, 'mars');
      } else if (ship.at === 'earth') {
        s.earth.probed = true;
        setFlag(s, 'earthProbed');
        msg(s, 'story', STORY.earthProbe.title, STORY.earthProbe.text, 'earth');
      } else {
        revealBody(s, ship.at);
        const moons = MOONS_OF(ship.at).length;
        msg(s, 'good', `Probe report: ${body.name}`, `${ship.name} has mapped ${body.name}${moons ? ` and its ${moons} major moon${moons > 1 ? 's' : ''}` : ''}. Resource estimates are now available.`, ship.at);
      }
      destroyShip(s, ship);
      return;
    }
    case 'survey': {
      ship.status = 'working';
      ship.workDaysLeft = SURVEY_DAYS;
      return;
    }
    case 'colonise': {
      const check = colonyRequirementMet(s, ship.at);
      if (!check.ok) {
        msg(s, 'warn', 'Colony landing aborted', `${ship.name} could not land on ${body.name}: ${check.reason}. Returning to Moonbase.`, ship.at);
        returnHome(s, ship);
        return;
      }
      const col = makeInstallation(s, ship.at, false, ship.colonists);
      col.founders = ship.colonists;
      col.commissioning = 0;
      // Colony pods carry ~6 MW of generation: solar in the inner system, a compact reactor further out.
      const perArray = solarPerArray(s, col);
      if (perArray < 0.2) { col.equipment.reactor = 1; col.equipment.solar = 2; }
      else col.equipment.solar = Math.min(24, Math.ceil(6 / perArray));
      for (const id of MATERIAL_IDS) col.stock[id] += ship.cargo[id];
      if (s.bodies[ship.at].knowledge < 2) s.bodies[ship.at].knowledge = 2;
      const waiting = Object.values(s.ships).filter((sh) => sh.routeBody === ship.at);
      for (const sh of waiting) { sh.routeTo = col.id; sh.routeBody = undefined; }
      const supply = waiting.length
        ? ` ${waiting.length === 1 ? `${waiting[0].name} is` : `${waiting.length} freighters are`} already assigned to keep it supplied.`
        : ' Assign a freighter to keep it supplied and bring its ore home.';
      msg(s, 'good', `${col.name} founded`, `${ship.colonists} colonists have landed on ${body.name}. The founding party is sheltered from shortages and raids. The colony will get itself running slowly on its own (about ${Math.ceil(1 / COMMISSION_PER_DAY)} days); each freighter delivery speeds that up.${supply}`, col.id);
      destroyShip(s, ship);
      return;
    }
    case 'mine': {
      ship.status = 'working';
      if (s.bodies[ship.at].knowledge < 1) revealBody(s, ship.at);
      return;
    }
    case 'haulOut': {
      const instId = s.bodies[ship.at].installationId;
      const col = instId ? s.installations[instId] : undefined;
      if (col) exchangeAtColony(s, ship, col);
      else {
        ship.routeBody = undefined;
        msg(s, 'warn', `${ship.name}: no colony`, `There is no colony on ${body.name}. Returning with cargo.`);
      }
      returnHome(s, ship);
      return;
    }
    case 'haulBack':
    case 'return': {
      unloadAtMoon(s, ship);
      return;
    }
    case 'assault':
    case 'accord':
      // Resolved by threat module (needs the whole fleet together).
      ship.status = 'working';
      return;
  }
}

function work(s: GameState, ship: Ship): void {
  if (ship.type === 'surveyor') {
    ship.workDaysLeft -= 1;
    if (ship.workDaysLeft <= 0) {
      const b = s.bodies[ship.at];
      b.knowledge = 2;
      const def = BODY_BY_ID[ship.at];
      const c = colonyRequirementMet(s, ship.at);
      const site = def.colony === 'never' || def.colony === 'special'
        ? 'No colony site is possible here.'
        : c.ok ? 'A suitable landing site has been found — ready for a colony ship.' : `A landing site has been found, but: ${c.reason}.`;
      msg(s, 'good', `Survey complete: ${def.name}`, `Detailed resource data is now available. ${site}`, ship.at);
      returnHome(s, ship);
    }
    return;
  }
  if (ship.type === 'miner' || ship.type === 'gasScoop') {
    const comp = s.bodies[ship.at].composition;
    const total = Object.values(comp).reduce((a, b) => a + (b ?? 0), 0) || 1;
    const room = shipCapacity(s, ship.type) - stockTotal(ship.cargo);
    const amount = Math.min(room, MINING_RATE * (0.9 + rand(s) * 0.2));
    for (const [k, v] of Object.entries(comp)) ship.cargo[k as MaterialId] += (amount * (v ?? 0)) / total;
    s.stats.kgMined += amount;
    if (ship.type === 'miner' && chance(s, 0.003)) {
      ship.cargo.platinum += 1500;
      ship.cargo.copper += 2500;
      msg(s, 'good', 'Derelict found', `${ship.name} found a pre-impact mining drone in a stable orbit and stripped it: +1,500 kg platinum, +2,500 kg copper.`, ship.id);
    }
    if (stockTotal(ship.cargo) >= shipCapacity(s, ship.type) - 1) returnHome(s, ship);
  }
}

/** Ships docked at Moonbase with a standing route launch again automatically. */
function dispatchLoops(s: GameState): void {
  for (const ship of Object.values(s.ships)) {
    if (ship.status !== 'docked' || ship.at !== 'moon' || !(ship.routeTo || ship.routeBody) || !ship.autoLoop) continue;
    startLoop(s, ship, true);
  }
}

/** Start one leg of a standing route. Returns an error string or null. */
export function startLoop(s: GameState, ship: Ship, quiet = false): string | null {
  if (!ship.routeTo && !ship.routeBody) return 'No route set';
  if (ship.type === 'freighter') return startFreighterLeg(s, ship, quiet);
  if (ship.type === 'miner' || ship.type === 'gasScoop') {
    if (!ship.routeTo || !launch(s, ship, ship.routeTo, 'mine')) {
      if (quiet) noteFuel(s, ship);
      return 'Not enough hydrogen fuel';
    }
    return null;
  }
  return 'This ship cannot run routes';
}

/**
 * Freighters on one route share a schedule: a docked freighter leaves when the route's next slot comes up,
 * and slots are spaced by the round trip divided among the route's freighters. A freighter assigned to a
 * colony ship's destination leaves so as to arrive just after the landing.
 */
function startFreighterLeg(s: GameState, ship: Ship, quiet: boolean): string | null {
  // Waiting for a colony ship?
  if (ship.routeBody) {
    const bodyId = ship.routeBody;
    const landed = s.bodies[bodyId]?.installationId;
    if (landed) { ship.routeTo = landed; ship.routeBody = undefined; }
    else {
      const colonyShip = colonyShipTo(s, bodyId);
      if (!colonyShip) {
        ship.routeBody = undefined; ship.autoLoop = false;
        msg(s, 'warn', `${ship.name}: route cancelled`, `No colony ship is heading for ${BODY_BY_ID[bodyId].name} any more.`, ship.id);
        return 'No colony ship is on its way there';
      }
      const land = colonyShip.transit!.arriveDay;
      const n = Object.values(s.ships).filter((sh) => sh.routeBody === bodyId).length;
      const dep = departureToArriveAfter(s, bodyId, s.day, land + 1);
      if (dep > s.day) return null; // waiting for the right moment
      const interval = routeInterval(s, bodyId, n);
      return loadAndLaunch(s, ship, foundingColony(s, bodyId, colonyShip.colonists), s.day + legDays(s, bodyId, s.day), interval, quiet);
    }
  }
  const col = s.installations[ship.routeTo!];
  if (!col) { ship.routeTo = undefined; return 'Colony no longer exists'; }
  s.routes ??= {};
  const route = (s.routes[col.id] ??= {});
  if (nextSlot(s, col) > s.day) return null; // another freighter on this route left recently
  const interval = routeInterval(s, col.bodyId, routeFreighters(s, col).length);
  const err = loadAndLaunch(s, ship, col, s.day + legDays(s, col.bodyId, s.day), interval, quiet);
  if (!err) route.lastDeparture = s.day;
  return err;
}

function loadAndLaunch(s: GameState, ship: Ship, col: Installation, arrivalDay: number, interval: number, quiet: boolean): string | null {
  loadOutbound(s, ship, col, arrivalDay, interval);
  if (!launch(s, ship, col.bodyId, 'haulOut')) {
    unloadAtMoon(s, ship); // put the supplies back
    if (quiet) noteFuel(s, ship);
    return 'Not enough hydrogen fuel';
  }
  return null;
}

function noteFuel(s: GameState, ship: Ship) {
  const key = `fuel-${ship.id}`;
  if (!s.flags.includes(key)) {
    s.flags.push(key);
    msg(s, 'warn', 'Ships grounded: no fuel', `${ship.name} is waiting for hydrogen. Increase refinery output or bring in hydrogen.`, ship.id);
  }
}

export function clearFuelNotes(s: GameState): void {
  if (moonbase(s).stock.hydrogen > 5000) s.flags = s.flags.filter((f) => !f.startsWith('fuel-'));
}
