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
};
