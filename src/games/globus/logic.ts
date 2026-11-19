import type { Feature, Geometry, Position } from 'geojson';
import { countries } from '../../data/countries';

/** Targets: sovereign states (and Kosovo/Israel/Taiwan-type entries), ≥ 300 km² so they are visible on the globe. */
const EXCLUDE = new Set(['IMN', 'ALD', 'HKG', 'CUW', 'FLK', 'KAS', 'ATA', 'PSX', 'GRL']);
export const pool: string[] = countries
  .filter((c) => ['Sovereign country', 'Country', 'Sovereignty', 'Disputed'].includes(c.type) && c.area >= 300 && !EXCLUDE.has(c.id))
  .map((c) => c.id)
  .sort();

export interface GlobusState {
  guesses: string[];
  gaveUp?: boolean;
}

export const BUCKETS = ['1–3', '4–6', '7–10', '11–15', '16–25', '26+', 'X'];
export function bucketFor(n: number): string {
  return n <= 3 ? '1–3' : n <= 6 ? '4–6' : n <= 10 ? '7–10' : n <= 15 ? '11–15' : n <= 25 ? '16–25' : '26+';
}

export function outcome(s: GlobusState, target: string) {
  if (s.guesses.includes(target)) return { won: true, bucket: bucketFor(s.guesses.length) };
  if (s.gaveUp) return { won: false, bucket: 'X' };
  return null;
}

/* ---------- border-to-border distance ---------- */
type Vec = [number, number, number];
const toVec = ([lon, lat]: Position): Vec => {
  const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
};

const vecCache = new WeakMap<object, Vec[]>();
function vertices(f: Feature<Geometry>): Vec[] {
  let v = vecCache.get(f);
  if (v) return v;
  const out: Vec[] = [];
  const g = f.geometry;
  const rings: Position[][] = g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [];
  for (const r of rings) for (const p of r) out.push(toVec(p));
  vecCache.set(f, (v = out));
  return v;
}

/** Minimum great-circle distance (km) between the vertices of two country outlines; 0 for shared borders. */
export function borderDistance(a: Feature<Geometry>, b: Feature<Geometry>, areNeighbours: boolean): number {
  if (a === b || areNeighbours) return 0;
  const va = vertices(a), vb = vertices(b);
  let best = -1;
  for (let i = 0; i < va.length; i++) {
    const [x, y, z] = va[i];
    for (let j = 0; j < vb.length; j++) {
      const d = x * vb[j][0] + y * vb[j][1] + z * vb[j][2];
      if (d > best) best = d;
    }
  }
  return Math.round(Math.acos(Math.min(1, best)) * 6371);
}

/** Heat level 0 (far) … 6 (adjacent). */
export function heatLevel(km: number): number {
  if (km <= 0) return 6;
  if (km < 500) return 5;
  if (km < 1000) return 4;
  if (km < 2000) return 3;
  if (km < 3500) return 2;
  if (km < 6000) return 1;
  return 0;
}

export function shareLine(levels: number[], won: boolean): string {
  const sym = ['⬜', '⬜', '🟨', '🟨', '🟧', '🟥', '🟥'];
  const cells = levels.map((l, i) => (won && i === levels.length - 1 ? '🟩' : sym[l]));
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 10) rows.push(cells.slice(i, i + 10).join(''));
  return rows.join('\n');
}

/** Initial great-circle bearing (degrees, 0 = north, clockwise) from point a to point b, both [lon, lat]. */
export function bearing([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const r = Math.PI / 180;
  const p1 = lat1 * r, p2 = lat2 * r, dl = (lon2 - lon1) * r;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) / r) % 360 + 360) % 360;
}

export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
/** 8-point compass sector (0 = N … 7 = NW). */
export function compassIndex(deg: number): number {
  return Math.round(deg / 45) % 8;
}
