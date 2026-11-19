import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { localDateKey, msUntilLocalMidnight } from './date';
import { dailyIndex, puzzleNumber, unlimitedIndex } from './daily';
import { load, save } from './storage';
import { emptyStats, statsFromHistory, type History, type Stats, type UnlimitedStats } from './stats';

export type Mode = 'daily' | 'unlimited';
export type GameId = 'slowko' | 'globus' | 'kontur' | 'glebia' | 'epoka' | 'flagi' | 'kronika' | 'oko';

export interface Outcome {
  won: boolean;
  bucket: string;
  score?: number;
}

export interface Stored<S> {
  puzzle: number;
  date?: string;
  state: S;
  recorded?: boolean;
  /** last time the player changed the state (ms); 0 = untouched. Used to merge devices. */
  at?: number;
}

/** Re-renders whenever a sync brought in data from another device. */
export function useSyncTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((x) => x + 1);
    window.addEventListener('gamehub:synced', on);
    return () => window.removeEventListener('gamehub:synced', on);
  }, []);
  return tick;
}

/** Unlimited counters: this device + the other devices known from sync. */
export function unlimitedTotal(statKey: string): UnlimitedStats {
  const own = load<UnlimitedStats>(`${statKey}:ustats`, { played: 0, wins: 0 });
  const others = load<Record<string, UnlimitedStats>>(`${statKey}:ustats-sync`, {});
  const me = load<string>('device', '');
  let { played, wins } = own;
  for (const [dev, u] of Object.entries(others)) if (dev !== me) (played += u.played), (wins += u.wins);
  return { played, wins };
}

/** Re-renders when the local date changes (midnight, or tab woken up the next day). */
export function useDateKey(): string {
  const [key, setKey] = useState(localDateKey);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = () => setKey(localDateKey());
    const schedule = () => {
      timer = setTimeout(() => {
        check();
        schedule();
      }, msUntilLocalMidnight() + 250);
    };
    schedule();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return key;
}

export function useStats(gameId: string) {
  const [stats, setStats] = useState<Stats>(() => load(`${gameId}:stats`, emptyStats()));
  const [ustats, setUStats] = useState<UnlimitedStats>(() => unlimitedTotal(gameId));
  const tick = useSyncTick();
  useEffect(() => {
    if (!tick) return;
    setStats(load(`${gameId}:stats`, emptyStats()));
    setUStats(unlimitedTotal(gameId));
  }, [tick, gameId]);
  return { stats, setStats, ustats, setUStats };
}

export interface SessionOptions<S> {
  gameId: GameId;
  mode: Mode;
  poolSize: number | null;
  init: (puzzle: number) => S;
  outcome: (state: S, puzzle: number) => Outcome | null; // null while still playing
  version?: number; // bump to invalidate stored state shape
  /** sub-game with its own daily puzzle, saved state and stats (e.g. a flag category) */
  variant?: string;
}

export function useGameSession<S>(opts: SessionOptions<S>) {
  const { mode, poolSize, init, outcome, version = 1 } = opts;
  const gameId = opts.variant ? `${opts.gameId}-${opts.variant}` : opts.gameId;
  const dateKey = useDateKey();
  const storeKey = `${gameId}:${mode}:v${version}`;
  const { stats, setStats, ustats, setUStats } = useStats(gameId);
  const syncTick = useSyncTick();
  const initRef = useRef(init);
  initRef.current = init;

  const fresh = useCallback((): Stored<S> | null => {
    if (!poolSize) return null;
    if (mode === 'daily') {
      const puzzle = dailyIndex(gameId, poolSize, dateKey);
      return { puzzle, date: dateKey, state: initRef.current(puzzle), at: 0 };
    }
    const puzzle = unlimitedIndex(gameId, poolSize, dateKey);
    return { puzzle, state: initRef.current(puzzle) };
  }, [gameId, mode, poolSize, dateKey]);

  const [session, setSession] = useState<Stored<S> | null>(null);

  // (re)load when inputs change
  useEffect(() => {
    if (!poolSize) return setSession(null);
    const stored = load<Stored<S> | null>(storeKey, null);
    const valid =
      stored &&
      stored.puzzle < poolSize &&
      (mode === 'unlimited'
        ? stored.puzzle !== dailyIndex(gameId, poolSize, dateKey)
        : stored.date === dateKey && stored.puzzle === dailyIndex(gameId, poolSize, dateKey));
    setSession(valid ? stored : fresh());
  }, [storeKey, poolSize, dateKey, mode, gameId, fresh, syncTick]);

  useEffect(() => {
    if (session) save(storeKey, session);
  }, [session, storeKey]);

  const result = useMemo(() => (session ? outcome(session.state, session.puzzle) : null), [session, outcome]);

  // record stats exactly once per finished session
  useEffect(() => {
    if (!session || !result || session.recorded) return;
    if (mode === 'daily' && session.date) {
      const hist = load<History>(`${gameId}:hist`, {});
      if (!hist[session.date]) {
        hist[session.date] = { won: result.won, bucket: result.bucket, ...(result.score != null ? { score: result.score } : {}), at: Date.now() };
        save(`${gameId}:hist`, hist);
      }
      const next = statsFromHistory(hist, load<Stats | null>(`${gameId}:legacy`, null));
      save(`${gameId}:stats`, next);
      setStats(next);
    } else {
      const u = load<UnlimitedStats>(`${gameId}:ustats`, { played: 0, wins: 0 });
      save(`${gameId}:ustats`, { played: u.played + 1, wins: u.wins + (result.won ? 1 : 0) });
      setUStats(unlimitedTotal(gameId));
    }
    setSession({ ...session, recorded: true });
  }, [session, result, mode, gameId, setStats, setUStats]);

  const setState = useCallback(
    (update: S | ((s: S) => S)) => {
      setSession((cur) => {
        if (!cur || (cur.recorded && mode === 'daily')) return cur; // daily locked after completion
        const state = typeof update === 'function' ? (update as (s: S) => S)(cur.state) : update;
        return { ...cur, state, at: Date.now() };
      });
    },
    [mode],
  );

  const newUnlimited = useCallback(() => {
    if (!poolSize || mode !== 'unlimited') return;
    setSession((cur) => {
      const puzzle = unlimitedIndex(gameId, poolSize, dateKey, Math.random, cur ? [cur.puzzle] : []);
      return { puzzle, state: initRef.current(puzzle) };
    });
  }, [poolSize, mode, gameId, dateKey]);

  return {
    dateKey,
    puzzleNo: puzzleNumber(dateKey),
    puzzle: session?.puzzle ?? null,
    state: session?.state ?? null,
    setState,
    result,
    stats,
    ustats,
    newUnlimited,
    ready: !!session,
  };
}
