import { create } from 'zustand';
import { connectCloud, listCloud, readCloud, writeCloud, type SaveKey, type SaveMeta, type StoredSave } from '../platform/cloudSave';
import { downloadText } from '../platform/download';
import {
  type ActionResult, type GameSettings, type GameState, type Message,
  advanceDay, newGame, serialize, deserialize, markRead, BODY_BY_ID, type ShipType,
} from '../engine';

export type Tab = 'base' | 'map' | 'fleet' | 'research' | 'build' | 'log' | 'archive';
export type Speed = 'paused' | 'run' | 'fast';
export type FleetStatusFilter = 'all' | 'idle' | 'docked' | 'transit' | 'working';
export interface FleetFilter { status: FleetStatusFilter; type: ShipType | 'all' }

const AUTOSAVE = 'mill22-autosave';
const SLOT = (n: number) => `mill22-slot-${n}`;
const AT = (key: string) => `${key}-at`; // when a device save was written (ms), to compare with the cloud copy
const slotKey = (n: number) => `slot-${n}` as SaveKey;
/** Cloud autosave at most this often while the clock runs; pausing, a player command or leaving the app flushes it now. */
const CLOUD_EVERY_MS = 20_000;

export type CloudStatus = 'checking' | 'on' | 'off';
export interface CloudState { status: CloudStatus; saves: Partial<Record<SaveKey, SaveMeta>>; lastSavedAt: number | null; problem: string | null }
export interface SaveInfo extends SaveMeta { where: 'cloud' | 'device' }

function metaOf(g: GameState, savedAt = Date.now()): SaveMeta {
  return { day: g.day, colonies: Object.keys(g.installations).length - 1, savedAt };
}

/** A save on this device: its metadata, read without keeping the game. */
function deviceSave(key: string): (SaveMeta & { json: string }) | null {
  const json = store(key);
  if (!json) return null;
  try {
    const g = deserialize(json);
    return { json, ...metaOf(g, Number(store(AT(key))) || 0) };
  } catch { return null; }
}

function writeDevice(key: string, g: GameState): boolean {
  const ok = store(key, serialize(g)) !== null;
  if (ok) store(AT(key), String(Date.now()));
  return ok;
}

function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
    return value;
  } catch {
    return null;
  }
}

interface UIState {
  game: GameState | null;
  tab: Tab;
  speed: Speed;
  installationId: string;
  selectedBody: string | null;
  mapView: 'inner' | 'outer';
  toast: { text: string; kind: 'error' | 'info' } | null;
  modal: Message | null;
  menuOpen: boolean;
  fleetFilter: FleetFilter;
  cloud: CloudState;

  start: (settings: Partial<GameSettings>, seed?: number) => void;
  load: (json: string) => boolean;
  saveSlot: (n: number) => Promise<void>;
  loadSlot: (n: number) => Promise<boolean>;
  slotInfo: (n: number) => SaveInfo | null;
  autosaveInfo: () => SaveInfo | null;
  continueGame: () => Promise<boolean>;
  initCloud: () => Promise<void>;
  flushSaves: () => void;
  downloadSave: () => Promise<void>;
  quit: () => void;

  step: () => boolean;
  act: (fn: (s: GameState) => ActionResult, success?: string) => boolean;
  setTab: (t: Tab) => void;
  setSpeed: (s: Speed) => void;
  setInstallation: (id: string) => void;
  selectBody: (id: string | null) => void;
  setMapView: (v: 'inner' | 'outer') => void;
  showToast: (text: string, kind?: 'error' | 'info') => void;
  closeModal: () => void;
  setMenu: (open: boolean) => void;
  jumpTo: (ref?: string) => void;
  setFleetFilter: (f: Partial<FleetFilter>) => void;
}

export const useGame = create<UIState>((set, get) => ({
  game: null,
  tab: 'base',
  speed: 'paused',
  installationId: 'moonbase',
  selectedBody: null,
  mapView: 'inner',
  toast: null,
  modal: null,
  menuOpen: false,
  fleetFilter: { status: 'all', type: 'all' },
  cloud: { status: 'checking', saves: {}, lastSavedAt: null, problem: null },

  setFleetFilter: (f) => set({ fleetFilter: { ...get().fleetFilter, ...f } }),

  start: (settings, seed) => {
    const game = newGame(seed ?? Math.floor(Math.random() * 2147483646) + 1, settings);
    set({ game, tab: 'base', speed: 'paused', installationId: 'moonbase', selectedBody: null, modal: game.messages[0], menuOpen: false, fleetFilter: { status: 'all', type: 'all' } });
    writeDevice(AUTOSAVE, game);
    queueCloud(game);
  },
  load: (json) => {
    try {
      const game = deserialize(json);
      set({ game, tab: 'base', speed: 'paused', installationId: 'moonbase', selectedBody: null, modal: null, menuOpen: false, fleetFilter: { status: 'all', type: 'all' } });
      writeDevice(AUTOSAVE, game);
      queueCloud(game);
      return true;
    } catch (e) {
      get().showToast((e as Error).message);
      return false;
    }
  },
  saveSlot: async (n) => {
    const g = get().game;
    if (!g) return;
    const onDevice = writeDevice(SLOT(n), g);
    const meta = metaOf(g);
    const cloud = get().cloud.status === 'on' ? await writeCloud(slotKey(n), { json: serialize(g), ...meta }) : 'off';
    const inCloud = cloud === 'saved' || cloud === 'skipped';
    if (inCloud) noteCloud(slotKey(n), meta);
    if (inCloud) get().showToast(`Saved to slot ${n}${onDevice ? '' : ' (cloud only)'}`, 'info');
    else if (onDevice) get().showToast(`Saved to slot ${n} on this device${get().cloud.status === 'on' ? '; the cloud copy failed' : ''}`, 'info');
    else get().showToast('Could not save here. Use Download save or Copy save instead.');
  },
  loadSlot: async (n) => {
    const local = deviceSave(SLOT(n));
    const cloudMeta = get().cloud.saves[slotKey(n)];
    if (cloudMeta && (!local || cloudMeta.savedAt >= local.savedAt)) {
      const c = await readCloud(slotKey(n));
      if (c) return get().load(c.json);
    }
    return local ? get().load(local.json) : false;
  },
  slotInfo: (n) => newest(deviceSave(SLOT(n)), get().cloud.saves[slotKey(n)]),
  autosaveInfo: () => newest(deviceSave(AUTOSAVE), get().cloud.saves.autosave),
  continueGame: async () => {
    const info = get().autosaveInfo();
    if (!info) return false;
    if (info.where === 'cloud') {
      const c = await readCloud('autosave');
      if (c) return get().load(c.json);
    }
    const local = store(AUTOSAVE);
    return local ? get().load(local) : false;
  },
  initCloud: async () => {
    const c = await connectCloud();
    if (!c) { set({ cloud: { ...get().cloud, status: 'off' } }); return; }
    const all = await listCloud();
    const saves: Partial<Record<SaveKey, SaveMeta>> = {};
    for (const [k, v] of Object.entries(all) as [SaveKey, StoredSave][]) saves[k] = { day: v.day, colonies: v.colonies, savedAt: v.savedAt };
    set({ cloud: { status: 'on', saves, lastSavedAt: saves.autosave?.savedAt ?? null, problem: null } });
    // A game already running (loaded before the cloud answered) gets its first cloud copy now.
    const g = get().game;
    if (g) queueCloud(g, true);
  },
  flushSaves: () => {
    const g = get().game;
    if (!g) return;
    writeDevice(AUTOSAVE, g);
    queueCloud(g, true);
  },
  downloadSave: async () => {
    const g = get().game;
    if (!g) return;
    const r = await downloadText(`millennium-day${g.day}.json`, serialize(g));
    if (r === 'saved') get().showToast('Save file handed over. Choose where to keep it.', 'info');
    else if (r === 'busy') get().showToast('A download is already waiting for you to confirm.');
    else if (r === 'unavailable') get().showToast('Downloads are blocked here. Use Copy save instead.');
  },
  quit: () => set({ game: null, speed: 'paused', menuOpen: false }),

  step: () => {
    const g = get().game;
    if (!g || g.outcome) { set({ speed: 'paused' }); return false; }
    const r = advanceDay(g);
    const story = [...r.newMessages].reverse().find((m) => m.kind === 'story');
    const alert = [...r.newMessages].reverse().find((m) => m.kind === 'alert');
    const patch: Partial<UIState> = { game: r.state };
    if (r.pause) {
      patch.speed = 'paused';
      if (story) patch.modal = story;
      else if (alert) patch.toast = { text: `${alert.title} — ${alert.text}`, kind: 'error' };
    }
    // Quality of life: stop the clock when the labs or the factory fall idle.
    if (!r.pause && g.research.current && !r.state.research.current) {
      patch.speed = 'paused';
      patch.toast = { text: 'Research complete — the labs are idle. Pick the next project.', kind: 'info' };
    } else if (!r.pause && g.queue.length > 0 && r.state.queue.length === 0) {
      patch.speed = 'paused';
      patch.toast = { text: 'Production queue finished — the factory is idle.', kind: 'info' };
    }
    if (r.state.outcome) patch.modal = r.newMessages.find((m) => m.kind === 'story' || m.kind === 'alert') ?? null;
    if (r.state.installations[get().installationId] === undefined) patch.installationId = 'moonbase';
    set(patch);
    if (r.state.day % 5 === 0 || r.pause) writeDevice(AUTOSAVE, r.state);
    queueCloud(r.state, !!r.pause);
    return !r.pause;
  },
  act: (fn, success) => {
    const g = get().game;
    if (!g) return false;
    const r = fn(g);
    if (!r.ok) { get().showToast(r.error); return false; }
    set({ game: r.state });
    if (success) get().showToast(success, 'info');
    writeDevice(AUTOSAVE, r.state);
    queueCloud(r.state);
    return true;
  },
  setTab: (tab) => {
    const g = get().game;
    set({ tab, game: tab === 'log' && g ? markRead(g) : g });
  },
  setSpeed: (speed) => {
    const wasRunning = get().speed !== 'paused';
    set({ speed });
    // Save straight away when the clock stops; single steps (already paused) use the normal throttle.
    if (speed === 'paused' && wasRunning) get().flushSaves();
  },
  setInstallation: (installationId) => set({ installationId }),
  selectBody: (selectedBody) => set({ selectedBody }),
  setMapView: (mapView) => set({ mapView }),
  showToast: (text, kind = 'error') => set({ toast: { text, kind } }),
  closeModal: () => set({ modal: null }),
  setMenu: (menuOpen) => set({ menuOpen, speed: menuOpen ? 'paused' : get().speed }),
  jumpTo: (ref) => {
    const g = get().game;
    if (!g || !ref) return;
    if (g.installations[ref]) set({ tab: 'base', installationId: ref });
    else if (g.bodies[ref]) {
      const sys = BODY_BY_ID[ref].parent ?? ref;
      const outer = BODY_BY_ID[sys].a > 4;
      set({ tab: 'map', selectedBody: ref, mapView: outer ? 'outer' : 'inner' });
    } else if (g.ships[ref]) set({ tab: 'fleet' });
  },
}));

export const AUTOSAVE_KEY = AUTOSAVE;
export function readAutosave(): string | null { return store(AUTOSAVE); }

function newest(local: (SaveMeta & { json: string }) | null, cloud: SaveMeta | undefined): SaveInfo | null {
  if (cloud && (!local || cloud.savedAt >= local.savedAt)) return { ...cloud, where: 'cloud' };
  if (local) return { day: local.day, colonies: local.colonies, savedAt: local.savedAt, where: 'device' };
  return null;
}

// ---- cloud autosave scheduling (outside React; one pending copy, newest wins) ----
let pendingCloud: GameState | null = null;
let cloudTimer: ReturnType<typeof setTimeout> | null = null;
let lastCloudAt = 0;

function noteCloud(key: SaveKey, meta: SaveMeta) {
  const c = useGame.getState().cloud;
  useGame.setState({ cloud: { ...c, saves: { ...c.saves, [key]: meta }, lastSavedAt: key === 'autosave' ? meta.savedAt : c.lastSavedAt, problem: null } });
}

function queueCloud(g: GameState, now = false) {
  const status = useGame.getState().cloud.status;
  if (status === 'off') return;
  pendingCloud = g;
  if (status === 'checking') return; // initCloud writes it once connected
  if (now) { void flushCloud(); return; }
  if (cloudTimer) return;
  cloudTimer = setTimeout(() => { void flushCloud(); }, Math.max(0, lastCloudAt + CLOUD_EVERY_MS - Date.now()));
}

async function flushCloud() {
  if (cloudTimer) { clearTimeout(cloudTimer); cloudTimer = null; }
  const g = pendingCloud;
  pendingCloud = null;
  if (!g) return;
  lastCloudAt = Date.now();
  const meta = metaOf(g, lastCloudAt);
  const r = await writeCloud('autosave', { json: serialize(g), ...meta });
  const c = useGame.getState().cloud;
  if (r === 'saved' || r === 'skipped') noteCloud('autosave', meta);
  else if (r === 'off') useGame.setState({ cloud: { ...c, status: 'off', problem: null } });
  else useGame.setState({ cloud: { ...c, problem: r === 'full' ? 'Cloud storage is full.' : 'Cloud save failed; retrying.' } });
  if (r === 'unavailable' && !pendingCloud) { pendingCloud = g; cloudTimer = setTimeout(() => { void flushCloud(); }, CLOUD_EVERY_MS); }
}
