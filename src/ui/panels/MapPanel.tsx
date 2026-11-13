import { useGame } from '../../store/useGame';
import {
  type GameState, type MaterialId, type Ship, type ShipType, BODY_BY_ID, MOONS_OF, MATERIAL_BY_ID, SHIP_SPECS,
  abundanceLabel, colonyRequirementMet, distanceAU, sunDistance, driveName, driveSpeed, travelDays, missionsFor,
  sendShip, launchAssault, fuelFor, BATTLECRUISER_POWER, TERRAFORM_FEED, TERRAFORM_RATE, fmtKg, formatDate, terraformForecast, fmtRate, setFeedPolicy, supplyForecast, type FeedPolicy,
} from '../../engine';
import { SolarCanvas } from './SolarCanvas';
import { Bar, Globe, Section } from '../components/common';

export function MapPanel() {
  const game = useGame((s) => s.game)!;
  const view = useGame((s) => s.mapView);
  const setView = useGame((s) => s.setMapView);
  const selected = useGame((s) => s.selectedBody);
  return (
    <div className="stack">
      <section className="panel map-panel">
        <div className="segmented">
          <button className={view === 'inner' ? 'active' : ''} onClick={() => setView('inner')}>Inner system</button>
          <button className={view === 'outer' ? 'active' : ''} onClick={() => setView('outer')}>Outer system</button>
        </div>
        <SolarCanvas game={game} />
        <p className="muted small center">Drive: {driveName(game.research.done)} ({driveSpeed(game.research.done)} AU/day). Tap a world.</p>
      </section>
      {selected ? <BodySheet game={game} bodyId={selected} /> : <WorldList game={game} />}
    </div>
  );
}

function WorldList({ game }: { game: GameState }) {
  const select = useGame((s) => s.selectBody);
  const known = Object.values(game.bodies).filter((b) => b.knowledge > 0 && b.id !== 'sun');
  return (
    <Section title="Known worlds">
      <div className="worldgrid">
        {known.map((b) => {
          const def = BODY_BY_ID[b.id];
          return (
            <button key={b.id} className="world" onClick={() => select(b.id)}>
              <Globe bodyId={b.id} size={28} />
              <span>{def.name}</span>
              <small className="muted">{b.installationId ? game.installations[b.installationId].name : b.id === 'earth' ? (game.earth.probed ? 'Probed' : 'Impact zone') : b.id === 'mars' ? 'Hostile' : b.knowledge === 2 ? 'Surveyed' : 'Probed'}</small>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

const KIND: Record<string, string> = { planet: 'Planet', dwarf: 'Dwarf planet', moon: 'Moon', asteroid: 'Asteroid', gasgiant: 'Gas giant', star: 'Star' };

function BodySheet({ game, bodyId }: { game: GameState; bodyId: string }) {
  const select = useGame((s) => s.selectBody);
  const jump = useGame((s) => s.jumpTo);
  const def = BODY_BY_ID[bodyId];
  const st = game.bodies[bodyId];
  const parent = def.parent && def.parent !== 'earth' ? BODY_BY_ID[def.parent] : null;
  const moons = MOONS_OF(bodyId).filter((m) => m.id !== 'moon' || bodyId === 'earth');
  const speed = driveSpeed(game.research.done);
  const r = sunDistance(bodyId, game.day);
  const dMoon = distanceAU('moon', bodyId, game.day);
  const travel = bodyId === 'moon' ? 0 : travelDays('moon', bodyId, game.day, speed);
  const knowledgeLabel = ['Unexplored', 'Probed', 'Surveyed'][st.knowledge];
  const colony = st.installationId ? game.installations[st.installationId] : undefined;
  const req = def.mineable === 'colony' ? colonyRequirementMet(game, bodyId) : null;

  return (
    <Section
      title={<span className="sheet-title"><Globe bodyId={bodyId} size={36} /> {st.knowledge || bodyId === 'sun' ? def.name : `${def.name}?`}</span>}
      right={<button className="iconbtn" onClick={() => select(null)} aria-label="Close">✕</button>}
      className="bodysheet"
    >
      {parent && <button className="link" onClick={() => select(parent.id)}>‹ {parent.name} system</button>}
      <div className="kv">
        <span>Type</span><span>{KIND[def.kind]}</span>
        <span>Status</span><span className={st.knowledge === 2 ? 'good-text' : ''}>{colony ? 'Colonised' : knowledgeLabel}</span>
        {bodyId !== 'sun' && <><span>From Sun</span><span>{r.toFixed(2)} AU</span></>}
        {bodyId !== 'moon' && bodyId !== 'sun' && <><span>From Moonbase</span><span>{dMoon.toFixed(2)} AU · {travel} days</span></>}
        {bodyId !== 'sun' && <><span>Solar array</span><span>{(2 / (r * r)).toFixed(2)} MW each</span></>}
        <span>Radius</span><span>{def.radiusKm.toLocaleString('en-GB')} km</span>
      </div>
      {def.hazard && <p className="warn-text">{def.hazard}</p>}
      <p className="blurb">{def.blurb}</p>

      {bodyId === 'earth' && <EarthCard game={game} />}
      {bodyId === 'mars' && <MarsCard game={game} />}

      {def.mineable !== 'none' && bodyId !== 'earth' && (
        <div className="composition">
          <h3>Resources {st.knowledge === 1 ? '(estimated)' : st.knowledge === 2 ? '(surveyed)' : ''}</h3>
          {st.knowledge === 0 && bodyId !== 'mars' ? <p className="muted">Unknown. Send a probe.</p> : (
            <ul>
              {Object.entries(st.composition).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([k, v]) => {
                const m = MATERIAL_BY_ID[k as MaterialId];
                return (
                  <li key={k}>
                    <i className="dot" style={{ background: m.color }} />{m.name}
                    <span className="muted">{st.knowledge === 2 && def.mineable === 'colony' ? `~${fmtKg((v ?? 0) * 250 * 1.5)} kg/day` : abundanceLabel(v)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {req && !colony && st.knowledge > 0 && <p className={req.ok ? 'good-text' : 'muted'}>{req.ok ? (st.knowledge === 2 ? 'Ready for a colony ship.' : 'Colony possible after a survey.') : `Colony: ${req.reason}.`}</p>}
          {def.mineable === 'miner' && <p className="muted">Asteroid miners can work here.</p>}
          {def.mineable === 'scoop' && <p className="muted">Gas scoops can skim this atmosphere.</p>}
        </div>
      )}

      {colony && <button className="btn wide" onClick={() => jump(colony.id)}>Open {colony.name} ›</button>}

      <Launchers game={game} bodyId={bodyId} />

      {moons.length > 0 && (
        <div className="moons">
          <h3>Moons</h3>
          <div className="worldgrid">
            {moons.map((m) => (
              <button key={m.id} className="world" onClick={() => select(m.id)}>
                <Globe bodyId={m.id} size={26} />
                <span>{game.bodies[m.id].knowledge ? m.name : `${m.name}?`}</span>
                <small className="muted">{game.bodies[m.id].installationId ? 'Colony' : ['Unknown', 'Probed', 'Surveyed'][game.bodies[m.id].knowledge]}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

const VERB: Partial<Record<ShipType, string>> = {
  probe: 'Probe', surveyor: 'Survey', colonyShip: 'Colonise', miner: 'Mine', gasScoop: 'Scoop', hospitalShip: 'Send cure',
};

function Launchers({ game, bodyId }: { game: GameState; bodyId: string }) {
  const act = useGame((s) => s.act);
  const docked = Object.values(game.ships).filter((s) => s.status === 'docked' && s.at === 'moon' && VERB[s.type]);
  const byType = new Map<ShipType, Ship[]>();
  for (const s of docked) byType.set(s.type, [...(byType.get(s.type) ?? []), s]);
  const rows = [...byType.entries()].map(([type, ships]) => {
    const opt = missionsFor(game, ships[0]).find((o) => o.bodyId === bodyId);
    return opt ? { type, ship: ships[0], count: ships.length, opt } : null;
  }).filter(Boolean) as { type: ShipType; ship: Ship; count: number; opt: ReturnType<typeof missionsFor>[number] }[];
  if (!rows.length) return null;
  return (
    <div className="launchers">
      <h3>Launch from Moonbase</h3>
      {rows.map(({ type, ship, count, opt }) => {
        const purpose = type === 'probe' ? 'probe' : type === 'surveyor' ? 'survey' : type === 'colonyShip' ? 'colonise' : type === 'hospitalShip' ? 'accord' : 'mine';
        const fuel = fuelFor(game, ship, bodyId, purpose);
        return (
          <div key={type} className="launch-row">
            <button className="btn" disabled={!opt.ok} onClick={() => act((s) => sendShip(s, ship.id, bodyId), `${ship.name} launched — ${opt.days} days to ${opt.label}`)}>
              {VERB[type]}: {ship.name}
            </button>
            <span className="muted small">
              {SHIP_SPECS[type].name}{count > 1 ? ` (${count} docked)` : ''} · {opt.days}d · {fmtKg(fuel)} kg H{opt.ok ? '' : ` · ${opt.reason}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const FEED_NAMES = { nitrogen: 'nitrogen', water: 'water', oxygen: 'oxygen' } as const;
const listOf = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

const POLICY_TEXT: Record<FeedPolicy, { name: string; blurb: string }> = {
  surplus: { name: 'Surplus only', blurb: 'The engines take only what is left once Moonbase\'s own reserve and the next load for every colony route are set aside. Restoration slows instead of colonists going short.' },
  engines: { name: 'Engines first', blurb: 'The engines take what they need first. Restoration runs faster, but colony freighters may leave short and colonists beyond the founders can die.' },
};

/** Who gets Moonbase's oxygen, water and nitrogen first, and what that means today. */
function FeedPolicyControl({ game }: { game: GameState }) {
  const act = useGame((s) => s.act);
  const f = terraformForecast(game);
  const at = (d: number) => `${formatDate(d)}`;
  const risks = Object.values(game.installations).filter((i) => !i.isMoonBase).map((col) => ({ col, fc: supplyForecast(game, col) })).filter((x) => x.fc.gap);
  return (
    <div className="growth">
      <span className="stat-label">Feed priority</span>
      <div className="segmented" role="radiogroup" aria-label="Feed priority">
        {(['surplus', 'engines'] as FeedPolicy[]).map((p) => (
          <button key={p} role="radio" aria-checked={p === f.policy} className={p === f.policy ? 'active' : ''} onClick={() => act((s) => setFeedPolicy(s, p))}>
            {POLICY_TEXT[p].name}
          </button>
        ))}
      </div>
      <p className="dept-detail">{POLICY_TEXT[f.policy].blurb}</p>
      <table className="restable">
        <thead><tr><th></th><th>Stock</th><th>Committed</th><th>Engines may use</th><th>Engines a day</th></tr></thead>
        <tbody>
          {f.feed.map((r) => (
            <tr key={r.mat} className={r.available < r.perDay ? 'warn-text' : ''}>
              <td>{r.mat === 'nitrogen' ? 'N₂' : r.mat === 'oxygen' ? 'O₂' : 'Water'}</td>
              <td>{fmtKg(r.stock)}</td>
              <td>{fmtKg(r.committed)}</td>
              <td>{fmtKg(r.available)}</td>
              <td>{fmtKg(r.perDay)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Committed: Moonbase's own 60-day reserve plus the next load for every colony route{f.policy === 'engines' ? ' (not protected under Engines first)' : ''}.</p>
      {risks.map(({ col, fc }) => (
        <p key={col.id} className="warn-text small">
          {col.name}: {fc.gap!.mat} runs out {at(fc.gap!.runsOutDay)}
          {fc.freighters === 0 ? '. No freighter is assigned, so nothing is set aside for it.' : `, before the next delivery (${fc.gap!.nextArrival !== null ? at(fc.gap!.nextArrival) : 'none scheduled'}).`}
        </p>
      ))}
    </div>
  );
}

function EarthCard({ game }: { game: GameState }) {
  const e = game.earth;
  const f = terraformForecast(game);
  const done = e.progress >= 100;
  const short = f.fed < 1;
  return (
    <div className="earthcard">
      <h3>Restoration</h3>
      <Bar value={e.progress} max={100} tone="green" label={`${e.progress.toFixed(1)}%`} />
      {e.engines > 0 && !done && (
        <>
          <p className="small">
            {e.engines} Terraforming Engine{e.engines > 1 ? 's' : ''} · {fmtRate(f.ratePerDay)} a day
            {short ? ` (${fmtRate(f.fullRate)} when fully fed)` : ''}
            {' · '}
            {f.finishDay !== null
              ? `restored in about ${f.daysLeft} days (${formatDate(f.finishDay)})${short ? ' at this rate' : ''}.`
              : 'stalled until feed arrives.'}
          </p>
          {short && (
            <p className="warn-text small">
              Short of {listOf(f.short.map((k) => FEED_NAMES[k]))}: the engines got {Math.round(f.fed * 100)}% of their feed yesterday.
              They draw on the same Moonbase stock that freighters carry to the colonies.
            </p>
          )}
          <p className="muted small">
            Engines add together: each one adds {TERRAFORM_RATE}% a day if it can be fed.
            {f.queued ? ` ${f.queued} more engine${f.queued > 1 ? 's' : ''} in the build queue.` : ''}
            {f.anotherAffordable && !f.queued ? ' Moonbase has the materials for another.' : ''}
          </p>
          <p className="muted small">
            Daily feed from Moonbase: {fmtKg(TERRAFORM_FEED.nitrogen * e.engines)} N₂, {fmtKg(TERRAFORM_FEED.water * e.engines)} water, {fmtKg(TERRAFORM_FEED.oxygen * e.engines)} O₂.
          </p>
          <FeedPolicyControl game={game} />
          {!short && f.feedDays < (f.daysLeft ?? 0) && (
            <p className="muted small">Moonbase stock covers {f.feedDays} day{f.feedDays === 1 ? '' : 's'} of feed, before production and deliveries.</p>
          )}
        </>
      )}
      {!e.engines && (
        <p className="muted small">
          {!e.probed ? 'Send a probe to assess the damage.'
            : !game.research.done.includes('terraforming') ? 'Research Terraforming Theory, then build Terraforming Engines.'
            : `Build Terraforming Engines. Each restores ${TERRAFORM_RATE}% a day and engines add together: one takes about 500 days, four about 125.`}
          {f.queued ? ` ${f.queued} in the build queue.` : ''}
        </p>
      )}
    </div>
  );
}

function MarsCard({ game }: { game: GameState }) {
  const act = useGame((s) => s.act);
  const t = game.threat;
  const bcs = Object.values(game.ships).filter((s) => s.type === 'battlecruiser' && s.status === 'docked' && s.at === 'moon').length;
  const troops = Object.values(game.ships).filter((s) => s.type === 'troopship' && s.status === 'docked' && s.at === 'moon').length;
  const intel = game.flags.includes('marsProbed');
  return (
    <div className="marscard">
      <h3>The Ares Collective</h3>
      <p>Status: <strong className={t.status === 'hostile' ? 'neg' : 'pos'}>{t.status === 'hostile' ? 'Hostile' : t.status === 'peace' ? 'At peace (Ares Accord)' : 'Occupied'}</strong> · waves so far: {t.wave} · salvage recovered: {t.salvage}</p>
      {t.status === 'hostile' && (
        <>
          <p className="muted small">Orbital defences: {intel ? `~${Math.round(t.marsDefence)} strength` : 'unknown — probe Mars'} · each battlecruiser ≈ {BATTLECRUISER_POWER}.</p>
          {(bcs > 0 || troops > 0) && (
            <button className="btn wide danger" onClick={() => act(launchAssault, 'Assault fleet launched for Mars')}>
              Launch assault: {bcs} battlecruiser{bcs === 1 ? '' : 's'}{troops ? ` + ${troops} troopship${troops === 1 ? '' : 's'}` : ' (no troopship!)'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
