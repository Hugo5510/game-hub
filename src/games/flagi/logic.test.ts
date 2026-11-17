import { describe, expect, it } from 'vitest';
import { CATS, FLAGS, poolFor, roundFlags, outcome, ROUND, WIN_AT, shareLine } from './logic';
import meta from '../../data/countries-meta.json';

describe('flagi data', () => {
  it('has every sovereign state with a known continent and a unique flag', () => {
    expect(FLAGS.length).toBeGreaterThanOrEqual(195);
    expect(new Set(FLAGS.map((f) => f.a2)).size).toBe(FLAGS.length);
    const ids = new Set(meta.map((m) => m.id));
    for (const f of FLAGS) expect(ids.has(f.id)).toBe(true);
    for (const c of CATS) expect(poolFor(c).length).toBeGreaterThanOrEqual(ROUND);
  });
  it('includes Poland in Europe and excludes territories', () => {
    expect(poolFor('europe').some((f) => f.id === 'POL')).toBe(true);
    expect(FLAGS.some((f) => f.id === 'GRL' || f.id === 'PRI' || f.id === 'HKG')).toBe(false);
  });
});

describe('flagi rounds', () => {
  it('ten distinct flags from the category, deterministic per puzzle', () => {
    for (const c of CATS) {
      const r = roundFlags(c, 42);
      expect(r).toHaveLength(ROUND);
      expect(new Set(r).size).toBe(ROUND);
      const pool = new Set(poolFor(c).map((f) => f.id));
      for (const id of r) expect(pool.has(id)).toBe(true);
      expect(roundFlags(c, 42)).toEqual(r);
    }
    expect(roundFlags('world', 1)).not.toEqual(roundFlags('world', 2));
  });
  it('outcome: unfinished → null; score and win threshold', () => {
    const f = roundFlags('europe', 3);
    expect(outcome({ answers: f.slice(0, 5) }, f)).toBeNull();
    const seven = f.map((id, i) => (i < WIN_AT ? id : null));
    expect(outcome({ answers: seven }, f)).toEqual({ won: true, bucket: String(WIN_AT), score: WIN_AT });
    const six = f.map((id, i) => (i < WIN_AT - 1 ? id : 'XXX'));
    expect(outcome({ answers: six }, f)?.won).toBe(false);
    expect(shareLine({ answers: seven }, f, false)).toBe('🟩'.repeat(7) + '🟥'.repeat(3));
  });
});
