import { describe, expect, it } from 'vitest';
import { EVENTS, ROUNDS, roundEvents, pointsFor, yearDiff, outcome, bucketFor, EVENTS_PER_DAY, WIN_KM } from './logic';

describe('kronika data', () => {
  it('has a big pool of unique, dated events', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(300);
    expect(ROUNDS).toBeGreaterThanOrEqual(40);
    expect(new Set(EVENTS.map((e) => e.pl)).size).toBe(EVENTS.length);
    for (const e of EVENTS) {
      expect(e.y).not.toBe(0);
      expect(Number.isInteger(e.y)).toBe(true);
      expect(e.pl.trim()).toBe(e.pl);
      // texts never give the year away
      expect(e.pl).not.toContain(String(Math.abs(e.y)));
      expect(e.en).not.toContain(String(Math.abs(e.y)));
    }
  });
});

describe('kronika rounds', () => {
  it('seven distinct events spanning all eras, deterministic, no repeats across rounds', () => {
    const seen = new Set<string>();
    for (let p = 0; p < ROUNDS; p++) {
      const r = roundEvents(p);
      expect(r).toHaveLength(EVENTS_PER_DAY);
      expect(roundEvents(p)).toEqual(r);
      for (const e of r) {
        expect(seen.has(e.pl)).toBe(false);
        seen.add(e.pl);
      }
      const ys = r.map((e) => e.y).sort((a, b) => a - b);
      expect(ys[ys.length - 1] - ys[0]).toBeGreaterThan(300);
    }
  });
});

describe('kronika scoring', () => {
  it('handles the missing year 0', () => {
    expect(yearDiff(1, -1)).toBe(1);
    expect(yearDiff(-44, -44)).toBe(0);
  });
  it('points by era', () => {
    expect(pointsFor(1410, 1410)).toBe(100);
    expect(pointsFor(1918, 1914)).toBe(92); // 2 per year from 1500
    expect(pointsFor(1400, 1410)).toBe(90); // 1 per year before 1500
    expect(pointsFor(-30, -44)).toBe(93); // 0.5 per year BC
    expect(pointsFor(1800, 1989)).toBe(0);
  });
  it('outcome and buckets', () => {
    const ev = roundEvents(0);
    expect(outcome({ guesses: [] }, ev)).toBeNull();
    const perfect = outcome({ guesses: ev.map((e) => e.y) }, ev)!;
    expect(perfect.score).toBe(7000);
    expect(perfect.won).toBe(true);
    expect(perfect.bucket).toBe('6000+ km');
    const far = outcome({ guesses: ev.map(() => 2025 + 0) }, ev)!;
    expect(far.score < WIN_KM || far.won).toBe(true);
    expect(bucketFor(999)).toBe('0–999 km');
  });
});
