// Pure helpers for the Epoka atlas: ring orientation fix, neighbour-aware colouring and
// label placement (pole of inaccessibility, after Mapbox "polylabel", ISC).
import { geoArea } from 'd3-geo';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';

export type PolyFeature = Feature<Polygon | MultiPolygon, { n: string; s: string }>;

/**
 * Some source polygons are wound the "wrong" way for d3's spherical maths, so d3 reads them as
 * the whole globe minus the country and paints over everything. Reverse such polygons.
 */
export function fixWinding(f: PolyFeature): PolyFeature {
  const fix = (p: Position[][]) => (geoArea({ type: 'Polygon', coordinates: p }) > 2 * Math.PI ? p.map((r) => [...r].reverse()) : p);
  const g = f.geometry;
  const geometry = g.type === 'Polygon' ? { ...g, coordinates: fix(g.coordinates) } : { ...g, coordinates: g.coordinates.map(fix) };
  return { ...f, geometry } as PolyFeature;
}

/** Not states: shown in a neutral colour and without a name. */
export const NOT_A_STATE = /hunter|gatherer|farmers|herders|pastoralists|foragers|fishers|tribes?\b|peoples|nomad|cultures?\b|complex\b|clans|chiefdoms|antarctica|uninhabited/i;

/**
 * Greedy colouring of polities (parts of one polity share a colour) so that bordering polities
 * never share one when `colors` allows it; the least-used free colour is taken to keep variety.
 */
export function colorPolities(groupOf: string[], neighbours: number[][], colors: number, weight: number[] = []): Map<string, number> {
  const adj = new Map<string, Set<string>>();
  const w = new Map<string, number>();
  groupOf.forEach((g, i) => {
    if (!adj.has(g)) adj.set(g, new Set());
    w.set(g, (w.get(g) ?? 0) + (weight[i] ?? 0));
    for (const j of neighbours[i] ?? []) if (groupOf[j] !== g) adj.get(g)!.add(groupOf[j]);
  });
  for (const [g, set] of adj) for (const o of set) adj.get(o)?.add(g);
  const order = [...adj.keys()].sort((a, b) => adj.get(b)!.size - adj.get(a)!.size || (w.get(b) ?? 0) - (w.get(a) ?? 0) || (a < b ? -1 : 1));
  const out = new Map<string, number>();
  const used = new Array(colors).fill(0);
  for (const g of order) {
    const taken = new Set([...adj.get(g)!].map((o) => out.get(o)).filter((c) => c != null));
    let best = -1;
    for (let c = 0; c < colors; c++) if (!taken.has(c) && (best < 0 || used[c] < used[best])) best = c;
    if (best < 0) best = used.indexOf(Math.min(...used));
    out.set(g, best);
    used[best]++;
  }
  return out;
}

/* ---------------- polylabel (planar, in projected coordinates) ---------------- */
type Pt = [number, number];
function segDist2(p: Pt, a: Pt, b: Pt) {
  let [x, y] = a;
  let dx = b[0] - x, dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) (x = b[0]), (y = b[1]);
    else if (t > 0) (x += dx * t), (y += dy * t);
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}
/** Signed distance from p to the polygon outline (positive inside). */
export function pointToPolygon(p: Pt, rings: Pt[][]): number {
  let inside = false;
  let min = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
      min = Math.min(min, segDist2(p, a, b));
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(min);
}
interface Cell {
  x: number;
  y: number;
  h: number;
  d: number;
  max: number;
}
const cell = (x: number, y: number, h: number, rings: Pt[][]): Cell => {
  const d = pointToPolygon([x, y], rings);
  return { x, y, h, d, max: d + h * Math.SQRT2 };
};
/** Point inside the polygon farthest from its edges, with that distance. */
export function polylabel(rings: Pt[][], precision?: number): { x: number; y: number; d: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of rings[0]) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const w = maxX - minX, h = maxY - minY;
  const size = Math.min(w, h);
  if (size === 0) return { x: minX, y: minY, d: 0 };
  const prec = precision ?? Math.max(w, h) / 60;
  const queue: Cell[] = [];
  for (let x = minX; x < maxX; x += size) for (let y = minY; y < maxY; y += size) queue.push(cell(x + size / 2, y + size / 2, size / 2, rings));
  let best = cell(minX + w / 2, minY + h / 2, 0, rings);
  for (let guard = 0; queue.length && guard < 4000; guard++) {
    let k = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].max > queue[k].max) k = i;
    const c = queue.splice(k, 1)[0];
    if (c.d > best.d) best = c;
    if (c.max - best.d <= prec) continue;
    const hh = c.h / 2;
    queue.push(cell(c.x - hh, c.y - hh, hh, rings), cell(c.x + hh, c.y - hh, hh, rings), cell(c.x - hh, c.y + hh, hh, rings), cell(c.x + hh, c.y + hh, hh, rings));
  }
  return { x: best.x, y: best.y, d: Math.max(0, best.d) };
}

/** Split a long name into at most two balanced lines. */
export function labelLines(name: string): string[] {
  if (name.length <= 14 || !name.includes(' ')) return [name];
  const words = name.split(' ');
  let bestI = 1, bestD = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (d < bestD) (bestD = d), (bestI = i);
  }
  return [words.slice(0, bestI).join(' '), words.slice(bestI).join(' ')];
}
