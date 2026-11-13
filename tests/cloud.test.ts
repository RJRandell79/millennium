// Cloud saves against a fake Claude host: one write at a time per save, newest copy wins,
// a refused view switches cloud saves off, a transient failure retries once.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;
interface FakeOpts { failWith?: string[]; delayMs?: number; userId?: string | null }

function installFakeHost(opts: FakeOpts = {}) {
  const docs = new Map<string, Doc>();
  const writes: { path: string; day: unknown }[] = [];
  const fails = [...(opts.failWith ?? [])];
  let active = 0, maxActive = 0;
  const snap = (path: string) => ({ id: path.split('/').pop()!, exists: docs.has(path), data: () => docs.get(path) });
  const db = {
    doc: (path: string) => ({
      get: async () => snap(path),
      set: async (d: Doc) => {
        active++; maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, opts.delayMs ?? 5));
        active--;
        const f = fails.shift();
        if (f) throw { code: f, message: f };
        docs.set(path, d); writes.push({ path, day: d.day });
      },
    }),
    collection: (path: string) => ({
      get: async () => ({ docs: [...docs.keys()].filter((k) => k.startsWith(path + '/')).map(snap) }),
    }),
  };
  const user = { id: async () => (opts.userId === undefined ? 'u_test' : opts.userId) };
  (globalThis as Record<string, unknown>).claude = { use: async (n: string) => (n === 'db' ? db : n === 'user' ? user : null) };
  return { docs, writes, maxActive: () => maxActive };
}

async function freshModule() {
  vi.resetModules();
  return import('../src/platform/cloudSave');
}

const save = (day: number) => ({ json: JSON.stringify({ day }), day, colonies: 1, savedAt: 1000 + day });

describe('cloud saves', () => {
  beforeEach(() => { delete (globalThis as Record<string, unknown>).claude; });

  it('is off with no Claude host (standalone builds)', async () => {
    const m = await freshModule();
    expect(await m.connectCloud()).toBeNull();
    expect(await m.writeCloud('autosave', save(1))).toBe('off');
  });

  it("writes to the player's private path and reads it back", async () => {
    const host = installFakeHost();
    const m = await freshModule();
    expect(await m.writeCloud('autosave', save(7))).toBe('saved');
    expect([...host.docs.keys()]).toEqual(['data/users/u_test/autosave']);
    expect((await m.readCloud('autosave'))?.day).toBe(7);
    expect(Object.keys(await m.listCloud())).toEqual(['autosave']);
  });

  it('never writes one save twice at once, and the newest waiting copy wins', async () => {
    const host = installFakeHost({ delayMs: 20 });
    const m = await freshModule();
    const ps = [m.writeCloud('autosave', save(1)), m.writeCloud('autosave', save(2)), m.writeCloud('autosave', save(3))];
    await Promise.all(ps);
    expect(host.maxActive()).toBe(1);
    expect(host.writes.map((w) => w.day)).toEqual([1, 3]); // 2 was superseded while 1 was in flight
    expect((await m.readCloud('autosave'))?.day).toBe(3);
  });

  it('skips writing an unchanged save', async () => {
    const host = installFakeHost();
    const m = await freshModule();
    await m.writeCloud('slot-1', save(5));
    expect(await m.writeCloud('slot-1', save(5))).toBe('skipped');
    expect(host.writes).toHaveLength(1);
  });

  it('retries a transient failure once', async () => {
    const host = installFakeHost({ failWith: ['unavailable'] });
    const m = await freshModule();
    expect(await m.writeCloud('autosave', save(4))).toBe('saved');
    expect(host.writes).toHaveLength(1);
  });

  it('switches off when this view may not write, and reports a full store', async () => {
    installFakeHost({ failWith: ['invalid_argument'] });
    let m = await freshModule();
    expect(await m.writeCloud('autosave', save(4))).toBe('off');
    expect(await m.writeCloud('autosave', save(5))).toBe('off');
    installFakeHost({ failWith: ['quota_exceeded'] });
    m = await freshModule();
    expect(await m.writeCloud('autosave', save(6))).toBe('full');
  });

  it('is off for a signed-out viewer (no id)', async () => {
    installFakeHost({ userId: null });
    const m = await freshModule();
    expect(await m.connectCloud()).toBeNull();
  });
});
