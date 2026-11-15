import { describe, expect, it } from 'vitest';
import { maps, judge, outcome, window, timeX, MAX_YEAR } from './logic';

describe('epoka', () => {
  it('maps have contiguous, non-overlapping validity ranges', () => {
    expect(maps.length).toBeGreaterThan(25);
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
    for (let y = 1; y <= 2010; y += 7) {
      const x = timeX(y);
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
  });
});
