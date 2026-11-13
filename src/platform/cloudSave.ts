// Cloud saves: the player's private per-person storage on claude.ai (`db` capability, path
// data/users/<id>/…), which survives the app being closed and follows the player between devices.
// One document per save key; a full-game save is ~55 KB against a 256 KB document limit.
import { claudeUse, errorCode, useCapability } from './claude';

export type SaveKey = 'autosave' | 'slot-1' | 'slot-2' | 'slot-3';
export const SAVE_KEYS: SaveKey[] = ['autosave', 'slot-1', 'slot-2', 'slot-3'];

export interface SaveMeta { day: number; colonies: number; savedAt: number }
export interface StoredSave extends SaveMeta { json: string }

interface Snap { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
interface DocRef { get(): Promise<Snap>; set(data: Record<string, unknown>): Promise<void> }
interface Db { doc(path: string): DocRef; collection(path: string): { get(): Promise<{ docs: Snap[] }> } }
interface User { id(): Promise<string | null> }

interface Conn { db: Db; base: string }
let conn: Promise<Conn | null> | null = null;
let disabled = false;

/** Connect once. Resolves null when cloud saves aren't available in this view. */
export function connectCloud(): Promise<Conn | null> {
  if (conn) return conn;
  conn = (async () => {
    if (!claudeUse()) return null;
    const [db, user] = await Promise.all([useCapability<Db>('db'), useCapability<User>('user')]);
    if (!db || !user) return null;
    const id = await user.id();
    return id ? { db, base: `data/users/${id}` } : null;
  })().catch(() => null);
  return conn;
}

function parse(snap: Snap): StoredSave | null {
  const d = snap.exists ? snap.data() : undefined;
  if (!d || typeof d.json !== 'string') return null;
  return { json: d.json, day: Number(d.day) || 0, colonies: Number(d.colonies) || 0, savedAt: Number(d.savedAt) || 0 };
}

/** Every save this player has in the cloud, keyed by slot. */
export async function listCloud(): Promise<Partial<Record<SaveKey, StoredSave>>> {
  const c = await connectCloud();
  if (!c || disabled) return {};
  try {
    const q = await c.db.collection(c.base).get();
    const out: Partial<Record<SaveKey, StoredSave>> = {};
    for (const snap of q.docs) {
      const s = parse(snap);
      if (s && (SAVE_KEYS as string[]).includes(snap.id)) out[snap.id as SaveKey] = s;
    }
    return out;
  } catch {
    return {};
  }
}

export async function readCloud(key: SaveKey): Promise<StoredSave | null> {
  const c = await connectCloud();
  if (!c || disabled) return null;
  try { return parse(await c.db.doc(`${c.base}/${key}`).get()); } catch { return null; }
}

export type WriteResult = 'saved' | 'skipped' | 'unavailable' | 'full' | 'off';

// One write at a time per document; a newer save waiting behind it replaces any older waiting one.
const inflight: Partial<Record<SaveKey, Promise<WriteResult>>> = {};
const waiting: Partial<Record<SaveKey, StoredSave>> = {};
const lastJson: Partial<Record<SaveKey, string>> = {};

export function writeCloud(key: SaveKey, save: StoredSave): Promise<WriteResult> {
  if (disabled) return Promise.resolve('off');
  if (lastJson[key] === save.json) return Promise.resolve('skipped');
  if (inflight[key]) { waiting[key] = save; return inflight[key]!; }
  const run = async (): Promise<WriteResult> => {
    let next: StoredSave | undefined = save;
    let result: WriteResult = 'skipped';
    while (next) {
      const s = next;
      next = undefined;
      result = await writeOnce(key, s);
      if (result === 'saved') lastJson[key] = s.json;
      if (waiting[key]) { next = waiting[key]; delete waiting[key]; }
    }
    return result;
  };
  const p = run().finally(() => { delete inflight[key]; });
  inflight[key] = p;
  return p;
}

async function writeOnce(key: SaveKey, s: StoredSave, retried = false): Promise<WriteResult> {
  const c = await connectCloud();
  if (!c) return 'off';
  try {
    await c.db.doc(`${c.base}/${key}`).set({ json: s.json, day: s.day, colonies: s.colonies, savedAt: s.savedAt });
    return 'saved';
  } catch (e) {
    const code = errorCode(e);
    if (code === 'quota_exceeded') return 'full';
    if (['invalid_argument', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed'].includes(code)) {
      disabled = true; // this view can't write the player's storage: stop trying, fall back to the device
      return 'off';
    }
    if (!retried && code === 'unavailable') {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
      return writeOnce(key, s, true);
    }
    return 'unavailable';
  }
}
