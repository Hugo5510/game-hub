// Final assembly of the Głębia category pool, shared by build-depth.mjs (full rebuild from
// data-raw/) and refresh-depth.mjs (re-assembly from the committed depth.json).
//  - geography is trimmed: no states/provinces of other countries (only the USA and Poland),
//    fewer overlapping country/region lists;
//  - hand-curated history / science / culture / sport / politics categories are added;
//  - every category gets a `group`, used to keep each dive varied (see promptsFor in logic.ts).
import { curated, countrySets, polishCities } from './curated.mjs';
import { curated2, countrySets2 } from './curated2.mjs';

/** Natural Earth categories that stay in the pool, with their group. */
export const KEEP = {
  'countries-europe': 'geo',
  'countries-asia': 'geo',
  'countries-africa': 'geo',
  'countries-americas': 'geo',
  'countries-big': 'geo',
  'countries-pop20': 'geo',
  'countries-small-pop': 'geo',
  'countries-south': 'geo',
  'capitals-europe': 'geo',
  'capitals-asia': 'geo',
  'capitals-africa': 'geo',
  'capitals-world': 'geo',
  'us-states': 'geo',
  'us-state-capitals': 'geo',
  seas: 'geo',
  deserts: 'geo',
  'ranges-eu-af': 'geo',
  'islands-europe': 'geo',
  'peaks-5000': 'geo',
  'lakes-2000': 'geo',
  rivers: 'geo',
  'elements-all': 'science',
  'elements-1-30': 'science',
  'elements-31-60': 'science',
  'elements-transition': 'science',
  'elements-f-block': 'science',
  'elements-metals': 'science',
};

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
const uniq = (arr) => [...new Set(arr.map(clean).filter(Boolean))];
const rarity = (i, n) => 1 + Math.round((99 * i) / (n - 1));

function fromItems(c) {
  const n = c.items.length;
  if (n < 30) throw new Error(`category ${c.id} has only ${n} answers`);
  const seen = new Set();
  for (const [pl] of c.items) {
    if (seen.has(pl)) throw new Error(`duplicate ${pl} in ${c.id}`);
    seen.add(pl);
  }
  const answers = c.items.map(([pl, en, ...alt], i) => ({ pl, en, alt: uniq([pl, en, ...alt]), r: rarity(i, n) }));
  for (const [pl, en, ...alt] of c.extra ?? []) answers.push({ pl, en, alt: uniq([pl, en, ...alt]), r: 100, extra: true });
  const out = { id: c.id, group: c.group, prompt: c.prompt, metric: c.metric, answers };
  if (c.note) out.note = c.note;
  if (c.exact) out.exact = true;
  return out;
}

/**
 * @param natural  categories built from Natural Earth / element data (any superset of KEEP)
 * @param meta     countries-meta.json (for country ids → population)
 */
export function finalize(natural, meta) {
  const byId = new Map(natural.map((c) => [c.id, c]));
  const kept = Object.entries(KEEP).map(([id, group]) => {
    const c = byId.get(id);
    if (!c) throw new Error(`missing natural category ${id}`);
    return { ...c, group };
  });

  // country answers (with every alias) collected from the country categories
  const countryAns = new Map();
  for (const c of natural) if (c.id.startsWith('countries-')) for (const a of c.answers) if (!countryAns.has(a.en)) countryAns.set(a.en, a);
  const metaById = new Map(meta.map((m) => [m.id, m]));
  const toItems = (ids, setId) =>
    ids
      .map((id) => {
        const m = metaById.get(id);
        if (!m) throw new Error(`unknown country ${id} in ${setId}`);
        const a = countryAns.get(m.en) ?? { pl: m.pl, en: m.en, alt: [m.pl, m.en, ...m.aliases] };
        return { pop: m.pop, item: [a.pl, a.en, ...a.alt] };
      })
      .sort((x, y) => y.pop - x.pop)
      .map((x) => x.item);
  const sets = [...countrySets, ...countrySets2].map((s) =>
    fromItems({ ...s, metric: { pl: 'populacja', en: 'population' }, items: toItems(s.ids, s.id), extra: s.extra ? toItems(s.extra, s.id) : undefined }),
  );

  return [...kept, fromItems(polishCities), ...curated.map(fromItems), ...curated2.map(fromItems), ...sets];
}
