import { describe, it, expect } from 'vitest';
import {
  newGame, advanceDay, setFreighterRoute, setRoutePreference, setFeedPolicy, moonbase, type GameState,
  plannedLoad, homeboundLoad, colonyKeep, moonbaseCommitted, routeInterval, legDays, supplyForecast, TERRAFORM_FEED,
} from '../src/engine';
import { addShip } from '../src/engine/newGame';
import { makeInstallation } from '../src/engine/util';

/** Moonbase with plenty of fuel and supplies, a fusion drive, and a colony on Ganymede. */
function setup(seed = 5) {
  const s = newGame(seed);
  s.research.done.push('ionDrive', 'fission', 'fusionDrive', 'colonyPods', 'radiationHardening');
  const mb = moonbase(s);
  mb.stock.hydrogen = 1e7; mb.stock.oxygen = 1e6; mb.stock.water = 1e6; mb.stock.nitrogen = 1e6;
  const col = makeInstallation(s, 'ganymede', false, 50);
  col.equipment.reactor = 1;
  return { s, col };
}
const ok = (r: ReturnType<typeof setFreighterRoute>) => { if (!r.ok) throw new Error(r.error); return r.state; };
const run = (s: GameState, days: number) => { for (let i = 0; i < days; i++) s = advanceDay(s).state; return s; };

describe('shared route schedule', () => {
  it('spaces departures across the freighters on a route', () => {
    let { s, col } = setup();
    const a = addShip(s, 'freighter', 'moon'); const b = addShip(s, 'freighter', 'moon');
    s = ok(setFreighterRoute(s, a.id, col.id));
    s = ok(setFreighterRoute(s, b.id, col.id));
    expect(s.ships[a.id].status).toBe('transit');
    expect(s.ships[b.id].status).toBe('docked'); // waits for the route's next slot
    const interval = routeInterval(s, 'ganymede', 2, s.day);
    expect(s.routes![col.id].lastDeparture).toBe(s.day);
    expect(interval).toBeLessThan(routeInterval(s, 'ganymede', 1, s.day));
    const later = run(s, interval);
    expect(later.ships[b.id].status).toBe('transit');
    expect(later.ships[b.id].transit!.departDay).toBe(s.day + interval);
  });

  it('counts supplies already in flight before loading another top-up', () => {
    let { s, col } = setup();
    col.stock.oxygen = 0; col.stock.nitrogen = 0;
    const arrive = s.day + legDays(s, 'ganymede', s.day);
    const first = plannedLoad(s, col, arrive, 60);
    expect(first.oxygen).toBeGreaterThan(0);
    const a = addShip(s, 'freighter', 'moon');
    s = ok(setFreighterRoute(s, a.id, col.id));
    const second = plannedLoad(s, s.installations[col.id], arrive, 60);
    expect(second.oxygen).toBeLessThan(first.oxygen * 0.2);
  });
});

describe('freighters for a colony ship in flight', () => {
  it('leaves so as to arrive just after landing, then takes the colony as its route', () => {
    let { s } = setup();
    delete s.installations[Object.keys(s.installations).find((k) => k !== 'moonbase')!];
    s.bodies.ganymede.installationId = undefined;
    const cs = addShip(s, 'colonyShip', 'moon');
    cs.colonists = 50; cs.status = 'transit';
    cs.transit = { from: 'moon', to: 'ganymede', departDay: s.day, arriveDay: s.day + 70, purpose: 'colonise' };
    const f = addShip(s, 'freighter', 'moon');
    s = ok(setFreighterRoute(s, f.id, 'ganymede'));
    expect(s.ships[f.id].routeBody).toBe('ganymede');
    let departed = -1;
    for (let i = 0; i < 80; i++) {
      s = advanceDay(s).state;
      if (departed < 0 && s.ships[f.id].status === 'transit') {
        departed = s.day;
        expect(s.ships[f.id].transit!.arriveDay).toBeGreaterThanOrEqual(cs.transit!.arriveDay + 1);
        expect(s.ships[f.id].cargo.oxygen).toBeGreaterThan(0);
      }
    }
    expect(departed).toBeGreaterThan(0);
    const col = Object.values(s.installations).find((i) => i.bodyId === 'ganymede')!;
    expect(col).toBeDefined();
    expect(s.ships[f.id].routeTo).toBe(col.id);
    expect(s.ships[f.id].routeBody).toBeUndefined();
  });
});

describe('homebound cargo follows Moonbase demand', () => {
  it('brings water before silver when the engines need water, and never strips the colony', () => {
    const { s, col } = setup();
    s.earth.engines = 5; s.earth.progress = 30;
    moonbase(s).stock.water = 0;
    col.stock.silver = 500000; col.stock.water = 500000;
    const load = homeboundLoad(s, col, 200000, 60);
    expect(load.water ?? 0).toBeGreaterThan(150000);
    expect((load.water ?? 0) + (load.silver ?? 0)).toBeLessThanOrEqual(200000 + 1);
    const keep = colonyKeep(col, 60);
    expect(col.stock.water - (load.water ?? 0)).toBeGreaterThanOrEqual(keep.water - 1);
  });

  it('the colony keeps what it needs even when Moonbase is desperate', () => {
    const { s, col } = setup();
    s.earth.engines = 10; s.earth.progress = 30;
    moonbase(s).stock.water = 0;
    const keep = colonyKeep(col, 60);
    col.stock.water = keep.water + 1000;
    const load = homeboundLoad(s, col, 200000, 60);
    expect(load.water ?? 0).toBeLessThanOrEqual(1000 + 1);
  });

  it('a route preference goes first only while Moonbase needs it', () => {
    let { s, col } = setup();
    col.stock.titanium = 500000; col.stock.iron = 500000;
    s.queue.push({ id: 'q1', blueprintId: 'terraformer', targetId: 'earth', progress: 0, started: false, repeat: false });
    const mb = moonbase(s); mb.stock.titanium = 0; mb.stock.iron = 0;
    const r = setRoutePreference(s, col.id, 'iron'); if (!r.ok) throw new Error(r.error); s = r.state;
    const c2 = s.installations[col.id];
    const order = Object.keys(homeboundLoad(s, c2, 60000, 60));
    expect(order[0]).toBe('iron');
    // Once Moonbase has plenty of iron, the preference no longer forces it.
    moonbase(s).stock.iron = 1e9;
    const after = homeboundLoad(s, c2, 60000, 60);
    expect(Object.keys(after)[0]).not.toBe('iron');
  });
});

describe('engines: surplus only or engines first', () => {
  function withRoute() {
    let { s, col } = setup();
    col.stock.oxygen = 0; col.stock.nitrogen = 0;
    const f = addShip(s, 'freighter', 'moon');
    f.status = 'transit';
    f.transit = { from: 'ganymede', to: 'moon', departDay: s.day, arriveDay: s.day + 40, purpose: 'haulBack' };
    f.routeTo = col.id; f.autoLoop = true;
    s.earth.engines = 5; s.earth.progress = 30;
    return { s, col };
  }

  it('surplus only (the default) leaves the colony commitment and Moonbase reserve alone', () => {
    const { s } = withRoute();
    const held = moonbaseCommitted(s);
    const mb = moonbase(s);
    mb.stock.nitrogen = held.nitrogen + TERRAFORM_FEED.nitrogen * 5 * 0.5; // half a day's feed above the commitment
    const next = advanceDay(s).state;
    expect(next.earth.fed).toBeLessThan(0.75);
    expect(moonbase(next).stock.nitrogen).toBeGreaterThan(held.nitrogen * 0.95);
  });

  it('engines first takes what it needs regardless', () => {
    const { s } = withRoute();
    const held = moonbaseCommitted(s);
    moonbase(s).stock.nitrogen = held.nitrogen + TERRAFORM_FEED.nitrogen * 5 * 0.5;
    const r = setFeedPolicy(s, 'engines'); if (!r.ok) throw new Error(r.error);
    const next = advanceDay(r.state).state;
    expect(next.earth.fed).toBe(1);
  });
});

describe('supply forecast', () => {
  it('flags a colony that will run out before its next delivery', () => {
    const { s, col } = setup();
    col.stock.oxygen = 100; // a day or two
    const none = supplyForecast(s, col);
    expect(none.freighters).toBe(0);
    expect(none.gap?.mat).toBeDefined();
    expect(none.gap?.nextArrival).toBeNull();
    expect(none.producedPerDay).toBeGreaterThan(1);
  });
});
