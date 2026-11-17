// Builds the Flagi pool: sovereign states (UN members + Vatican, Palestine, Kosovo, Taiwan)
// with their continent, and copies their SVG flags (flag-icons, MIT) into public/data/flags/.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const iso = require('i18n-iso-countries');
const root = path.resolve(import.meta.dirname, '..');
const meta = JSON.parse(fs.readFileSync(path.join(root, 'src/data/countries-meta.json'), 'utf8'));

const TYPES = new Set(['Sovereign country', 'Country', 'Sovereignty', 'Disputed']);
// not (widely recognised) states, or not sovereign
const EXCLUDE = new Set(['SOL', 'CYN', 'JEY', 'GGY', 'IMN', 'ALD', 'ABW', 'CUW', 'SXM', 'GRL', 'HKG', 'MAC', 'IOT', 'FLK']);
const INCLUDE = new Set(['PSX']);
const A2_OVERRIDE = { SDS: 'SS', KOS: 'XK', PSX: 'PS' };
// Natural Earth puts a few island states in "Seven seas"
const CONTINENT_FIX = { MDV: 'Asia', MUS: 'Africa', SYC: 'Africa' };
const CONT = { Europe: 'europe', Asia: 'asia', Africa: 'africa', 'North America': 'namerica', 'South America': 'samerica', Oceania: 'oceania' };

const src = path.join(root, 'node_modules/flag-icons/flags/4x3');
const out = path.join(root, 'public/data/flags');
fs.mkdirSync(out, { recursive: true });

const pool = [];
for (const c of meta) {
  if (EXCLUDE.has(c.id) || (!TYPES.has(c.type) && !INCLUDE.has(c.id))) continue;
  const a2 = (A2_OVERRIDE[c.id] ?? iso.alpha3ToAlpha2(c.id))?.toLowerCase();
  if (!a2) throw new Error(`no ISO alpha-2 for ${c.id} ${c.en}`);
  const file = path.join(src, `${a2}.svg`);
  if (!fs.existsSync(file)) throw new Error(`no flag for ${c.id} (${a2})`);
  const cont = CONT[CONTINENT_FIX[c.id] ?? c.continent];
  if (!cont) throw new Error(`no continent for ${c.id}`);
  fs.copyFileSync(file, path.join(out, `${a2}.svg`));
  pool.push({ id: c.id, a2, cont });
}
pool.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(path.join(root, 'src/games/flagi/flags.json'), JSON.stringify(pool, null, 1) + '\n');
const by = {};
for (const p of pool) by[p.cont] = (by[p.cont] ?? 0) + 1;
console.log('flags', pool.length, by);
