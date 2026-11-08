import type { BodyDef } from '../types';

// Real orbital elements (circular approximation): semi-major axis (AU), sidereal period (days),
// mean longitude at J2000 (deg). Compositions are game abundances informed by 21st-century
// mission data (MESSENGER, Dawn, Cassini, Juno, New Horizons, Psyche) and the original's rule that
// silver, uranium and chromium can't be found on the Moon or in the asteroid belt.

const P = (b: BodyDef) => b;

export const BODIES: BodyDef[] = [
  P({ id: 'sun', name: 'Sun', kind: 'star', a: 0, periodDays: 1, L0: 0, radiusKm: 696000, colony: 'never', mineable: 'none', composition: {}, hazard: '', blurb: 'G-type main-sequence star. Solar arrays fall off with the square of distance from it.', color: '#ffd36b' }),

  P({ id: 'mercury', name: 'Mercury', kind: 'planet', a: 0.387, periodDays: 87.969, L0: 252.25, radiusKm: 2440, colony: 'thermalShielding', mineable: 'colony',
    composition: { iron: 10, sulphur: 5, chromium: 5, uranium: 3, titanium: 4, silica: 4, water: 1 },
    hazard: 'Extreme heat — thermal shielding required', blurb: 'Iron-cored and sulphur-rich, with polar ice in shadowed craters. Brutal sunlight means superb solar power.', color: '#b9a99a' }),

  P({ id: 'venus', name: 'Venus', kind: 'planet', a: 0.723, periodDays: 224.70, L0: 181.98, radiusKm: 6052, colony: 'aerostats', mineable: 'colony',
    composition: { nitrogen: 7, sulphur: 9, oxygen: 4, hydrogen: 2, water: 1 },
    hazard: 'Crushing surface — floating aerostat habitats only', blurb: 'At 55 km altitude the pressure and temperature are almost Earth-like. The clouds are rich in sulphur and nitrogen.', color: '#e8cf8f' }),

  P({ id: 'earth', name: 'Earth', kind: 'planet', a: 1.0, periodDays: 365.256, L0: 100.46, radiusKm: 6371, colony: 'special', mineable: 'none',
    composition: { water: 12, nitrogen: 10, oxygen: 2 },
    hazard: 'Impact winter — uninhabitable', blurb: 'Home. A 20-trillion-tonne impact has shrouded it in dust and ash. Restoring it is the goal.', color: '#5f7f9a' }),

  P({ id: 'moon', name: 'Moon', kind: 'moon', parent: 'earth', a: 60, periodDays: 27.32, L0: 0, radiusKm: 1737, colony: 'never', mineable: 'colony',
    composition: { hydrogen: 4, oxygen: 10, water: 3, nitrogen: 0.6, titanium: 8, aluminium: 10, silica: 12, iron: 10, helium3: 0.2 },
    hazard: '', blurb: 'Moonbase, at the Shackleton crater rim near the south pole: near-constant sunlight and ice in the crater floor.', color: '#c8c8c8' }),

  P({ id: 'mars', name: 'Mars', kind: 'planet', a: 1.524, periodDays: 686.98, L0: 355.45, radiusKm: 3390, colony: 'special', mineable: 'colony',
    composition: { iron: 10, water: 4, silica: 6, uranium: 5, oxygen: 2, nitrogen: 1, sulphur: 2 },
    hazard: 'Held by the Ares Collective', blurb: 'The Ares Collective: descendants of the old Mars colony, changed by nearly 140 years of isolation, radiation and low gravity. They want Earth.', color: '#d9653b' }),
  P({ id: 'phobos', name: 'Phobos', kind: 'moon', parent: 'mars', a: 2.8, periodDays: 0.32, L0: 0, radiusKm: 11, colony: 'none', mineable: 'colony',
    composition: { silica: 5, iron: 3, water: 2, silver: 4, copper: 2 },
    hazard: 'Within striking distance of Mars', blurb: 'A captured carbonaceous rubble-pile. Silver traces — but the Collective is watching.', color: '#8f7f72' }),
  P({ id: 'deimos', name: 'Deimos', kind: 'moon', parent: 'mars', a: 6.9, periodDays: 1.26, L0: 0, radiusKm: 6, colony: 'none', mineable: 'colony',
    composition: { silica: 5, iron: 3, water: 3, copper: 2, platinum: 1 },
    hazard: 'Within striking distance of Mars', blurb: 'Smaller and smoother than Phobos, blanketed in fine regolith.', color: '#9c8f80' }),

  P({ id: 'vesta', name: 'Vesta', kind: 'asteroid', a: 2.362, periodDays: 1325.8, L0: 20.9, radiusKm: 263, colony: 'none', mineable: 'colony',
    composition: { iron: 7, silica: 7, titanium: 3, aluminium: 4, platinum: 1.5, copper: 2 },
    hazard: '', blurb: 'A differentiated protoplanet with a basaltic crust — a natural foundry world.', color: '#a59a8a' }),
  P({ id: 'ceres', name: 'Ceres', kind: 'dwarf', a: 2.767, periodDays: 1681.6, L0: 153.9, radiusKm: 470, colony: 'none', mineable: 'colony',
    composition: { water: 10, nitrogen: 4, methane: 2, silica: 4, hydrogen: 2, copper: 1 },
    hazard: '', blurb: 'Dwarf planet of the belt. Briny water and ammonia beneath Occator crater — the best early colony site.', color: '#8c8c88' }),
  P({ id: 'psyche', name: 'Psyche', kind: 'asteroid', a: 2.924, periodDays: 1826.0, L0: 72.0, radiusKm: 113, colony: 'never', mineable: 'miner',
    composition: { iron: 10, platinum: 6, copper: 5, titanium: 1 },
    hazard: 'Too small for a colony — asteroid miners only', blurb: 'A metal-rich world, possibly an exposed planetary core. A fortune in platinum.', color: '#b0a690' }),
  P({ id: 'pallas', name: 'Pallas', kind: 'asteroid', a: 2.773, periodDays: 1686.0, L0: 263.0, radiusKm: 256, colony: 'never', mineable: 'miner',
    composition: { silica: 7, water: 3, aluminium: 4, copper: 3, platinum: 2 },
    hazard: 'Highly inclined orbit — asteroid miners only', blurb: 'Large, battered and steeply tilted.', color: '#8e8b84' }),
  P({ id: 'hygiea', name: 'Hygiea', kind: 'asteroid', a: 3.139, periodDays: 2030.0, L0: 310.0, radiusKm: 217, colony: 'never', mineable: 'miner',
    composition: { water: 5, silica: 5, copper: 3, iron: 2, platinum: 1 },
    hazard: 'Asteroid miners only', blurb: 'Dark, round and primitive. Possibly a dwarf planet in its own right.', color: '#77736d' }),

  P({ id: 'jupiter', name: 'Jupiter', kind: 'gasgiant', a: 5.203, periodDays: 4332.6, L0: 34.40, radiusKm: 69911, colony: 'never', mineable: 'scoop',
    composition: { hydrogen: 12, helium3: 4, methane: 1 },
    hazard: 'Gas giant — gas scoops only', blurb: 'Hydrogen, helium and a fearsome magnetosphere.', color: '#d8b48a' }),
  P({ id: 'io', name: 'Io', kind: 'moon', parent: 'jupiter', a: 5.9, periodDays: 1.77, L0: 0, radiusKm: 1822, colony: 'radiationHardening', mineable: 'colony',
    composition: { sulphur: 12, silica: 5, iron: 4, uranium: 3, chromium: 2 },
    hazard: 'Intense radiation; active volcanism', blurb: 'The most volcanic body known. Its lavas carry heavy elements up from the deep.', color: '#e8d25e' }),
  P({ id: 'europa', name: 'Europa', kind: 'moon', parent: 'jupiter', a: 9.4, periodDays: 3.55, L0: 0, radiusKm: 1561, colony: 'radiationHardening', mineable: 'colony',
    composition: { water: 12, oxygen: 6, sulphur: 2, silica: 2 },
    hazard: 'Intense radiation', blurb: 'An ice shell over a global ocean. Radiolysis leaves oxygen in the ice.', color: '#c9c0aa' }),
  P({ id: 'ganymede', name: 'Ganymede', kind: 'moon', parent: 'jupiter', a: 15, periodDays: 7.15, L0: 0, radiusKm: 2634, colony: 'none', mineable: 'colony',
    composition: { water: 9, silica: 4, iron: 3, silver: 4, titanium: 2 },
    hazard: 'Weak sunlight — reactors advised', blurb: 'Largest moon in the system, with its own magnetic field that shelters it from Jupiter\'s radiation.', color: '#9d9384' }),
  P({ id: 'callisto', name: 'Callisto', kind: 'moon', parent: 'jupiter', a: 26.3, periodDays: 16.69, L0: 0, radiusKm: 2410, colony: 'none', mineable: 'colony',
    composition: { water: 7, silica: 6, iron: 2, silver: 2, copper: 2 },
    hazard: 'Weak sunlight — reactors advised', blurb: 'Ancient, cratered and outside the worst of the radiation belts.', color: '#6f665c' }),

  P({ id: 'saturn', name: 'Saturn', kind: 'gasgiant', a: 9.537, periodDays: 10759, L0: 49.94, radiusKm: 58232, colony: 'never', mineable: 'scoop',
    composition: { hydrogen: 12, helium3: 5, methane: 2 },
    hazard: 'Gas giant — gas scoops only', blurb: 'Ringed giant with a family of icy moons.', color: '#e3cf98' }),
  P({ id: 'enceladus', name: 'Enceladus', kind: 'moon', parent: 'saturn', a: 4, periodDays: 1.37, L0: 0, radiusKm: 252, colony: 'cryoHabitats', mineable: 'colony',
    composition: { water: 12, hydrogen: 4, methane: 2, nitrogen: 2 },
    hazard: 'Deep cold', blurb: 'Plumes of salty water and molecular hydrogen erupt from its south pole.', color: '#eef3f6' }),
  P({ id: 'rhea', name: 'Rhea', kind: 'moon', parent: 'saturn', a: 8.7, periodDays: 4.52, L0: 0, radiusKm: 764, colony: 'cryoHabitats', mineable: 'colony',
    composition: { water: 10, silica: 3, oxygen: 2, aluminium: 2 },
    hazard: 'Deep cold', blurb: 'Icy and heavily cratered, with a whisper-thin oxygen atmosphere.', color: '#cfcbc5' }),
  P({ id: 'titan', name: 'Titan', kind: 'moon', parent: 'saturn', a: 20, periodDays: 15.95, L0: 0, radiusKm: 2575, colony: 'cryoHabitats', mineable: 'colony',
    composition: { methane: 12, nitrogen: 12, water: 6, hydrogen: 3 },
    hazard: 'Deep cold; thick haze blocks sunlight', blurb: 'A dense nitrogen atmosphere and seas of liquid methane. Nitrogen for Earth\'s new sky.', color: '#d9a74a' }),
  P({ id: 'iapetus', name: 'Iapetus', kind: 'moon', parent: 'saturn', a: 59, periodDays: 79.3, L0: 0, radiusKm: 735, colony: 'cryoHabitats', mineable: 'colony',
    composition: { water: 8, silica: 4, methane: 2, titanium: 2 },
    hazard: 'Deep cold', blurb: 'Two-toned: one hemisphere coal-dark, the other bright ice.', color: '#a39a8c' }),

  P({ id: 'uranus', name: 'Uranus', kind: 'gasgiant', a: 19.19, periodDays: 30687, L0: 313.23, radiusKm: 25362, colony: 'never', mineable: 'scoop',
    composition: { hydrogen: 10, helium3: 7, methane: 5 },
    hazard: 'Ice giant — gas scoops only', blurb: 'Tipped on its side, methane-blue, and rich in helium-3.', color: '#9fe0e6' }),
  P({ id: 'miranda', name: 'Miranda', kind: 'moon', parent: 'uranus', a: 5, periodDays: 1.41, L0: 0, radiusKm: 236, colony: 'cryoHabitats', mineable: 'colony',
    composition: { water: 7, silica: 4, chromium: 5, iron: 2 },
    hazard: 'Deep cold', blurb: 'A patchwork moon with 20 km cliffs and exposed mineral seams.', color: '#b7b4ae' }),
  P({ id: 'titania', name: 'Titania', kind: 'moon', parent: 'uranus', a: 17, periodDays: 8.71, L0: 0, radiusKm: 789, colony: 'cryoHabitats', mineable: 'colony',
    composition: { water: 8, silica: 4, uranium: 4, iron: 2 },
    hazard: 'Deep cold', blurb: 'Uranus\' largest moon, split by enormous canyons.', color: '#a9a39b' }),
  P({ id: 'oberon', name: 'Oberon', kind: 'moon', parent: 'uranus', a: 23, periodDays: 13.46, L0: 0, radiusKm: 761, colony: 'cryoHabitats', mineable: 'colony',
    composition: { water: 8, silica: 4, silver: 5, copper: 2 },
    hazard: 'Deep cold', blurb: 'Old, dark and cratered, with bright ray systems of fresh ice.', color: '#8f8780' }),

  P({ id: 'neptune', name: 'Neptune', kind: 'gasgiant', a: 30.07, periodDays: 60190, L0: 304.88, radiusKm: 24622, colony: 'never', mineable: 'scoop',
    composition: { hydrogen: 10, helium3: 8, methane: 5 },
    hazard: 'Ice giant — gas scoops only', blurb: 'The windiest world in the system.', color: '#5a7fe6' }),
  P({ id: 'triton', name: 'Triton', kind: 'moon', parent: 'neptune', a: 14, periodDays: 5.88, L0: 0, radiusKm: 1353, colony: 'cryoHabitats', mineable: 'colony',
    composition: { nitrogen: 12, methane: 6, water: 6, silica: 2 },
    hazard: 'Deep cold', blurb: 'A captured Kuiper belt object with nitrogen geysers.', color: '#d6c3c0' }),

  P({ id: 'pluto', name: 'Pluto', kind: 'dwarf', a: 39.48, periodDays: 90560, L0: 238.93, radiusKm: 1188, colony: 'cryoHabitats', mineable: 'colony',
    composition: { nitrogen: 10, methane: 8, water: 6, helium3: 1 },
    hazard: 'Deep cold; 5 light-hours from the Sun', blurb: 'Glaciers of nitrogen ice in the heart of Sputnik Planitia.', color: '#d8b9a0' }),
  P({ id: 'charon', name: 'Charon', kind: 'moon', parent: 'pluto', a: 16, periodDays: 6.39, L0: 0, radiusKm: 606, colony: 'cryoHabitats', mineable: 'colony',
    composition: { water: 10, nitrogen: 3, silica: 3, platinum: 2 },
    hazard: 'Deep cold', blurb: 'Pluto\'s partner, with a reddish polar cap.', color: '#9a9590' }),
];

export const BODY_BY_ID: Record<string, BodyDef> = Object.fromEntries(BODIES.map((b) => [b.id, b]));
export const MOONS_OF = (parentId: string) => BODIES.filter((b) => b.parent === parentId);
/** Top-level bodies drawn on the map (planets, dwarfs, asteroids, gas giants). */
export const PRIMARY_BODIES = BODIES.filter((b) => !b.parent && b.kind !== 'star');
/** Bodies never randomised in a varied game (as in the original PC version). */
export const FIXED_BODIES = new Set(['earth', 'moon', 'mars']);
