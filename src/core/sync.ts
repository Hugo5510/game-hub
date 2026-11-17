// Sync between devices through the player's own private GitHub repository (Contents API),
// the same way as in the Budżet app: no server, the app reads/writes one JSON file.
// The same repo and token as Budżet can be reused — the data goes to a separate file.
import { useEffect, useState } from 'react';
import { keys, load, onSave, remove, save } from './storage';
import { emptyStats, mergeHistory, mergeLegacy, statsFromHistory, type History, type Stats, type UnlimitedStats } from './stats';
import type { Stored } from './session';

export const FILE = 'gamehub-dane.json';
const API = 'https://api.github.com';
const APP = 'gamehub-sync';

/* ------------------------------------------------------------------ snapshot & merge */
export interface GameSnap {
  hist: History;
  legacy: Stats | null;
  /** unlimited-mode counters per device */
  ustats: Record<string, UnlimitedStats>;
}
export interface Snapshot {
  app: typeof APP;
  v: 1;
  updatedAt?: number;
  games: Record<string, GameSnap>;
  /** today's (latest) daily session per game, e.g. "slowko:daily:v1" */
  daily: Record<string, Stored<unknown>>;
}

const DAILY_RE = /^(.+):daily:v\d+$/;
const STAT_SUFFIXES = [':stats', ':hist', ':legacy', ':ustats', ':ustats-sync'];

export function deviceId(): string {
  let id = load<string>('device', '');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    save('device', id, { silent: true });
  }
  return id;
}

/** Older daily sessions lose; same day: a finished one wins, then the most recently played. */
export function pickDaily<T>(a: Stored<T> | undefined, b: Stored<T> | undefined): Stored<T> | undefined {
  if (!a) return b;
  if (!b) return a;
  if ((a.date ?? '') !== (b.date ?? '')) return (a.date ?? '') > (b.date ?? '') ? a : b;
  if (!!a.recorded !== !!b.recorded) return a.recorded ? a : b;
  if ((a.at ?? 0) !== (b.at ?? 0)) return (a.at ?? 0) > (b.at ?? 0) ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

export function mergeSnapshots(a: Partial<Snapshot> = {}, b: Partial<Snapshot> = {}): Snapshot {
  const games: Record<string, GameSnap> = {};
  for (const k of new Set([...Object.keys(a.games ?? {}), ...Object.keys(b.games ?? {})])) {
    const x = a.games?.[k], y = b.games?.[k];
    const ustats: Record<string, UnlimitedStats> = { ...(x?.ustats ?? {}) };
    for (const [dev, u] of Object.entries(y?.ustats ?? {})) {
      const cur = ustats[dev];
      ustats[dev] = !cur || u.played > cur.played || (u.played === cur.played && u.wins > cur.wins) ? u : cur;
    }
    games[k] = { hist: mergeHistory(x?.hist, y?.hist), legacy: mergeLegacy(x?.legacy, y?.legacy), ustats };
  }
  const daily: Record<string, Stored<unknown>> = {};
  for (const k of new Set([...Object.keys(a.daily ?? {}), ...Object.keys(b.daily ?? {})])) {
    const v = pickDaily(a.daily?.[k], b.daily?.[k]);
    if (v) daily[k] = v;
  }
  return { app: APP, v: 1, games, daily };
}

/** Results recorded before the history existed become the per-game baseline (once). */
export function migrateLegacy(): void {
  for (const k of keys()) {
    if (!k.endsWith(':stats')) continue;
    const g = k.slice(0, -':stats'.length);
    if (load<unknown>(`${g}:legacy`, undefined) !== undefined) continue;
    const st = load<Stats>(k, emptyStats());
    const hist = load<History>(`${g}:hist`, {});
    save(`${g}:legacy`, st.played > 0 && Object.keys(hist).length === 0 ? st : null, { silent: true });
  }
}

const gameKeys = () => {
  const set = new Set<string>();
  for (const k of keys()) {
    for (const suf of STAT_SUFFIXES) if (k.endsWith(suf)) set.add(k.slice(0, -suf.length));
    const m = k.match(DAILY_RE);
    if (m) set.add(m[1]);
  }
  set.delete('');
  return [...set];
};

export function localSnapshot(): Snapshot {
  const dev = deviceId();
  const games: Record<string, GameSnap> = {};
  for (const g of gameKeys()) {
    const ustats = { ...load<Record<string, UnlimitedStats>>(`${g}:ustats-sync`, {}) };
    const own = load<UnlimitedStats | null>(`${g}:ustats`, null);
    if (own) ustats[dev] = own;
    games[g] = { hist: load<History>(`${g}:hist`, {}), legacy: load<Stats | null>(`${g}:legacy`, null), ustats };
  }
  const daily: Record<string, Stored<unknown>> = {};
  for (const k of keys()) if (DAILY_RE.test(k)) daily[k] = load<Stored<unknown>>(k, undefined as never);
  return { app: APP, v: 1, games, daily };
}

/** Writes the merged data locally; returns true when anything visible changed. */
export function applySnapshot(snap: Snapshot): boolean {
  let changed = false;
  const write = (k: string, v: unknown) => {
    const before = JSON.stringify(load<unknown>(k, null));
    if (before !== JSON.stringify(v)) {
      save(k, v, { silent: true });
      changed = true;
    }
  };
  for (const [g, gs] of Object.entries(snap.games)) {
    write(`${g}:hist`, gs.hist);
    write(`${g}:legacy`, gs.legacy);
    write(`${g}:ustats-sync`, gs.ustats);
    if (Object.keys(gs.hist).length || gs.legacy) write(`${g}:stats`, statsFromHistory(gs.hist, gs.legacy));
  }
  for (const [k, v] of Object.entries(snap.daily)) write(k, pickDaily(load<Stored<unknown> | undefined>(k, undefined), v));
  return changed;
}

/* ------------------------------------------------------------------ GitHub API */
export class SyncError extends Error {
  constructor(message: string, public code = '') {
    super(message);
  }
}
export function b64enc(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64dec(b64: string): string {
  const bin = atob(String(b64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function gh(token: string, path: string, opts: RequestInit = {}) {
  try {
    return await fetch(API + path, {
      ...opts,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${token}`,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...((opts.headers as Record<string, string>) ?? {}),
      },
    });
  } catch {
    throw new SyncError('network', 'network');
  }
}
function fail(res: Response): never {
  if (res.status === 401) throw new SyncError('auth', 'auth');
  if (res.status === 403) throw new SyncError('forbidden', 'forbidden');
  throw new SyncError(`http ${res.status}`, 'http');
}

export interface SyncCfg {
  repo: string;
  token: string;
}

export async function pull({ token, repo }: SyncCfg): Promise<{ sha: string; data: Snapshot } | null> {
  const res = await gh(token, `/repos/${repo}/contents/${FILE}`);
  if (res.status === 404) {
    const r2 = await gh(token, `/repos/${repo}`);
    if (r2.ok) return null;
    if (r2.status === 401) fail(r2);
    throw new SyncError('norepo', 'norepo');
  }
  if (!res.ok) fail(res);
  const j = await res.json();
  let text: string;
  if (j.encoding === 'base64' && j.content) text = b64dec(j.content);
  else {
    const raw = await gh(token, `/repos/${repo}/contents/${FILE}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
    if (!raw.ok) fail(raw);
    text = await raw.text();
  }
  let data: Snapshot;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SyncError('corrupt', 'corrupt');
  }
  if (data?.app !== APP) throw new SyncError('corrupt', 'corrupt');
  return { sha: j.sha, data };
}

export async function push({ token, repo }: SyncCfg, sha: string | undefined, snapshot: Snapshot): Promise<void> {
  const body = { message: `Game Hub: synchronizacja ${new Date().toISOString()}`, content: b64enc(JSON.stringify(snapshot)), ...(sha ? { sha } : {}) };
  const res = await gh(token, `/repos/${repo}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify(body) });
  if (res.status === 409 || res.status === 422) throw new SyncError('conflict', 'conflict');
  if (!res.ok) fail(res);
}

/* ------------------------------------------------------------------ engine */
export interface SyncConfig extends SyncCfg {
  lastSync?: number;
  error?: string; // error code, translated in the UI
}
export type SyncPhase = 'off' | 'idle' | 'syncing' | 'error';
export interface SyncStatus {
  phase: SyncPhase;
  repo?: string;
  lastSync?: number;
  error?: string;
}

const CFG = 'sync';
export const getConfig = () => load<SyncConfig | null>(CFG, null);
const status = (): SyncStatus => {
  const c = getConfig();
  if (!c?.token || !c.repo) return { phase: 'off' };
  return { phase: running ? 'syncing' : c.error ? 'error' : 'idle', repo: c.repo, lastSync: c.lastSync, error: c.error };
};
const emit = () => window.dispatchEvent(new CustomEvent('gamehub:syncstate', { detail: status() }));

let running = false;
let queued = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export function scheduleSync(delay = 3000) {
  if (!getConfig()?.token) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** pull → merge → apply → push (retries on a write conflict). Returns the error code or null. */
export async function syncNow(): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg?.token || !cfg.repo) return 'off';
  if (running) {
    queued = true;
    return null;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network';
  running = true;
  emit();
  let error: string | null = null;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const remote = await pull(cfg);
        const merged = mergeSnapshots(localSnapshot(), remote?.data);
        const changed = applySnapshot(merged);
        if (changed) window.dispatchEvent(new CustomEvent('gamehub:synced'));
        const { updatedAt: _u, ...remoteCore } = remote?.data ?? ({} as Snapshot);
        if (!remote || JSON.stringify(remoteCore) !== JSON.stringify(merged)) await push(cfg, remote?.sha, { ...merged, updatedAt: Date.now() });
        break;
      } catch (e) {
        if (e instanceof SyncError && e.code === 'conflict' && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e) {
    error = e instanceof SyncError ? e.code : 'unknown';
  } finally {
    running = false;
  }
  const c = getConfig();
  if (c) save(CFG, { ...c, ...(error ? (error === 'network' ? {} : { error }) : { lastSync: Date.now(), error: undefined }) }, { silent: true });
  emit();
  if (queued) {
    queued = false;
    scheduleSync(500);
  }
  return error;
}

export async function connect(repo: string, token: string): Promise<string | null> {
  save(CFG, { repo: repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, ''), token: token.trim() }, { silent: true });
  return syncNow();
}

export function disconnect() {
  remove(CFG);
  emit();
}

let started = false;
/** Wire triggers once: app start, coming back to the tab, network back, and local changes. */
export function startSync() {
  if (started) return;
  started = true;
  deviceId();
  migrateLegacy();
  onSave((k) => {
    if (DAILY_RE.test(k) || /:(hist|ustats|legacy)$/.test(k)) scheduleSync();
  });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && scheduleSync(300));
  window.addEventListener('online', () => scheduleSync(300));
  scheduleSync(600);
}

export function useSyncStatus(): SyncStatus {
  const [st, setSt] = useState<SyncStatus>(status);
  useEffect(() => {
    const on = (e: Event) => setSt((e as CustomEvent<SyncStatus>).detail);
    window.addEventListener('gamehub:syncstate', on);
    setSt(status());
    return () => window.removeEventListener('gamehub:syncstate', on);
  }, []);
  return st;
}
