import { useState } from 'react';
import { useGame } from '../../store/useGame';
import {
  type Blueprint, type GameState, BLUEPRINT_BY_ID, availableBlueprints, validTargetsFor, equipCount, queueBuild,
  cancelBuild, moveBuild, toggleRepeat, missing, canAfford, productionRate, MATERIAL_BY_ID, fmtKg, type MaterialId,
} from '../../engine';
import { Bar, CostChips, Empty, Section } from '../components/common';

const CATS: Blueprint['category'][] = ['Ships', 'Infrastructure', 'Defence', 'Endgame'];

export function BuildPanel() {
  const game = useGame((s) => s.game)!;
  const [cat, setCat] = useState<Blueprint['category']>('Ships');
  const bps = availableBlueprints(game).filter((b) => b.category === cat);
  return (
    <div className="stack">
      <Queue game={game} />
      <section className="panel">
        <div className="segmented">
          {CATS.map((c) => <button key={c} className={cat === c ? 'active' : ''} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div className="catalogue">
          {bps.length ? bps.map((bp) => <BlueprintCard key={bp.id} game={game} bp={bp} />) : <Empty>Nothing here yet — research unlocks more.</Empty>}
        </div>
      </section>
    </div>
  );
}

function Queue({ game }: { game: GameState }) {
  const act = useGame((s) => s.act);
  const mb = game.installations.moonbase;
  const slots = 1 + mb.equipment.factories;
  const rate = productionRate(mb, mb.report.deptEff.production ?? 0);
  let active = 0;
  return (
    <Section title={`Production queue (${game.queue.length}/12)`} right={<span className="muted small">{slots} slot{slots > 1 ? 's' : ''} · {rate.toFixed(2)}×/day</span>}>
      {game.queue.length === 0 && <Empty>The factory is idle.</Empty>}
      <ol className="queue">
        {game.queue.map((q, i) => {
          const bp = BLUEPRINT_BY_ID[q.blueprintId];
          const target = q.targetId === 'earth' ? 'Earth' : game.installations[q.targetId]?.name ?? '';
          const waiting = !q.started && !canAfford(mb.stock, bp.cost);
          const working = q.started && active < slots;
          if (q.started) active++;
          const short = missing(mb.stock, bp.cost);
          return (
            <li key={q.id} className={working ? 'working' : waiting ? 'waiting' : ''}>
              <div className="q-top">
                <strong>{bp.name}</strong>
                {bp.equip && <span className="muted small">→ {target}</span>}
                <span className="q-actions">
                  <button className="iconbtn" onClick={() => act((s) => moveBuild(s, q.id, -1))} disabled={i === 0} aria-label="Move up">▲</button>
                  <button className="iconbtn" onClick={() => act((s) => moveBuild(s, q.id, 1))} disabled={i === game.queue.length - 1} aria-label="Move down">▼</button>
                  <button className={`iconbtn ${q.repeat ? 'lit' : ''}`} onClick={() => act((s) => toggleRepeat(s, q.id))} aria-label="Repeat" title="Repeat">↻</button>
                  <button className="iconbtn" onClick={() => act((s) => cancelBuild(s, q.id))} aria-label="Cancel">✕</button>
                </span>
              </div>
              {q.started
                ? <Bar value={q.progress} max={bp.days} tone={working ? 'cyan' : 'amber'} label={working ? `${Math.floor((q.progress / bp.days) * 100)}%` : 'waiting for a slot'} />
                : <p className={`small ${waiting ? 'neg' : 'muted'}`}>{waiting ? `Short: ${Object.entries(short).map(([k, v]) => `${MATERIAL_BY_ID[k as MaterialId].symbol} ${fmtKg(v ?? 0)}`).join(', ')}` : 'Queued'}</p>}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function BlueprintCard({ game, bp }: { game: GameState; bp: Blueprint }) {
  const act = useGame((s) => s.act);
  const mb = game.installations.moonbase;
  const targets = validTargetsFor(game, bp);
  const [target, setTarget] = useState('moonbase');
  const tgt = game.installations[target] ?? mb;
  const count = bp.equip ? equipCount(game, bp, tgt) : null;
  const full = bp.max !== undefined && count !== null && count >= bp.max;
  return (
    <article className="bp">
      <div className="bp-top">
        <strong>{bp.name}</strong>
        <span className="muted small">{bp.days} days{count !== null && bp.max ? ` · ${count}/${bp.max}` : ''}</span>
      </div>
      <p className="small">{bp.desc}</p>
      <CostChips cost={bp.cost} stock={mb.stock} />
      <div className="bp-actions">
        {bp.install === 'any' && targets.length > 1 && (
          <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Install at">
            {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <button className="btn" disabled={full} onClick={() => act((s) => queueBuild(s, bp.id, bp.install === 'any' ? target : 'moonbase'), `${bp.name} queued`)}>
          {full ? 'Maximum reached' : 'Queue'}
        </button>
      </div>
    </article>
  );
}
