import type { BattleReport, DeptId, GameState, Installation, Raid } from './types';
import { STORY, ADVERSARY } from './data/lore';
import { RAIDER_SPEED, distanceAU, travelDays } from './orbits';
import { DIFFICULTY } from './newGame';
import { returnHome } from './fleet';
import { makeInstallation, moonbase, msg, newId, setFlag } from './util';
import { chance, pick, rand } from './rng';
import { shelteredOf } from './economy';

export function raidSize(s: GameState, wave: number): { ships: number; quality: number } {
  const d = DIFFICULTY[s.settings.difficulty];
  return { ships: Math.max(2, Math.round((3 + wave * 1.6) * d.raidScale)), quality: 1 + wave * 0.07 };
}

export function runThreat(s: GameState): void {
  const t = s.threat;
  if (t.status === 'peace') {
    if (s.day % 30 === 0) {
      moonbase(s).stock.uranium += 3000;
      msg(s, 'info', 'Gift from Mars', 'Under the Ares Accord, a Martian tender delivered 3,000 kg of uranium.');
    }
  }
  resolveMarsMissions(s);
  if (t.status !== 'hostile') { t.raids = []; return; }

  t.marsDefence += 0.03;

  if (s.day >= t.nextLaunchDay) launchRaid(s);

  const arriving = t.raids.filter((r) => r.arriveDay <= s.day);
  t.raids = t.raids.filter((r) => r.arriveDay > s.day);
  for (const r of arriving) resolveRaid(s, r);
}

function launchRaid(s: GameState): void {
  const t = s.threat;
  const d = DIFFICULTY[s.settings.difficulty];
  t.wave += 1;
  const { ships, quality } = raidSize(s, t.wave);
  // Target: usually Moonbase; colonies nearer Mars are more exposed.
  const colonies = Object.values(s.installations).filter((i) => !i.isMoonBase && i.bodyId !== 'mars');
  let target: Installation = moonbase(s);
  if (colonies.length && rand(s) < 0.35) {
    const weighted = colonies.map((c) => ({ c, w: 1 / (0.5 + distanceAU('mars', c.bodyId, s.day)) }));
    const total = weighted.reduce((a, b) => a + b.w, 0);
    let roll = rand(s) * total;
    for (const w of weighted) { roll -= w.w; if (roll <= 0) { target = w.c; break; } }
  }
  const eta = travelDays('mars', target.bodyId, s.day, RAIDER_SPEED);
  const raid: Raid = { id: newId(s, 'raid'), ships, quality, targetInstallationId: target.id, targetBodyId: target.bodyId, launchDay: s.day, arriveDay: s.day + eta };
  t.raids.push(raid);
  const interval = Math.max(20, 55 - t.wave * 2.5) * d.interval * (0.85 + rand(s) * 0.3);
  t.nextLaunchDay = s.day + Math.round(interval);
  if (setFlag(s, 'firstLaunch')) msg(s, 'story', STORY.firstLaunch.title, STORY.firstLaunch.text);
  msg(s, 'alert', `Raid inbound: ${target.name}`, `Tracking ${ships} ${ADVERSARY.raiderName}s from Mars. Estimated arrival in ${eta} days.`, target.id);
}

const DEPT_WEIGHTS: DeptId[] = ['lifeSupport', 'energy', 'energy', 'refinery', 'refinery', 'production', 'research', 'flightDeck', 'defence', 'defence'];

export function resolveRaid(s: GameState, raid: Raid): BattleReport | null {
  const inst = s.installations[raid.targetInstallationId];
  if (!inst) return null;
  const log: string[] = [];
  let raiders = raid.ships;
  const q = raid.quality;
  const defEff = inst.report.deptEff.defence ?? (inst.depts.defence?.online ? 1 : 0);

  // 1. Orbital lasers get two volleys each before the raiders close.
  let laserKills = 0;
  const shots = inst.equipment.lasers * 2;
  for (let i = 0; i < shots && raiders > 0; i++) {
    if (chance(s, 0.6 * defEff / Math.sqrt(q))) { raiders--; laserKills++; }
  }
  if (inst.equipment.lasers) log.push(`Orbital lasers destroyed ${laserKills} ${ADVERSARY.raiderName}${laserKills === 1 ? '' : 's'}.`);

  // 2. Fighters (Moonbase only): four passes.
  let mk1 = inst.isMoonBase ? inst.equipment.fightersMk1 : 0;
  let mk2 = inst.isMoonBase ? inst.equipment.fightersMk2 : 0;
  const startFighters = mk1 + mk2;
  let fighterKills = 0;
  const fdEff = inst.report.deptEff.flightDeck ?? 1;
  for (let round = 1; round <= 4 && raiders > 0 && mk1 + mk2 > 0; round++) {
    let kills = 0;
    for (let i = 0; i < mk1; i++) if (chance(s, 0.45 * (1 / (1 + q)) * (0.5 + 0.5 * fdEff))) kills++;
    for (let i = 0; i < mk2; i++) if (chance(s, 0.45 * (2 / (2 + q)) * (0.5 + 0.5 * fdEff))) kills++;
    kills = Math.min(kills, raiders);
    let losses = 0;
    const avg = (mk1 + 2 * mk2) / (mk1 + mk2);
    for (let i = 0; i < raiders; i++) if (chance(s, 0.25 * (q / (avg + q)))) losses++;
    losses = Math.min(losses, mk1 + mk2);
    // Mk Is die first.
    const l1 = Math.min(losses, mk1);
    mk1 -= l1; mk2 -= losses - l1;
    raiders -= kills;
    fighterKills += kills;
    log.push(`Pass ${round}: fighters downed ${kills}, lost ${losses}.`);
  }
  const fightersLost = startFighters - (mk1 + mk2);
  if (inst.isMoonBase) { inst.equipment.fightersMk1 = mk1; inst.equipment.fightersMk2 = mk2; }

  // 3. Survivors bombard the installation.
  const damage: { dept: DeptId; amount: number }[] = [];
  let casualties = 0;
  let sheltered = false;
  if (raiders > 0) {
    const shield = 1 - 0.25 * Math.min(3, inst.equipment.shields) * (defEff > 0.5 ? 1 : 0.5);
    let pts = raiders * q * 7 * shield;
    const depts = DEPT_WEIGHTS.filter((d) => inst.depts[d]);
    while (pts > 0.5) {
      const chunk = Math.min(pts, 4 + rand(s) * 6);
      pts -= chunk;
      const d = pick(s, depts);
      const st = inst.depts[d]!;
      const real = Math.min(100 - st.damage, chunk);
      st.damage += real;
      const existing = damage.find((x) => x.dept === d);
      if (existing) existing.amount += real; else damage.push({ dept: d, amount: real });
      // Casualties follow the damage actually done: hitting a plant that is already wrecked kills no one directly.
      if (d === 'lifeSupport') casualties += inst.population * (real / 300);
    }
    // The founding party shelters and can't be killed; anyone beyond them can.
    const exposed = Math.max(0, inst.population - shelteredOf(inst));
    sheltered = Math.round(casualties) > exposed && shelteredOf(inst) > 0;
    casualties = Math.min(exposed, Math.round(casualties));
    inst.population -= casualties;
    log.push(`${raiders} ${ADVERSARY.raiderName}s broke through and bombarded ${inst.name}.`);
  } else {
    log.push('All raiders destroyed. No damage.');
  }

  const destroyed = raid.ships - raiders;
  s.threat.salvage += destroyed;
  const totalDamage = damage.reduce((a, b) => a + b.amount, 0);
  const outcome: BattleReport['outcome'] = raiders === 0 ? 'repelled' : totalDamage < 60 ? 'damaged' : 'devastated';
  if (outcome === 'repelled') s.stats.raidsRepelled += 1;
  const report: BattleReport = { day: s.day, installationId: inst.id, raiders: raid.ships, raidersDestroyed: destroyed, fightersLost, laserKills, damage, casualties, outcome, log };
  s.threat.lastBattle = report;

  const summary = `${destroyed}/${raid.ships} destroyed (lasers ${laserKills}, fighters ${fighterKills}). Fighters lost: ${fightersLost}.` +
    (damage.length ? ` Damage to ${damage.map((d) => `${DEPT_NAMES[d.dept]} ${Math.round(d.amount)}%`).join(', ')}.` : '') +
    (casualties ? ` ${casualties} killed.` : '') +
    (sheltered ? ` The founding party of ${shelteredOf(inst)} sheltered and survived.` : '');
  msg(s, outcome === 'repelled' ? 'good' : 'alert', `Raid on ${inst.name}: ${outcome}`, summary, inst.id);

  if (destroyed > 0 && setFlag(s, 'firstContact')) msg(s, 'story', STORY.firstContact.title, STORY.firstContact.text);

  if (!inst.isMoonBase && inst.population < 1) {
    msg(s, 'alert', `${inst.name} lost`, `The colony on ${inst.name.replace(' Colony', '')} has been wiped out.`);
    s.bodies[inst.bodyId].installationId = undefined;
    delete s.installations[inst.id];
    for (const sh of Object.values(s.ships)) if (sh.routeTo === inst.id) sh.routeTo = undefined;
    s.consignments = s.consignments.filter((c) => c.installationId !== inst.id);
  }
  return report;
}

export const DEPT_NAMES: Record<DeptId, string> = {
  lifeSupport: 'Life Support', energy: 'Energy', research: 'Research', refinery: 'Refinery',
  production: 'Production', flightDeck: 'Flight Deck', defence: 'Defence',
};

export const BATTLECRUISER_POWER = 10;

/** Ships that have arrived at Mars on an assault or accord mission. */
function resolveMarsMissions(s: GameState): void {
  const atMars = Object.values(s.ships).filter((sh) => sh.status === 'working' && sh.at === 'mars');
  if (!atMars.length) return;
  const t = s.threat;

  const hospital = atMars.filter((sh) => sh.type === 'hospitalShip');
  if (hospital.length && t.status === 'hostile') {
    t.status = 'peace';
    t.raids = [];
    for (const h of hospital) delete s.ships[h.id];
    setFlag(s, 'accord');
    msg(s, 'story', STORY.accord.title, STORY.accord.text, 'mars');
  }

  const bcs = atMars.filter((sh) => sh.type === 'battlecruiser');
  const troops = atMars.filter((sh) => sh.type === 'troopship');
  if (t.status !== 'hostile') {
    for (const sh of [...bcs, ...troops]) {
      if (t.status === 'conquered' && sh.type === 'troopship') continue;
      returnHome(s, sh);
    }
    return;
  }
  if (!bcs.length && !troops.length) return;

  const power = bcs.length * BATTLECRUISER_POWER * (0.8 + rand(s) * 0.4);
  const defence = t.marsDefence;
  if (power >= defence) {
    // Win the orbital battle; some losses.
    let lost = 0;
    for (const bc of bcs) if (chance(s, 0.35 * (defence / power))) { delete s.ships[bc.id]; lost++; }
    if (troops.length) {
      t.status = 'conquered';
      t.raids = [];
      const crew = troops.reduce((a, b) => a + b.colonists, 0);
      for (const tr of troops) delete s.ships[tr.id];
      s.bodies.mars.knowledge = 2;
      const col = makeInstallation(s, 'mars', false, Math.max(20, crew));
      col.name = 'Mars Garrison';
      col.equipment.solar = 10;
      col.stock.oxygen = 8000; col.stock.water = 15000; col.stock.nitrogen = 1500;
      setFlag(s, 'conquest');
      msg(s, 'story', STORY.conquest.title, `${STORY.conquest.text} (${lost} battlecruiser${lost === 1 ? '' : 's'} lost.)`, col.id);
    } else {
      t.marsDefence = defence * 0.3;
      t.nextLaunchDay = Math.max(t.nextLaunchDay, s.day + 60);
      msg(s, 'warn', 'Orbital defences broken', `The fleet smashed the Martian platforms (${lost} lost) but has no troopship to land. Defences will rebuild — send an Assault Troopship with the next attack.`, 'mars');
    }
    for (const bc of bcs) if (s.ships[bc.id]) returnHome(s, s.ships[bc.id]);
  } else {
    for (const sh of [...bcs, ...troops]) delete s.ships[sh.id];
    t.marsDefence += 5;
    msg(s, 'alert', STORY.assaultFailed.title, `${STORY.assaultFailed.text} Fleet strength ${Math.round(power)} vs defences ${Math.round(defence)}.`, 'mars');
  }
}
