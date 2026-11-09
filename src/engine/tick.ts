import type { DeptId, GameState, TickResult } from './types';
import { STORY } from './data/lore';
import { runInstallation } from './economy';
import { clearFuelNotes, runFleet } from './fleet';
import { runThreat, DEPT_NAMES } from './threat';
import { clone, moonbase, msg, setFlag } from './util';
import { chance, pick, randInt } from './rng';
import { sunDistance } from './orbits';

export const TERRAFORM_FEED = { nitrogen: 400, water: 800, oxygen: 200 } as const;
export const TERRAFORM_RATE = 0.2; // % per engine per day when fully fed

/** Advance the simulation by one day. Pure: returns a new state. */
export function advanceDay(prev: GameState): TickResult {
  if (prev.outcome) return { state: prev, pause: true, newMessages: [] };
  const s = clone(prev);
  const firstMsg = s.nextMsg;
  s.day += 1;
  s.modifiers = s.modifiers.filter((m) => m.until > s.day);

  // 1. Installations (Moonbase first: it runs research and production)
  const insts = Object.values(s.installations).sort((a, b) => Number(b.isMoonBase) - Number(a.isMoonBase));
  for (const inst of insts) runInstallation(s, inst);

  // 2. Fleet movements and work
  runFleet(s);
  clearFuelNotes(s);

  // 3. Earth
  runEarth(s);

  // 4. The adversary
  runThreat(s);

  // 5. Random events
  runEvents(s);

  // 6. Win / lose
  const mb = moonbase(s);
  const totalPop = Object.values(s.installations).reduce((a, i) => a + i.population, 0);
  s.stats.peakPopulation = Math.max(s.stats.peakPopulation, Math.floor(totalPop));
  if (mb.population < 1) {
    s.outcome = { result: 'lost', day: s.day, reason: STORY.defeatPopulation.text };
    msg(s, 'alert', STORY.defeatPopulation.title, STORY.defeatPopulation.text);
  } else if (s.earth.progress >= 100) {
    s.outcome = { result: 'won', day: s.day, reason: STORY.victory.text };
    msg(s, 'story', STORY.victory.title, STORY.victory.text, 'earth');
  }

  const newMessages = s.messages.filter((m) => m.id > firstMsg);
  const pause = !!s.outcome || newMessages.some((m) => m.kind === 'alert' || m.kind === 'story');
  return { state: s, pause, newMessages };
}

function runEarth(s: GameState): void {
  const e = s.earth;
  if (e.engines <= 0 || e.progress >= 100) return;
  const mb = moonbase(s);
  let frac = 1;
  for (const [k, v] of Object.entries(TERRAFORM_FEED)) frac = Math.min(frac, mb.stock[k as 'water'] / (v * e.engines));
  frac = Math.max(0, Math.min(1, frac));
  for (const [k, v] of Object.entries(TERRAFORM_FEED)) mb.stock[k as 'water'] -= v * e.engines * frac;
  if (frac < 1 && setFlag(s, `tf-starved-${Math.floor(s.day / 30)}`)) {
    msg(s, 'warn', 'Terraforming starved', 'The engines on Earth are short of nitrogen, water or oxygen. Bring more in from Titan, Triton, Ceres or Venus.', 'earth');
  }
  const before = e.progress;
  e.progress = Math.min(100, e.progress + TERRAFORM_RATE * e.engines * frac);
  for (const [pct, story] of [[25, STORY.terraform25], [50, STORY.terraform50], [75, STORY.terraform75]] as const) {
    if (before < pct && e.progress >= pct) msg(s, 'story', story.title, story.text, 'earth');
  }
}

function runEvents(s: GameState): void {
  const insts = Object.values(s.installations);
  const colonies = insts.filter((i) => !i.isMoonBase);
  if (chance(s, 0.004) && !s.modifiers.some((m) => m.kind === 'solarFlare')) {
    s.modifiers.push({ kind: 'solarFlare', until: s.day + 5 });
    const hit = insts.filter((i) => sunDistance(i.bodyId, s.day) < 2 && i.equipment.shields === 0).map((i) => i.name);
    msg(s, 'warn', 'Solar storm', `A coronal mass ejection is sweeping the inner system. Solar output inside 2 AU is down 60% for five days${hit.length ? ` (${hit.join(', ')})` : ''}. Shield generators protect arrays.`);
  }
  if (chance(s, 0.003)) {
    const inst = pick(s, insts);
    const depts = Object.keys(inst.depts) as DeptId[];
    const d = pick(s, depts);
    const amt = randInt(s, 12, 28);
    inst.depts[d]!.damage = Math.min(100, inst.depts[d]!.damage + amt);
    msg(s, 'warn', `Meteoroid strike: ${inst.name}`, `${DEPT_NAMES[d]} took ${amt}% damage. Repair crews are on it.`, inst.id);
  }
  if (colonies.length && chance(s, 0.003)) {
    const c = pick(s, colonies);
    s.bodies[c.bodyId].richUntil = s.day + 30;
    msg(s, 'good', `Rich seam: ${c.name}`, 'Geologists have hit a rich seam. Mining output +50% for 30 days.', c.id);
  }
  const mb = moonbase(s);
  // Survivors can only find Moonbase while the comms watch is listening on the rescue bands.
  if (s.day < 500 && s.flags.filter((f) => f.startsWith('survivors')).length < 3 && chance(s, 0.0015) && mb.commsWatch) {
    const n = randInt(s, 4, 12);
    s.flags.push(`survivors${s.day}`);
    mb.population += n;
    msg(s, 'good', 'Survivors!', `A lifeboat from a pre-impact orbital station has docked with ${n} survivors aboard. It homed in on the comms watch's rescue band.`);
  }
}

/** Advance until something needs attention, or `max` days pass. */
export function advanceUntilEvent(state: GameState, max: number): TickResult {
  let res: TickResult = { state, pause: false, newMessages: [] };
  const all = [];
  for (let i = 0; i < max; i++) {
    res = advanceDay(res.state);
    all.push(...res.newMessages);
    if (res.pause) break;
  }
  return { ...res, newMessages: all };
}
