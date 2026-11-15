import { dayNumber } from './date';
import { hashString, seededPermutation } from './rng';

/**
 * Daily puzzle engine.
 * The pool is shuffled once per "cycle" (pool-size consecutive days) with a seed derived
 * from the game id and the cycle number, so every player gets the same puzzle on the same
 * local date and no puzzle repeats until the whole pool has been used. The first puzzle of
 * a cycle is never equal to the last puzzle of the previous cycle.
 */
const permCache = new Map<string, number[]>();

function rawPerm(gameId: string, poolSize: number, cycle: number): number[] {
  const key = `${gameId}|${poolSize}|${cycle}`;
  let p = permCache.get(key);
  if (!p) {
    p = seededPermutation(poolSize, hashString(`gamehub:${gameId}:cycle:${cycle}`));
    permCache.set(key, p);
  }
  return p;
}

export function cyclePermutation(gameId: string, poolSize: number, cycle: number): number[] {
  const p = rawPerm(gameId, poolSize, cycle).slice();
  if (poolSize > 2) {
    const prevLast = rawPerm(gameId, poolSize, cycle - 1)[poolSize - 1];
    if (p[0] === prevLast) [p[0], p[1]] = [p[1], p[0]];
  }
  return p;
}

export function dailyIndexForDay(gameId: string, poolSize: number, day: number): number {
  if (poolSize <= 0) throw new Error('empty pool');
  const cycle = Math.floor(day / poolSize);
  const pos = day - cycle * poolSize;
  return cyclePermutation(gameId, poolSize, cycle)[pos];
}

export function dailyIndex(gameId: string, poolSize: number, dateKey: string): number {
  return dailyIndexForDay(gameId, poolSize, dayNumber(dateKey));
}

/** Puzzle number shown to players ("#123"), counted from the epoch. */
export function puzzleNumber(dateKey: string): number {
  return dayNumber(dateKey) + 1;
}

/** Random puzzle for Unlimited mode — never today's daily puzzle (and not the previous one). */
export function unlimitedIndex(
  gameId: string,
  poolSize: number,
  dateKey: string,
  rand: () => number = Math.random,
  avoid: number[] = [],
): number {
  const today = dailyIndex(gameId, poolSize, dateKey);
  const banned = new Set([today, ...avoid]);
  if (banned.size >= poolSize) banned.clear(), banned.add(today);
  for (;;) {
    const i = Math.floor(rand() * poolSize);
    if (!banned.has(i)) return i;
  }
}
