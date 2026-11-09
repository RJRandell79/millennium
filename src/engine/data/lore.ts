// All story text lives here so the adversary can be re-themed without touching game logic.

export const ADVERSARY = {
  name: 'Ares Collective',
  short: 'Collective',
  home: 'mars',
  raiderName: 'raider',
};

export const STORY = {
  intro: {
    title: '30 January 2200 — Moonbase',
    text: 'Eleven days ago a 20-trillion-tonne asteroid struck the Pacific. Earth is silent beneath a shroud of dust. The 100 people of Moonbase are, as far as we know, all that is left of humanity — apart from whatever still lives on Mars. Your orders: keep us alive, reach out into the system, and one day bring us home. Start by sending a probe somewhere useful, and get an Asteroid Miner out to the belt: we have no copper of our own.',
  },
  firstLaunch: {
    title: 'Launches detected on Mars',
    text: 'Deep-space tracking has picked up a formation of craft climbing out of the Martian gravity well on an intercept course for the Moon. They are not answering hails. Ready the fighters.',
  },
  firstContact: {
    title: 'First contact',
    text: 'The wreckage is human-built, but the pilots were not quite human. The craft were broadcasting a looping transmission in a degraded dialect of English. Research can now attempt Signal Analysis.',
  },
  signalAnalysis: {
    title: 'Signal analysis complete',
    text: 'They call themselves the Ares Collective — descendants of the Mars colony that went silent in 2061. Nearly 140 years of isolation, radiation and low gravity have changed them, and they are dying of it. Their tracking stations saw the asteroid coming. They warned no one. Now they mean to take Earth for themselves, and they see Moonbase as the only thing in the way. There may be two ways to end this: break their orbital defences and occupy Mars, or study their condition and offer a cure.',
  },
  mutationStudy: {
    title: 'The Collective is dying',
    text: 'Salvaged tissue shows a cascading genetic degeneration. Within two generations there will be no Collective left. A retroviral therapy may be possible — and it might buy a peace.',
  },
  earthProbe: {
    title: 'Probe report: Earth',
    text: 'Surface temperature -21°C and falling. Stratospheric dust at 40× pre-impact levels. Oceans partly frozen. But the Svalbard seed vault beacon is still transmitting, and sensors register microbial life in deep-ocean vents. Earth is not dead. With fusion power and enough nitrogen and water, it could be restored. Research can now attempt Terraforming Theory.',
  },
  marsProbe: {
    title: 'Probe lost over Mars',
    text: 'The probe transmitted for nine minutes before it was shot down. Orbital defence platforms ring the planet. Any attack will need capital ships.',
  },
  conquest: {
    title: 'Mars has fallen',
    text: 'The orbital platforms are silent and the troopship has landed. The Collective has surrendered. The raids are over. Mars is ours to mine — uranium and iron in abundance.',
  },
  assaultFailed: {
    title: 'Assault repulsed',
    text: 'Our fleet was destroyed in Martian orbit. The Collective will be emboldened.',
  },
  accord: {
    title: 'The Ares Accord',
    text: 'The hospital ship was met not with lasers but with an honour guard. The Collective has accepted the therapy and signed the Ares Accord. The raids are over, and Mars will send uranium in gratitude.',
  },
  terraformStart: {
    title: 'Terraforming has begun',
    text: 'The first engine is down in what was once Lancashire. It is pulling dust from the sky and seeding it into rain. Keep it fed with nitrogen, water and oxygen from Moonbase.',
  },
  terraform25: { title: 'Earth: 25%', text: 'The sky over the northern hemisphere is turning blue again for the first time since the impact.' },
  terraform50: { title: 'Earth: 50%', text: 'Rain is falling on unfrozen ground. Lichen is spreading out from the seed-bank test plots.' },
  terraform75: { title: 'Earth: 75%', text: 'The air at sea level is breathable for hours at a time. Volunteers are queuing at the flight deck.' },
  victory: {
    title: 'Return to Earth',
    text: 'Earth can support life again. The first shuttle lands on new grass in what used to be Preston. Humanity has a home again — and a whole solar system besides.',
  },
  defeatPopulation: { title: 'Moonbase lost', text: 'There is no one left alive on Moonbase. Humanity\'s last outpost has fallen silent.' },
  commsObjection: {
    title: 'Deputy commander: the comms watch',
    text: 'Commander, before you cut it. The comms watch is the only thing on this base listening on the rescue bands. If anyone is still alive up there, in a lifeboat or a station hulk, that is how they find us. It costs 0.4 megawatts. I would rather pay that than explain to the next crew who knocks that nobody was listening. Your call. Give the order again and I will log it. — A. Okafor-Lind',
  },
  commsOff: {
    title: 'Comms watch off',
    text: 'Comms watch powered down on the commander\'s order. Logged. — A. Okafor-Lind',
  },
};

// ---------------------------------------------------------------------------
// The Archive: documents the player recovers in play. Canon lives in the story bible;
// every fragment must change what the player knows. `dated` is in-world; omit it for
// entries written at Moonbase, which show the day they were recovered.

export type MysteryId = 'wormwood' | 'ares' | 'severance' | 'svalbard' | 'shackleton';

export interface FragmentDef {
  id: string;
  mystery: MysteryId;
  trigger: { kind: 'research'; id: string };
  author: string;
  dated?: string;
  title: string;
  body: string;
  /** What the player knows after reading this that they didn't before. Not shown in this build. */
  reveals: string;
}

export const FRAGMENTS: FragmentDef[] = [
  {
    id: 'W1', mystery: 'wormwood', trigger: { kind: 'research', id: 'surveyor' },
    author: 'Lunar Minor Body Survey, Shackleton Station', dated: '14 March 2187',
    title: 'Catalogue entry: 2187 KW',
    body: '2187 KW. Discovered 2 March 2187, Shackleton 1.8 m survey telescope. Observation arc: 11 days. Albedo 0.03 (very dark). Approach from low solar elongation; further observation not possible. Diameter estimated at 26 km. Minimum distance from Earth\'s orbit 0.21 AU, uncertainty high. Hazard rating: 0. No further observation scheduled. Recommend follow-up when solar elongation permits, estimated 2196.\n\n[Archive note: the survey spectrometers described in this record are the basis for the Survey Ship.]',
    reveals: 'The orbit came from an 11-day arc and the follow-up was never done; with more watching, it could have been seen sooner.',
  },
  {
    id: 'W2', mystery: 'wormwood', trigger: { kind: 'research', id: 'orbitalLaser' },
    author: 'Off-World Authority, Planetary Defence Office', dated: '2171',
    title: 'Planetary Defence Review (extract)',
    body: 'Earth\'s sky has a blind spot. Objects approaching from inside Earth\'s orbit spend much of their final approach in the Sun\'s glare, where no telescope on Earth or the Moon can follow them. Since 2061 this sector has been covered by a single instrument, the Mercury Solar Observatory, which was built for solar physics, not asteroid search. Before 2061 it was covered by a purpose-built network operated from Mars: Deep Watch. That capability has not been replaced.\n\nThe free-electron laser platforms proposed in section 4 would let us nudge a small body off course, but only with years of warning.\n\nRecommendation: fund a dedicated sunward survey. Status: deferred.',
    reveals: 'Earth relied on two sunward watchers, Mercury and Ares\'s Deep Watch, and lost the second in 2061.',
  },
  {
    id: 'L1', mystery: 'shackleton', trigger: { kind: 'research', id: 'improvedRefining' },
    author: 'Off-World Authority, Lunar Programmes', dated: '2094',
    title: 'Shackleton Station: founding budget',
    body: 'Regolith refinery and fabrication shops: 18%. Habitat for 60, expandable to 100: 22%. Solar farm on the rim ridges: 12%. Ice extraction, crater floor: 9%. Deep-space antenna, 34 m, cryogenic receiver: 33%. Contingency: 6%.\n\n[Note, Moonbase: Found this digging out the refinery specs. A third of the money went on the big dish. I have kept that refinery running for nine years and never seen a science programme book time on it. Must have been the fashion in 2094. — T. Wójcik]',
    reveals: 'A third of Shackleton\'s founding budget went on a 34 m dish that the science programme never used.',
  },
  {
    id: 'L2', mystery: 'shackleton', trigger: { kind: 'research', id: 'labExpansion' },
    author: 'Callum Brierley, Archivist',
    title: 'A locked partition',
    body: 'Rain in Preston, steady, the kind that gets under your hood on Fishergate.\n\nCataloguing the lab-module designs, I found a partition in the Archive I can\'t open. It isn\'t damaged; it\'s sealed. The index gives it one word, LANTERN, an Authority classification, and a single access key: the deputy commander\'s. Everything else that came up on the Last Shuttles, I can read.\n\nI asked her about it. She said some Authority files were sealed for good reasons, and she would tell me if any of them became our business. Then she asked how the medical archive was coming along.',
    reveals: 'An Archive partition sealed under "Lantern" opens only to the deputy commander\'s key.',
  },
  {
    id: 'S1', mystery: 'severance', trigger: { kind: 'research', id: 'colonyPods' },
    author: 'Off-World Authority', dated: '1 March 2064',
    title: 'Directive OWA-64-11: Permanent settlement',
    body: 'With immediate effect, no permanent settlement shall be established at any location from which its whole population cannot be evacuated to Earth within ninety days. Existing research stations on the Moon and in Earth orbit are exempt. Habitat designs for permanent settlement are withdrawn from use and placed in the Archive for reference only. This directive follows the loss of the Ares Settlement and shall be reviewed in 2074.\n\n[Margin, Moonbase: Never reviewed. Colony pods rebuilt from the withdrawn designs. Ceres is a long way past ninety days. We are about to break Earth\'s last law on space. — A. Okafor-Lind]',
    reveals: 'After 2061 Earth banned settlements it couldn\'t evacuate; every colony the player founds breaks Earth\'s last law on space.',
  },
  {
    id: 'A2', mystery: 'ares', trigger: { kind: 'research', id: 'signalAnalysis' },
    author: 'Callum Brierley, Archivist',
    title: 'Decode notes: the raider broadcasts',
    body: 'Drizzle, probably. It usually was.\n\nThe loop the raiders broadcast isn\'t just degraded English; it\'s structured. Every transmission opens with a call sign in an old Consortium format: watch number, station, sequence. I found the format in the Archive, in a 2040 field handbook for a Mars programme called Deep Watch. The handbook\'s sample call signs and the raiders\' match exactly.\n\nWhoever flies those ships learned to talk from people who trained on that handbook. These aren\'t strangers who found Mars empty. They are the settlers\' descendants.\n\nI\'ve told the deputy. She said "good work" and asked me to keep it to the decode team for now.',
    reveals: 'The raiders use Deep Watch call signs from the 2040s: they are descended from the Ares settlers.',
  },
  {
    id: 'A3', mystery: 'ares', trigger: { kind: 'research', id: 'mutationStudy' },
    author: 'Dr Ines Carvalho, Chief Medical Officer',
    title: 'Pathology: raider remains, twelve cases',
    body: 'Twelve sets of remains, all adults under forty. Average height 2.04 metres. Bone density 61% of a lunar-born baseline. Every sample shows the same cascade: repair genes failing one after another, the way a building fails once the first beam goes. Radiation started it. A founding population that small left no healthy variation to dilute it.\n\nFrom the age profile and the damage in the youngest samples, I would put their whole population under 2,000 and falling. Within two generations there will be no one left to fly these ships.\n\nThey know. You can see it in the tissue: they have treated it with everything they have, and what they have is 2061 medicine.',
    reveals: 'There are fewer than 2,000 of them and falling; within two generations there will be none.',
  },
  {
    id: 'A4', mystery: 'ares', trigger: { kind: 'research', id: 'retroviralTherapy' },
    author: 'Dr Ines Carvalho, Chief Medical Officer',
    title: 'The therapy',
    body: 'The cure was in the Archive all along. Callum found it filed under inherited disorders: a retroviral repair therapy licensed on Earth in 2143 and used routinely for half a century. I didn\'t invent it. I adapted it to their genome, which took longer than it should have, because I kept stopping to be angry.\n\nAres went silent in 2061. Eighty years later Earth could have fixed this with a course of injections. Whatever else happened between them and us, nobody had to die of this.\n\nI have written the protocol so anyone can follow it. I would like it to reach them under my name, not the Authority\'s.',
    reveals: 'The cure is a 2140s Earth therapy; the Thinning was treatable all along.',
  },
  {
    id: 'V3', mystery: 'svalbard', trigger: { kind: 'research', id: 'cryoHabitats' },
    author: 'Off-World Authority, Contingency Office', dated: '11 December 2199',
    title: 'Svalbard vault: refit specification',
    body: 'Cold-climate habitat module, adapted from the Saturn survey designs, to be installed in the vault\'s service tunnel. Heat: geothermal loop with battery reserve. Occupancy: 9. Stores: 14 months at full ration. Projected surface winter: 30 to 40 months.\n\nCrew: Solheim I. (lead, vault keeper). Brierley N. (seed trials). Yusuf A. (crops). Ferrer L. (soils). Mehta A. (heat and power). Asante K. (medical). Kobayashi H. (communications). Eriksen T. (stores). Novák P. (records).\n\nAll volunteers. Each place signed for by the volunteer.',
    reveals: 'Nine named volunteers took 14 months of supplies into a winter forecast at three years: they knew it was one-way.',
  },
  {
    id: 'S4', mystery: 'severance', trigger: { kind: 'research', id: 'battlecruiser' },
    author: 'Off-World Authority, Security Directorate', dated: 'September 2062',
    title: 'Operation Red Return (sealed)',
    body: 'Objective: restore Authority administration at the Ares Settlement. Force: two armed transports, 140 security personnel. Transit: 210 days. Assessment: the settlement is believed to have lost power and contact after the 2061 dust storm. If survivors are present, resistance should be expected; the founders\' vote of 2061 rejected Authority oversight.\n\n[Annex C: Cancelled, March 2063, on cost. Ares to be recorded as lost with all hands.]\n\n[Note, Moonbase: A year after Earth said Ares was dead, it was planning to land soldiers there. The warship designs in this file are why we can build a battlecruiser at all. — C. Brierley]',
    reveals: 'Earth planned to invade Ares a year after declaring it lost.',
  },
  {
    id: 'S3', mystery: 'severance', trigger: { kind: 'research', id: 'terraforming' },
    author: 'Ares Consortium and Off-World Authority', dated: '2058',
    title: 'Ares Atmosphere Study, volume 1 (summary)',
    body: 'A breathable Mars is achievable within four to six centuries, beginning with orbital mirrors, nitrogen import and engineered soil biota. Phase 1 is estimated at 3% of the Authority\'s annual budget for twenty years. Recommendation: proceed, in partnership with the Ares Settlement.\n\n[Stamped, 2059: Shelved pending budget review.]\n\n[Note, Moonbase: Written to make Mars green for the people of Ares. Shelved two years before Ares stopped talking to us. We are using it to make Earth green instead. — C. Brierley]',
    reveals: 'Earth shelved the plan to make Mars habitable two years before the split.',
  },
];

export const FRAGMENT_BY_ID: Record<string, FragmentDef> = Object.fromEntries(FRAGMENTS.map((f) => [f.id, f]));
