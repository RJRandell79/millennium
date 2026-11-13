import { useGame } from '../store/useGame';
import { formatDate } from '../engine';

export function TopBar() {
  const game = useGame((s) => s.game)!;
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const step = useGame((s) => s.step);
  const instId = useGame((s) => s.installationId);
  const setInst = useGame((s) => s.setInstallation);
  const setTab = useGame((s) => s.setTab);
  const setMenu = useGame((s) => s.setMenu);
  const raids = game.threat.raids;
  const tracking = raids.reduce((a, r) => a + r.ships, 0);
  const nextEta = raids.length ? Math.min(...raids.map((r) => r.arriveDay)) - game.day : 0;
  const insts = Object.values(game.installations);

  return (
    <header className="topbar">
      <div className="topbar-row">
        <button className="iconbtn" onClick={() => setMenu(true)} aria-label="Menu">☰</button>
        <label className="inst-select">
          <span className="inst-label">INSTALLATION:</span>
          <select value={instId} onChange={(e) => { setInst(e.target.value); setTab('base'); }}>
            {insts.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        <div className="clock">
          <div className="clock-date">{formatDate(game.day)}</div>
          <div className="clock-day">DAY {game.day}</div>
        </div>
      </div>
      <div className="topbar-row controls">
        <button className="btn btn-step" onClick={() => { setSpeed('paused'); step(); }} disabled={!!game.outcome}>Next day</button>
        <button className={`btn ${speed === 'run' ? 'active' : ''}`} onClick={() => setSpeed(speed === 'run' ? 'paused' : 'run')} disabled={!!game.outcome} aria-label="Run">
          {speed === 'run' ? '❚❚' : '▶'}
        </button>
        <button className={`btn ${speed === 'fast' ? 'active' : ''}`} onClick={() => setSpeed(speed === 'fast' ? 'paused' : 'fast')} disabled={!!game.outcome} aria-label="Fast forward">
          {speed === 'fast' ? '❚❚' : '▶▶'}
        </button>
        <button className={`tracking ${tracking ? 'hot' : ''}`} onClick={() => { setTab('base'); setInst('moonbase'); }}>
          TRACKING: {tracking}{tracking ? ` · ETA ${nextEta}d` : ''}
        </button>
      </div>
      {tracking > 0 && <div className="alert-strip"><span>ALERT</span></div>}
    </header>
  );
}
