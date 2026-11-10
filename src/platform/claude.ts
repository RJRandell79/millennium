// Thin, typed access to the Claude artifact host (`window.claude.use`).
// Every capability is optional: in a standalone or CI build there is no host and all of this
// resolves to null, so the game falls back to browser storage and an ordinary download link.

type Use = (name: string) => Promise<unknown>;

export function claudeUse(): Use | null {
  const c = (globalThis as { claude?: { use?: Use } }).claude;
  return c && typeof c.use === 'function' ? (name: string) => c.use!(name) : null;
}

/** Resolve a capability, or null when it is missing, refused, or the host doesn't answer within `ms`. */
export async function useCapability<T>(name: string, ms = 10_000): Promise<T | null> {
  const use = claudeUse();
  if (!use) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((r) => { timer = setTimeout(() => r(null), ms); });
  try {
    return ((await Promise.race([use(name), timeout])) as T | null) ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const isEmbedded = (): boolean => {
  try { return window.self !== window.top; } catch { return true; }
};

export function errorCode(e: unknown): string {
  return typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : 'unavailable';
}
