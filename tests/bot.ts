// A simple scripted player used to check that the game is winnable and the balance is sane.
import {
  type GameState, advanceDay, setResearch, queueBuild, sendShip, setFreighterRoute, launchAssault,
  researchList, missionsFor, moonbase, canAfford, setGrowthPolicy, popCap, growthLimit, DEFAULT_GROWTH, type GrowthPolicy,
} from '../src/engine';

const RESEARCH_ORDER = [
  'surveyor', 'improvedRefining', 'colonyPods', 'orbitalLaser', 'labExpansion', 'signalAnalysis', 'fission', 'thermalShielding',
  'ionDrive', 'factoryAutomation', 'interceptorMk2', 'mutationStudy', 'radiationHardening', 'retroviralTherapy', 'gasScoop',
  'shields', 'fusionDrive', 'fusionPower', 'cryoHabitats', 'terraforming', 'aerostats', 'battlecruiser', 'planetaryAssault',
];

const COLONY_TARGETS = ['ceres', 'mercury', 'vesta', 'ganymede', 'titan', 'phobos', 'europa', 'callisto', 'triton', 'oberon', 'venus'];
const PROBE_TARGETS = ['ceres', 'mercury', 'earth', 'jupiter', 'vesta', 'saturn', 'mars', 'uranus', 'neptune', 'venus'];

export interface BotLog { milestones: Record<string, number>; events: string[] }

function tryAct(s: GameState, r: { ok: boolean; state?: GameState }): GameState {
  return r.ok ? (r as { state: GameState }).state : s;
}

export type Opening = 'balanced' | 'defence' | 'asteroid' | 'research' | 'ceres';
export type BotGrowth = GrowthPolicy | 'adaptive' | 'holdWhenFull' | 'reserveThenHold';
export interface BotOpts { conquest?: boolean; opening?: Opening; growth?: BotGrowth; /** research labs to build (default 2; max 4) */ labs?: number }

const OPENING_RESEARCH: Record<Opening, string[]> = {
  balanced: [],
  defence: ['orbitalLaser', 'interceptorMk2'],
  asteroid: ['improvedRefining', 'factoryAutomation'],
  research: ['labExpansion', 'surveyor', 'ionDrive'],
  ceres: ['surveyor', 'colonyPods'],
};

export function botTurn(s: GameState, log: BotLog, opts: BotOpts = {}): GameState {
  const mb = moonbase(s);
  // Research
  if (!s.research.current) {
    const avail = researchList(s).filter((x) => x.status === 'available').map((x) => x.def.id)
      .filter((id) => !(opts.conquest && (id === 'mutationStudy' || id === 'retroviralTherapy')));
    const order = s.day < 200 ? [...OPENING_RESEARCH[opts.opening ?? 'balanced'], ...RESEARCH_ORDER] : RESEARCH_ORDER;
    const next = order.find((id) => avail.includes(id)) ?? avail[0];
    if (next) s = tryAct(s, setResearch(s, next));
  }

  // Population policy
  if (opts.growth) {
    for (const inst of Object.values(s.installations)) {
      const fixed = opts.growth === 'grow' || opts.growth === 'steady' || opts.growth === 'hold';
      let want: GrowthPolicy = fixed ? (opts.growth as GrowthPolicy) : 'grow';
      if (opts.growth === 'holdWhenFull') want = inst.population >= popCap(inst) ? 'hold' : 'grow';
      // Fill the Moonbase reserve on Grow, then put it on duty with Hold until losses take it back below capacity.
      if (opts.growth === 'reserveThenHold') {
        const cur = inst.growth ?? DEFAULT_GROWTH;
        want = inst.population >= growthLimit(inst) - 0.5 ? 'hold' : cur === 'hold' && inst.population >= popCap(inst) ? 'hold' : 'grow';
      }
      if (opts.growth === 'adaptive') {
        want = 'steady';
        const r = inst.report;
        const raidSoon = s.threat.raids.some((x) => x.targetInstallationId === inst.id && x.arriveDay - s.day < 15);
        const tight = !r.lifeSupportOk || r.daysOfSupplies < 90 || r.powerGen - r.powerDemand < 2;
        want = tight || raidSoon ? 'hold' : inst.population < popCap(inst) - 5 ? 'grow' : 'steady';
      }
      if ((inst.growth ?? DEFAULT_GROWTH) !== want) s = tryAct(s, setGrowthPolicy(s, inst.id, want));
    }
  }

  // Production planning
  const queued = (id: string) => s.queue.filter((q) => q.blueprintId === id).length;
  const ships = Object.values(s.ships);
  const count = (t: string) => ships.filter((x) => x.type === t).length;
  const colonies = Object.values(s.installations).filter((i) => !i.isMoonBase);
  const want = (id: string, n: number, target = 'moonbase') => {
    if (s.queue.length >= 6) return;
    if (queued(id) >= n) return;
    s = tryAct(s, queueBuild(s, id, target));
  };
  const done = (id: string) => s.research.done.includes(id);
  const e = mb.equipment;
  const power = mb.report.powerGen - mb.report.powerDemand;
  const op = s.day < 200 ? (opts.opening ?? 'balanced') : 'balanced';
  if (op === 'defence') {
    if (e.fightersMk1 + e.fightersMk2 < 12 + 2 * s.threat.wave) want(done('interceptorMk2') && mb.stock.chromium > 600 ? 'interceptor2' : 'interceptor', 2);
    if (done('orbitalLaser') && e.lasers < 4 + s.threat.wave) want('laser', 2);
  }
  if (op === 'asteroid') {
    if (count('miner') + queued('miner') < 4) want('miner', 2);
    if (done('improvedRefining') && e.refinery < 3) want('refinery', 2);
  }
  if (op === 'research' && done('labExpansion') && e.labs < 3) want('lab', 2);
  if (op === 'ceres' && done('colonyPods') && count('colonyShip') + queued('colonyShip') < 1) want('colonyShip', 1);
  if (power < 3 && e.solar < 30) want('solar', 1);
  if (count('miner') < 2) want('miner', 1);
  if (e.fightersMk1 + e.fightersMk2 < 6 + s.threat.wave) want(done('interceptorMk2') && mb.stock.chromium > 600 ? 'interceptor2' : 'interceptor', 1);
  if (done('orbitalLaser') && e.lasers < Math.min(10, 2 + s.threat.wave)) want('laser', 1);
  if (done('improvedRefining') && e.refinery < 3) want('refinery', 1);
  if (mb.population > 100 * e.habitat - 15 && e.habitat < 6) want('habitat', 1);
  if (done('labExpansion') && e.labs < (opts.labs ?? 2)) want('lab', 1);
  if (done('factoryAutomation') && e.factories < 2) want('factory', 1);
  if (done('shields') && e.shields < 2) want('shield', 1);
  if (done('surveyor') && count('surveyor') < 1) want('surveyor', 1);
  if (count('probe') < 1 && PROBE_TARGETS.some((b) => s.bodies[b].knowledge === 0 || (b === 'earth' && !s.earth.probed))) want('probe', 1);
  if (done('colonyPods') && count('colonyShip') < 1 && colonies.length < 8 && mb.population > 90) want('colonyShip', 1);
  if (count('freighter') < colonies.length + 1) want('freighter', 1);
  if (done('gasScoop') && count('gasScoop') < 2) want('gasScoop', 1);
  if (done('retroviralTherapy') && count('hospitalShip') < 1 && s.threat.status === 'hostile') want('hospitalShip', 1);
  if (done('fusionPower') && e.fusion < 2) want('fusion', 1);
  if (done('fission') && e.reactor < 2 && mb.stock.uranium > 1500) want('reactor', 1);
  if (done('battlecruiser') && count('battlecruiser') + queued('battlecruiser') < 6 && s.threat.status === 'hostile') want('battlecruiser', 1);
  if (done('planetaryAssault') && count('troopship') + queued('troopship') < 1 && s.threat.status === 'hostile') want('troopship', 1);
  if (done('terraforming') && s.earth.engines + queued('terraformer') < 4) want('terraformer', 1);
  for (const c of colonies) {
    const r = c.report;
    if (r.powerGen < r.powerDemand && c.equipment.solar + queued('solar') < 20) {
      if (done('fission') && mb.stock.uranium > 1600 && c.equipment.reactor < 2) want('reactor', 1, c.id);
      else want('solar', 1, c.id);
    }
  }

  // Fleet
  for (const ship of Object.values(s.ships)) {
    if (ship.status !== 'docked' || ship.at !== 'moon') continue;
    const opts = missionsFor(s, ship).filter((o) => o.ok);
    let target: string | undefined;
    if (ship.type === 'probe') target = PROBE_TARGETS.find((b) => opts.some((o) => o.bodyId === b));
    if (ship.type === 'surveyor') target = COLONY_TARGETS.find((b) => opts.some((o) => o.bodyId === b));
    if (ship.type === 'colonyShip') target = COLONY_TARGETS.find((b) => opts.some((o) => o.bodyId === b));
    if (ship.type === 'miner') target = canAfford(mb.stock, { copper: 6000 }) ? 'vesta' : 'psyche';
    if (ship.type === 'gasScoop') target = 'saturn';
    if (ship.type === 'hospitalShip') target = 'mars';
    if (target && opts.some((o) => o.bodyId === target)) s = tryAct(s, sendShip(s, ship.id, target));
    if (ship.type === 'freighter' && !ship.routeTo) {
      const served = new Set(Object.values(s.ships).map((x) => x.routeTo));
      const col = colonies.find((c) => !served.has(c.id));
      if (col) s = tryAct(s, setFreighterRoute(s, ship.id, col.id));
    }
  }
  if (count('battlecruiser') >= 6 && count('troopship') >= 1) s = tryAct(s, launchAssault(s));

  // Milestones
  const m = log.milestones;
  const mark = (k: string, cond: boolean) => { if (cond && m[k] === undefined) m[k] = s.day; };
  mark('firstColony', colonies.length > 0);
  mark('threeColonies', colonies.length >= 3);
  mark('peace', s.threat.status !== 'hostile');
  mark('terraformStart', s.earth.engines > 0);
  mark('pop300', mb.population >= 300);
  return s;
}

export function playBot(s: GameState, maxDays: number, opts: BotOpts = {}): { state: GameState; log: BotLog } {
  const log: BotLog = { milestones: {}, events: [] };
  for (let i = 0; i < maxDays && !s.outcome; i++) {
    s = botTurn(s, log, opts);
    const r = advanceDay(s);
    s = r.state;
    for (const msg of r.newMessages) if (msg.kind === 'alert' || msg.kind === 'story') log.events.push(`d${s.day} ${msg.title}`);
  }
  return { state: s, log };
}
