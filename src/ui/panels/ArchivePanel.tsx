import { useState } from 'react';
import { useGame } from '../../store/useGame';
import { FRAGMENT_BY_ID, formatDate, readFragment } from '../../engine';
import { Empty, Section } from '../components/common';

/**
 * The Archive: documents recovered from the Last Shuttles' library as research progresses.
 * Deliberately plain for the first playtest: a list with an unread mark, no board, no counts of what's left.
 */
export function ArchivePanel() {
  const game = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const [open, setOpen] = useState<string | null>(null);
  const entries = [...game.archive].reverse();

  const toggle = (id: string) => {
    if (open === id) { setOpen(null); return; }
    const running = useGame.getState().speed !== 'paused';
    if (running) useGame.setState({ speed: 'paused' });
    act((s) => readFragment(s, id, running));
    setOpen(id);
  };

  return (
    <div className="stack">
      <Section title="Archive">
        {entries.length === 0 && <Empty>Nothing recovered yet. Documents surface from the Archive as research brings its designs back into use.</Empty>}
        <ul className="archive">
          {entries.map((e) => {
            const f = FRAGMENT_BY_ID[e.id];
            if (!f) return null;
            const unread = e.firstReadDay === undefined;
            const isOpen = open === e.id;
            return (
              <li key={e.id} className={`doc ${unread ? 'doc-unread' : ''} ${isOpen ? 'doc-open' : ''}`}>
                <button className="doc-head" onClick={() => toggle(e.id)} aria-expanded={isOpen}>
                  {unread && <span className="doc-dot" aria-label="Unread" />}
                  <span className="doc-title">{f.title}</span>
                  <span className="doc-meta muted small">{f.author} · {f.dated ?? formatDate(e.day)}</span>
                </button>
                {isOpen && (
                  <div className="doc-body">
                    {f.body.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                    <p className="muted small">Recovered {formatDate(e.day)}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
