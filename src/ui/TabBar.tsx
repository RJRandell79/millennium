import { useGame, type Tab } from '../store/useGame';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'base', label: 'Base', icon: '⌂' },
  { id: 'map', label: 'System', icon: '◎' },
  { id: 'fleet', label: 'Fleet', icon: '➤' },
  { id: 'research', label: 'Research', icon: '⚗' },
  { id: 'build', label: 'Build', icon: '⚙' },
  { id: 'log', label: 'Log', icon: '✉' },
  { id: 'archive', label: 'Archive', icon: '❖' },
];

export function TabBar() {
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const unread = useGame((s) => s.game?.unread ?? 0);
  const idleResearch = useGame((s) => !s.game?.research.current);
  const emptyQueue = useGame((s) => s.game?.queue.length === 0);
  const unreadDocs = useGame((s) => s.game?.archive.filter((e) => e.firstReadDay === undefined).length ?? 0);
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const badge = t.id === 'log' && unread ? String(Math.min(99, unread))
          : t.id === 'archive' && unreadDocs ? String(unreadDocs)
          : t.id === 'research' && idleResearch ? '!' : t.id === 'build' && emptyQueue ? '!' : '';
        return (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
            {badge && <span className="badge">{badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}
