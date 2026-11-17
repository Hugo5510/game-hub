const PREFIX = 'gamehub:v1:';

type SaveListener = (key: string) => void;
const listeners = new Set<SaveListener>();
/** Called after a value really changed (used by sync to schedule an upload). */
export function onSave(fn: SaveListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T, { silent = false } = {}): void {
  try {
    const json = JSON.stringify(value);
    if (localStorage.getItem(PREFIX + key) === json) return;
    localStorage.setItem(PREFIX + key, json);
    if (!silent) for (const fn of listeners) fn(key);
  } catch {
    /* storage full or disabled — game still works in memory */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** All keys (without prefix) currently stored by the app. */
export function keys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
    }
  } catch {
    /* ignore */
  }
  return out;
}
