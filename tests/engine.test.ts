import { describe, expect, it } from 'vitest';
import {
  newGame, advanceDay, advanceUntilEvent, serialize, deserialize, sendShip, queueBuild, setResearch,
  travelDays, position, moonbase, toggleDept, raidSize, toggleCommsWatch, readFragment, deptDemand,
  archiveStats, FRAGMENTS, RESEARCH_BY_ID, COMMS_WATCH_MW, type GameState,
  setGrowthPolicy, lsNeed, workforce, popCap, growthLimit, reserveOf, terraformForecast, fmtRate, BLUEPRINT_BY_ID,
} from '../src/engine';
import { playBot } from './bot';
import { addShip } from '../src/engine/newGame';
import { resolveRaid } from '../src/engine/threat';
import { makeInstallation } from '../src/engine/util';
import { workforce as workforceOf, commissioningOf, miningRates, COMMISSION_PER_DELIVERY } from '../src/engine/economy';

describe('orbits', () => {
  it('places planets at their real distances', () => {
    const e = position('earth', 0);
    expect(Math.hypot(e.x, e.y)).toBeCloseTo(1, 5);
    const j = position('jupiter', 100);
    expect(Math.hypot(j.x, j.y)).toBeCloseTo(5.203, 3);
  });
  it('makes outer worlds take longer to reach', () => {
    const mars = travelDays('moon', 'mars', 0, 0.02);
    const saturn = travelDays('moon', 'saturn', 0, 0.02);
    expect(saturn).toBeGreaterThan(mars);
    expect(travelDays('moon', 'earth', 0, 0.02)).toBe(3);
  });
});

describe('core loop', () => {
  it('is deterministic for a seed', () => {
    let a = newGame(42), b = newGame(42);
    for (let i = 0; i < 200; i++) { a = advanceDay(a).state; b = advanceDay(b).state; }
    expect(serialize(a)).toEqual(serialize(b));
  });

  it('round-trips a save mid-game and stays in lockstep', () => {
    let a = newGame(7);
    for (let i = 0; i < 50; i++) a = advanceDay(a).state;
    let b = deserialize(serialize(a));
    for (let i = 0; i < 100; i++) { a = advanceDay(a).state; b = advanceDay(b).state; }
    expect(serialize(b)).toEqual(serialize(a));
  });

  it('mines the Moon and keeps 100 people alive with no input', () => {
    let s = newGame(1);
    const ti0 = moonbase(s).stock.titanium;
    s = advanceDay(s).state;
    expect(moonbase(s).stock.titanium).toBeGreaterThan(ti0);
    expect(moonbase(s).report.powerGen).toBeGreaterThan(moonbase(s).report.powerDemand);
  });

  it('probes reveal a world', () => {
    let s = newGame(3);
    const probe = Object.values(s.ships).find((x) => x.type === 'probe')!;
    const r = sendShip(s, probe.id, 'ceres');
    expect(r.ok).toBe(true);
    s = (r as { state: typeof s }).state;
    expect(s.ships[probe.id].status).toBe('transit');
    const res = advanceUntilEvent(s, 400);
    let t = res.state;
    for (let i = 0; i < 400 && t.bodies.ceres.knowledge === 0; i++) t = advanceDay(t).state;
    expect(t.bodies.ceres.knowledge).toBe(1);
    expect(t.ships[probe.id]).toBeUndefined();
  });

  it('builds things from the queue and researches', () => {
    let s = newGame(5);
    s = (queueBuild(s, 'probe') as { state: typeof s }).state;
    s = (setResearch(s, 'surveyor') as { state: typeof s }).state;
    const before = Object.keys(s.ships).length;
    for (let i = 0; i < 10; i++) s = advanceDay(s).state;
    expect(Object.keys(s.ships).length).toBe(before + 1);
    expect(s.research.done).toContain('surveyor');
  });

  it('refuses to switch off life support', () => {
    const s = newGame(5);
    expect(toggleDept(s, 'moonbase', 'lifeSupport').ok).toBe(false);
  });

  it('escalates raids', () => {
    const s = newGame(5);
    expect(raidSize(s, 10).ships).toBeGreaterThan(raidSize(s, 1).ships);
  });
});

const okState = (r: { ok: boolean }) => (r as unknown as { state: GameState }).state;

describe('comms watch', () => {
  it('is a visible 0.4 MW load under Moonbase life support, and nowhere else', () => {
    const s = newGame(1);
    const mb = moonbase(s);
    expect(mb.commsWatch).toBe(true);
    const with_ = deptDemand(mb, 'lifeSupport');
    expect(deptDemand({ ...mb, commsWatch: false }, 'lifeSupport')).toBeCloseTo(with_ - COMMS_WATCH_MW, 6);
    expect(mb.report.powerDemand).toBeGreaterThan(0);
    expect(mb.report.powerGen).toBeGreaterThan(mb.report.powerDemand);
  });

  it('draws one objection, then obeys, and can be switched back on', () => {
    let s = newGame(1);
    s = okState(toggleCommsWatch(s));
    expect(moonbase(s).commsWatch).toBe(true);
    expect(s.messages.at(-1)!.kind).toBe('story');
    s = okState(toggleCommsWatch(s));
    expect(moonbase(s).commsWatch).toBe(false);
    s = okState(toggleCommsWatch(s));
    expect(moonbase(s).commsWatch).toBe(true);
    // No second objection.
    const before = s.messages.length;
    s = okState(toggleCommsWatch(s));
    expect(moonbase(s).commsWatch).toBe(false);
    expect(s.messages.slice(before).some((m) => m.kind === 'story')).toBe(false);
  });

  it('survivors cannot find Moonbase while it is off', () => {
    for (const seed of [2, 3, 4, 5]) {
      let s = newGame(seed);
      moonbase(s).commsWatch = false;
      for (let i = 0; i < 499; i++) s = advanceDay(s).state;
      expect(s.flags.some((f) => f.startsWith('survivors'))).toBe(false);
    }
  });
});

describe('population policy', () => {
  it('defaults to Grow, and each policy has visible costs and effects', () => {
    let s = newGame(3);
    const mb = () => moonbase(s);
    mb().equipment.habitat = 2; // room to grow
    expect(mb().growth).toBeUndefined();
    const base = lsNeed({ ...mb(), growth: 'steady' }).oxygen;
    expect(lsNeed(mb()).oxygen).toBeCloseTo(base * 1.1, 6);
    // Grow costs nothing extra once the reserve is full.
    const full = popCap(mb()) * 1.1;
    expect(lsNeed({ ...mb(), population: full }).oxygen).toBeCloseTo(lsNeed({ ...mb(), population: full, growth: 'steady' }).oxygen, 6);
    s = okState(setGrowthPolicy(s, 'moonbase', 'hold'));
    expect(lsNeed(mb()).oxygen).toBeCloseTo(base * 0.9, 6);
    expect(workforce(mb())).toBeCloseTo(workforce({ ...mb(), growth: 'grow' }) * 1.1, 6);
    const p0 = mb().population;
    for (let i = 0; i < 30; i++) s = advanceDay(s).state;
    expect(mb().population).toBeLessThanOrEqual(p0);
  });

  it('at full capacity every policy keeps a trade-off: reserve versus output (Moonbase)', () => {
    const s = newGame(3);
    const mb = moonbase(s); // starts full: 100 of 100
    expect(mb.population).toBe(popCap(mb));
    // Grow keeps growing into an off-duty reserve of up to 10%.
    expect(growthLimit(mb)).toBeCloseTo(110, 6);
    expect(growthLimit({ ...mb, growth: 'steady' })).toBeCloseTo(105, 6);
    expect(growthLimit({ ...mb, growth: 'hold' })).toBeCloseTo(100, 6);
    const withReserve = { ...mb, population: 110 };
    expect(reserveOf(withReserve)).toBeCloseTo(10, 6);
    // The reserve eats but doesn't work on Grow; on Hold it goes on duty.
    expect(workforce(withReserve)).toBeCloseTo(workforce(mb), 6);
    expect(workforce({ ...withReserve, growth: 'hold' })).toBeGreaterThan(workforce(withReserve));
    // Hold's rationing and crisis effort only apply below capacity: no free bonus when full.
    expect(lsNeed({ ...mb, growth: 'hold' }).oxygen).toBeCloseTo(lsNeed({ ...mb, growth: 'steady' }).oxygen, 6);
    expect(workforce({ ...mb, growth: 'hold' })).toBeCloseTo(workforce(mb), 6);
  });

  it('a Grow reserve builds up at Moonbase and absorbs the first losses', () => {
    let s = newGame(3);
    for (let i = 0; i < 60; i++) s = advanceDay(s).state;
    const mb = moonbase(s);
    expect(mb.population).toBeGreaterThan(popCap(mb));
    expect(mb.population).toBeLessThanOrEqual(growthLimit(mb) + 1e-9);
    const crewBefore = workforce(mb);
    expect(workforce({ ...mb, population: mb.population - reserveOf(mb) })).toBeCloseTo(crewBefore, 6);
  });

  it('colonies keep their 100 cap: no reserve', () => {
    const s = newGame(3);
    const col = { ...moonbase(s), isMoonBase: false, population: 100 };
    expect(growthLimit(col)).toBe(100);
  });

  it('grows fastest on Grow, slower on Steady', () => {
    const grown = (g: 'grow' | 'steady') => {
      const s0 = newGame(3);
      moonbase(s0).equipment.habitat = 2;
      let s = okState(setGrowthPolicy(s0, 'moonbase', g));
      for (let i = 0; i < 60; i++) s = advanceDay(s).state;
      return moonbase(s).population;
    };
    expect(grown('grow')).toBeGreaterThan(grown('steady'));
    expect(grown('steady')).toBeGreaterThan(100);
  });
});

describe('archive', () => {
  it('every fragment is triggered by a real project and stays within 30 to 150 words', () => {
    for (const f of FRAGMENTS) {
      expect(RESEARCH_BY_ID[f.trigger.id], f.id).toBeDefined();
      const words = f.body.split(/\s+/).filter(Boolean).length;
      expect(words, f.id).toBeGreaterThanOrEqual(30);
      expect(words, f.id).toBeLessThanOrEqual(150);
    }
  });

  it('recovers a document quietly when its project completes, and records reading', () => {
    let s = newGame(5);
    s = okState(setResearch(s, 'surveyor'));
    for (let i = 0; i < 10; i++) s = advanceDay(s).state;
    expect(s.archive.map((e) => e.id)).toContain('W1');
    expect(s.messages.some((m) => m.kind === 'story' && m.day > 0)).toBe(false);
    expect(archiveStats(s)).toMatchObject({ found: 1, read: 0 });
    const day = s.archive[0].day;
    for (let i = 0; i < 3; i++) s = advanceDay(s).state;
    s = okState(readFragment(s, 'W1', true));
    s = okState(readFragment(s, 'W1'));
    expect(archiveStats(s)).toMatchObject({ found: 1, read: 1, reopened: 1, interruptedPlay: 1, medianDaysToOpen: s.day - day });
  });

  it('upgrades a version 1 save: the watch is on and past research is in the archive', () => {
    let s = newGame(5);
    s = okState(setResearch(s, 'surveyor'));
    for (let i = 0; i < 10; i++) s = advanceDay(s).state;
    const old = JSON.parse(serialize(s));
    old.version = 1;
    delete old.archive;
    delete old.installations.moonbase.commsWatch;
    const up = deserialize(JSON.stringify(old));
    expect(up.version).toBe(2);
    expect(moonbase(up).commsWatch).toBe(true);
    expect(up.archive.map((e) => e.id)).toEqual(['W1']);
    // Back-filled documents don't count towards the playtest reading stats.
    expect(up.archive[0].backfilled).toBe(true);
    expect(archiveStats(up)).toMatchObject({ found: 0, backfilled: 1, read: 0 });
    const opened = okState(readFragment(up, 'W1'));
    expect(archiveStats(opened)).toMatchObject({ found: 0, read: 0, medianDaysToOpen: null });
  });
});

describe('terraforming readability', () => {
  function earthGame(engines: number, progress: number, rich: boolean): GameState {
    const s = newGame(1);
    s.research.done.push('terraforming');
    s.earth = { engines, progress, probed: true };
    const mb = moonbase(s);
    mb.stock.nitrogen = 1e6; mb.stock.water = 1e6; mb.stock.oxygen = 1e6;
    if (rich) for (const [k, v] of Object.entries(BLUEPRINT_BY_ID.terraformer.cost)) mb.stock[k as 'iron'] = Math.max(mb.stock[k as 'iron'], v * 2);
    else for (const k of Object.keys(BLUEPRINT_BY_ID.terraformer.cost)) if (k !== 'nitrogen') mb.stock[k as 'iron'] = 0;
    return s;
  }

  it('forecasts the rate and finish, and engines add together', () => {
    const one = terraformForecast(earthGame(1, 16, false));
    expect(one.ratePerDay).toBeCloseTo(0.2);
    expect(one.daysLeft).toBe(420);
    expect(one.anotherAffordable).toBe(false);
    const four = terraformForecast(earthGame(4, 16, false));
    expect(four.ratePerDay).toBeCloseTo(0.8);
    expect(four.daysLeft).toBe(105);
  });

  it('reports the rate the engines actually got, including a shortfall', () => {
    for (const water of [1e6, 1200]) { // plenty; then less than a day's feed for two engines
      const s = earthGame(2, 50, false);
      moonbase(s).stock.water = water;
      const next = advanceDay(s).state;
      const f = terraformForecast(next);
      expect(f.ratePerDay).toBeCloseTo(next.earth.progress - 50, 6);
      if (water < 1600) {
        expect(f.fed).toBeLessThan(1);
        expect(f.short).toContain('water');
        expect(f.fullRate).toBeCloseTo(0.4);
      } else {
        expect(f.fed).toBe(1);
        expect(f.short).toEqual([]);
      }
    }
  });

  it('never shows a slow rate as 0.0%', () => {
    expect(fmtRate(0.04)).toBe('0.04%');
    expect(fmtRate(0.8)).toBe('0.8%');
    expect(fmtRate(0)).toBe('0%');
  });

  it('says once per engine count when Moonbase can afford another engine', () => {
    let s = earthGame(1, 10, true);
    s = advanceDay(s).state;
    const prompts = (g: GameState) => g.messages.filter((m) => m.title === 'Materials for another Terraforming Engine').length;
    expect(prompts(s)).toBe(1);
    expect(terraformForecast(s).anotherAffordable).toBe(true);
    s = advanceDay(s).state;
    expect(prompts(s)).toBe(1);
    s.earth.engines = 2;
    s = advanceDay(s).state;
    expect(prompts(s)).toBe(2);
  });

  it('stays quiet when an engine is already queued', () => {
    let s = earthGame(1, 10, true);
    const r = queueBuild(s, 'terraformer', 'earth');
    expect(r.ok).toBe(true);
    if (r.ok) s = r.state;
    s.queue.forEach((q) => { q.started = true; }); // paid, so stock stays affordable for the check
    s = advanceDay(s).state;
    expect(s.messages.some((m) => m.title === 'Materials for another Terraforming Engine')).toBe(false);
  });
});

describe('raids', () => {
  function raidOn(lsDamage: number, seed: number) {
    const s = newGame(seed);
    const col = makeInstallation(s, 'ceres', false, 200);
    s.installations[col.id] = col;
    col.depts.lifeSupport!.damage = lsDamage;
    return resolveRaid(s, { id: 'r', ships: 40, quality: 1.5, targetInstallationId: col.id, targetBodyId: 'ceres', launchDay: 0, arriveDay: 0 })!;
  }

  it('bombarding an already wrecked life-support plant kills no one directly', () => {
    for (let seed = 1; seed <= 20; seed++) expect(raidOn(100, seed).casualties).toBe(0);
  });

  it('bombarding a working plant still causes casualties', () => {
    const total = Array.from({ length: 20 }, (_, i) => raidOn(0, i + 1).casualties).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe('colony survival', () => {
  /** A powered colony on Ceres with the given people and life-support stock. */
  function colony(pop: number, stock: { oxygen?: number; water?: number; nitrogen?: number }, opts: { founders?: number; commissioning?: number } = {}) {
    const s = newGame(7);
    const col = makeInstallation(s, 'ceres', false, pop);
    col.equipment.reactor = 1;
    if (opts.founders !== undefined) col.founders = opts.founders;
    if (opts.commissioning !== undefined) col.commissioning = opts.commissioning;
    col.stock.oxygen = stock.oxygen ?? 0; col.stock.water = stock.water ?? 0; col.stock.nitrogen = stock.nitrogen ?? 0;
    s.installations[col.id] = col;
    s.bodies.ceres.installationId = col.id;
    // Ceres has local water; take it away so these tests control supply.
    s.bodies.ceres.composition = { iron: 0.3, silica: 0.2 } as typeof s.bodies.ceres.composition;
    return { s, id: col.id };
  }
  const run = (s: GameState, days: number) => { for (let i = 0; i < days; i++) s = advanceDay(s).state; return s; };

  it('the founding party survives running out of oxygen and water', () => {
    const { s, id } = colony(50, {}, { founders: 50 });
    const after = run(s, 90);
    expect(after.installations[id]).toBeDefined();
    expect(after.installations[id].population).toBe(50);
  });

  it('people beyond the founders can still die of shortages, down to the founders', () => {
    const { s, id } = colony(90, {}, { founders: 50 });
    const after = run(s, 90);
    expect(after.installations[id].population).toBe(50);
    expect(after.messages.some((m) => m.title.endsWith('down to the founding party'))).toBe(true);
  });

  it('older saves treat a colony as having 50 founders and as fully commissioned', () => {
    const { s, id } = colony(80, {});
    expect(s.installations[id].founders).toBeUndefined();
    expect(commissioningOf(s.installations[id])).toBe(1);
    expect(run(s, 90).installations[id].population).toBe(50);
  });

  it('raids cannot kill the founding party', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame(seed);
      const col = makeInstallation(s, 'ceres', false, 60);
      col.founders = 50;
      s.installations[col.id] = col;
      const r = resolveRaid(s, { id: 'r', ships: 60, quality: 2, targetInstallationId: col.id, targetBodyId: 'ceres', launchDay: 0, arriveDay: 0 })!;
      expect(r.casualties).toBeLessThanOrEqual(10);
      expect(s.installations[col.id].population).toBeGreaterThanOrEqual(50);
    }
  });

  it('a nitrogen shortage slows work and stops growth but kills no one', () => {
    const { s, id } = colony(80, { oxygen: 1e6, water: 1e6, nitrogen: 0 }, { founders: 50 });
    const before = workforceOf(s.installations[id]);
    const after = run(s, 60);
    const col = after.installations[id];
    expect(col.population).toBe(80);
    expect(col.report.nitrogenShort).toBe(true);
    expect(col.report.lifeSupportOk).toBe(true);
    expect(workforceOf(col)).toBeLessThan(before);
    expect(after.messages.filter((m) => m.title.endsWith('nitrogen short')).length).toBe(1);
  });

  it('a new colony commissions itself slowly, and a delivery speeds it up', () => {
    const { s, id } = colony(50, { oxygen: 1e6, water: 1e6, nitrogen: 1e6 }, { founders: 50, commissioning: 0 });
    const after = run(s, 30);
    const c = commissioningOf(after.installations[id]);
    expect(c).toBeCloseTo(30 / 150, 5);
    // Ore output scales with commissioning; nothing grows before it starts.
    const full = miningRates(after, { ...after.installations[id], commissioning: 1 }, 1);
    const now = miningRates(after, after.installations[id], 1);
    expect(now.iron!).toBeCloseTo(full.iron! * c, 6);
    // A freighter arriving with supplies adds a chunk.
    const f = addShip(after, 'freighter', 'moon');
    f.status = 'transit'; f.at = 'moon';
    f.transit = { from: 'moon', to: 'ceres', departDay: after.day - 10, arriveDay: after.day + 1, purpose: 'haulOut' };
    const next = advanceDay(after).state;
    expect(commissioningOf(next.installations[id])).toBeCloseTo(c + 1 / 150 + COMMISSION_PER_DELIVERY, 5);
  });
});

describe('full playthrough (scripted bot)', () => {
  for (const seed of [11, 202, 3003]) {
    it(`seed ${seed}: the game is winnable`, () => {
      const { state, log } = playBot(newGame(seed), 2500);
      const mb = moonbase(state);
      // eslint-disable-next-line no-console
      console.log(`seed ${seed}: outcome=${state.outcome?.result ?? 'none'} day=${state.day} pop=${Math.floor(mb.population)} colonies=${Object.keys(state.installations).length - 1} wave=${state.threat.wave} status=${state.threat.status} earth=${state.earth.progress.toFixed(1)}% research=${state.research.done.length}`, log.milestones);
      console.log(log.events.slice(0, 60).join('\n'));
      expect(state.outcome?.result).toBe('won');
    });
  }

  it('conquest path: Mars can be taken by force', () => {
    const { state, log } = playBot(newGame(77), 2500, { conquest: true });
    console.log(`conquest: outcome=${state.outcome?.result} day=${state.day} status=${state.threat.status} wave=${state.threat.wave}`, log.milestones);
    expect(state.threat.status).toBe('conquered');
  });
  it('hard difficulty is survivable by a competent player', () => {
    const { state, log } = playBot(newGame(5150, { difficulty: 'hard' }), 2500);
    console.log(`hard: outcome=${state.outcome?.result} day=${state.day} status=${state.threat.status} wave=${state.threat.wave}`, log.milestones);
    expect(state.outcome?.result).toBe('won');
  });
});
