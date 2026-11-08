import { describe, expect, it } from 'vitest';
import {
  newGame, advanceDay, advanceUntilEvent, serialize, deserialize, sendShip, queueBuild, setResearch,
  travelDays, position, moonbase, toggleDept, raidSize,
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
