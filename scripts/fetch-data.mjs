// Downloads raw open datasets into data-raw/ (git-ignored). Then run `npm run data:build`.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'data-raw');
fs.mkdirSync(path.join(out, 'hb'), { recursive: true });
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const HB = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson';
const HB_YEARS = ['bc3000', 'bc2000', 'bc1500', 'bc1000', 'bc700', 'bc500', 'bc400', 'bc323', 'bc300', 'bc200', 'bc100', 'bc1', 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400, 1492, 1500, 1530, 1600, 1650, 1700, 1715, 1783, 1800, 1815, 1878, 1880, 1900, 1914, 1920, 1930, 1938, 1945, 1960, 1994, 2000, 2010];
const files = [
  ...['ne_50m_admin_0_countries', 'ne_10m_populated_places', 'ne_10m_rivers_lake_centerlines', 'ne_10m_lakes', 'ne_10m_geography_regions_polys', 'ne_10m_geography_regions_elevation_points', 'ne_10m_geography_marine_polys', 'ne_10m_admin_1_states_provinces'].map((f) => [`${NE}/${f}.geojson`, `${f}.geojson`]),
  ...HB_YEARS.map((y) => [`${HB}/world_${y}.geojson`, `hb/world_${y}.geojson`]),
  ['https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pl/pl_50k.txt', 'pl_50k.txt'],
  ['https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json', 'elements.json'],
];
for (const [url, name] of files) {
  const dest = path.join(out, name);
  if (fs.existsSync(dest)) {
    console.log('skip', name);
    continue;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('ok  ', name);
}
