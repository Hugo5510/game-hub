import { describe, expect, it } from 'vitest';
import { makePuzzle, ballAt, flightTime, scoreCount, scoreAngle, scoreSplit, scoreTrack, angleDiff, outcome, grade, total, BOX, BALL_R, TRACK_FLOOR } from './logic';

describe('oko puzzles', () => {
  it('are deterministic and valid', () => {
    for (let p = 0; p < 300; p++) {
      const a = makePuzzle(p);
      expect(makePuzzle(p)).toEqual(a);
      const n = a.count.dots.length;
      expect(n).toBeGreaterThanOrEqual(12);
      expect(n).toBeLessThanOrEqual(90);
      for (const d of a.count.dots) {
        expect(d.x - d.r).toBeGreaterThan(0);
        expect(d.x + d.r).toBeLessThan(BOX);
      }
      expect(a.angle.target).toBeGreaterThanOrEqual(0);
      expect(a.angle.target).toBeLessThan(360);
      expect(angleDiff(a.angle.target, 0) % 45 === 0).toBe(false);
      expect(a.split.answer).toBeGreaterThan(0);
      expect(a.split.answer).toBeLessThan(1);
      expect(a.split.num * 2).not.toBe(a.split.den);
      expect(a.split.x2).toBeLessThanOrEqual(95);
      expect(a.track.answer).toBeGreaterThanOrEqual(BALL_R - 1e-9);
      expect(a.track.answer).toBeLessThanOrEqual(BOX - BALL_R + 1e-9);
    }
  });
  it('the ball stays inside the walls and lands on the floor', () => {
    const tr = makePuzzle(7).track;
    const T = flightTime(tr);
    for (let k = 0; k <= 100; k++) {
      const p = ballAt(tr, (T * k) / 100);
      expect(p.x).toBeGreaterThanOrEqual(BALL_R - 1e-9);
      expect(p.x).toBeLessThanOrEqual(BOX - BALL_R + 1e-9);
    }
    expect(ballAt(tr, T).y).toBeCloseTo(TRACK_FLOOR);
    expect(ballAt(tr, T).x).toBeCloseTo(tr.answer);
  });
  it('bounces mirror the motion', () => {
    const tr = { x0: 90, y0: 0, vx: 20, vy: 10, visible: 0.5, answer: 0 };
    // after 1 s the unbounded x would be 110 → mirrored inside the right wall
    expect(ballAt(tr, 1).x).toBeCloseTo(2 * (BOX - BALL_R) - 110);
  });
});

describe('oko scoring', () => {
  it('scores each trial 0–100', () => {
    expect(scoreCount(40, 40)).toBe(100);
    expect(scoreCount(44, 40)).toBe(80);
    expect(scoreCount(80, 40)).toBe(0);
    expect(angleDiff(355, 5)).toBe(10);
    expect(scoreAngle(100, 100)).toBe(100);
    expect(scoreAngle(118, 100)).toBe(50);
    expect(scoreSplit(0.5, 0.5)).toBe(100);
    expect(scoreSplit(0.55, 0.5)).toBe(80);
    expect(scoreTrack(50, 50)).toBe(100);
    expect(scoreTrack(75, 50)).toBe(0);
  });
  it('grades the average; F is a loss', () => {
    expect(total([100, 90, 80, 70])).toBe(85);
    expect(grade(97)).toBe('S');
    expect(grade(85)).toBe('A');
    expect(grade(44)).toBe('F');
    const pz = makePuzzle(1);
    expect(outcome({ answers: [1, 2], shown: 1 }, pz)).toBeNull();
    const perfect = outcome({ answers: [pz.count.dots.length, pz.angle.target, pz.split.answer, pz.track.answer], shown: 3 }, pz);
    expect(perfect).toEqual({ won: true, bucket: 'S', score: 100 });
    const bad = outcome({ answers: [999, (pz.angle.target + 180) % 360, pz.split.answer > 0.5 ? 0 : 1, pz.track.answer > 50 ? 0 : 100], shown: 3 }, pz);
    expect(bad?.won).toBe(false);
  });
});
