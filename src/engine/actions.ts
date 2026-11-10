// Player commands. Each takes the current state and returns a new state, or an error string.
import type { GrowthPolicy, DeptId, GameState, Ship } from './types';
import { BLUEPRINT_BY_ID } from './data/blueprints';
import { RESEARCH_BY_ID } from './data/research';
import { pay, stockFrom } from './data/materials';
import { BODY_BY_ID } from './data/bodies';
import { colonyRequirementMet, launch, startLoop, returnHome } from './fleet';
import { equipCount, missionsFor, researchStatus } from './selectors';
import { clone, moonbase, msg, newId, setFlag } from './util';
import { STORY } from './data/lore';

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };

const ok = (state: GameState): ActionResult => ({ ok: true, state });
const fail = (error: string): ActionResult => ({ ok: false, error });

export function toggleDept(prev: GameState, instId: string, dept: DeptId): ActionResult {
  const s = clone(prev);
  const d = s.installations[instId]?.depts[dept];
  if (!d) return fail('No such department');
  if (dept === 'lifeSupport' && d.online) return fail('Switching off life support would kill everyone.');
  d.online = !d.online;
  return ok(s);
}

/**
 * Switch Moonbase's comms watch on or off. The first attempt to switch it off draws one objection
 * from the deputy commander and changes nothing; asking again switches it off.
 */
export function toggleCommsWatch(prev: GameState): ActionResult {
  const s = clone(prev);
  const mb = moonbase(s);
  if (!mb.commsWatch) {
    mb.commsWatch = true;
    return ok(s);
  }
  if (setFlag(s, 'commsObjection')) {
    msg(s, 'story', STORY.commsObjection.title, STORY.commsObjection.text);
    return ok(s);
  }
  mb.commsWatch = false;
  msg(s, 'info', STORY.commsOff.title, STORY.commsOff.text);
  return ok(s);
}

/** Set an installation's population policy. */
export function setGrowthPolicy(prev: GameState, instId: string, policy: GrowthPolicy): ActionResult {
  const s = clone(prev);
  const inst = s.installations[instId];
  if (!inst) return fail('No such installation');
  inst.growth = policy;
  return ok(s);
}

/** Open an archive document. Records when, and whether it interrupted a running clock. */
export function readFragment(prev: GameState, id: string, clockRunning = false): ActionResult {
  const s = clone(prev);
  const e = s.archive.find((x) => x.id === id);
  if (!e) return fail('Not in the archive');
  e.opens += 1;
  if (e.firstReadDay === undefined) {
    e.firstReadDay = s.day;
    e.firstReadWhileRunning = clockRunning;
  }
  return ok(s);
}

export function setResearch(prev: GameState, id: string | undefined): ActionResult {
  const s = clone(prev);
  if (!id) { s.research.current = undefined; return ok(s); }
  const def = RESEARCH_BY_ID[id];
  if (!def) return fail('Unknown project');
  const st = researchStatus(s, def);
  if (st === 'done') return fail('Already researched');
  if (st !== 'available' && st !== 'current') return fail('Prerequisites not met');
  if (s.research.current !== id) {
    // Switching keeps half the progress as "general research" — discourages thrashing without punishing hard.
    s.research.progress = s.research.current ? s.research.progress * 0.5 : s.research.progress;
    s.research.current = id;
    if (s.research.progress >= def.days) s.research.progress = def.days - 1;
  }
  return ok(s);
}

export function queueBuild(prev: GameState, blueprintId: string, targetId = 'moonbase', repeat = false): ActionResult {
  const s = clone(prev);
  const bp = BLUEPRINT_BY_ID[blueprintId];
  if (!bp) return fail('Unknown blueprint');
  if (bp.requires && !s.research.done.includes(bp.requires)) return fail('Not yet researched');
  if (bp.terraformer) targetId = 'earth';
  else if (bp.equip) {
    const inst = s.installations[targetId];
    if (!inst) return fail('No such installation');
    if (bp.install === 'moon' && !inst.isMoonBase) return fail('Moonbase only');
    if (bp.max && equipCount(s, bp, inst) >= bp.max) return fail(`Maximum ${bp.max} at ${inst.name}`);
  } else targetId = 'moonbase';
  if (s.queue.length >= 12) return fail('Production queue is full (12)');
  s.queue.push({ id: newId(s, 'q'), blueprintId, targetId, progress: 0, started: false, repeat });
  return ok(s);
}

export function cancelBuild(prev: GameState, itemId: string): ActionResult {
  const s = clone(prev);
  const i = s.queue.findIndex((q) => q.id === itemId);
  if (i < 0) return fail('Not in queue');
  const item = s.queue[i];
  if (item.started) {
    // Refund 75% of materials.
    const bp = BLUEPRINT_BY_ID[item.blueprintId];
    const refund = Object.fromEntries(Object.entries(bp.cost).map(([k, v]) => [k, -Math.floor((v ?? 0) * 0.75)]));
    pay(moonbase(s).stock, refund);
  }
  s.queue.splice(i, 1);
  return ok(s);
}

export function moveBuild(prev: GameState, itemId: string, dir: -1 | 1): ActionResult {
  const s = clone(prev);
  const i = s.queue.findIndex((q) => q.id === itemId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= s.queue.length) return ok(prev);
  [s.queue[i], s.queue[j]] = [s.queue[j], s.queue[i]];
  return ok(s);
}

export function toggleRepeat(prev: GameState, itemId: string): ActionResult {
  const s = clone(prev);
  const item = s.queue.find((q) => q.id === itemId);
  if (!item) return fail('Not in queue');
  item.repeat = !item.repeat;
  return ok(s);
}

function dockedShip(s: GameState, shipId: string): Ship | string {
  const ship = s.ships[shipId];
  if (!ship) return 'No such ship';
  if (ship.status !== 'docked' || ship.at !== 'moon') return `${ship.name} is not on the Moonbase flight deck`;
  const fd = moonbase(s).depts.flightDeck!;
  if (!fd.online) return 'The flight deck is offline';
  if (fd.damage >= 90) return 'The flight deck is too badly damaged to launch';
  return ship;
}

/** Send a probe, survey ship, colony ship, miner, scoop or hospital ship to a body. */
export function sendShip(prev: GameState, shipId: string, bodyId: string): ActionResult {
  const s = clone(prev);
  const ship = dockedShip(s, shipId);
  if (typeof ship === 'string') return fail(ship);
  const opt = missionsFor(s, ship).find((o) => o.bodyId === bodyId);
  if (!opt) return fail(`${ship.name} can't go to ${BODY_BY_ID[bodyId]?.name ?? bodyId}`);
  if (!opt.ok) return fail(opt.reason ?? 'Not possible');
  const mb = moonbase(s);
  switch (ship.type) {
    case 'probe':
      if (!launch(s, ship, bodyId, 'probe')) return fail('Not enough hydrogen fuel');
      break;
    case 'surveyor':
      if (!launch(s, ship, bodyId, 'survey')) return fail('Not enough hydrogen fuel');
      break;
    case 'colonyShip': {
      const req = colonyRequirementMet(s, bodyId);
      if (!req.ok) return fail(req.reason!);
      if (!launch(s, ship, bodyId, 'colonise')) return fail('Not enough hydrogen fuel');
      ship.colonists = 50;
      mb.population -= 50;
      const supplies = stockFrom({ oxygen: 4000, water: 12000, nitrogen: 1000 });
      for (const [k, v] of Object.entries(supplies)) {
        const take = Math.min(v, Math.max(0, mb.stock[k as 'water'] - 2000));
        mb.stock[k as 'water'] -= take;
        ship.cargo[k as 'water'] += take;
      }
      break;
    }
    case 'miner':
    case 'gasScoop': {
      ship.routeTo = bodyId;
      ship.autoLoop = true;
      const err = startLoop(s, ship);
      if (err) { ship.routeTo = undefined; return fail(err); }
      break;
    }
    case 'hospitalShip':
      if (!launch(s, ship, 'mars', 'accord')) return fail('Not enough hydrogen fuel');
      break;
    default:
      return fail('Use the dedicated controls for this ship');
  }
  return ok(s);
}

/** Assign a freighter to a colony; it loops automatically. */
export function setFreighterRoute(prev: GameState, shipId: string, colonyId: string | undefined): ActionResult {
  const s = clone(prev);
  const ship = s.ships[shipId];
  if (!ship || ship.type !== 'freighter') return fail('Not a freighter');
  if (!colonyId) { ship.routeTo = undefined; ship.autoLoop = false; return ok(s); }
  if (!s.installations[colonyId] || s.installations[colonyId].isMoonBase) return fail('Choose a colony');
  ship.routeTo = colonyId;
  ship.autoLoop = true;
  if (ship.status === 'docked' && ship.at === 'moon') {
    const fd = moonbase(s).depts.flightDeck!;
    if (!fd.online) return fail('The flight deck is offline');
    const err = startLoop(s, ship);
    if (err) return fail(err);
  }
  return ok(s);
}

/** Stop a looping ship after its current leg (miners/scoops return immediately if working). */
export function recallShip(prev: GameState, shipId: string): ActionResult {
  const s = clone(prev);
  const ship = s.ships[shipId];
  if (!ship) return fail('No such ship');
  ship.autoLoop = false;
  ship.routeTo = undefined;
  if (ship.status === 'working' && (ship.type === 'miner' || ship.type === 'gasScoop' || ship.type === 'surveyor')) returnHome(s, ship);
  return ok(s);
}

/** Launch every docked battlecruiser and troopship at Mars together. */
export function launchAssault(prev: GameState): ActionResult {
  const s = clone(prev);
  if (s.threat.status !== 'hostile') return fail('There is no one left to fight');
  const fleet = Object.values(s.ships).filter((sh) => (sh.type === 'battlecruiser' || sh.type === 'troopship') && sh.status === 'docked' && sh.at === 'moon');
  if (!fleet.some((f) => f.type === 'battlecruiser')) return fail('You need at least one battlecruiser docked at Moonbase');
  const fd = moonbase(s).depts.flightDeck!;
  if (!fd.online) return fail('The flight deck is offline');
  const troops = fleet.filter((f) => f.type === 'troopship').length;
  if (troops && moonbase(s).population < 50 * troops + 50) return fail('Moonbase cannot spare 50 troops per troopship');
  const fleetId = newId(s, 'fleet');
  // Fly together at the speed of the fleet: compute once, apply to all.
  for (const sh of fleet) {
    if (!launch(s, sh, 'mars', 'assault')) return fail('Not enough hydrogen to launch the whole fleet');
    sh.fleetId = fleetId;
    if (sh.type === 'troopship') { sh.colonists = 50; moonbase(s).population -= 50; }
  }
  return ok(s);
}

export function renameInstallation(prev: GameState, instId: string, name: string): ActionResult {
  const s = clone(prev);
  const inst = s.installations[instId];
  if (!inst) return fail('No such installation');
  inst.name = name.trim().slice(0, 28) || inst.name;
  return ok(s);
}

export function markRead(prev: GameState): GameState {
  if (prev.unread === 0) return prev;
  return { ...prev, unread: 0 };
}
