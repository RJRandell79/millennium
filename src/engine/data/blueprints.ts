import type { Cost, EquipKey, ShipType } from '../types';

export type InstallRule = 'moon' | 'any' | 'colony' | 'earth';

export interface Blueprint {
  id: string;
  name: string;
  category: 'Ships' | 'Defence' | 'Infrastructure' | 'Endgame';
  cost: Cost;
  days: number;
  requires?: string;          // research id
  ship?: ShipType;
  equip?: EquipKey;
  install?: InstallRule;      // for equipment
  max?: number;               // per installation
  terraformer?: boolean;
  desc: string;
}

export const BLUEPRINTS: Blueprint[] = [
  // Ships
  { id: 'probe', name: 'Probe', category: 'Ships', ship: 'probe', days: 2,
    cost: { titanium: 1200, aluminium: 800, silica: 400, iron: 400 },
    desc: 'One-way robotic explorer. Reveals a world (and its moons) and their likely resources.' },
  { id: 'miner', name: 'Asteroid Miner', category: 'Ships', ship: 'miner', days: 6,
    cost: { titanium: 6000, iron: 6000, aluminium: 3000, silica: 1000 },
    desc: 'Mines asteroids directly — no colony needed. 30,000 kg hold. Loops automatically.' },
  { id: 'freighter', name: 'Freighter', category: 'Ships', ship: 'freighter', days: 7,
    cost: { titanium: 8000, aluminium: 8000, iron: 5000 },
    desc: '60,000 kg hold. Assign to a colony and it runs supplies out and ore back on its own.' },
  { id: 'surveyor', name: 'Survey Ship', category: 'Ships', ship: 'surveyor', days: 5, requires: 'surveyor',
    cost: { titanium: 4000, aluminium: 3000, silica: 2000, copper: 400 },
    desc: 'Maps a probed world in detail and locates a landing site, then returns home.' },
  { id: 'colonyShip', name: 'Colony Ship', category: 'Ships', ship: 'colonyShip', days: 12, requires: 'colonyPods',
    cost: { titanium: 12000, aluminium: 10000, iron: 8000, silica: 6000, copper: 1500, platinum: 200 },
    desc: 'Carries 50 colonists from Moonbase plus habitat, refinery and ~6 MW of power (solar, or a compact reactor beyond the belt).' },
  { id: 'gasScoop', name: 'Gas Scoop', category: 'Ships', ship: 'gasScoop', days: 10, requires: 'gasScoop',
    cost: { titanium: 10000, aluminium: 6000, copper: 2000, platinum: 500, chromium: 500 },
    desc: 'Skims gas giants for hydrogen, methane and helium-3. 30,000 kg hold.' },
  { id: 'hospitalShip', name: 'Hospital Ship', category: 'Endgame', ship: 'hospitalShip', days: 10, requires: 'retroviralTherapy',
    cost: { titanium: 8000, aluminium: 6000, silver: 2000, platinum: 1000, water: 20000 },
    desc: 'Carries the cure to Mars under a flag of truce.' },
  { id: 'battlecruiser', name: 'Battlecruiser', category: 'Endgame', ship: 'battlecruiser', days: 18, requires: 'battlecruiser',
    cost: { titanium: 20000, iron: 15000, chromium: 3000, uranium: 2000, silver: 800, platinum: 800 },
    desc: 'Capital warship. Send several to Mars together with a troopship.' },
  { id: 'troopship', name: 'Assault Troopship', category: 'Endgame', ship: 'troopship', days: 12, requires: 'planetaryAssault',
    cost: { titanium: 12000, aluminium: 8000, iron: 8000, chromium: 1000 },
    desc: 'Lands an occupation force once orbital defences fall. Carries 50 crew.' },

  // Defence
  { id: 'interceptor', name: 'Interceptor Mk I', category: 'Defence', equip: 'fightersMk1', install: 'moon', days: 2, max: 40,
    cost: { titanium: 2000, aluminium: 1500, iron: 500 },
    desc: 'Base fighter. Joins the Moonbase fighter reserve.' },
  { id: 'interceptor2', name: 'Interceptor Mk II', category: 'Defence', equip: 'fightersMk2', install: 'moon', days: 3, max: 40, requires: 'interceptorMk2',
    cost: { titanium: 2500, aluminium: 1500, chromium: 300, copper: 200 },
    desc: 'Twice as effective as the Mk I.' },
  { id: 'laser', name: 'Orbital Laser', category: 'Defence', equip: 'lasers', install: 'any', days: 6, max: 10, requires: 'orbitalLaser',
    cost: { titanium: 4000, silica: 3000, copper: 800, platinum: 100 },
    desc: 'Fires on raiders before they reach the fighters. Can be shipped to colonies.' },
  { id: 'shield', name: 'Shield Generator', category: 'Defence', equip: 'shields', install: 'any', days: 10, max: 3, requires: 'shields',
    cost: { titanium: 5000, silver: 600, chromium: 600, copper: 1000 },
    desc: 'Cuts raid damage by 25% each (max 3). Draws 2 MW.' },

  // Infrastructure
  { id: 'solar', name: 'Solar Array', category: 'Infrastructure', equip: 'solar', install: 'any', days: 3, max: 40,
    cost: { silica: 3000, aluminium: 1500, copper: 250 },
    desc: '2 MW at Earth\'s distance from the Sun; output falls with distance².' },
  { id: 'habitat', name: 'Habitation Module', category: 'Infrastructure', equip: 'habitat', install: 'moon', days: 10, max: 6,
    cost: { titanium: 8000, aluminium: 6000, silica: 4000, iron: 4000, water: 5000 },
    desc: 'Room for 100 more people at Moonbase (max 600).' },
  { id: 'refinery', name: 'Refinery Upgrade', category: 'Infrastructure', equip: 'refinery', install: 'any', days: 6, max: 3, requires: 'improvedRefining',
    cost: { titanium: 5000, iron: 5000, copper: 800 },
    desc: '+30% mining yield. Draws +1 MW.' },
  { id: 'lab', name: 'Research Lab', category: 'Infrastructure', equip: 'labs', install: 'moon', days: 8, max: 4, requires: 'labExpansion',
    cost: { titanium: 4000, silica: 4000, copper: 1000, platinum: 100 },
    desc: '+1 research rate. Draws 2 MW.' },
  { id: 'factory', name: 'Factory Module', category: 'Infrastructure', equip: 'factories', install: 'moon', days: 10, max: 3, requires: 'factoryAutomation',
    cost: { titanium: 6000, iron: 6000, aluminium: 4000, copper: 1000 },
    desc: 'Build one more item at a time. Draws 3 MW.' },
  { id: 'reactor', name: 'Fission Reactor', category: 'Infrastructure', equip: 'reactor', install: 'any', days: 10, max: 6, requires: 'fission',
    cost: { titanium: 6000, iron: 4000, uranium: 1500, copper: 600 },
    desc: 'Steady 10 MW anywhere in the system.' },
  { id: 'fusion', name: 'Fusion Plant', category: 'Infrastructure', equip: 'fusion', install: 'any', days: 14, max: 4, requires: 'fusionPower',
    cost: { titanium: 10000, platinum: 800, chromium: 800, helium3: 400, copper: 1500 },
    desc: '40 MW. The end of power shortages.' },

  // Endgame
  { id: 'terraformer', name: 'Terraforming Engine', category: 'Endgame', terraformer: true, install: 'earth', days: 25, requires: 'terraforming',
    cost: { titanium: 30000, iron: 30000, chromium: 3000, silver: 2000, uranium: 3000, platinum: 1500, nitrogen: 20000 },
    desc: 'Lands on Earth and starts restoring the atmosphere. Each engine consumes 400 kg nitrogen, 800 kg water and 200 kg oxygen a day from Moonbase.' },
];

export const BLUEPRINT_BY_ID: Record<string, Blueprint> = Object.fromEntries(BLUEPRINTS.map((b) => [b.id, b]));

export interface ShipSpec { name: string; capacity: number; fuelPerAU: number; colonists: number; blurb: string }

/** hydrogen burned per AU of the outward leg (round trips are paid up front for loops) */
export const SHIP_SPECS: Record<ShipType, ShipSpec> = {
  probe: { name: 'Probe', capacity: 0, fuelPerAU: 250, colonists: 0, blurb: 'One-way' },
  surveyor: { name: 'Survey Ship', capacity: 0, fuelPerAU: 500, colonists: 0, blurb: 'Surveys then returns' },
  colonyShip: { name: 'Colony Ship', capacity: 20000, fuelPerAU: 1500, colonists: 50, blurb: 'Founds a colony' },
  freighter: { name: 'Freighter', capacity: 60000, fuelPerAU: 700, colonists: 0, blurb: 'Colony supply loop' },
  miner: { name: 'Asteroid Miner', capacity: 30000, fuelPerAU: 700, colonists: 0, blurb: 'Asteroid mining loop' },
  gasScoop: { name: 'Gas Scoop', capacity: 30000, fuelPerAU: 700, colonists: 0, blurb: 'Gas giant loop' },
  battlecruiser: { name: 'Battlecruiser', capacity: 0, fuelPerAU: 1500, colonists: 0, blurb: 'Warship' },
  troopship: { name: 'Troopship', capacity: 0, fuelPerAU: 1000, colonists: 50, blurb: 'Occupation force' },
  hospitalShip: { name: 'Hospital Ship', capacity: 0, fuelPerAU: 800, colonists: 0, blurb: 'Peace mission' },
};

export const SHIP_NAMES: Record<ShipType, string[]> = {
  probe: ['Pathfinder', 'Mariner', 'Voyager', 'Pioneer', 'Venera', 'Galileo', 'Cassini', 'Juno', 'Dawn', 'Rosetta', 'Messenger', 'Ulysses', 'Giotto', 'Vega', 'Hayabusa', 'Huygens'],
  surveyor: ['Cartographer', 'Lodestar', 'Theodolite', 'Plumb Line', 'Sextant'],
  colonyShip: ['New Hope', 'Arcadia', 'Mayflower', 'Endurance', 'Covenant', 'Providence', 'Horizon', 'Exodus'],
  freighter: ['Pack Mule', 'Dray', 'Clydesdale', 'Barge Royal', 'Coal Scuttle', 'Lancashire Lass', 'Ribble', 'Steady Eddie', 'Tug Wilson', 'Penny Black'],
  miner: ['Pickaxe', 'Prospector', 'Gold Digger', 'Seam Finder', 'Sledgehammer', 'Rock Hound'],
  gasScoop: ['Skimmer', 'Bellows', 'Albatross', 'Petrel'],
  battlecruiser: ['Resolute', 'Defiance', 'Vanguard', 'Indomitable', 'Retribution', 'Steadfast'],
  troopship: ['Bulwark', 'Rampart', 'Citadel'],
  hospitalShip: ['Olive Branch', 'Good Samaritan', 'Florence'],
};
