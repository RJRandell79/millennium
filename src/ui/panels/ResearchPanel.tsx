import { useGame } from '../../store/useGame';
import { type ResearchDef, RESEARCH_BY_ID, researchList, setResearch, researchRate, researchCost, formatDate } from '../../engine';
import { Bar, Section } from '../components/common';

const BRANCHES: ResearchDef['branch'][] = ['Space', 'Colonies', 'Industry', 'Defence', 'Endgame'];

export function ResearchPanel() {
  const game = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const mb = game.installations.moonbase;
  const list = researchList(game);
  const cur = game.research.current ? RESEARCH_BY_ID[game.research.current] : null;
  const rate = researchRate(mb, mb.report.deptEff.research ?? 0);
  const eta = cur && rate > 0 ? Math.ceil((researchCost(cur) - game.research.progress) / rate) : null;

  return (
    <div className="stack">
      <Section title="Current project">
        {cur ? (
          <>
            <h3 className="proj-name">{cur.name}</h3>
            <Bar value={game.research.progress} max={researchCost(cur)} tone="cyan" label={`${Math.floor((game.research.progress / researchCost(cur)) * 100)}%`} />
            <p className="muted small">{rate > 0 ? `${rate.toFixed(2)} pts/day · completes ~${formatDate(game.day + (eta ?? 0))}` : 'Research department has no power!'}</p>
            <p className="small">Unlocks: {cur.unlocks}</p>
          </>
        ) : <p className="warn-text">The labs are idle. Pick a project below.</p>}
        <p className="muted small">Done: {game.research.done.length} / {Object.keys(RESEARCH_BY_ID).length}. Switching project keeps half the progress.</p>
      </Section>
      {BRANCHES.map((br) => {
        const items = list.filter((x) => x.def.branch === br);
        if (!items.length) return null;
        return (
          <Section key={br} title={br}>
            <ul className="research">
              {items.map(({ def, status }) => (
                <li key={def.id} className={`rs rs-${status}`}>
                  <button disabled={status === 'done' || status === 'locked'} onClick={() => act((s) => setResearch(s, def.id), `Researching ${def.name}`)}>
                    <span className="rs-top">
                      <strong>{def.name}</strong>
                      <span className="muted small">{status === 'done' ? '✓ done' : status === 'current' ? '◉ active' : `${Math.round(researchCost(def))} pts`}</span>
                    </span>
                    <span className="small">{def.desc}</span>
                    <span className="small rs-unlock">→ {def.unlocks}</span>
                    {status === 'locked' && (
                      <span className="small neg">
                        Needs: {def.requires.filter((r) => !game.research.done.includes(r)).map((r) => RESEARCH_BY_ID[r].name).join(', ')}
                        {def.minSalvage && game.threat.salvage < def.minSalvage ? ` ${def.requires.some((r) => !game.research.done.includes(r)) ? '+' : ''} salvage ${game.threat.salvage}/${def.minSalvage}` : ''}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}
