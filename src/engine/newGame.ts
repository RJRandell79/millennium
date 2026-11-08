import type { BodyState, Cost, GameSettings, GameState, MaterialId, Ship, ShipType } from './types';
import { BODIES, FIXED_BODIES } from './data/bodies';
import { emptyStock } from './data/materials';
import { SHIP_NAMES } from './data/blueprints';
import { STORY } from './data/lore';
import { clone, makeInstallation, msg, newId } from './util';
import { runInstallation } from './economy';
import { rand } from './rng';

export const SAVE_VERSION = 1;

export const DIFFICULTY = {
  relaxed: { firstRaid: 140, raidScale: 0.7, interval: 1.3 },
  standard: { firstRaid: 100, raidScale: 1, interval: 1 },
  hard: { firstRaid: 70, raidScale: 1.35, interval: 0.8 },
} as const;

export function newGame(seed = Date.now() % 2147483647, settings: Partial<GameSettings> = {}): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: seed | 0,
    day: 0,
    nextId: 0,
    nextMsg: 0,
    settings: { varied: true, difficulty: 'standard', ...settings },
    bodies: {},
    installations: {},
    ships: {},
    queue: [],
    consignments: [],
    research: { progress: 0, done: [] },
    threat: { status: 'hostile', wave: 0, nextLaunchDay: 0, raids: [], salvage: 0, marsDefence: 30 },
    earth: { engines: 0, progress: 0, probed: false },
    modifiers: [],
    flags: [],
    messages: [],
    unread: 0,
    stats: { raidsRepelled: 0, shipsBuilt: 0, kgMined: 0, peakPopulation: 100, named: {} },
  };
  s.threat.nextLaunchDay = DIFFICULTY[s.settings.difficulty].firstRaid;

  for (const b of BODIES) {
    const comp: Cost = { ...b.composition };
    if (s.settings.varied && !FIXED_BODIES.has(b.id) && b.mineable !== 'none') {
      // Shuffle the deck a little each game: ±40% on each deposit, occasionally a surprise trace.
      for (const k of Object.keys(comp) as MaterialId[]) {
        comp[k] = Math.round((comp[k]! * (0.6 + rand(s) * 0.8)) * 10) / 10;
      }
      if (b.mineable === 'colony' && rand(s) < 0.25) {
        const bonus: MaterialId[] = ['copper', 'platinum', 'titanium', 'aluminium', 'iron'];
        const k = bonus[Math.floor(rand(s) * bonus.length)];
        comp[k] = Math.round(((comp[k] ?? 0) + 1 + rand(s) * 2) * 10) / 10;
      }
    }
    const st: BodyState = { id: b.id, knowledge: 0, composition: comp };
    s.bodies[b.id] = st;
  }
  // We know our own neighbourhood.
  s.bodies.moon.knowledge = 2;
  s.bodies.earth.knowledge = 1;
  s.bodies.mars.knowledge = 1;
  s.bodies.sun.knowledge = 2;

  const mb = makeInstallation(s, 'moon', true, 100);
  mb.equipment = { ...mb.equipment, solar: 8, habitat: 1, fightersMk1: 4 };
  mb.stock = {
    ...emptyStock(),
    hydrogen: 20000, oxygen: 20000, water: 15000, nitrogen: 3000,
    titanium: 20000, aluminium: 15000, silica: 15000, iron: 15000, copper: 2000,
  };

  addShip(s, 'probe', 'moon');
  addShip(s, 'probe', 'moon');
  addShip(s, 'miner', 'moon');
  addShip(s, 'freighter', 'moon');

  // Prime the day report so the UI has numbers before the first tick.
  const probe = clone(s);
  runInstallation(probe, probe.installations.moonbase);
  mb.report = probe.installations.moonbase.report;

  msg(s, 'story', STORY.intro.title, STORY.intro.text);
  s.unread = 1;
  return s;
}

export function addShip(s: GameState, type: ShipType, at: string): Ship {
  const names = SHIP_NAMES[type];
  const count = s.stats.named[type] ?? 0;
  s.stats.named[type] = count + 1;
  const base = names[count % names.length];
  const suffix = count >= names.length ? ` ${Math.floor(count / names.length) + 1}` : '';
  const ship: Ship = {
    id: newId(s, 'ship'),
    type,
    name: base + suffix,
    status: 'docked',
    at,
    cargo: emptyStock(),
    colonists: 0,
    workDaysLeft: 0,
    autoLoop: true,
    consignments: [],
  };
  s.ships[ship.id] = ship;
  return ship;
}
