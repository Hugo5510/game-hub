import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeSnapshots, pickDaily, syncNow, connect, b64dec, b64enc, FILE, type Snapshot } from './sync';
import { statsFromHistory, mergeHistory, emptyStats, type History } from './stats';
import { load, save } from './storage';

/* ---------- fake browser: per-device localStorage + an in-memory GitHub repo ---------- */
class MemStorage {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
const g = globalThis as unknown as Record<string, unknown>;
g.window = new EventTarget();
let repoFile: { sha: string; content: string } | null = null;
let shaN = 0;
g.fetch = vi.fn(async (url: string, opts: RequestInit = {}) => {
  const path = url.replace('https://api.github.com', '');
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  if (path === '/repos/me/data') return json(200, {});
  if (path === `/repos/me/data/contents/${FILE}`) {
    if (opts.method === 'PUT') {
      const body = JSON.parse(String(opts.body));
      if ((repoFile?.sha ?? undefined) !== body.sha) return json(409, {});
      repoFile = { sha: 'sha' + ++shaN, content: body.content };
      return json(200, { content: { sha: repoFile.sha } });
    }
    return repoFile ? json(200, { sha: repoFile.sha, encoding: 'base64', content: repoFile.content }) : json(404, {});
  }
  return json(404, {});
});
const devices = { A: new MemStorage(), B: new MemStorage() };
const use = (d: keyof typeof devices) => (g.localStorage = devices[d]);
const remote = (): Snapshot => JSON.parse(b64dec(repoFile!.content));

describe('merge rules', () => {
  it('history: union by day, earliest record of a day wins', () => {
    const a: History = { '2026-11-01': { won: true, bucket: '3', at: 5 } };
    const b: History = { '2026-11-01': { won: false, bucket: 'X', at: 9 }, '2026-11-02': { won: true, bucket: '2', at: 7 } };
    expect(mergeHistory(a, b)).toEqual({ '2026-11-01': a['2026-11-01'], '2026-11-02': b['2026-11-02'] });
    expect(mergeHistory(b, a)).toEqual(mergeHistory(a, b));
  });
  it('stats from history continue the legacy streak', () => {
    const legacy = { ...emptyStats(), played: 10, wins: 8, currentStreak: 4, maxStreak: 5, lastCompleted: '2026-11-01', lastWon: '2026-11-01', dist: { '3': 8, X: 2 } };
    const s = statsFromHistory({ '2026-11-01': { won: true, bucket: '3', at: 1 }, '2026-11-02': { won: true, bucket: '2', at: 2 }, '2026-11-03': { won: true, bucket: '4', at: 3 } }, legacy);
    expect(s.played).toBe(12); // 11-01 is already inside the baseline
    expect(s.currentStreak).toBe(6);
    expect(s.maxStreak).toBe(6);
    expect(s.dist).toEqual({ '3': 8, X: 2, '2': 1, '4': 1 });
  });
  it('daily session: newer day, then finished, then most recent', () => {
    const base = { puzzle: 1, state: {} };
    expect(pickDaily({ ...base, date: '2026-11-02', at: 1 }, { ...base, date: '2026-11-01', at: 99 })?.date).toBe('2026-11-02');
    expect(pickDaily({ ...base, date: 'd', at: 9 }, { ...base, date: 'd', at: 1, recorded: true })?.recorded).toBe(true);
    expect(pickDaily({ ...base, date: 'd', at: 9 }, { ...base, date: 'd', at: 1 })?.at).toBe(9);
  });
  it('unlimited counters are kept per device and merged by max', () => {
    const m = mergeSnapshots(
      { games: { slowko: { hist: {}, legacy: null, ustats: { A: { played: 3, wins: 1 } } } } },
      { games: { slowko: { hist: {}, legacy: null, ustats: { A: { played: 2, wins: 1 }, B: { played: 5, wins: 4 } } } } },
    );
    expect(m.games.slowko.ustats).toEqual({ A: { played: 3, wins: 1 }, B: { played: 5, wins: 4 } });
  });
  it('base64 round trip keeps Polish letters', () => {
    expect(b64dec(b64enc('źdźbło ŻÓŁW'))).toBe('źdźbło ŻÓŁW');
  });
});

describe('two devices through a GitHub repo', () => {
  beforeEach(() => {
    repoFile = null;
    devices.A = new MemStorage();
    devices.B = new MemStorage();
  });
  it('a result played on A shows up on B, and both histories merge', async () => {
    use('A');
    save('device', 'devA', { silent: true });
    save('slowko:hist', { '2026-11-16': { won: true, bucket: '4', at: 100 } } as History);
    save('slowko:daily:v1', { puzzle: 7, date: '2026-11-17', state: { guesses: ['kotek', 'mleko'] }, recorded: true, at: 200 });
    save('slowko:ustats', { played: 2, wins: 1 });
    expect(await connect('me/data', 'tok')).toBeNull();
    expect(remote().games.slowko.hist['2026-11-16'].bucket).toBe('4');

    use('B');
    save('device', 'devB', { silent: true });
    save('slowko:hist', { '2026-11-15': { won: false, bucket: 'X', at: 50 } } as History);
    save('slowko:daily:v1', { puzzle: 7, date: '2026-11-17', state: { guesses: [] }, at: 0 });
    save('slowko:ustats', { played: 1, wins: 1 });
    const synced = vi.fn();
    (g.window as EventTarget).addEventListener('gamehub:synced', synced);
    expect(await connect('https://github.com/me/data', 'tok')).toBeNull();
    expect(synced).toHaveBeenCalled();
    // B now has A's finished daily and the merged stats
    expect(load<{ recorded?: boolean }>('slowko:daily:v1', {}).recorded).toBe(true);
    const st = load('slowko:stats', emptyStats());
    expect(st.played).toBe(2);
    expect(st.wins).toBe(1);
    expect(Object.keys(remote().games.slowko.hist).sort()).toEqual(['2026-11-15', '2026-11-16']);
    expect(remote().games.slowko.ustats).toEqual({ devA: { played: 2, wins: 1 }, devB: { played: 1, wins: 1 } });
    // the token never leaves the device
    expect(JSON.stringify(remote())).not.toContain('tok');

    // A pulls B's history back
    use('A');
    expect(await syncNow()).toBeNull();
    expect(load('slowko:stats', emptyStats()).played).toBe(2);
  });
  it('reports a missing token / wrong repo', async () => {
    use('A');
    expect(await connect('me/other', 'tok')).toBe('norepo');
  });
});
