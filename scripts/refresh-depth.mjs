// Re-assembles public/data/depth.json from the committed file (no data-raw/ needed):
// keeps the Natural Earth / element categories listed in scripts/depth/finalize.mjs and
// re-adds the hand-curated ones. Run after editing scripts/depth/curated.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { finalize } from './depth/finalize.mjs';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'public/data/depth.json');
const meta = JSON.parse(fs.readFileSync(path.join(root, 'src/data/countries-meta.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const categories = finalize(data.categories, meta);
fs.writeFileSync(file, JSON.stringify({ version: 2, categories }));
const groups = {};
for (const c of categories) groups[c.group] = (groups[c.group] ?? 0) + 1;
console.log('categories', categories.length, 'answers', categories.reduce((a, c) => a + c.answers.length, 0), groups);
for (const c of categories) console.log(c.group.padEnd(8), c.id.padEnd(24), String(c.answers.length).padStart(4), c.answers.slice(0, 3).map((a) => a.pl).join(', '));
