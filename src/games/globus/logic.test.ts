import { describe, expect, it } from 'vitest';
import type { Feature, Geometry } from 'geojson';
import { borderDistance, bucketFor, heatLevel, outcome, pool } from './logic';

const sq = (lon: number, lat: number, s = 1): Feature<Geometry> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [[[lon, lat], [lon + s, lat], [lon + s, lat + s], [lon, lat + s], [lon, lat]]] },
});

describe('globus', () => {
  it('pool contains sovereign states and is unique', () => {
    expect(pool.length).toBeGreaterThan(160);
    expect(new Set(pool).size).toBe(pool.length);
    expect(pool).toContain('POL');
    expect(pool).not.toContain('ATA');
  });
  it('border distance: neighbours are 0, otherwise nearest vertices', () => {
    const a = sq(0, 0), b = sq(10, 0);
    expect(borderDistance(a, b, true)).toBe(0);
    const d = borderDistance(a, b, false); // 9° of longitude at equator ≈ 1000 km
    expect(d).toBeGreaterThan(990);
    expect(d).toBeLessThan(1010);
    expect(heatLevel(0)).toBe(6);
    expect(heatLevel(d)).toBe(3);
    expect(heatLevel(12000)).toBe(0);
  });
  it('win counts guesses, give-up is a loss', () => {
    expect(outcome({ guesses: ['DEU', 'POL'] }, 'POL')).toEqual({ won: true, bucket: '1–3' });
    expect(outcome({ guesses: ['DEU'], gaveUp: true }, 'POL')).toEqual({ won: false, bucket: 'X' });
    expect(outcome({ guesses: ['DEU'] }, 'POL')).toBeNull();
    expect(bucketFor(30)).toBe('26+');
  });
});
