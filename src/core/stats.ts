import { addDays } from './date';

export interface Stats {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  lastCompleted: string | null; // date key of last completed daily
  lastWon: string | null;
  /** distribution bucket → count (e.g. guesses "1".."6", "X" for loss) */
  dist: Record<string, number>;
  /** optional best score (Głębia) */
  best?: number;
  totalScore?: number;
}

export interface UnlimitedStats {
  played: number;
  wins: number;
}

export const emptyStats = (): Stats => ({
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastCompleted: null,
  lastWon: null,
  dist: {},
});

export interface DailyResult {
  date: string;
  won: boolean;
  bucket: string;
  score?: number;
}

/** Pure reducer: apply one completed daily result. Streak = consecutive days with a win. */
export function applyResult(stats: Stats, r: DailyResult): Stats {
  if (stats.lastCompleted === r.date) return stats; // already recorded
  const s: Stats = { ...stats, dist: { ...stats.dist } };
  s.played += 1;
  s.lastCompleted = r.date;
  s.dist[r.bucket] = (s.dist[r.bucket] ?? 0) + 1;
  if (r.score != null) {
    s.best = Math.max(s.best ?? 0, r.score);
    s.totalScore = (s.totalScore ?? 0) + r.score;
  }
  if (r.won) {
    s.wins += 1;
    s.currentStreak = s.lastWon === addDays(r.date, -1) ? s.currentStreak + 1 : 1;
    s.lastWon = r.date;
    s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
  } else {
    s.currentStreak = 0;
  }
  return s;
}

/** Streak as it should be displayed today (broken if yesterday's daily was not won). */
export function displayedStreak(stats: Stats, today: string): number {
  if (!stats.lastWon) return 0;
  if (stats.lastWon === today || stats.lastWon === addDays(today, -1)) return stats.currentStreak;
  return 0;
}
