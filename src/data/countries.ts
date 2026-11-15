import { feature, neighbors } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, Geometry } from 'geojson';
import metaJson from './countries-meta.json';
import { normalize } from '../core/text';
import type { Lang } from '../core/i18n';

export interface CountryMeta {
  id: string;
  pl: string;
  en: string;
  aliases: string[];
  type: string;
  continent: string;
  subregion: string;
  pop: number;
  labelrank: number;
  lx: number;
  ly: number;
  area: number;
}

export const countries: CountryMeta[] = metaJson as CountryMeta[];
export const byId = new Map(countries.map((c) => [c.id, c]));
export const countryName = (id: string, lang: Lang) => {
  const c = byId.get(id);
  return c ? (lang === 'pl' ? c.pl : c.en) : id;
};

export interface Geo {
  features: Map<string, Feature<Geometry>>;
  neighbours: Map<string, Set<string>>;
  all: Feature<Geometry>[];
}

let geoPromise: Promise<Geo> | null = null;
export function loadGeo(): Promise<Geo> {
  geoPromise ??= fetch(`${import.meta.env.BASE_URL}data/countries-50m.topo.json`)
    .then((r) => r.json() as Promise<Topology<{ countries: GeometryCollection }>>)
    .then((topo) => {
      const fc = feature(topo, topo.objects.countries);
      const geoms = topo.objects.countries.geometries;
      const nb = neighbors(geoms as never);
      const features = new Map<string, Feature<Geometry>>();
      const neighbours = new Map<string, Set<string>>();
      fc.features.forEach((f, i) => {
        const id = String(geoms[i].id);
        f.id = id;
        features.set(id, f);
        neighbours.set(id, new Set(nb[i].map((j) => String(geoms[j].id))));
      });
      return { features, neighbours, all: fc.features };
    });
  return geoPromise;
}

/** Search index: every alias normalised. */
const index = countries.map((c) => ({ id: c.id, keys: [...new Set([c.pl, c.en, ...c.aliases].map(normalize))] }));

export function searchCountries(query: string, lang: Lang, limit = 8): CountryMeta[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { c: CountryMeta; s: number }[] = [];
  for (const { id, keys } of index) {
    let best = Infinity;
    for (const k of keys) {
      if (k === q) best = Math.min(best, 0);
      else if (k.startsWith(q)) best = Math.min(best, 1);
      else if (k.split(' ').some((w) => w.startsWith(q))) best = Math.min(best, 2);
      else if (k.includes(q)) best = Math.min(best, 3);
    }
    if (best < Infinity) scored.push({ c: byId.get(id)!, s: best });
  }
  return scored
    .sort((a, b) => a.s - b.s || (lang === 'pl' ? a.c.pl : a.c.en).localeCompare(lang === 'pl' ? b.c.pl : b.c.en, lang))
    .slice(0, limit)
    .map((x) => x.c);
}

/** Exact (normalised) name → country, used when the player presses Enter without picking. */
export function findCountry(query: string): CountryMeta | null {
  const q = normalize(query);
  const hit = index.find((x) => x.keys.includes(q));
  return hit ? byId.get(hit.id)! : null;
}

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversine(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial great-circle bearing in degrees (0 = north, clockwise). */
export function bearing(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export const MAX_EARTH_DISTANCE = Math.PI * R; // ≈ 20 015 km
