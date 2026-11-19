import mapsJson from './maps.json';

export interface EpochMap {
  year: number;
  from: number;
  to: number;
  file: string;
  prevYear: number | null;
  nextYear: number | null;
  appears: string[];
  vanishes: string[];
  polities: number;
}
export const maps: EpochMap[] = mapsJson as EpochMap[];
/** Years are signed: negative = BC; there is no year 0. */
export const MIN_YEAR = -3000;
export const MAX_YEAR = 2010;
export const MAX_GUESSES = 6;

export interface EpokaState {
  guesses: number[];
}

export type Dir = 'correct' | 'later' | 'earlier';
export interface Feedback {
  year: number;
  dir: Dir;
  off: number;
  tier: 'hit' | 'hot' | 'warm' | 'cold';
}

/** Astronomical numbering (1 BC = 0) so distances across the BC/AD boundary are right. */
const astro = (y: number) => (y < 0 ? y + 1 : y);

/** Signed year from a number and an era flag (BC). 0 is not a year. */
export function signedYear(n: number, bc: boolean): number {
  return bc ? -Math.abs(n) : n;
}

/** "500 p.n.e." / "500 BC" / "1815". */
export function formatYear(y: number, lang: 'pl' | 'en'): string {
  return y < 0 ? `${-y} ${lang === 'pl' ? 'p.n.e.' : 'BC'}` : String(y);
}

export function judge(year: number, m: EpochMap): Feedback {
  if (year >= m.from && year <= m.to) return { year, dir: 'correct', off: 0, tier: 'hit' };
  const later = year < m.from;
  const off = later ? astro(m.from) - astro(year) : astro(year) - astro(m.to);
  return { year, dir: later ? 'later' : 'earlier', off, tier: off <= 15 ? 'hot' : off <= 75 ? 'warm' : 'cold' };
}

export function outcome(s: EpokaState, m: EpochMap) {
  const last = s.guesses[s.guesses.length - 1];
  if (last != null && judge(last, m).dir === 'correct') return { won: true, bucket: String(s.guesses.length) };
  if (s.guesses.length >= MAX_GUESSES) return { won: false, bucket: 'X' };
  return null;
}

/** Feasible window implied by the feedback so far. */
export function window(fb: Feedback[]): [number, number] {
  let lo = MIN_YEAR, hi = MAX_YEAR;
  for (const f of fb) {
    if (f.dir === 'later') lo = Math.max(lo, f.year + 1);
    if (f.dir === 'earlier') hi = Math.min(hi, f.year - 1);
  }
  return [lo, hi];
}

/** Piecewise-linear timeline scale giving recent centuries (with more maps) more room. */
const DOMAIN = [-3000, -500, 1, 1000, 1500, 1800, 2010];
const RANGE = [0, 0.1, 0.2, 0.37, 0.53, 0.73, 1];
export function timeX(year: number): number {
  const y = Math.max(DOMAIN[0], Math.min(DOMAIN[DOMAIN.length - 1], year));
  for (let i = 1; i < DOMAIN.length; i++) {
    if (y <= DOMAIN[i]) return RANGE[i - 1] + ((y - DOMAIN[i - 1]) / (DOMAIN[i] - DOMAIN[i - 1])) * (RANGE[i] - RANGE[i - 1]);
  }
  return 1;
}

/** Share row: only the direction of each miss (the game no longer reveals how far off a guess was). */
export function shareRows(fb: Feedback[], hc: boolean): string {
  return fb.map((f) => (f.dir === 'correct' ? (hc ? '🟧' : '🟩') : f.dir === 'later' ? '⏩' : '⏪')).join(' ');
}
