import type { DeptId, FeedPolicy, GameState, TickResult } from './types';
import { STORY } from './data/lore';
import { runInstallation, TERRAFORM_FEED, TERRAFORM_RATE } from './economy';
import { moonbaseCommitted } from './logistics';
import { clearFuelNotes, runFleet } from './fleet';
import { runThreat, DEPT_NAMES } from './threat';
import { clone, moonbase, msg, setFlag } from './util';
import { chance, pick, randInt } from './rng';
import { sunDistance } from './orbits';
import { BLUEPRINT_BY_ID } from './data/blueprints';
import { canAfford } from './data/materials';


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
  // Surplus only (the default): the engines can't touch Moonbase's own reserve or what the colony routes have coming.
  const held = (e.feedPolicy ?? 'surplus') === 'surplus' ? moonbaseCommitted(s) : { oxygen: 0, water: 0, nitrogen: 0 };
  const avail = (k: 'nitrogen' | 'water' | 'oxygen') => Math.max(0, mb.stock[k] - held[k]);
  let frac = 1;
  for (const [k, v] of Object.entries(TERRAFORM_FEED)) frac = Math.min(frac, avail(k as 'water') / (v * e.engines));
  frac = Math.max(0, Math.min(1, frac));
  e.fed = frac;
  e.short = (Object.entries(TERRAFORM_FEED) as ['nitrogen' | 'water' | 'oxygen', number][])
    .filter(([k, v]) => avail(k) < v * e.engines - 1e-6).map(([k]) => k);
  for (const [k, v] of Object.entries(TERRAFORM_FEED)) mb.stock[k as 'water'] -= v * e.engines * frac;
  if (frac < 1 && setFlag(s, `tf-starved-${Math.floor(s.day / 30)}`)) {
    msg(s, 'warn', 'Terraforming starved', (e.feedPolicy ?? 'surplus') === 'surplus'
      ? 'The engines are short of nitrogen, water or oxygen: what Moonbase has is committed to its own reserve and the colony routes. Bring more in from Titan, Triton, Ganymede, Ceres or Venus, or switch the engines to Engines first.'
      : 'The engines on Earth are short of nitrogen, water or oxygen. Bring more in from Titan, Triton, Ganymede, Ceres or Venus.', 'earth');
  }
  const before = e.progress;
  e.progress = Math.min(100, e.progress + TERRAFORM_RATE * e.engines * frac);
  for (const [pct, story] of [[25, STORY.terraform25], [50, STORY.terraform50], [75, STORY.terraform75]] as const) {
    if (before < pct && e.progress >= pct) msg(s, 'story', story.title, story.text, 'earth');
  }
  // Engines add together, which the player may not realise: say so once per engine count, when Moonbase can afford another.
  const engineCost = BLUEPRINT_BY_ID.terraformer.cost;
  if (e.progress < 100 && !s.queue.some((q) => q.blueprintId === 'terraformer') && canAfford(mb.stock, engineCost)
    && setFlag(s, `tf-another-${e.engines}`)) {
    const left = 100 - e.progress;
    const now = Math.ceil(left / (TERRAFORM_RATE * e.engines));
    const next = Math.ceil(left / (TERRAFORM_RATE * (e.engines + 1)));
    msg(s, 'good', 'Materials for another Terraforming Engine',
      `Moonbase has enough to build another engine. Engines add together: each restores ${TERRAFORM_RATE}% a day. With ${e.engines + 1} engines Earth would be restored in about ${next} days instead of ${now}, and the daily feed rises to match.`, 'earth');
  }
}

/** What the player needs to plan restoration: current rate, finish estimate, feed in stock, and whether another engine is affordable. */
type FeedMat = 'nitrogen' | 'water' | 'oxygen';

export interface TerraformForecast {
  engines: number;
  queued: number;
  /** % a day per engine when fed */
  perEngine: number;
  /** % a day on the last day's actual feed */
  ratePerDay: number;
  /** % a day with every engine fully fed */
  fullRate: number;
  /** 0–1: share of the engines' feed supplied on the last day */
  fed: number;
  /** feed materials that ran short on the last day */
  short: ('nitrogen' | 'water' | 'oxygen')[];
  /** days to 100%: at the full rate when fed, at today's rate when short (Infinity if nothing gets through); null with no engines */
  daysLeft: number | null;
  finishDay: number | null;
  policy: FeedPolicy;
  /** per feed material: Moonbase stock, what's committed to its reserve and the colony routes, what the engines may draw on, and their daily use */
  feed: { mat: FeedMat; stock: number; committed: number; available: number; perDay: number }[];
  /** days of feed the engines can draw on, before production and deliveries */
  feedDays: number;
  anotherAffordable: boolean;
}

export function terraformForecast(s: GameState): TerraformForecast {
  const e = s.earth;
  const mb = moonbase(s);
  const queued = s.queue.filter((q) => q.blueprintId === 'terraformer').length;
  const policy = e.feedPolicy ?? 'surplus';
  const held = policy === 'surplus' ? moonbaseCommitted(s) : { oxygen: 0, water: 0, nitrogen: 0 };
  const committed = moonbaseCommitted(s);
  const feed = (Object.entries(TERRAFORM_FEED) as [FeedMat, number][]).map(([mat, v]) => ({
    mat, stock: mb.stock[mat], committed: committed[mat], available: Math.max(0, mb.stock[mat] - held[mat]), perDay: v * e.engines,
  }));
  // Days of feed the engines can draw on now. Daily production and deliveries come on top, so this is a floor.
  let feedDays = Infinity;
  if (e.engines > 0) for (const f of feed) feedDays = Math.min(feedDays, f.available / f.perDay);
  // The rate is what the engines actually received on the last day. End-of-day stock is the wrong measure:
  // income arrives the next day before the engines draw, so a base living hand to mouth can look unfed when it isn't.
  const fed = e.engines > 0 ? Math.max(0, Math.min(1, e.fed ?? 1)) : 1;
  const left = Math.max(0, 100 - e.progress);
  const fullRate = TERRAFORM_RATE * e.engines;
  const ratePerDay = e.engines > 0 && left > 0 ? fullRate * fed : 0;
  // Estimate at today's rate when short, so the date doesn't promise more than the feed allows.
  const rate = fed < 1 ? ratePerDay : fullRate;
  const daysLeft = e.engines > 0 ? (rate > 0 ? Math.ceil(left / rate) : Infinity) : null;
  return {
    engines: e.engines,
    queued,
    perEngine: TERRAFORM_RATE,
    ratePerDay,
    fullRate,
    fed,
    short: e.short ?? [],
    daysLeft,
    finishDay: daysLeft === null || !Number.isFinite(daysLeft) ? null : s.day + daysLeft,
    feedDays: Number.isFinite(feedDays) ? Math.floor(feedDays) : Infinity,
    policy,
    feed,
    anotherAffordable: s.research.done.includes('terraforming') && canAfford(mb.stock, BLUEPRINT_BY_ID.terraformer.cost),
  };
}

/** A rate for display: one decimal place, or two below 0.1, so a slow rate never reads as 0.0%. */
export function fmtRate(pct: number): string {
  if (pct <= 0) return '0%';
  return pct < 0.1 ? `${pct.toFixed(2)}%` : `${pct.toFixed(1)}%`;
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
