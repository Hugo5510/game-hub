import { hashString, mulberry32 } from '../../core/rng';

/** Oko — four quick perception trials. Every trial scores 0–100; the day's result is the rounded mean. */
export type TrialId = 'count' | 'angle' | 'split' | 'track';
export const TRIALS: TrialId[] = ['count', 'angle', 'split', 'track'];

/** Puzzle pool size: the daily index is used only as a seed. */
export const POOL = 50000;

export interface Dot {
  x: number;
  y: number;
  r: number;
}
export interface CountTrial {
  dots: Dot[];
  /** how long the dots are shown (ms) */
  showMs: number;
}
export interface AngleTrial {
  /** target angle in degrees, counter-clockwise from "3 o'clock" */
  target: number;
  /** where the movable arm starts */
  start: number;
}
export interface SplitTrial {
  num: number;
  den: number;
  /** endpoint the fraction is measured from */
  from: 'A' | 'B';
  /** segment in a 100 × 40 box */
  x1: number;
  x2: number;
  y: number;
  /** target position as a fraction from A (0) to B (1) */
  answer: number;
}
export interface TrackTrial {
  /** start point and velocity in a 100 × 100 box (units per second), y grows downwards */
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  /** the ball is visible for this share of its flight */
  visible: number;
  /** x where the ball reaches the bottom line (after wall bounces) */
  answer: number;
}
export interface Puzzle {
  count: CountTrial;
  angle: AngleTrial;
  split: SplitTrial;
  track: TrackTrial;
}

export const BOX = 100;
export const BALL_R = 2.6;
export const TRACK_FLOOR = 100;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Position of the ball at time t (s), bouncing off the side walls (ball radius included). */
export function ballAt(tr: TrackTrial, t: number): { x: number; y: number } {
  const lo = BALL_R, hi = BOX - BALL_R, w = hi - lo;
  let u = (tr.x0 - lo + tr.vx * t) % (2 * w);
  if (u < 0) u += 2 * w;
  const x = lo + (u <= w ? u : 2 * w - u);
  return { x, y: tr.y0 + tr.vy * t };
}
export const flightTime = (tr: TrackTrial) => (TRACK_FLOOR - tr.y0) / tr.vy;

export function makePuzzle(p: number): Puzzle {
  const rand = mulberry32(hashString(`oko:${p}`));
  const between = (a: number, b: number) => a + rand() * (b - a);
  const int = (a: number, b: number) => Math.floor(between(a, b + 1));

  // count: 12–90 dots, non-overlapping, in a 100 × 100 box
  const n = int(12, 90);
  const dots: Dot[] = [];
  const rMax = n > 60 ? 2.1 : n > 35 ? 2.6 : 3.2;
  for (let tries = 0; dots.length < n && tries < 20000; tries++) {
    const r = between(rMax * 0.7, rMax);
    const x = between(r + 2, BOX - r - 2), y = between(r + 2, BOX - r - 2);
    if (dots.every((d) => (d.x - x) ** 2 + (d.y - y) ** 2 > (d.r + r + 1.2) ** 2)) dots.push({ x, y, r });
  }
  const count: CountTrial = { dots, showMs: 2000 };

  // angle: avoid the trivial ones (within 4° of a multiple of 45°)
  // keep clear of the horizontal arm (≥ 12°) and of the "easy" multiples of 45° (≥ 5°)
  let target = int(12, 348);
  while (Math.abs(((target + 22.5) % 45) - 22.5) < 5) target = int(12, 348);
  const angle: AngleTrial = { target, start: (target + int(70, 290)) % 360 };

  // split: a fraction other than 1/2, from a random endpoint
  let den = int(3, 9), num = int(1, den - 1);
  while (gcd(num, den) !== 1 || num * 2 === den) (den = int(3, 9)), (num = int(1, den - 1));
  const from: 'A' | 'B' = rand() < 0.5 ? 'A' : 'B';
  const len = between(62, 88);
  const x1 = between(6, 94 - len);
  const split: SplitTrial = { num, den, from, x1, x2: x1 + len, y: between(16, 24), answer: from === 'A' ? num / den : 1 - num / den };

  // track: launched from the top, bounces off the side walls 0–2 times, hidden part-way
  const x0 = between(15, 85), y0 = 6;
  const tFlight = between(1.9, 2.6);
  const vy = (TRACK_FLOOR - y0) / tFlight;
  const vx = (rand() < 0.5 ? -1 : 1) * between(20, 75);
  const tr: TrackTrial = { x0, y0, vx, vy, visible: between(0.38, 0.55), answer: 0 };
  tr.answer = ballAt(tr, tFlight).x;

  return { count, angle, split, track: tr };
}

/* ---------- scoring ---------- */
const clampScore = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
/** Smallest difference between two angles, in degrees. */
export const angleDiff = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
};

/** count: relative error; 50% off (or more) scores 0 */
export const scoreCount = (guess: number, actual: number) => clampScore(100 * (1 - Math.abs(guess - actual) / actual / 0.5));
/** angle: 36° off scores 0 */
export const scoreAngle = (guess: number, target: number) => clampScore(100 * (1 - angleDiff(guess, target) / 36));
/** split: error as a share of the segment; a quarter off scores 0 */
export const scoreSplit = (guess: number, answer: number) => clampScore(100 * (1 - Math.abs(guess - answer) / 0.25));
/** track: error as a share of the box width; a quarter off scores 0 */
export const scoreTrack = (guessX: number, answerX: number) => clampScore(100 * (1 - Math.abs(guessX - answerX) / BOX / 0.25));

export interface OkoState {
  /** answers in trial order: count (number), angle (deg), split (fraction from A), track (x) */
  answers: number[];
  /** index of the last trial whose stimulus was already shown (count and track are shown once) */
  shown: number;
}

export function trialScore(pz: Puzzle, i: number, a: number): number {
  switch (TRIALS[i]) {
    case 'count':
      return scoreCount(a, pz.count.dots.length);
    case 'angle':
      return scoreAngle(a, pz.angle.target);
    case 'split':
      return scoreSplit(a, pz.split.answer);
    case 'track':
      return scoreTrack(a, pz.track.answer);
  }
}

export const scores = (s: OkoState, pz: Puzzle) => s.answers.map((a, i) => trialScore(pz, i, a));
export const total = (sc: number[]) => (sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / TRIALS.length) : 0);

export const GRADES = ['S', 'A', 'B', 'C', 'D', 'F'] as const;
export function grade(score: number): (typeof GRADES)[number] {
  return score >= 95 ? 'S' : score >= 85 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F';
}

export function outcome(s: OkoState, pz: Puzzle) {
  if (s.answers.length < TRIALS.length) return null;
  const sc = total(scores(s, pz));
  const g = grade(sc);
  return { won: g !== 'F', bucket: g, score: sc };
}

export const ICONS: Record<TrialId, string> = { count: '🔢', angle: '📐', split: '✂️', track: '🎯' };
export function shareLine(sc: number[]): string {
  return TRIALS.map((id, i) => `${ICONS[id]} ${sc[i] ?? '–'}`).join(' · ');
}
