import { describe, expect, it } from 'vitest';
import { evaluate, outcome, pool, shareRows, compass8 } from './logic';

describe('kontur', () => {
  it('pool is large, unique and stable', () => {
    expect(pool.length).toBeGreaterThan(150);
    expect(new Set(pool).size).toBe(pool.length);
    expect([...pool].sort()).toEqual(pool);
  });
  it('distance, bearing and proximity are sensible', () => {
    const pl_de = evaluate('POL', 'DEU');
    expect(pl_de.km).toBeGreaterThan(300);
    expect(pl_de.km).toBeLessThan(900);
    expect(compass8(pl_de.bearing)).toBe(6); // west
    const pl_au = evaluate('POL', 'AUS');
    expect(pl_au.proximity).toBeLessThan(pl_de.proximity);
    const hit = evaluate('FRA', 'FRA');
    expect(hit).toMatchObject({ km: 0, proximity: 100, correct: true });
  });
  it('win in ≤6 and loss after 6 wrong', () => {
    expect(outcome({ guesses: ['POL', 'FRA'] }, 'FRA')).toEqual({ won: true, bucket: '2' });
    expect(outcome({ guesses: ['POL', 'DEU', 'CZE', 'SVK', 'UKR', 'BLR'] }, 'FRA')).toEqual({ won: false, bucket: 'X' });
  });
  it('share text has no country names', () => {
    const s = shareRows([evaluate('POL', 'FRA'), evaluate('FRA', 'FRA')], false);
    expect(s).not.toMatch(/[A-Za-z]{3}/);
    expect(s).toContain('🎯');
  });
});
