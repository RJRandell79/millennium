import { useState } from 'react';
import { useGame } from '../../store/useGame';
import {
  type GameState, type Ship, BODY_BY_ID, SHIP_SPECS, MATERIAL_IDS, MATERIAL_BY_ID, BLUEPRINT_BY_ID,
  missionsFor, sendShip, setFreighterRoute, recallShip, launchAssault, formatDate, fmtKg, stockTotal, fuelFor,
} from '../../engine';
import { Bar, Empty, Section } from '../components/common';

const PURPOSE: Record<string, string> = {
  probe: 'Probing', survey: 'En route to survey', colonise: 'Carrying colonists to', mine: 'Heading out to mine',
  haulOut: 'Supply run to', haulBack: 'Returning with ore from', return: 'Returning to Moonbase from', assault: 'Assault on', accord: 'Peace mission to',
};

export function FleetPanel() {
  const game = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const ships = Object.values(game.ships);
  const docked = ships.filter((s) => s.status === 'docked');
  const away = ships.filter((s) => s.status !== 'docked');
  const fd = game.installations.moonbase.depts.flightDeck!;
  const warships = docked.filter((s) => s.type === 'battlecruiser' || s.type === 'troopship');
  return (
    <div className="stack">
      {(!fd.online || fd.damage >= 90) && <p className="warn-text panel">The flight deck is {fd.online ? 'too damaged' : 'offline'} — nothing can launch.</p>}
      <Section title={`Flight deck — ${docked.length} docked`}>
        {docked.length ? docked.map((s) => <ShipCard key={s.id} game={game} ship={s} />) : <Empty>No ships docked. Build some in the Build tab.</Empty>}
        {warships.length > 0 && game.threat.status === 'hostile' && (
          <button className="btn wide danger" onClick={() => act(launchAssault, 'Assault fleet launched for Mars')}>Launch assault on Mars</button>
        )}
      </Section>
      <Section title={`In space — ${away.length}`}>
        {away.length ? away.sort((a, b) => (a.transit?.arriveDay ?? 1e9) - (b.transit?.arriveDay ?? 1e9)).map((s) => <ShipCard key={s.id} game={game} ship={s} />) : <Empty>Nothing in flight.</Empty>}
      </Section>
      {game.consignments.length > 0 && (
        <Section title="Awaiting a freighter">
          <ul className="plain">
            {game.consignments.map((c) => <li key={c.id}>{BLUEPRINT_BY_ID[c.blueprintId].name} → {game.installations[c.installationId]?.name}</li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}

function cargoLine(ship: Ship): string {
  const items = MATERIAL_IDS.filter((m) => ship.cargo[m] > 1).sort((a, b) => ship.cargo[b] - ship.cargo[a]).slice(0, 4);
  return items.map((m) => `${MATERIAL_BY_ID[m].symbol} ${fmtKg(ship.cargo[m])}`).join(' · ');
}

function ShipCard({ game, ship }: { game: GameState; ship: Ship }) {
  const act = useGame((s) => s.act);
  const [dest, setDest] = useState('');
  const spec = SHIP_SPECS[ship.type];
  const t = ship.transit;
  const colonies = Object.values(game.installations).filter((i) => !i.isMoonBase);
  const routeName = ship.routeTo ? (game.installations[ship.routeTo]?.name ?? BODY_BY_ID[ship.routeTo]?.name) : null;
  const options = ship.status === 'docked' ? missionsFor(game, ship) : [];
  const total = stockTotal(ship.cargo);

  let status = '';
  if (ship.status === 'docked') status = `Docked at ${BODY_BY_ID[ship.at].name}`;
  else if (ship.status === 'working') {
    status = ship.type === 'surveyor' ? `Surveying ${BODY_BY_ID[ship.at].name} — ${ship.workDaysLeft} days left`
      : ship.type === 'miner' || ship.type === 'gasScoop' ? `Mining ${BODY_BY_ID[ship.at].name}` : `At ${BODY_BY_ID[ship.at].name}`;
  } else if (t) {
    const place = t.purpose === 'haulBack' || t.purpose === 'return' ? BODY_BY_ID[t.from].name : BODY_BY_ID[t.to].name;
    status = `${PURPOSE[t.purpose]} ${place} · arrives ${formatDate(t.arriveDay)}`;
  }

  return (
    <article className={`ship ship-${ship.type}`}>
      <div className="ship-top">
        <strong>{ship.name}</strong>
        <span className="muted small">{spec.name}</span>
      </div>
      <p className="ship-status">{status}</p>
      {t && <Bar value={game.day - t.departDay} max={t.arriveDay - t.departDay} tone="cyan" label={`${t.arriveDay - game.day} days`} />}
      {ship.status === 'working' && spec.capacity > 0 && <Bar value={total} max={spec.capacity} tone="amber" label={`Hold ${fmtKg(total)} / ${fmtKg(spec.capacity)} kg`} />}
      {total > 1 && ship.status !== 'working' && <p className="muted small">Cargo: {cargoLine(ship)}</p>}
      {ship.consignments.length > 0 && <p className="muted small">Crates: {ship.consignments.map((c) => BLUEPRINT_BY_ID[c.blueprintId].name).join(', ')}</p>}
      {routeName && <p className="small">Route: <strong>{routeName}</strong> {ship.autoLoop ? '(looping)' : '(last leg)'}</p>}

      <div className="ship-actions">
        {ship.type === 'freighter' && (
          <select value={ship.routeTo ?? ''} onChange={(e) => act((s) => setFreighterRoute(s, ship.id, e.target.value || undefined), e.target.value ? `${ship.name} assigned` : undefined)}>
            <option value="">{colonies.length ? 'Assign to colony…' : 'No colonies yet'}</option>
            {colonies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {ship.status === 'docked' && ship.at === 'moon' && options.length > 0 && (
          <>
            <select value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="">Destination…</option>
              {options.map((o) => (
                <option key={o.bodyId} value={o.bodyId} disabled={!o.ok}>
                  {o.label} — {o.days}d{o.ok ? '' : ` (${o.reason})`}
                </option>
              ))}
            </select>
            <button className="btn" disabled={!dest} onClick={() => { if (act((s) => sendShip(s, ship.id, dest), `${ship.name} launched`)) setDest(''); }}>
              Launch{dest ? ` · ${fmtKg(fuelFor(game, ship, dest, ship.type === 'probe' ? 'probe' : ship.type === 'colonyShip' ? 'colonise' : 'mine'))} kg H` : ''}
            </button>
          </>
        )}
        {(ship.routeTo || ship.status === 'working') && ship.type !== 'battlecruiser' && ship.type !== 'troopship' && (
          <button className="btn ghost" onClick={() => act((s) => recallShip(s, ship.id), `${ship.name} will come home`)}>Recall</button>
        )}
      </div>
    </article>
  );
}
