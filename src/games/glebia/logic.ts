import { editDistance, normalize, typoTolerance } from '../../core/text';
import { hashString, seededPermutation } from '../../core/rng';

export interface Answer {
  pl: string;
  en: string;
  alt: string[];
  r: number;
  extra?: boolean;
}
export interface Category {
  id: string;
  prompt: { pl: string; en: string };
  note?: { pl: string; en: string };
  metric?: { pl: string; en: string };
  answers: Answer[];
}
export interface DepthData {
  version: number;
  categories: Category[];
}

export const PROMPTS = 7;
export const OXYGEN = 3;
export const METERS_PER_POINT = 10;

/** Seven distinct categories for a puzzle: the puzzle's own category plus six chosen by a seeded shuffle. */
export function promptsFor(puzzle: number, categoryCount: number): number[] {
  const others = seededPermutation(categoryCount, hashString(`glebia:dive:${puzzle}`)).filter((i) => i !== puzzle);
  return [puzzle, ...others.slice(0, PROMPTS - 1)];
}

const keyCache = new WeakMap<Category, string[][]>();
function keys(cat: Category): string[][] {
  let k = keyCache.get(cat);
  if (!k) {
    k = cat.answers.map((a) => [...new Set(a.alt.map(normalize).filter(Boolean))]);
    keyCache.set(cat, k);
  }
  return k;
}

/** Index of the matching answer, or -1. Exact (normalised) match wins; otherwise the closest alias within typo tolerance. */
export function matchAnswer(cat: Category, input: string): number {
  const q = normalize(input);
  if (!q) return -1;
  const all = keys(cat);
  for (let i = 0; i < all.length; i++) if (all[i].includes(q)) return i;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < all.length; i++) {
    for (const k of all[i]) {
      const tol = Math.min(typoTolerance(k.length), typoTolerance(q.length));
      if (tol === 0) continue;
      const d = editDistance(q, k, tol);
      if (d <= tol && d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  return best;
}

export type StepResult = { kind: 'hit'; answer: number; r: number; input: string } | { kind: 'skip' } | { kind: 'fail' };

export interface GlebiaState {
  results: StepResult[];
  oxygen: number;
  misses: { step: number; text: string }[];
}

export const initialState = (): GlebiaState => ({ results: [], oxygen: OXYGEN, misses: [] });

export function score(s: GlebiaState): number {
  return s.results.reduce((a, r) => a + (r.kind === 'hit' ? r.r : 0), 0);
}

export const BUCKETS = ['0–999 m', '1000+ m', '2000+ m', '3000+ m', '4000+ m', '5000+ m', 'X'];
export function bucketFor(meters: number): string {
  const k = Math.min(5, Math.floor(meters / 1000));
  return BUCKETS[k];
}

export function outcome(s: GlebiaState) {
  const meters = score(s) * METERS_PER_POINT;
  if (s.oxygen <= 0) return { won: false, bucket: 'X', score: meters };
  if (s.results.length >= PROMPTS) return { won: true, bucket: bucketFor(meters), score: meters };
  return null;
}

/** Pure reducer for one submission. */
export function submit(s: GlebiaState, cat: Category, input: string): { state: GlebiaState; event: 'hit' | 'miss' | 'dup' | 'empty'; answer?: number } {
  if (!input.trim()) return { state: s, event: 'empty' };
  const idx = matchAnswer(cat, input);
  const step = s.results.length;
  if (idx >= 0) {
    return { state: { ...s, results: [...s.results, { kind: 'hit', answer: idx, r: cat.answers[idx].r, input }] }, event: 'hit', answer: idx };
  }
  if (s.misses.some((m) => m.step === step && normalize(m.text) === normalize(input))) return { state: s, event: 'dup' };
  const oxygen = s.oxygen - 1;
  const misses = [...s.misses, { step, text: input }];
  const results = oxygen <= 0 ? [...s.results, { kind: 'fail' as const }] : s.results;
  return { state: { ...s, oxygen, misses, results }, event: 'miss' };
}

export function skip(s: GlebiaState): GlebiaState {
  return { ...s, results: [...s.results, { kind: 'skip' }] };
}

export function shareRow(results: StepResult[]): string {
  return results
    .map((r) => (r.kind !== 'hit' ? '⬛' : r.r >= 75 ? '🟥' : r.r >= 50 ? '🟨' : r.r >= 25 ? '🟩' : '🟦'))
    .join('');
}
