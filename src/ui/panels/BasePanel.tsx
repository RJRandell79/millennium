import { useState } from 'react';
import { useGame } from '../../store/useGame';
import {
  type DeptId, type GameState, type Installation, MATERIALS, DEPT_NAMES, BODY_BY_ID,
  fmtKg, popCap, toggleDept, researchRate, productionRate, BLUEPRINT_BY_ID, RESEARCH_BY_ID, solarPerArray,
  deptDemand, raidSize, formatDate, renameInstallation, toggleCommsWatch, COMMS_WATCH_MW,
  GROWTH_POLICIES, growthPolicy, lsNeed, baseGrowthRate, setGrowthPolicy, growthLimit, reserveOf, type GrowthPolicy,
  terraformForecast, fmtRate, foundersOf, commissioningOf, commissionDaysLeft, COMMISSION_PER_DELIVERY, NITROGEN_SHORT_WORK,
  supplyForecast, setRoutePreference, MATERIAL_BY_ID, type MaterialId,
} from '../../engine';
import { Bar, Section, Toggle, pct } from '../components/common';
import { BaseScene } from '../components/BaseScene';

export function BasePanel() {
  const game = useGame((s) => s.game)!;
  const instId = useGame((s) => s.installationId);
  const inst = game.installations[instId] ?? game.installations.moonbase;
  return (
    <div className="stack">
      {inst.isMoonBase && <Objectives game={game} />}
      <Overview game={game} inst={inst} />
      <Departments game={game} inst={inst} />
      <Resources inst={inst} />
      <DefenceCard game={game} inst={inst} />
    </div>
  );
}

function Overview({ game, inst }: { game: GameState; inst: Installation }) {
  const act = useGame((s) => s.act);
  const r = inst.report;
  const cap = popCap(inst);
  const body = BODY_BY_ID[inst.bodyId];
  const freighters = Object.values(game.ships).filter((s) => s.routeTo === inst.id);
  const [editing, setEditing] = useState(false);
  return (
    <section className="panel overview">
      <BaseScene inst={inst} />
      <div className="overview-title">
        {editing ? (
          <input autoFocus defaultValue={inst.name} onBlur={(e) => { act((s) => renameInstallation(s, inst.id, e.target.value)); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        ) : (
          <h1 onClick={() => setEditing(true)} title="Tap to rename">{inst.name}</h1>
        )}
        <span className="muted">{body.name}{inst.isMoonBase ? ' · Shackleton crater' : ` · founded ${formatDate(inst.foundedDay)}`}</span>
      </div>
      <div className="statgrid">
        <Stat label="Population" value={`${Math.floor(inst.population)} / ${cap}${reserveOf(inst) >= 1 ? ` (+${Math.floor(reserveOf(inst))} reserve)` : ''}`} warn={!r.lifeSupportOk} />
        <Stat label="Power" value={`${r.powerGen.toFixed(1)} / ${r.powerDemand.toFixed(1)} MW`} warn={r.powerGen < r.powerDemand} />
        <Stat label="Supplies" value={r.daysOfSupplies >= 999 ? 'Self-sufficient' : `${Math.floor(r.daysOfSupplies)} days`} warn={r.daysOfSupplies < 30} />
        {!inst.isMoonBase && <Stat label="Freighters" value={freighters.length ? freighters.map((f) => f.name).join(', ') : 'None assigned'} warn={!freighters.length} />}
      </div>
      {!inst.isMoonBase && <ColonyStatus inst={inst} />}
      {!inst.isMoonBase && <SupplyRoute game={game} inst={inst} />}
      {inst.isMoonBase && r.nitrogenShort && <p className="warn-text small">Nitrogen short: work {Math.round((1 - NITROGEN_SHORT_WORK) * 100)}% slower and no growth until it arrives. No one dies of this.</p>}
      <GrowthControl inst={inst} />
    </section>
  );
}

/** A colony's founding party, commissioning and nitrogen state: what keeps it alive and what limits it. */
function ColonyStatus({ inst }: { inst: Installation }) {
  const c = commissioningOf(inst);
  const founders = foundersOf(inst);
  const beyond = Math.max(0, Math.floor(inst.population) - founders);
  return (
    <div className="colony-status">
      {c < 1 && (
        <>
          <Bar value={c * 100} max={100} tone="amber" label={`Commissioning ${Math.floor(c * 100)}%`} />
          <p className="muted small">
            Ore output and growth scale with commissioning. On its own the colony is fully running in about {commissionDaysLeft(inst)} days;
            each freighter delivery adds {Math.round(COMMISSION_PER_DELIVERY * 100)}%. Life-support gases are extracted at the full rate from the start.
          </p>
        </>
      )}
      {founders > 0 && (
        <p className="muted small">
          Founding party: {Math.min(founders, Math.floor(inst.population))} sheltered from shortages and raids.
          {beyond > 0 ? ` ${beyond} more beyond them ${beyond === 1 ? 'is' : 'are'} at risk.` : ''}
          {' '}Buildings, equipment and stock are not protected.
        </p>
      )}
      {inst.report.nitrogenShort && (
        <p className="warn-text small">Nitrogen short: work {Math.round((1 - NITROGEN_SHORT_WORK) * 100)}% slower and no growth until it arrives. No one dies of this.</p>
      )}
    </div>
  );
}

const LS_NAME: Record<'oxygen' | 'water' | 'nitrogen', string> = { oxygen: 'Oxygen', water: 'Water', nitrogen: 'Nitrogen' };

/** The colony's supply route: who serves it, when they arrive, whether the store lasts, and what gets home. */
function SupplyRoute({ game, inst }: { game: GameState; inst: Installation }) {
  const act = useGame((s) => s.act);
  const f = supplyForecast(game, inst);
  const prefer = game.routes?.[inst.id]?.prefer;
  const mined = Object.keys(BODY_BY_ID[inst.bodyId].composition) as MaterialId[];
  const inDays = (d: number) => (d <= game.day ? 'today' : d === game.day + 1 ? 'tomorrow' : `in ${d - game.day} days`);
  const short = f.lines.filter((l) => l.perDay > 0);
  const piling = f.freighters > 0 && f.producedPerDay > f.homePerDay * 1.2;
  return (
    <div className="growth supply">
      <span className="stat-label">Supply route</span>
      {f.freighters === 0 ? (
        <p className="warn-text small">No freighter assigned. Assign one in Fleet to keep the colony supplied and bring its ore home.</p>
      ) : (
        <>
          <p className="dept-detail">
            {f.freighters} freighter{f.freighters > 1 ? 's' : ''} · round trip about {f.roundTrip} days at today's distance
            {f.freighters > 1 ? ` · a departure every ${f.interval} days` : ''}.
          </p>
          <ul className="plain small">
            {f.arrivals.slice(0, 3).map((a) => (
              <li key={a.shipId}>{a.shipName} arrives {formatDate(a.arriveDay)} ({inDays(a.arriveDay)}){a.carrying ? ', supplies aboard' : ''}</li>
            ))}
          </ul>
        </>
      )}
      {short.map((l) => {
        const out = l.runsOutDay;
        const next = f.arrivals[0]?.arriveDay;
        const gap = out !== null && (next === undefined || out < next);
        return (
          <p key={l.mat} className={gap ? 'warn-text small' : 'muted small'}>
            {LS_NAME[l.mat]}: needs {fmtKg(l.perDay)} kg a day from outside · store lasts to {out !== null ? formatDate(out) : '—'}
            {gap ? (next !== undefined ? `, ${next - out!} days before the next delivery` : ', with no delivery scheduled') : ''}
            {l.inFlight > 1 ? ` · ${fmtKg(l.inFlight)} kg on its way` : ''}.
          </p>
        );
      })}
      {f.freighters > 0 && (
        <p className={piling ? 'warn-text small' : 'muted small'}>
          Mines about {f.producedPerDay.toFixed(1)} t a day; its freighters can bring home about {f.homePerDay.toFixed(1)} t a day.
          {piling ? ' Output is piling up faster than it can be shipped: another freighter would help.' : ''}
        </p>
      )}
      {f.freighters > 0 && (
        <label className="small pref">
          Bring home first:{' '}
          <select value={prefer ?? ''} onChange={(e) => act((s) => setRoutePreference(s, inst.id, (e.target.value || undefined) as MaterialId | undefined))}>
            <option value="">Automatic (what Moonbase is short of)</option>
            {mined.map((m) => <option key={m} value={m}>{MATERIAL_BY_ID[m].name}, when Moonbase needs it</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

const POLICY_ORDER: GrowthPolicy[] = ['grow', 'steady', 'hold'];

/** Population policy: the consequences are shown as numbers; which is wise is left to the player. */
function GrowthControl({ inst }: { inst: Installation }) {
  const act = useGame((s) => s.act);
  const current = growthPolicy(inst);
  const p = GROWTH_POLICIES[current];
  const cap = popCap(inst);
  const limit = growthLimit(inst);
  const below = inst.population < cap;
  const growing = inst.population < limit && p.rate > 0;
  const stalled = growing && (inst.report.deptEff.lifeSupport ?? 0) < 0.95;
  const noN2 = growing && !!inst.report.nitrogenShort;
  const c = commissioningOf(inst);
  const perDay = growing ? Math.max(0.05 * c, inst.population * baseGrowthRate(inst) * p.rate * c) : 0;
  const ls = current === 'grow' ? (growing ? 10 : 0) : current === 'hold' && below ? -10 : 0;
  const work = current === 'hold' && below ? 10 : 0;
  const reserve = Math.floor(reserveOf(inst));
  const reserveMax = Math.round(cap * (inst.isMoonBase ? p.reserve : 0));
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const now = stalled ? 'growth paused: life support is short'
    : noN2 ? 'growth paused: nitrogen is short'
    : growing && c <= 0 ? 'no growth until the colony starts commissioning'
    : growing ? `about ${perDay.toFixed(perDay < 0.1 ? 2 : 1)} more people a day${below ? '' : ' into the reserve'}${c < 1 ? ` (${Math.floor(c * 100)}% commissioned)` : ''}`
    : !below && current === 'hold' && reserve > 0 ? `no growth; ${reserve} from the reserve on duty`
    : !below ? (inst.isMoonBase && current !== 'hold' ? 'reserve full' : 'at capacity, no growth')
    : 'no growth';
  return (
    <div className="growth">
      <span className="stat-label">Population policy</span>
      <div className="segmented" role="radiogroup" aria-label="Population policy">
        {POLICY_ORDER.map((g) => (
          <button key={g} role="radio" aria-checked={g === current} className={g === current ? 'active' : ''}
            onClick={() => act((s) => setGrowthPolicy(s, inst.id, g))}>
            {GROWTH_POLICIES[g].name}
          </button>
        ))}
      </div>
      <p className="dept-detail">
        {inst.isMoonBase ? p.blurb : COLONY_BLURB[current]}{' '}
        <span className="muted">
          Now: {now}
          {inst.isMoonBase && reserveMax > 0 ? ` · reserve ${reserve} of ${reserveMax}` : ''}
          {ls ? ` · life support ${sign(ls)}%` : ''}{work ? ` · work rate ${sign(work)}%` : ''}.
        </span>
      </p>
    </div>
  );
}

const COLONY_BLURB: Record<GrowthPolicy, string> = {
  grow: 'Full growth to the colony\'s 100. Life support +10% a head while numbers are rising.',
  steady: 'Slow growth with no life-support surcharge.',
  hold: 'No growth. Below capacity, tighter rationing cuts life-support use by 10% and the crew works 10% harder.',
};

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`stat ${warn ? 'warn' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function deptDetail(game: GameState, inst: Installation, d: DeptId): string {
  const e = inst.equipment;
  const eff = inst.report.deptEff[d] ?? 0;
  switch (d) {
    case 'lifeSupport': {
      const p = Math.floor(inst.population);
      const n = lsNeed(inst);
      return `${p} people use ${fmtKg(n.oxygen)} O₂, ${fmtKg(n.water)} water, ${fmtKg(n.nitrogen)} N₂ a day.${inst.population >= popCap(inst) ? ' At capacity.' : growthPolicy(inst) === 'hold' ? ' Holding.' : ' Growing.'}`;
    }
    case 'energy': {
      const per = solarPerArray(game, inst);
      const parts = [`${e.solar} solar × ${per.toFixed(2)} MW`];
      if (e.reactor) parts.push(`${e.reactor} reactor × 10 MW`);
      if (e.fusion) parts.push(`${e.fusion} fusion × 40 MW`);
      return parts.join(' · ');
    }
    case 'research': {
      const cur = game.research.current ? RESEARCH_BY_ID[game.research.current] : null;
      const rate = researchRate(inst, eff);
      return cur ? `${cur.name}: ${rate.toFixed(2)} pts/day (${1 + e.labs} lab${e.labs ? 's' : ''})` : 'Idle — choose a project in Research';
    }
    case 'refinery': {
      const total = Object.values(inst.report.mined).reduce((a, b) => a + (b ?? 0), 0);
      return `${fmtKg(total)} kg/day · upgrades ${e.refinery}/3`;
    }
    case 'production': {
      const active = game.queue.filter((q) => q.started).slice(0, 1 + e.factories).map((q) => BLUEPRINT_BY_ID[q.blueprintId].name);
      return `${1 + e.factories} slot${e.factories ? 's' : ''} at ${productionRate(inst, eff).toFixed(2)}× · ${active.length ? active.join(', ') : 'nothing building'}`;
    }
    case 'flightDeck': {
      const docked = Object.values(game.ships).filter((s) => s.status === 'docked' && s.at === inst.bodyId).length;
      return `${docked} ship${docked === 1 ? '' : 's'} docked`;
    }
    case 'defence':
      return inst.isMoonBase
        ? `${e.fightersMk1 + e.fightersMk2} fighters · ${e.lasers} lasers · ${e.shields} shields`
        : `${e.lasers} lasers · ${e.shields} shields`;
  }
}

function Departments({ game, inst }: { game: GameState; inst: Installation }) {
  const act = useGame((s) => s.act);
  const setTab = useGame((s) => s.setTab);
  const depts = Object.keys(inst.depts) as DeptId[];
  return (
    <Section title="Departments" right={<span className="muted small">Power: top first</span>}>
      <ul className="depts">
        {depts.map((d) => {
          const st = inst.depts[d]!;
          const eff = d === 'energy' ? 1 - st.damage / 100 : inst.report.deptEff[d] ?? 0;
          const demand = deptDemand(inst, d);
          const tone = !st.online ? 'red' : eff >= 0.95 ? 'green' : eff >= 0.5 ? 'amber' : 'red';
          const go = d === 'research' ? () => setTab('research') : d === 'production' ? () => setTab('build') : d === 'flightDeck' ? () => setTab('fleet') : undefined;
          return (
            <li key={d} className={`dept dept-${tone}`}>
              <div className="dept-top">
                <button className="dept-name" onClick={go} disabled={!go}>{DEPT_NAMES[d]}{go ? ' ›' : ''}</button>
                <span className="dept-meta">
                  {d !== 'energy' && st.online && <span className="muted small">{demand.toFixed(1)} MW</span>}
                  {st.damage > 0 && <span className="dmg">DMG {Math.round(st.damage)}%</span>}
                </span>
                {d !== 'energy' && d !== 'lifeSupport' && (
                  <Toggle on={st.online} label={`${DEPT_NAMES[d]} power`} onChange={() => act((s) => toggleDept(s, inst.id, d))} />
                )}
              </div>
              <Bar value={st.online ? eff : 0} tone={tone} label={st.online ? pct(eff) : 'OFFLINE'} />
              <p className="dept-detail">{deptDetail(game, inst, d)}</p>
              {d === 'lifeSupport' && inst.isMoonBase && <CommsWatch on={!!inst.commsWatch} />}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function CommsWatch({ on }: { on: boolean }) {
  const act = useGame((s) => s.act);
  const toggle = () => {
    const before = useGame.getState().game!;
    if (!act(toggleCommsWatch)) return;
    const after = useGame.getState().game!;
    // The deputy's one objection arrives as a story message: show it.
    const objection = after.messages.find((m) => m.id > before.nextMsg && m.kind === 'story');
    if (objection) useGame.setState({ modal: objection, speed: 'paused' });
  };
  return (
    <div className="subload">
      <div className="dept-top">
        <span className="subload-name">Comms watch</span>
        <span className="dept-meta">{on && <span className="muted small">{COMMS_WATCH_MW.toFixed(1)} MW</span>}</span>
        <Toggle on={on} label="Comms watch power" onChange={toggle} />
      </div>
      <p className="dept-detail">Long-range listening watch on the search-and-rescue and deep-space navigation bands. Required by the lunar station safety code. Included in Life Support's draw.</p>
    </div>
  );
}

function Resources({ inst }: { inst: Installation }) {
  const r = inst.report;
  return (
    <Section title="Resources" right={<span className="muted small">kg</span>}>
      <table className="restable">
        <thead><tr><th>Material</th><th>Stock</th><th>Per day</th></tr></thead>
        <tbody>
          {MATERIALS.map((m) => {
            const net = (r.mined[m.id] ?? 0) - (r.consumed[m.id] ?? 0);
            const stock = inst.stock[m.id];
            if (stock < 1 && Math.abs(net) < 1 && !inst.isMoonBase) return null;
            return (
              <tr key={m.id}>
                <td><i className="dot" style={{ background: m.color }} />{m.name}</td>
                <td className="mono">{fmtKg(stock)}</td>
                <td className={`mono ${net < 0 ? 'neg' : net > 0 ? 'pos' : 'muted'}`}>{net === 0 ? '—' : `${net > 0 ? '+' : ''}${fmtKg(net)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

function DefenceCard({ game, inst }: { game: GameState; inst: Installation }) {
  const raids = game.threat.raids.filter((r) => r.targetInstallationId === inst.id);
  const last = game.threat.lastBattle?.installationId === inst.id ? game.threat.lastBattle : undefined;
  const nextWave = raidSize(game, game.threat.wave + 1);
  return (
    <Section title="Defence" className="defence">
      {game.threat.status === 'hostile' ? (
        <>
          {raids.length ? raids.map((r) => (
            <div key={r.id} className="raid">
              <strong>{r.ships} raiders inbound</strong> · arriving {formatDate(r.arriveDay)} ({r.arriveDay - game.day} days)
              <Bar value={game.day - r.launchDay} max={r.arriveDay - r.launchDay} tone="red" />
            </div>
          )) : <p className="muted">No raiders tracked{inst.isMoonBase ? `. Intelligence expects the next wave to be around ${nextWave.ships} craft.` : '.'}</p>}
          {!inst.isMoonBase && inst.equipment.lasers === 0 && <p className="warn-text">This colony has no orbital lasers. Build them at Moonbase and they'll ride out on the next freighter.</p>}
        </>
      ) : (
        <p className="good-text">{game.threat.status === 'peace' ? 'The Ares Accord holds. No raids.' : 'Mars is occupied. No raids.'}</p>
      )}
      {last && (
        <details className="battle">
          <summary>Damage report — {formatDate(last.day)}: {last.outcome}</summary>
          <ul>{last.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
          {last.damage.length > 0 && <p>Damage: {last.damage.map((d) => `${DEPT_NAMES[d.dept]} ${Math.round(d.amount)}%`).join(', ')}{last.casualties ? ` · ${last.casualties} killed` : ''}</p>}
        </details>
      )}
    </Section>
  );
}

function Objectives({ game }: { game: GameState }) {
  const [open, setOpen] = useState(game.day < 120);
  const colonies = Object.values(game.installations).filter((i) => !i.isMoonBase).length;
  const probed = Object.values(game.bodies).filter((b) => b.knowledge > 0).length > 4;
  const mining = Object.values(game.ships).some((s) => s.type === 'miner' && s.status !== 'docked') || game.stats.kgMined > 5_000_000;
  const items: [string, boolean][] = [
    ['Probe a new world', probed],
    ['Send an Asteroid Miner to the belt (copper!)', mining],
    ['Research Colony Pod Systems', game.research.done.includes('colonyPods')],
    ['Survey a site and found a colony', colonies > 0],
    ['Assign a freighter to a colony', Object.values(game.ships).some((s) => s.type === 'freighter' && s.routeTo)],
    ['End the war with Mars — Accord or Conquest', game.threat.status !== 'hostile'],
    ['Probe Earth', game.earth.probed],
    ['Terraform Earth', game.earth.progress >= 100],
  ];
  const done = items.filter((i) => i[1]).length;
  return (
    <section className="panel objectives">
      <button className="obj-head" onClick={() => setOpen(!open)}>
        <span>Objectives</span>
        <span className="muted small">{done}/{items.length} {open ? '▴' : '▾'}</span>
      </button>
      {game.earth.engines > 0 && <RestorationBar game={game} />}
      {open && (
        <ol className="obj-list">
          {items.map(([t, ok]) => <li key={t} className={ok ? 'done' : ''}>{ok ? '✓' : '○'} {t}</li>)}
        </ol>
      )}
    </section>
  );
}

function RestorationBar({ game }: { game: GameState }) {
  const f = terraformForecast(game);
  const done = game.earth.progress >= 100;
  const short = f.fed < 1;
  const eta = done ? '' : f.finishDay === null ? ' · stalled' : ` · ~${f.daysLeft} days${short ? ' at this rate' : ' left'}`;
  return (
    <>
      <Bar value={game.earth.progress} max={100} tone="green" label={`Earth restoration ${game.earth.progress.toFixed(1)}%${eta}`} />
      {!done && (
        <p className={short ? 'warn-text small' : 'muted small'}>
          {f.engines} engine{f.engines > 1 ? 's' : ''} · {fmtRate(f.ratePerDay)} a day
          {short ? `, short of ${f.short.join(' and ')} (${fmtRate(f.fullRate)} when fully fed).` : '.'}
          {' '}Each extra engine adds {f.perEngine}% a day if it can be fed
          {f.anotherAffordable && !f.queued ? '; Moonbase has the materials for another.' : '.'}
        </p>
      )}
    </>
  );
}
