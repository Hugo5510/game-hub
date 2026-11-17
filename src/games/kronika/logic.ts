import { RAW_EVENTS, type EventCat } from './events';
import { hashString, seededPermutation } from '../../core/rng';

export interface HistEvent {
  y: number; // negative = BC (there is no year 0)
  c: EventCat;
  pl: string;
  en: string;
}

export const EVENTS_PER_DAY = 7;
export const MAX_POINTS = 100;
export const KM_PER_POINT = 10;
export const MAX_KM = EVENTS_PER_DAY * MAX_POINTS * KM_PER_POINT; // 7000 km
export const WIN_KM = 3500; // the journey counts as completed past half way
export const MIN_YEAR = -3000;
export const MAX_YEAR = new Date().getFullYear();

/** Events sorted by year, cut into seven equal eras; every round takes one event from each era. */
const sorted: HistEvent[] = RAW_EVENTS.map(([y, c, pl, en]) => ({ y, c, pl, en })).sort((a, b) => a.y - b.y);
export const EVENTS = sorted;
const BIN = Math.floor(sorted.length / EVENTS_PER_DAY);
export const ROUNDS = BIN;
const bins = Array.from({ length: EVENTS_PER_DAY }, (_, k) => sorted.slice(k * BIN, k * BIN + BIN));
const binPerm = bins.map((_, k) => seededPermutation(BIN, hashString(`kronika:era:${k}`)));

/** The seven events of round `p` (one per era) in a seeded, non-chronological order. */
export function roundEvents(p: number): HistEvent[] {
  const picked = bins.map((b, k) => b[binPerm[k][p % BIN]]);
  return seededPermutation(EVENTS_PER_DAY, hashString(`kronika:order:${p}`)).map((i) => picked[i]);
}

/** Astronomical numbering (1 BC = 0) so the gap across the BC/AD boundary is right. */
const astro = (y: number) => (y < 0 ? y + 1 : y);
export const yearDiff = (guess: number, actual: number) => Math.abs(astro(guess) - astro(actual));

/** Points lost per year off: 2 from 1500 on, 1 for 1–1499, 0.5 BC (older dates are fuzzier). */
export const penaltyFor = (y: number) => (y < 0 ? 0.5 : y < 1500 ? 1 : 2);

export function pointsFor(guess: number, actual: number): number {
  return Math.max(0, Math.round(MAX_POINTS - penaltyFor(actual) * yearDiff(guess, actual)));
}

export interface KronikaState {
  guesses: number[];
}

export const totalPoints = (s: KronikaState, ev: HistEvent[]) => s.guesses.reduce((a, g, i) => a + pointsFor(g, ev[i].y), 0);

export const BUCKETS = ['6000+ km', '5000+ km', '4000+ km', '3000+ km', '2000+ km', '1000+ km', '0–999 km'];
export function bucketFor(km: number): string {
  const k = Math.min(6, Math.floor(km / 1000));
  return BUCKETS[6 - k];
}

export function outcome(s: KronikaState, ev: HistEvent[]) {
  if (s.guesses.length < ev.length) return null;
  const km = totalPoints(s, ev) * KM_PER_POINT;
  return { won: km >= WIN_KM, bucket: bucketFor(km), score: km };
}

export type Tier = 1 | 2 | 3 | 4;
/** 1 = bullseye-ish (≥ 90), 2 = close (≥ 60), 3 = so-so (≥ 30), 4 = far. */
export const tierFor = (pts: number): Tier => (pts >= 90 ? 1 : pts >= 60 ? 2 : pts >= 30 ? 3 : 4);

export function shareLine(s: KronikaState, ev: HistEvent[], hc: boolean): string {
  const sq = hc ? ['', '🟦', '🟨', '🟧', '⬛'] : ['', '🟩', '🟨', '🟧', '🟥'];
  return s.guesses.map((g, i) => sq[tierFor(pointsFor(g, ev[i].y))]).join('');
}

export const fmtYear = (y: number, bc: string) => (y < 0 ? `${-y} ${bc}` : String(y));
