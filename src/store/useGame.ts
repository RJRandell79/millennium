import { create } from 'zustand';
import {
  type ActionResult, type GameSettings, type GameState, type Message,
  advanceDay, newGame, serialize, deserialize, markRead, BODY_BY_ID, type ShipType,
} from '../engine';

export type Tab = 'base' | 'map' | 'fleet' | 'research' | 'build' | 'log';
export type Speed = 'paused' | 'run' | 'fast';
export type FleetStatusFilter = 'all' | 'idle' | 'docked' | 'transit' | 'working';
export interface FleetFilter { status: FleetStatusFilter; type: ShipType | 'all' }

const AUTOSAVE = 'mill22-autosave';
const SLOT = (n: number) => `mill22-slot-${n}`;

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

  start: (settings: Partial<GameSettings>, seed?: number) => void;
  load: (json: string) => boolean;
  saveSlot: (n: number) => void;
  loadSlot: (n: number) => boolean;
  slotInfo: (n: number) => string | null;
  hasAutosave: () => boolean;
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

  setFleetFilter: (f) => set({ fleetFilter: { ...get().fleetFilter, ...f } }),

  start: (settings, seed) => {
    const game = newGame(seed ?? Math.floor(Math.random() * 2147483646) + 1, settings);
    set({ game, tab: 'base', speed: 'paused', installationId: 'moonbase', selectedBody: null, modal: game.messages[0], menuOpen: false, fleetFilter: { status: 'all', type: 'all' } });
    store(AUTOSAVE, serialize(game));
  },
  load: (json) => {
    try {
      const game = deserialize(json);
      set({ game, tab: 'base', speed: 'paused', installationId: 'moonbase', selectedBody: null, modal: null, menuOpen: false, fleetFilter: { status: 'all', type: 'all' } });
      return true;
    } catch (e) {
      get().showToast((e as Error).message);
      return false;
    }
  },
  saveSlot: (n) => {
    const g = get().game;
    if (!g) return;
    if (store(SLOT(n), serialize(g)) === null) get().showToast('This browser will not let the game save. Use Export instead.');
    else get().showToast(`Saved to slot ${n}`, 'info');
  },
  loadSlot: (n) => {
    const json = store(SLOT(n));
    return json ? get().load(json) : false;
  },
  slotInfo: (n) => {
    const json = store(SLOT(n));
    if (!json) return null;
    try {
      const g = deserialize(json);
      return `Day ${g.day} · ${Object.keys(g.installations).length - 1} colonies`;
    } catch { return null; }
  },
  hasAutosave: () => !!store(AUTOSAVE),
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
    if (r.state.day % 5 === 0) store(AUTOSAVE, serialize(r.state));
    return !r.pause;
  },
  act: (fn, success) => {
    const g = get().game;
    if (!g) return false;
    const r = fn(g);
    if (!r.ok) { get().showToast(r.error); return false; }
    set({ game: r.state });
    if (success) get().showToast(success, 'info');
    return true;
  },
  setTab: (tab) => {
    const g = get().game;
    set({ tab, game: tab === 'log' && g ? markRead(g) : g });
  },
  setSpeed: (speed) => set({ speed }),
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
