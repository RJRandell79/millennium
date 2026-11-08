import { useState } from 'react';
import { useGame } from '../../store/useGame';
import { formatDate, type MessageKind } from '../../engine';
import { Empty, Section } from '../components/common';

const FILTERS: { id: 'all' | MessageKind; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'alert', label: 'Alerts' }, { id: 'story', label: 'Story' }, { id: 'good', label: 'Progress' },
];

export function LogPanel() {
  const game = useGame((s) => s.game)!;
  const jump = useGame((s) => s.jumpTo);
  const [f, setF] = useState<'all' | MessageKind>('all');
  const msgs = [...game.messages].reverse().filter((m) => f === 'all' || m.kind === f || (f === 'alert' && m.kind === 'warn'));
  return (
    <div className="stack">
      <section className="panel">
        <div className="segmented">
          {FILTERS.map((x) => <button key={x.id} className={f === x.id ? 'active' : ''} onClick={() => setF(x.id)}>{x.label}</button>)}
        </div>
      </section>
      <Section title="Communications log">
        {msgs.length === 0 && <Empty>No messages.</Empty>}
        <ul className="log">
          {msgs.map((m) => (
            <li key={m.id} className={`log-${m.kind}`}>
              <button onClick={() => jump(m.ref)} disabled={!m.ref}>
                <span className="log-date mono">{formatDate(m.day)}</span>
                <strong>{m.title}</strong>
                <span>{m.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
