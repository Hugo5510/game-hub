import { describe, expect, it } from 'vitest';
import { dailyIndex, dailyIndexForDay, unlimitedIndex, cyclePermutation } from './daily';
import { addDays, dayNumber, localDateKey, msUntilLocalMidnight } from './date';
import { applyResult, displayedStreak, emptyStats } from './stats';

describe('daily engine', () => {
  it('same date → same puzzle (deterministic, independent of time of day)', () => {
    const a = dailyIndex('slowko', 500, localDateKey(new Date(2026, 10, 15, 0, 0, 1)));
    const b = dailyIndex('slowko', 500, localDateKey(new Date(2026, 10, 15, 23, 59, 59)));
    expect(a).toBe(b);
    expect(dailyIndex('slowko', 500, '2026-11-15')).toBe(a);
  });

  it('changes exactly at local midnight', () => {
    const before = localDateKey(new Date(2026, 10, 15, 23, 59, 59, 999));
    const after = localDateKey(new Date(2026, 10, 16, 0, 0, 0, 0));
    expect(before).toBe('2026-11-15');
    expect(after).toBe('2026-11-16');
    expect(dailyIndex('kontur', 200, before)).not.toBe(dailyIndex('kontur', 200, after));
  });

  it('countdown to midnight is positive and ≤ 24h', () => {
    const ms = msUntilLocalMidnight(new Date(2026, 10, 15, 23, 59, 0));
    expect(ms).toBe(60_000);
    expect(msUntilLocalMidnight(new Date(2026, 10, 15, 0, 0, 0))).toBeLessThanOrEqual(25 * 3600_000);
  });

  it('day numbers are DST-safe and continuous', () => {
    // Europe: DST change on 2026-03-29 and 2026-10-25
    expect(dayNumber('2026-03-30') - dayNumber('2026-03-29')).toBe(1);
    expect(dayNumber('2026-10-26') - dayNumber('2026-10-25')).toBe(1);
    expect(dayNumber('2026-01-01')).toBe(0);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('no repeats until the pool is exhausted (several cycles)', () => {
    for (const pool of [3, 7, 37, 680]) {
      for (let cycle = -2; cycle < 4; cycle++) {
        const seen = new Set<number>();
        for (let d = cycle * pool; d < (cycle + 1) * pool; d++) seen.add(dailyIndexForDay('epoka', pool, d));
        expect(seen.size).toBe(pool);
      }
    }
  });

  it('no back-to-back repeat across cycle boundaries', () => {
    for (const pool of [3, 5, 37]) {
      for (let cycle = -3; cycle < 30; cycle++) {
        const last = dailyIndexForDay('globus', pool, cycle * pool - 1);
        const first = dailyIndexForDay('globus', pool, cycle * pool);
        expect(first).not.toBe(last);
      }
      for (let c = 0; c < 10; c++) expect(new Set(cyclePermutation('globus', pool, c)).size).toBe(pool);
    }
  });

  it('different games get different sequences', () => {
    const seq = (g: string) => Array.from({ length: 10 }, (_, d) => dailyIndexForDay(g, 1000, d)).join(',');
    expect(seq('slowko')).not.toBe(seq('kontur'));
  });

  it('unlimited never returns today\'s daily puzzle', () => {
    const today = '2026-11-15';
    const daily = dailyIndex('slowko', 4, today);
    let x = 0;
    const rand = () => ((x = (x + 0.137) % 1), x);
    for (let i = 0; i < 500; i++) expect(unlimitedIndex('slowko', 4, today, rand)).not.toBe(daily);
  });
});

describe('stats & streak', () => {
  it('counts consecutive daily wins and resets on loss or a missed day', () => {
    let s = emptyStats();
    s = applyResult(s, { date: '2026-11-10', won: true, bucket: '3' });
    s = applyResult(s, { date: '2026-11-11', won: true, bucket: '4' });
    expect(s.currentStreak).toBe(2);
    s = applyResult(s, { date: '2026-11-11', won: true, bucket: '4' }); // duplicate ignored
    expect(s.played).toBe(2);
    s = applyResult(s, { date: '2026-11-12', won: false, bucket: 'X' });
    expect(s.currentStreak).toBe(0);
    s = applyResult(s, { date: '2026-11-14', won: true, bucket: '1' });
    expect(s.currentStreak).toBe(1);
    expect(s.maxStreak).toBe(2);
    expect(displayedStreak(s, '2026-11-15')).toBe(1);
    expect(displayedStreak(s, '2026-11-16')).toBe(0);
    expect(s.dist).toEqual({ '3': 1, '4': 1, X: 1, '1': 1 });
  });
});
