import { useState } from 'react';
import { useGame } from '../../store/useGame';
import {
  type DeptId, type GameState, type Installation, MATERIALS, DEPT_NAMES, BODY_BY_ID, LS_PER_PERSON,
  fmtKg, popCap, toggleDept, researchRate, productionRate, BLUEPRINT_BY_ID, RESEARCH_BY_ID, solarPerArray,
  deptDemand, raidSize, formatDate, renameInstallation,
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
        <Stat label="Population" value={`${Math.floor(inst.population)} / ${cap}`} warn={!r.lifeSupportOk} />
        <Stat label="Power" value={`${r.powerGen.toFixed(1)} / ${r.powerDemand.toFixed(1)} MW`} warn={r.powerGen < r.powerDemand} />
        <Stat label="Supplies" value={r.daysOfSupplies >= 999 ? 'Self-sufficient' : `${Math.floor(r.daysOfSupplies)} days`} warn={r.daysOfSupplies < 30} />
        {!inst.isMoonBase && <Stat label="Freighters" value={freighters.length ? freighters.map((f) => f.name).join(', ') : 'None assigned'} warn={!freighters.length} />}
      </div>
    </section>
  );
}

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
      return `${p} people use ${fmtKg(p * LS_PER_PERSON.oxygen)} O₂, ${fmtKg(p * LS_PER_PERSON.water)} water, ${fmtKg(p * LS_PER_PERSON.nitrogen)} N₂ a day.${inst.population < popCap(inst) ? ' Growing.' : ' At capacity.'}`;
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
            </li>
          );
        })}
      </ul>
    </Section>
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
      {game.earth.engines > 0 && <Bar value={game.earth.progress} max={100} tone="green" label={`Earth restoration ${game.earth.progress.toFixed(1)}%`} />}
      {open && (
        <ol className="obj-list">
          {items.map(([t, ok]) => <li key={t} className={ok ? 'done' : ''}>{ok ? '✓' : '○'} {t}</li>)}
        </ol>
      )}
    </section>
  );
}
