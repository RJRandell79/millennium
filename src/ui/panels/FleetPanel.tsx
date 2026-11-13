import { useState } from 'react';
import { useGame, type FleetStatusFilter } from '../../store/useGame';
import {
  type GameState, type Ship, type ShipType, BODY_BY_ID, SHIP_SPECS, MATERIAL_IDS, MATERIAL_BY_ID, BLUEPRINT_BY_ID,
  missionsFor, sendShip, setFreighterRoute, recallShip, launchAssault, formatDate, fmtKg, stockTotal, fuelFor,
  shipCapacity, colonyShipTo, nextSlot, departureToArriveAfter,
} from '../../engine';
import { Bar, Empty, Section } from '../components/common';

const PURPOSE: Record<string, string> = {
  probe: 'Probing', survey: 'En route to survey', colonise: 'Carrying colonists to', mine: 'Heading out to mine',
  haulOut: 'Supply run to', haulBack: 'Returning with ore from', return: 'Returning to Moonbase from', assault: 'Assault on', accord: 'Peace mission to',
};

const STATUS_CHIPS: { id: FleetStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'idle', label: 'Idle' },
  { id: 'docked', label: 'Docked' },
  { id: 'transit', label: 'In transit' },
  { id: 'working', label: 'Working' },
];

const TYPE_ORDER: ShipType[] = ['probe', 'surveyor', 'colonyShip', 'freighter', 'miner', 'gasScoop', 'battlecruiser', 'troopship', 'hospitalShip'];
const TYPE_PLURAL: Record<ShipType, string> = {
  probe: 'Probes', surveyor: 'Survey ships', colonyShip: 'Colony ships', freighter: 'Freighters', miner: 'Miners',
  gasScoop: 'Gas scoops', battlecruiser: 'Battlecruisers', troopship: 'Troopships', hospitalShip: 'Hospital ships',
};

/** Idle = on the Moonbase flight deck with no standing route: ready for orders. */
export function isIdle(s: Ship): boolean {
  return s.status === 'docked' && s.at === 'moon' && !s.routeTo;
}

function matchesStatus(s: Ship, f: FleetStatusFilter): boolean {
  switch (f) {
    case 'all': return true;
    case 'idle': return isIdle(s);
    case 'docked': return s.status === 'docked';
    case 'transit': return s.status === 'transit';
    case 'working': return s.status === 'working';
  }
}

/** Keep a tapped chip fully on screen in a sideways-scrolling row. */
function reveal(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

function byFleetOrder(a: Ship, b: Ship): number {
  if (a.status === 'transit' && b.status === 'transit') return (a.transit?.arriveDay ?? 0) - (b.transit?.arriveDay ?? 0);
  const t = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
  return t !== 0 ? t : a.name.localeCompare(b.name);
}

export function FleetPanel() {
  const game = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const filter = useGame((s) => s.fleetFilter);
  const setFilter = useGame((s) => s.setFleetFilter);
  const ships = Object.values(game.ships);
  const fd = game.installations.moonbase.depts.flightDeck!;

  // If the chosen type no longer exists (e.g. last probe launched), fall back to all types.
  const ownedTypes = TYPE_ORDER.filter((t) => ships.some((s) => s.type === t));
  const typeFilter = filter.type !== 'all' && !ownedTypes.includes(filter.type) ? 'all' : filter.type;
  const ofType = (s: Ship) => typeFilter === 'all' || s.type === typeFilter;

  const statusCount = (f: FleetStatusFilter) => ships.filter((s) => ofType(s) && matchesStatus(s, f)).length;
  const typeCount = (t: ShipType | 'all') => ships.filter((s) => (t === 'all' || s.type === t) && matchesStatus(s, filter.status)).length;

  const shown = ships.filter((s) => ofType(s) && matchesStatus(s, filter.status));
  const docked = shown.filter((s) => s.status === 'docked').sort(byFleetOrder);
  const away = shown.filter((s) => s.status !== 'docked').sort(byFleetOrder);
  const warships = ships.filter((s) => (s.type === 'battlecruiser' || s.type === 'troopship') && s.status === 'docked' && s.at === 'moon');
  const filtered = filter.status !== 'all' || typeFilter !== 'all';
  const showAssault = warships.length > 0 && game.threat.status === 'hostile'
    && ['all', 'idle', 'docked'].includes(filter.status) && ['all', 'battlecruiser', 'troopship'].includes(typeFilter);

  return (
    <div className="stack">
      {(!fd.online || fd.damage >= 90) && <p className="warn-text panel">The flight deck is {fd.online ? 'too damaged' : 'offline'} — nothing can launch.</p>}

      <section className="panel fleet-filters" aria-label="Filter craft">
        <div className="chiprow" role="group" aria-label="Status">
          {STATUS_CHIPS.map((c) => (
            <button key={c.id} className={`fchip ${filter.status === c.id ? 'on' : ''} ${c.id === 'idle' && statusCount('idle') ? 'attn' : ''} ${statusCount(c.id) ? '' : 'zero'}`}
              aria-pressed={filter.status === c.id} onClick={(e) => { reveal(e); setFilter({ status: c.id }); }}>
              {c.label} <span className="fchip-n">{statusCount(c.id)}</span>
            </button>
          ))}
        </div>
        {ownedTypes.length > 1 && (
          <div className="chiprow" role="group" aria-label="Craft type">
            <button className={`fchip ${typeFilter === 'all' ? 'on' : ''}`} aria-pressed={typeFilter === 'all'} onClick={(e) => { reveal(e); setFilter({ type: 'all' }); }}>
              All types <span className="fchip-n">{typeCount('all')}</span>
            </button>
            {ownedTypes.map((t) => (
              <button key={t} className={`fchip ${typeFilter === t ? 'on' : ''} ${typeCount(t) ? '' : 'zero'}`} aria-pressed={typeFilter === t} onClick={(e) => { reveal(e); setFilter({ type: t }); }}>
                {TYPE_PLURAL[t]} <span className="fchip-n">{typeCount(t)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {showAssault && (
        <button className="btn wide danger" onClick={() => act(launchAssault, 'Assault fleet launched for Mars')}>Launch assault on Mars</button>
      )}

      {filter.status === 'all' ? (
        <>
          <Section title={`Flight deck — ${docked.length} docked`}>
            {docked.length ? docked.map((s) => <ShipCard key={s.id} game={game} ship={s} />) : <Empty>{filtered ? 'None of these are docked.' : 'No ships docked. Build some in the Build tab.'}</Empty>}
          </Section>
          <Section title={`In space — ${away.length}`}>
            {away.length ? away.map((s) => <ShipCard key={s.id} game={game} ship={s} />) : <Empty>{filtered ? 'None of these are in space.' : 'Nothing in flight.'}</Empty>}
          </Section>
        </>
      ) : (
        <Section title={`${STATUS_CHIPS.find((c) => c.id === filter.status)!.label} — ${shown.length}`}>
          {shown.length ? [...docked, ...away].map((s) => <ShipCard key={s.id} game={game} ship={s} />)
            : <Empty>{filter.status === 'idle' ? 'No idle craft. Everything docked is already on a route.' : 'No craft match this filter.'}</Empty>}
          {filtered && <button className="btn ghost wide" onClick={() => setFilter({ status: 'all', type: 'all' })}>Clear filters</button>}
        </Section>
      )}

      {game.consignments.length > 0 && filter.status === 'all' && (
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
  // Worlds a colony ship is heading for can take a freighter before the colony exists.
  const pending = Object.values(game.ships)
    .filter((sh) => sh.type === 'colonyShip' && sh.status === 'transit' && sh.transit?.purpose === 'colonise' && !game.bodies[sh.transit.to].installationId)
    .map((sh) => ({ bodyId: sh.transit!.to, land: sh.transit!.arriveDay }));
  const routeName = ship.routeBody ? `${BODY_BY_ID[ship.routeBody].name} (colony ship on its way)`
    : ship.routeTo ? (game.installations[ship.routeTo]?.name ?? BODY_BY_ID[ship.routeTo]?.name) : null;
  const options = ship.status === 'docked' ? missionsFor(game, ship) : [];
  const total = stockTotal(ship.cargo);

  let status = '';
  if (ship.status === 'docked') {
    status = `Docked at ${BODY_BY_ID[ship.at].name}`;
    if (ship.type === 'freighter' && ship.at === 'moon' && ship.autoLoop) {
      const col = ship.routeTo ? game.installations[ship.routeTo] : undefined;
      if (col && nextSlot(game, col) > game.day) status += ` · next slot on the route ${formatDate(nextSlot(game, col))}`;
      const cs = ship.routeBody ? colonyShipTo(game, ship.routeBody) : undefined;
      if (cs) status += ` · leaves ${formatDate(departureToArriveAfter(game, ship.routeBody!, game.day, cs.transit!.arriveDay + 1))} to arrive just after the landing`;
    }
  }
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
        <span className="muted small">{spec.name}{ship.type === 'freighter' ? ` · ${fmtKg(shipCapacity(game, 'freighter'))} kg hold` : ''}</span>
      </div>
      <p className="ship-status">{status}</p>
      {t && <Bar value={game.day - t.departDay} max={t.arriveDay - t.departDay} tone="cyan" label={`${t.arriveDay - game.day} days`} />}
      {ship.status === 'working' && spec.capacity > 0 && <Bar value={total} max={shipCapacity(game, ship.type)} tone="amber" label={`Hold ${fmtKg(total)} / ${fmtKg(shipCapacity(game, ship.type))} kg`} />}
      {total > 1 && ship.status !== 'working' && <p className="muted small">Cargo: {cargoLine(ship)}</p>}
      {ship.consignments.length > 0 && <p className="muted small">Crates: {ship.consignments.map((c) => BLUEPRINT_BY_ID[c.blueprintId].name).join(', ')}</p>}
      {routeName && <p className="small">Route: <strong>{routeName}</strong> {ship.autoLoop ? '(looping)' : '(last leg)'}</p>}

      <div className="ship-actions">
        {ship.type === 'freighter' && (
          <select value={ship.routeTo ?? ship.routeBody ?? ''} onChange={(e) => act((s) => setFreighterRoute(s, ship.id, e.target.value || undefined), e.target.value ? `${ship.name} assigned` : undefined)}>
            <option value="">{colonies.length || pending.length ? 'Assign to colony…' : 'No colonies yet'}</option>
            {colonies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {pending.map((p) => <option key={p.bodyId} value={p.bodyId}>{BODY_BY_ID[p.bodyId].name} (colony ship lands {formatDate(p.land)})</option>)}
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
