import { describe, expect, it } from 'vitest';
import {
  newGame, advanceDay, advanceUntilEvent, serialize, deserialize, sendShip, queueBuild, setResearch,
  travelDays, position, moonbase, toggleDept, raidSize, toggleCommsWatch, readFragment, deptDemand,
  archiveStats, FRAGMENTS, RESEARCH_BY_ID, COMMS_WATCH_MW, type GameState,
  setGrowthPolicy, lsNeed, workforce, popCap, growthLimit, reserveOf, terraformForecast, BLUEPRINT_BY_ID,
} from '../src/engine';
import { playBot } from './bot';

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

  it('reports a feed shortfall', () => {
    const s = earthGame(2, 50, false);
    moonbase(s).stock.water = 800; // half a day for two engines
    const f = terraformForecast(s);
    expect(f.fed).toBeCloseTo(0.5);
    expect(f.ratePerDay).toBeCloseTo(0.2);
    expect(f.feedDays).toBe(0);
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
