// Research projects. `days` is work at base rate (one lab, 100 crew, full power).
// `flag` = story flag that must be set before the project appears.

export interface ResearchDef {
  id: string;
  name: string;
  days: number;
  requires: string[];
  flag?: string;
  minSalvage?: number;
  desc: string;
  unlocks: string;
  branch: 'Space' | 'Industry' | 'Colonies' | 'Defence' | 'Endgame';
}

export const RESEARCH: ResearchDef[] = [
  { id: 'surveyor', name: 'Orbital Survey Systems', days: 6, requires: [], branch: 'Space',
    desc: 'Ground-penetrating radar and spectrometers on a reusable hull.', unlocks: 'Survey Ship' },
  { id: 'improvedRefining', name: 'Improved Refining', days: 7, requires: [], branch: 'Industry',
    desc: 'Electrolytic regolith processing.', unlocks: 'Refinery Upgrade (+30% yield, up to 3)' },
  { id: 'labExpansion', name: 'Laboratory Expansion', days: 8, requires: [], branch: 'Industry',
    desc: 'Modular lab blocks for the research department.', unlocks: 'Research Lab' },
  { id: 'orbitalLaser', name: 'Orbital Lasers', days: 10, requires: [], branch: 'Defence',
    desc: 'Free-electron lasers on stabilised orbital platforms.', unlocks: 'Orbital Laser' },
  { id: 'colonyPods', name: 'Colony Pod Systems', days: 12, requires: ['surveyor'], branch: 'Colonies',
    desc: 'Self-deploying habitats, refinery and solar farm for 50 colonists.', unlocks: 'Colony Ship' },
  { id: 'factoryAutomation', name: 'Factory Automation', days: 10, requires: ['improvedRefining'], branch: 'Industry',
    desc: 'Robotic assembly lines allow parallel construction.', unlocks: 'Factory Module (+1 build slot)' },
  { id: 'ionDrive', name: 'Ion Drive', days: 14, requires: ['surveyor'], branch: 'Space',
    desc: 'High-efficiency xenon-free hall thrusters running on hydrogen.', unlocks: 'All ships travel 2× faster' },
  { id: 'thermalShielding', name: 'Thermal Shielding', days: 12, requires: ['colonyPods'], branch: 'Colonies',
    desc: 'Ceramic heat-rejection habitats for the terminator zone.', unlocks: 'Colonies on Mercury' },
  { id: 'fission', name: 'Compact Fission Reactors', days: 12, requires: ['colonyPods'], branch: 'Industry',
    desc: 'Sealed 10 MW reactors for colonies beyond reliable sunlight. Uranium is not found on the Moon or in the belt.', unlocks: 'Fission Reactor' },
  { id: 'radiationHardening', name: 'Radiation Hardening', days: 14, requires: ['colonyPods'], branch: 'Colonies',
    desc: 'Water-jacketed habitats that survive Jupiter\'s radiation belts.', unlocks: 'Colonies on Io and Europa' },
  { id: 'interceptorMk2', name: 'Interceptor Mk II', days: 12, requires: ['orbitalLaser'], branch: 'Defence',
    desc: 'Chromium-alloy airframe, twice the punch.', unlocks: 'Interceptor Mk II' },
  { id: 'signalAnalysis', name: 'Signal Analysis', days: 8, requires: [], flag: 'firstContact', branch: 'Endgame',
    desc: 'Decode the transmissions intercepted from the raiders.', unlocks: 'Intelligence on the Ares Collective' },
  { id: 'cryoHabitats', name: 'Cryogenic Habitats', days: 16, requires: ['radiationHardening', 'fission'], branch: 'Colonies',
    desc: 'Habitats that stay warm at -180°C.', unlocks: 'Colonies on Saturn, Uranus, Neptune and Pluto systems' },
  { id: 'aerostats', name: 'Aerostat Habitats', days: 16, requires: ['thermalShielding'], branch: 'Colonies',
    desc: 'Floating cities in the Venusian cloud deck.', unlocks: 'Colonies on Venus' },
  { id: 'bulkFreight', name: 'Bulk Freight Holds', days: 16, requires: ['ionDrive'], branch: 'Space',
    desc: 'Expandable cargo frames and pressurised tankage, refitted to every freighter at Moonbase.', unlocks: 'Freighters carry 200 t instead of 60 t (hydrogen per AU +50%)' },
  { id: 'gasScoop', name: 'Atmospheric Scoops', days: 14, requires: ['ionDrive'], branch: 'Space',
    desc: 'Dive into a gas giant, skim its atmosphere, climb back out.', unlocks: 'Gas Scoop (hydrogen, methane, helium-3)' },
  { id: 'shields', name: 'Deflector Shields', days: 16, requires: ['interceptorMk2'], branch: 'Defence',
    desc: 'Plasma-window shielding over vital departments.', unlocks: 'Shield Generator (-25% damage each)' },
  { id: 'fusionDrive', name: 'Fusion Drive', days: 20, requires: ['ionDrive', 'fission'], branch: 'Space',
    desc: 'Magnetically confined D-³He torch.', unlocks: 'All ships travel ~5× faster than chemical' },
  { id: 'fusionPower', name: 'Fusion Power', days: 18, requires: ['fission', 'gasScoop'], branch: 'Industry',
    desc: 'Helium-3 fusion. Clean, compact, enormous.', unlocks: 'Fusion Plant (40 MW)' },
  { id: 'mutationStudy', name: 'Mutation Study', days: 12, requires: ['signalAnalysis'], minSalvage: 12, branch: 'Endgame',
    desc: 'Study remains recovered from destroyed raiders. Requires 12 salvage.', unlocks: 'Understanding of the Collective\'s condition' },
  { id: 'retroviralTherapy', name: 'Retroviral Therapy', days: 20, requires: ['mutationStudy'], branch: 'Endgame',
    desc: 'A cure for the degeneration killing the Collective.', unlocks: 'Hospital Ship — the path to peace' },
  { id: 'battlecruiser', name: 'Capital Ships', days: 24, requires: ['shields', 'fusionDrive'], branch: 'Endgame',
    desc: 'Heavily armed long-range warships.', unlocks: 'Battlecruiser' },
  { id: 'planetaryAssault', name: 'Planetary Assault', days: 18, requires: ['battlecruiser', 'signalAnalysis'], branch: 'Endgame',
    desc: 'Orbital drop doctrine and armoured landers.', unlocks: 'Assault Troopship — the path to conquest' },
  { id: 'terraforming', name: 'Terraforming Theory', days: 30, requires: ['fusionPower'], flag: 'earthProbed', branch: 'Endgame',
    desc: 'Clear the dust, rebuild the atmosphere, restart the biosphere. Requires a probe report from Earth.', unlocks: 'Terraforming Engine' },
];

export const RESEARCH_BY_ID: Record<string, ResearchDef> = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));
