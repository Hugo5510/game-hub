import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { matchAnswer, promptsFor, submit, skip, initialState, outcome, score, type DepthData } from './logic';

const data: DepthData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/data/depth.json'), 'utf8'));
const cat = (id: string) => data.categories.find((c) => c.id === id)!;

describe('głębia data', () => {
  it('has ≥ 45 categories with ≥ 30 answers and rarity 1–100', () => {
    expect(data.categories.length).toBeGreaterThanOrEqual(45);
    for (const c of data.categories) {
      expect(c.answers.filter((a) => !a.extra).length).toBeGreaterThanOrEqual(30);
      for (const a of c.answers) {
        expect(a.r).toBeGreaterThanOrEqual(1);
        expect(a.r).toBeLessThanOrEqual(100);
      }
      expect(Math.min(...c.answers.map((a) => a.r))).toBe(1);
      expect(Math.max(...c.answers.map((a) => a.r))).toBe(100);
    }
  });
  it('geography is limited: no foreign states/provinces, geo is under half of the pool', () => {
    const geo = data.categories.filter((c) => c.group === 'geo');
    expect(geo.length).toBeLessThan(data.categories.length / 2);
    const banned = /provinces|prefectures|departments|subjects|counties|-states$/;
    for (const c of data.categories) if (c.id !== 'us-states') expect(c.id).not.toMatch(banned);
    for (const c of data.categories) expect(c.group).toBeTruthy();
  });
  it('every dive has at most two geography prompts and seven distinct categories', () => {
    const groups = data.categories.map((c) => c.group);
    for (let p = 0; p < data.categories.length; p++) {
      const ps = promptsFor(p, data.categories.length, groups);
      expect(new Set(ps).size).toBe(7);
      expect(ps[0]).toBe(p);
      expect(ps.filter((i) => groups[i] === 'geo').length).toBeLessThanOrEqual(2);
    }
  });
  it('category ids are unique', () => {
    expect(new Set(data.categories.map((c) => c.id)).size).toBe(data.categories.length);
  });
});

describe('głębia matching', () => {
  it('curated categories: people, works, numbers', () => {
    expect(matchAnswer(cat('pl-rulers'), 'Chrobry')).toBe(matchAnswer(cat('pl-rulers'), 'Bolesław Chrobry'));
    expect(matchAnswer(cat('pl-rulers'), 'Mieszko II')).not.toBe(matchAnswer(cat('pl-rulers'), 'Mieszko I'));
    expect(matchAnswer(cat('us-presidents'), 'Lincoln')).toBeGreaterThanOrEqual(0);
    expect(matchAnswer(cat('shakespeare'), 'Makbet')).toBe(matchAnswer(cat('shakespeare'), 'Macbeth'));
    expect(matchAnswer(cat('constellations'), 'Wielki Wóz')).toBe(matchAnswer(cat('constellations'), 'Ursa Major'));
    expect(cat('constellations').answers.length).toBe(88);
    // numbers never fuzzy-match
    expect(matchAnswer(cat('primes-200'), '97')).toBeGreaterThanOrEqual(0);
    expect(matchAnswer(cat('primes-200'), '91')).toBe(-1);
    expect(matchAnswer(cat('summer-olympics-years'), '1940')).toBe(-1);
    expect(matchAnswer(cat('summer-olympics-years'), '2021')).toBe(matchAnswer(cat('summer-olympics-years'), '2020'));
    expect(matchAnswer(cat('nato'), 'Polska')).toBeGreaterThanOrEqual(0);
    expect(matchAnswer(cat('nato'), 'Austria')).toBe(-1);
  });
  it('accepts Polish and English names, diacritics-insensitive', () => {
    const c = cat('countries-europe');
    const pl = matchAnswer(c, 'Niemcy');
    expect(pl).toBeGreaterThanOrEqual(0);
    expect(matchAnswer(c, 'germany')).toBe(pl);
    expect(matchAnswer(c, 'Wlochy')).toBe(matchAnswer(c, 'Włochy'));
  });
  it('tolerates typos proportionally to length', () => {
    const c = cat('capitals-europe');
    expect(matchAnswer(c, 'Lizbonaa')).toBe(matchAnswer(c, 'Lizbona'));
    expect(matchAnswer(c, 'Wraszawa')).toBe(matchAnswer(c, 'Warszawa'));
    expect(matchAnswer(c, 'Xyz')).toBe(-1);
  });
  it('symbols and element names', () => {
    const c = cat('elements-all');
    expect(matchAnswer(c, 'Fe')).toBe(matchAnswer(c, 'żelazo'));
    expect(matchAnswer(c, 'iron')).toBe(matchAnswer(c, 'zelazo'));
  });
  it('rejects answers outside the category', () => {
    expect(matchAnswer(cat('countries-africa'), 'Polska')).toBe(-1);
    expect(matchAnswer(cat('us-states'), 'Bawaria')).toBe(-1);
  });
  it('accepts transcontinental extras with rarity 100', () => {
    const c = cat('countries-europe');
    const i = matchAnswer(c, 'Turcja');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(c.answers[i].r).toBe(100);
  });
  it('river aliases merge local names', () => {
    const c = cat('rivers');
    expect(matchAnswer(c, 'Dunaj')).toBe(matchAnswer(c, 'Donau'));
    expect(matchAnswer(c, 'Wisła')).toBe(matchAnswer(c, 'Vistula'));
    expect(matchAnswer(c, 'Wisła')).toBeGreaterThanOrEqual(0);
  });
});

describe('głębia game flow', () => {
  it('7 distinct prompts per puzzle, deterministic', () => {
    const p = promptsFor(5, data.categories.length);
    expect(p).toHaveLength(7);
    expect(new Set(p).size).toBe(7);
    expect(p[0]).toBe(5);
    expect(promptsFor(5, data.categories.length)).toEqual(p);
  });
  it('win after 7 prompts with score = sum of rarities × 10 m', () => {
    let s = initialState();
    const c = cat('countries-europe');
    for (let i = 0; i < 6; i++) s = submit(s, c, 'Polska').state;
    s = skip(s);
    expect(outcome(s)?.won).toBe(true);
    const r = c.answers[matchAnswer(c, 'Polska')].r;
    expect(score(s)).toBe(6 * r);
    expect(outcome(s)?.score).toBe(60 * r);
  });
  it('three wrong answers drain oxygen → loss', () => {
    let s = initialState();
    const c = cat('countries-africa');
    s = submit(s, c, 'Polska').state;
    expect(submit(s, c, 'Polska').event).toBe('dup'); // repeated miss is free
    s = submit(s, c, 'Francja').state;
    expect(outcome(s)).toBeNull();
    s = submit(s, c, 'Niemcy').state;
    expect(outcome(s)).toMatchObject({ won: false, bucket: 'X' });
  });
});
