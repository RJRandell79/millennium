// Core game types. The engine is pure TypeScript: no React, no DOM.
// All state is plain JSON so it can be saved, cloned and replayed deterministically.

export type MaterialId =
  | 'hydrogen' | 'oxygen' | 'water' | 'nitrogen' | 'methane' | 'sulphur'
  | 'titanium' | 'aluminium' | 'copper' | 'silica' | 'iron'
  | 'silver' | 'chromium' | 'platinum' | 'uranium' | 'helium3';

export type Stock = Record<MaterialId, number>;
export type Cost = Partial<Record<MaterialId, number>>;

export type BodyKind = 'star' | 'planet' | 'dwarf' | 'moon' | 'asteroid' | 'gasgiant';

/** Research id that must be complete before a colony can be founded on a body. */
export type ColonyRequirement = 'none' | 'thermalShielding' | 'aerostats' | 'radiationHardening' | 'cryoHabitats' | 'special';

export interface BodyDef {
  id: string;
  name: string;
  kind: BodyKind;
  parent?: string;          // for moons
  a: number;                // semi-major axis, AU (moons: orbit radius in parent radii, render only)
  periodDays: number;
  L0: number;               // mean longitude at J2000, degrees
  radiusKm: number;
  colony: ColonyRequirement | 'never';
  mineable: 'colony' | 'miner' | 'scoop' | 'none';
  composition: Cost;        // base abundance 0..12 per material (×250 kg/day at a colony refinery)
  hazard: string;
  blurb: string;
  color: string;
}

export type Knowledge = 0 | 1 | 2; // unknown, probed, surveyed

export interface BodyState {
  id: string;
  knowledge: Knowledge;
  composition: Cost;        // actual (possibly randomised) composition
  installationId?: string;
  richUntil?: number;       // day: rich seam bonus
}

export type DeptId = 'lifeSupport' | 'energy' | 'research' | 'refinery' | 'production' | 'flightDeck' | 'defence';
export const MOON_DEPTS: DeptId[] = ['lifeSupport', 'energy', 'research', 'refinery', 'production', 'flightDeck', 'defence'];
export const COLONY_DEPTS: DeptId[] = ['lifeSupport', 'energy', 'refinery', 'flightDeck', 'defence'];

export interface DeptState { online: boolean; damage: number } // damage 0..100

export type EquipKey =
  | 'solar' | 'reactor' | 'fusion' | 'habitat' | 'refinery' | 'labs' | 'factories'
  | 'lasers' | 'shields' | 'fightersMk1' | 'fightersMk2';

export type Equipment = Record<EquipKey, number>;

export interface DayReport {
  powerGen: number;
  powerDemand: number;
  deptEff: Partial<Record<DeptId, number>>;
  mined: Cost;
  consumed: Cost;
  lifeSupportOk: boolean;
  daysOfSupplies: number;   // min days of O2/water/N2 at current use
}

export interface Installation {
  id: string;
  name: string;
  bodyId: string;
  isMoonBase: boolean;
  population: number;
  stock: Stock;
  depts: Partial<Record<DeptId, DeptState>>;
  equipment: Equipment;
  foundedDay: number;
  report: DayReport;
  shortageDays: number;
  /** Moonbase only: the 0.4 MW long-range listening watch, drawn under Life Support. */
  commsWatch?: boolean;
  /** How this installation's population is managed. Absent means the default policy. */
  growth?: GrowthPolicy;
}

export type ShipType =
  | 'probe' | 'surveyor' | 'colonyShip' | 'freighter' | 'miner' | 'gasScoop'
  | 'battlecruiser' | 'troopship' | 'hospitalShip';

export type ShipStatus = 'docked' | 'transit' | 'working';

export type Purpose =
  | 'probe' | 'survey' | 'colonise' | 'mine' | 'haulOut' | 'haulBack' | 'return' | 'assault' | 'accord';

export interface Transit {
  from: string;   // body id
  to: string;     // body id
  departDay: number;
  arriveDay: number;
  purpose: Purpose;
}

export interface Ship {
  id: string;
  type: ShipType;
  name: string;
  status: ShipStatus;
  /** body id where the ship currently is (docked/working) — for transit, see transit */
  at: string;
  transit?: Transit;
  cargo: Stock;
  colonists: number;
  workDaysLeft: number;
  /** freighter: colony installation id it loops to. miner/scoop: body id it loops to. */
  routeTo?: string;
  autoLoop: boolean;
  consignments: Consignment[];
  fleetId?: string;   // assault fleets
}

export interface Consignment { id: string; blueprintId: string; installationId: string }

export interface QueueItem {
  id: string;
  blueprintId: string;
  targetId: string;        // installation id, or 'earth'
  progress: number;        // days of work done
  started: boolean;        // materials paid
  repeat: boolean;
}

export interface ResearchState {
  current?: string;
  progress: number;
  done: string[];
}

export interface Raid {
  id: string;
  ships: number;
  quality: number;
  targetInstallationId: string;
  targetBodyId: string;
  launchDay: number;
  arriveDay: number;
}

export type AdversaryStatus = 'hostile' | 'peace' | 'conquered';

export interface ThreatState {
  status: AdversaryStatus;
  wave: number;
  nextLaunchDay: number;
  raids: Raid[];
  salvage: number;
  marsDefence: number;
  lastBattle?: BattleReport;
}

export interface BattleReport {
  day: number;
  installationId: string;
  raiders: number;
  raidersDestroyed: number;
  fightersLost: number;
  laserKills: number;
  damage: { dept: DeptId; amount: number }[];
  casualties: number;
  outcome: 'repelled' | 'damaged' | 'devastated';
  log: string[];
}

export type MessageKind = 'info' | 'good' | 'warn' | 'alert' | 'story';

export interface Message {
  id: number;
  day: number;
  kind: MessageKind;
  title: string;
  text: string;
  /** body/installation to jump to */
  ref?: string;
}

export interface Modifier {
  kind: 'solarFlare' | 'richSeam';
  installationId?: string;
  until: number;
}

export interface EarthState { engines: number; progress: number; probed: boolean }

export interface GameSettings { varied: boolean; difficulty: 'relaxed' | 'standard' | 'hard' }

export type GrowthPolicy = 'grow' | 'steady' | 'hold';

/** A recovered document in the archive, with how the player has engaged with it (for playtests). */
export interface ArchiveEntry {
  id: string;
  /** day it was recovered */
  day: number;
  /** day it was first opened */
  firstReadDay?: number;
  /** times opened */
  opens: number;
  /** true if the first opening interrupted a running clock */
  firstReadWhileRunning?: boolean;
}

export interface GameStats { raidsRepelled: number; shipsBuilt: number; kgMined: number; peakPopulation: number; named: Partial<Record<ShipType, number>> }

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  day: number;
  nextId: number;
  nextMsg: number;
  settings: GameSettings;
  bodies: Record<string, BodyState>;
  installations: Record<string, Installation>;
  ships: Record<string, Ship>;
  queue: QueueItem[];
  consignments: Consignment[];
  research: ResearchState;
  threat: ThreatState;
  earth: EarthState;
  modifiers: Modifier[];
  flags: string[];
  messages: Message[];
  unread: number;
  archive: ArchiveEntry[];
  outcome?: { result: 'won' | 'lost'; day: number; reason: string };
  stats: GameStats;
}

export interface TickResult { state: GameState; pause: boolean; newMessages: Message[] }
