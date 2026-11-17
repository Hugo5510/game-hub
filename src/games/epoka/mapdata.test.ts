import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { feature, neighbors } from 'topojson-client';
import { geoArea } from 'd3-geo';
import { fixWinding, colorPolities, polylabel, pointToPolygon, labelLines, type PolyFeature } from './mapdata';
import maps from './maps.json';

const load = (file: string) => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/data', file), 'utf8'));

describe('epoka atlas data', () => {
  it('after fixing the winding no polity covers more than a hemisphere', () => {
    for (const m of maps) {
      const t = load(m.file);
      const feats = (feature(t, t.objects.p) as unknown as { features: PolyFeature[] }).features.map(fixWinding);
      for (const f of feats) expect(geoArea(f)).toBeLessThan(2 * Math.PI);
    }
  });
  it('neighbouring polities never share a colour', () => {
    for (const m of maps) {
      const t = load(m.file);
      const geoms = t.objects.p.geometries;
      const nb = neighbors(geoms);
      const group = geoms.map((g: { properties: { s: string } }) => g.properties.s);
      const col = colorPolities(group, nb, 8);
      nb.forEach((list: number[], i: number) => {
        for (const j of list) if (group[i] !== group[j]) expect(col.get(group[i])).not.toBe(col.get(group[j]));
      });
    }
  });
});

describe('label helpers', () => {
  it('polylabel finds the inside of a concave shape', () => {
    // a "C" shape: the centroid would fall in the gap
    const c: [number, number][] = [[0, 0], [10, 0], [10, 3], [3, 3], [3, 7], [10, 7], [10, 10], [0, 10], [0, 0]];
    const p = polylabel([c]);
    expect(pointToPolygon([p.x, p.y], [c])).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(3);
  });
  it('long names wrap into two balanced lines', () => {
    expect(labelLines('Polska')).toEqual(['Polska']);
    expect(labelLines('Polish-Lithuanian Commonwealth')).toEqual(['Polish-Lithuanian', 'Commonwealth']);
    expect(labelLines('Holy Roman Empire of the German Nation')).toEqual(['Holy Roman Empire', 'of the German Nation']);
  });
});
