// historical-basemaps (A. Ourednik, GPL-3.0) -> simplified TopoJSON per year + validity ranges + data-derived clues.
import fs from 'node:fs';
import path from 'node:path';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { quantize } from 'topojson-client';
import { geoArea } from 'd3-geo';

const root = path.resolve(import.meta.dirname, '..');
const YEARS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400, 1492, 1500, 1530, 1600, 1650, 1700, 1715, 1783, 1800, 1815, 1878, 1880, 1900, 1914, 1920, 1930, 1938, 1945, 1960, 1994, 2000, 2010];
const LAST_YEAR = 2010;

const maps = YEARS.map((year) => {
  const gj = JSON.parse(fs.readFileSync(path.join(root, `data-raw/hb/world_${year}.geojson`), 'utf8'));
  const feats = gj.features.filter((f) => f.geometry && f.properties.NAME);
  const areas = new Map();
  for (const f of feats) areas.set(f.properties.NAME, (areas.get(f.properties.NAME) ?? 0) + geoArea(f));
  return { year, feats, names: new Set(feats.map((f) => f.properties.NAME)), areas };
});

// Merge consecutive snapshots with (almost) identical sets of polities: they depict the same political map.
const jaccard = (a, b) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};
const groups = [];
for (const m of maps) {
  const last = groups[groups.length - 1];
  if (last && jaccard(last.at(-1).names, m.names) >= 0.97) last.push(m);
  else groups.push([m]);
}

// Clue extraction: tolerate trivial renames (token subset, e.g. "United States" ~ "United States of America"),
// skip cultural areas that are not polities, and keep only territories larger than ~20 000 km².
const MIN_AREA = 5e-4; // steradians
const STOP = new Set(['of', 'the', 'and', 'de', 'la', 'el', 'al']);
const tokens = (n) => new Set(n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z]+/).filter((w) => w && !STOP.has(w)));
const subset = (a, b) => [...a].every((x) => b.has(x));
const presentIn = (name, map) => {
  const t = tokens(name);
  if (!t.size) return true;
  for (const n of map.names) {
    const u = tokens(n);
    if (u.size && (subset(t, u) || subset(u, t))) return true;
  }
  return false;
};
const isPolity = (n) => !/hunter|gatherer|tribe|peoples|nomad|cultures|clans|chiefdoms|antarctica|minor |islands?$|uninhabited|states$|kingdoms$/i.test(n);
const SKIP_AS_PUZZLE = new Set([1492]); // 1307 micro-polities — kept for validity ranges only

const out = [];
groups.forEach((g, gi) => {
  const m = g[0];
  const from = m.year;
  const to = gi + 1 < groups.length ? groups[gi + 1][0].year - 1 : LAST_YEAR;
  const prev = gi > 0 ? groups[gi - 1].at(-1) : null;
  const next = gi + 1 < groups.length ? groups[gi + 1][0] : null;
  const rank = (names, src) => names.filter((n) => isPolity(n) && (src.areas.get(n) ?? 0) >= MIN_AREA).sort((a, b) => (src.areas.get(b) ?? 0) - (src.areas.get(a) ?? 0)).slice(0, 5);
  const appears = prev ? rank([...m.names].filter((n) => !presentIn(n, prev)), m) : [];
  const lastM = g.at(-1);
  const vanishes = next ? rank([...lastM.names].filter((n) => !presentIn(n, next)), lastM) : [];

  if (SKIP_AS_PUZZLE.has(from)) return;
  let topo = topology({ p: { type: 'FeatureCollection', features: m.feats.map((f) => ({ type: 'Feature', properties: { n: f.properties.NAME, s: f.properties.SUBJECTO || f.properties.NAME }, geometry: f.geometry })) } });
  topo = presimplify(topo);
  topo = simplify(topo, quantile(topo, 0.82));
  topo = quantize(topo, 2e4);
  const file = `epoch/world_${from}.topo.json`;
  fs.writeFileSync(path.join(root, 'public/data', file), JSON.stringify(topo));
  if (SKIP_AS_PUZZLE.has(from)) return;
  out.push({ year: from, from, to, file, prevYear: prev?.year ?? null, nextYear: next?.year ?? null, appears, vanishes, polities: m.names.size });
});
fs.writeFileSync(path.join(root, 'src/games/epoka/maps.json'), JSON.stringify(out, null, 1));
for (const o of out) console.log(o.from, '–', o.to, o.polities, 'appears:', o.appears.slice(0, 3).join('; '), '| vanishes:', o.vanishes.slice(0, 3).join('; '), fs.statSync(path.join(root, 'public/data', o.file)).size);
