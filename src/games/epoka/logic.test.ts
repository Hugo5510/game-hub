import { describe, expect, it } from 'vitest';
import { maps, judge, outcome, window, timeX, formatYear, signedYear, MAX_YEAR, MIN_YEAR } from './logic';

describe('epoka', () => {
  it('maps have contiguous, non-overlapping validity ranges', () => {
    expect(maps.length).toBeGreaterThan(40);
    expect(maps[0].from).toBe(MIN_YEAR);
    for (let i = 0; i < maps.length; i++) {
      expect(maps[i].from).toBeLessThanOrEqual(maps[i].to);
      if (i > 0) expect(maps[i].from).toBeGreaterThan(maps[i - 1].to);
    }
    expect(maps[maps.length - 1].to).toBe(MAX_YEAR);
  });
  it('any year in the range is correct; outside gives direction and distance', () => {
    const m = maps.find((x) => x.from === 1914)!;
    expect(judge(1914, m).dir).toBe('correct');
    expect(judge(m.to, m).dir).toBe('correct');
    expect(judge(1900, m)).toMatchObject({ dir: 'later', off: 14, tier: 'hot' });
    expect(judge(1990, m)).toMatchObject({ dir: 'earlier', off: 1990 - m.to });
  });
  it('win and loss', () => {
    const m = maps.find((x) => x.from === 1914)!;
    expect(outcome({ guesses: [1800, 1916] }, m)).toEqual({ won: true, bucket: '2' });
    expect(outcome({ guesses: [1, 2, 3, 4, 5, 6] }, m)).toEqual({ won: false, bucket: 'X' });
  });
  it('feasible window narrows', () => {
    const m = maps.find((x) => x.from === 1914)!;
    expect(window([judge(1800, m), judge(1990, m)])).toEqual([1801, 1989]);
  });
  it('timeline scale is monotonic', () => {
    let prev = -1;
    for (let y = MIN_YEAR; y <= 2010; y += 7) {
      const x = timeX(y);
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
  });
  it('BC maps: signed years, distance across the era boundary', () => {
    const m = maps.find((x) => x.from === -1)!;
    expect(m.to).toBe(99);
    expect(judge(-1, m).dir).toBe('correct');
    expect(judge(50, m).dir).toBe('correct');
    expect(judge(-5, m)).toMatchObject({ dir: 'later', off: 4 });
    const a = maps.find((x) => x.from === -500)!;
    expect(judge(signedYear(450, true), a).dir).toBe('correct');
    expect(judge(100, a)).toMatchObject({ dir: 'earlier', off: 100 - -401 - 1 });
    expect(formatYear(-500, 'pl')).toBe('500 p.n.e.');
    expect(formatYear(-500, 'en')).toBe('500 BC');
  });
});
