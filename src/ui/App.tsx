import { useEffect, useRef, useState } from 'react';
import { useGame, type SaveInfo } from '../store/useGame';
import { archiveStats, formatDate, score, serialize, totalPopulation, type GameSettings } from '../engine';
import { canDownload } from '../platform/download';
import { TopBar } from './TopBar';
import { TabBar } from './TabBar';
import { BasePanel } from './panels/BasePanel';
import { MapPanel } from './panels/MapPanel';
import { FleetPanel } from './panels/FleetPanel';
import { ResearchPanel } from './panels/ResearchPanel';
import { BuildPanel } from './panels/BuildPanel';
import { LogPanel } from './panels/LogPanel';
import { ArchivePanel } from './panels/ArchivePanel';

export function App() {
  const game = useGame((s) => s.game);
  const initCloud = useGame((s) => s.initCloud);
  const flushSaves = useGame((s) => s.flushSaves);
  // Connect cloud saves once; save immediately whenever the app is hidden or closed.
  useEffect(() => { void initCloud(); }, [initCloud]);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushSaves(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushSaves);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flushSaves); };
  }, [flushSaves]);
  return game ? <GameShell /> : <TitleScreen />;
}

/** "Day 134 · 2 colonies · cloud, 3 min ago" */
export function describeSave(s: SaveInfo): string {
  const mins = Math.round((Date.now() - s.savedAt) / 60000);
  const ago = !s.savedAt ? '' : mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`;
  return `Day ${s.day} · ${s.colonies} ${s.colonies === 1 ? 'colony' : 'colonies'} · ${s.where === 'cloud' ? 'cloud' : 'this device'}${ago ? `, ${ago}` : ''}`;
}

function CloudLine() {
  const cloud = useGame((s) => s.cloud);
  if (cloud.status === 'checking') return <p className="muted small">Cloud save: connecting…</p>;
  if (cloud.status === 'off') return <p className="muted small">Cloud save isn't available here: saves stay on this device. Use Download save to keep a copy.</p>;
  return (
    <p className={`small ${cloud.problem ? 'warn-text' : 'good-text'}`}>
      Cloud save on{cloud.lastSavedAt ? `: last saved ${new Date(cloud.lastSavedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}.{cloud.problem ? ` ${cloud.problem}` : ' Your game follows you between devices.'}
    </p>
  );
}

function GameShell() {
  const tab = useGame((s) => s.tab);
  const speed = useGame((s) => s.speed);
  const step = useGame((s) => s.step);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (speed === 'paused') return;
    const ms = speed === 'run' ? 450 : 70;
    const id = window.setInterval(() => { step(); }, ms);
    return () => window.clearInterval(id);
  }, [speed, step]);

  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [tab]);

  return (
    <div className="shell">
      <TopBar />
      <main ref={mainRef} className="main">
        {tab === 'base' && <BasePanel />}
        {tab === 'map' && <MapPanel />}
        {tab === 'fleet' && <FleetPanel />}
        {tab === 'research' && <ResearchPanel />}
        {tab === 'build' && <BuildPanel />}
        {tab === 'log' && <LogPanel />}
        {tab === 'archive' && <ArchivePanel />}
      </main>
      <TabBar />
      <Toast />
      <StoryModal />
      <Menu />
    </div>
  );
}

function Toast() {
  const toast = useGame((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => useGame.setState({ toast: null }), toast.kind === 'error' ? 4500 : 2200);
    return () => window.clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  return <div className={`toast toast-${toast.kind}`} role="status" onClick={() => useGame.setState({ toast: null })}>{toast.text}</div>;
}

function StoryModal() {
  const modal = useGame((s) => s.modal);
  const close = useGame((s) => s.closeModal);
  const game = useGame((s) => s.game)!;
  const jump = useGame((s) => s.jumpTo);
  const quit = useGame((s) => s.quit);
  if (!modal) return null;
  const over = game.outcome;
  return (
    <div className="modal-back" onClick={over ? undefined : close}>
      <div className={`modal ${over ? (over.result === 'won' ? 'won' : 'lost') : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head"><span className="blink">●</span> INCOMING TRANSMISSION · {formatDate(modal.day)}</div>
        <h2>{modal.title}</h2>
        <p>{modal.text}</p>
        {over && (
          <div className="final">
            <p>{over.result === 'won' ? 'Victory' : 'Defeat'} on day {over.day}. Population {totalPopulation(game)} · colonies {Object.keys(game.installations).length - 1} · raids repelled {game.stats.raidsRepelled}.</p>
            <p className="score">SCORE {score(game).toLocaleString('en-GB')}</p>
          </div>
        )}
        <div className="modal-actions">
          {over ? <button className="btn" onClick={quit}>Title screen</button> : (
            <>
              {modal.ref && <button className="btn ghost" onClick={() => { close(); jump(modal.ref); }}>Show me</button>}
              <button className="btn" onClick={close}>Acknowledge</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Menu() {
  const open = useGame((s) => s.menuOpen);
  const setMenu = useGame((s) => s.setMenu);
  const saveSlot = useGame((s) => s.saveSlot);
  const loadSlot = useGame((s) => s.loadSlot);
  const slotInfo = useGame((s) => s.slotInfo);
  const downloadSave = useGame((s) => s.downloadSave);
  useGame((s) => s.cloud); // re-render slot labels when cloud saves arrive
  const quit = useGame((s) => s.quit);
  const game = useGame((s) => s.game);
  const showToast = useGame((s) => s.showToast);
  const [downloadable, setDownloadable] = useState(false);
  useEffect(() => { if (open) void canDownload().then(setDownloadable); }, [open]);
  if (!open || !game) return null;
  const copySave = () => {
    navigator.clipboard.writeText(serialize(game))
      .then(() => showToast('Save copied — paste it into a .json file to keep it.', 'info'))
      .catch(() => showToast('Clipboard not available here.'));
  };
  return (
    <div className="modal-back" onClick={() => setMenu(false)}>
      <div className="modal menu" onClick={(e) => e.stopPropagation()}>
        <h2>Menu</h2>
        <p className="muted small">Seed {game.seed} · {game.settings.difficulty} · {game.settings.varied ? 'varied worlds' : 'classic worlds'}. The game autosaves as you play and whenever you pause or leave.</p>
        <CloudLine />
        <ArchiveStatsLine />
        {[1, 2, 3].map((n) => {
          const info = slotInfo(n);
          return (
            <div key={n} className="slot">
              <span>Slot {n}: <span className="muted">{info ? describeSave(info) : 'empty'}</span></span>
              <button className="btn" onClick={() => { void saveSlot(n); }}>Save</button>
              <button className="btn ghost" disabled={!info} onClick={() => { void loadSlot(n).then((ok) => { if (ok) showToast(`Loaded slot ${n}`, 'info'); }); }}>Load</button>
            </div>
          );
        })}
        <div className="modal-actions">
          {downloadable && <button className="btn ghost" onClick={() => { void downloadSave(); }}>Download save</button>}
          <button className="btn ghost" onClick={copySave}>Copy save</button>
          <button className="btn ghost" onClick={quit}>Title screen</button>
          <button className="btn" onClick={() => setMenu(false)}>Resume</button>
        </div>
        <HowTo />
      </div>
    </div>
  );
}

/** Playtest readout: how the archive has been used this game. */
function ArchiveStatsLine() {
  const game = useGame((s) => s.game)!;
  const a = archiveStats(game);
  if (!a.found && !a.backfilled) return null;
  return (
    <p className="muted small">
      Archive: {a.found} recovered in play · {a.read} opened{a.medianDaysToOpen !== null ? ` · median ${a.medianDaysToOpen} days to open` : ''} · {a.interruptedPlay} opened mid-run · {a.reopened} reopened
      {a.backfilled ? ` · ${a.backfilled} filed from an older save (not counted)` : ''}
    </p>
  );
}

function HowTo() {
  return (
    <details className="howto">
      <summary>How to play</summary>
      <ul>
        <li>Time passes one day at a time. Use <b>Next day</b>, or <b>▶</b>/<b>▶▶</b> to run — it stops automatically when something important happens.</li>
        <li><b>Explore:</b> probe → survey → colonise → mine. Probes reveal a world and its moons; survey ships find landing sites; colony ships carry 50 people.</li>
        <li><b>Supply:</b> assign a freighter to each colony. It loops on its own: life support and crated equipment out, ore back.</li>
        <li><b>Power:</b> solar output falls with distance² from the Sun. Departments get power top to bottom; switch some off to protect others.</li>
        <li><b>Rare materials:</b> no copper on the Moon (mine asteroids); no silver, chromium or uranium on the Moon or in the belt.</li>
        <li><b>Mars:</b> raids grow every wave. Lasers fire first, fighters next, shields soak damage. End the war by conquest or by finding a cure.</li>
        <li><b>Win:</b> probe Earth, research Terraforming Theory, and keep Terraforming Engines fed until Earth is 100% restored.</li>
      </ul>
    </details>
  );
}

function TitleScreen() {
  const start = useGame((s) => s.start);
  const load = useGame((s) => s.load);
  const [difficulty, setDifficulty] = useState<GameSettings['difficulty']>('standard');
  const [varied, setVaried] = useState(true);
  const [seed, setSeed] = useState('');
  const autosaveInfo = useGame((s) => s.autosaveInfo);
  const continueGame = useGame((s) => s.continueGame);
  const cloud = useGame((s) => s.cloud);
  const auto = autosaveInfo();
  const importFile = (f: File | undefined) => {
    if (!f) return;
    f.text().then((t) => load(t));
  };
  return (
    <div className="title">
      <div className="title-stars" />
      <div className="title-card">
        <p className="title-kicker">AFTER IAN BIRD · 1989</p>
        <h1>MILLENNIUM <span>2.2</span></h1>
        <p className="title-sub">30 January 2200. Earth is dead. Moonbase is all that's left.</p>
        {auto && (
          <>
            <button className="btn wide big" onClick={() => { void continueGame(); }}>Continue</button>
            <p className="muted small center">{describeSave(auto)}</p>
          </>
        )}
        {!auto && cloud.status === 'checking' && <p className="muted small center">Looking for a cloud save…</p>}
        <div className="title-opts">
          <label>Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as GameSettings['difficulty'])}>
              <option value="relaxed">Relaxed — slower raids</option>
              <option value="standard">Standard</option>
              <option value="hard">Hard — early, heavy raids</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={varied} onChange={(e) => setVaried(e.target.checked)} />
            Varied worlds (resources shuffled each game)
          </label>
          <label>Seed (optional)
            <input inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} placeholder="random" />
          </label>
        </div>
        <button className="btn wide big" onClick={() => start({ difficulty, varied }, seed ? Number(seed) : undefined)}>New game</button>
        <label className="btn ghost wide file">
          Import save
          <input type="file" accept="application/json,.json" onChange={(e) => importFile(e.target.files?.[0])} />
        </label>
        <HowTo />
      </div>
    </div>
  );
}
