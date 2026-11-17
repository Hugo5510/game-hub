import flagsJson from './flags.json';
import { hashString, seededPermutation } from '../../core/rng';

export type FlagCat = 'world' | 'europe' | 'asia' | 'africa' | 'namerica' | 'samerica' | 'oceania';
export const CATS: FlagCat[] = ['world', 'europe', 'asia', 'africa', 'namerica', 'samerica', 'oceania'];

export interface FlagEntry {
  id: string; // Natural Earth ADM0_A3 (matches countries-meta.json)
  a2: string; // ISO 3166-1 alpha-2, flag file name
  cont: Exclude<FlagCat, 'world'>;
}
export const FLAGS: FlagEntry[] = flagsJson as FlagEntry[];
export const flagById = new Map(FLAGS.map((f) => [f.id, f]));
export const flagIds = new Set(FLAGS.map((f) => f.id));

export const ROUND = 10;
export const WIN_AT = 7; // a round counts as won with at least 7 of 10 flags
/** Number of distinct seeded rounds per category (the daily engine cycles through them). */
export const POOL_ROUNDS = 1000;

export const poolFor = (cat: FlagCat): FlagEntry[] => (cat === 'world' ? FLAGS : FLAGS.filter((f) => f.cont === cat));

/** The ten flags of round `puzzle` in a category — deterministic, no repeats within a round. */
export function roundFlags(cat: FlagCat, puzzle: number): string[] {
  const pool = poolFor(cat);
  return seededPermutation(pool.length, hashString(`flagi:${cat}:${puzzle}`))
    .slice(0, Math.min(ROUND, pool.length))
    .map((i) => pool[i].id);
}

export interface FlagiState {
  /** per flag: the country the player named, or null when skipped */
  answers: (string | null)[];
}

export const correctCount = (s: FlagiState, flags: string[]) => s.answers.filter((a, i) => a === flags[i]).length;

export function outcome(s: FlagiState, flags: string[]) {
  if (s.answers.length < flags.length) return null;
  const score = correctCount(s, flags);
  return { won: score >= WIN_AT, bucket: String(score), score };
}

export const BUCKETS = Array.from({ length: ROUND + 1 }, (_, i) => String(ROUND - i));

export function shareLine(s: FlagiState, flags: string[], hc: boolean): string {
  const ok = hc ? '🟦' : '🟩';
  const bad = hc ? '🟧' : '🟥';
  return s.answers.map((a, i) => (a === flags[i] ? ok : bad)).join('');
}

export const flagUrl = (a2: string) => `${import.meta.env.BASE_URL}data/flags/${a2}.svg`;
