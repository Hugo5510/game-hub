// Builds the Głębia (depth) category database from open datasets.
// Every category is a closed set taken from a dataset; rarity 1–100 is the rank of an objective
// "obviousness" metric inside the category (most obvious answer = 1, least obvious = 100).
import fs from 'node:fs';
import path from 'node:path';
import { geoContains, geoArea, geoBounds, geoLength } from 'd3-geo';

const root = path.resolve(import.meta.dirname, '..');
const raw = (f) => JSON.parse(fs.readFileSync(path.join(root, 'data-raw', f), 'utf8'));
const local = (f) => JSON.parse(fs.readFileSync(path.join(root, 'scripts/depth', f), 'utf8'));
const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
const uniq = (arr) => [...new Set(arr.map(clean).filter(Boolean))];

const categories = [];
/**
 * items: [{ pl, en, alt: string[], metric: number, tie?: number }]; higher metric = more obvious.
 * extra: answers accepted but outside the core set (e.g. transcontinental countries) — always rarity 100.
 */
function addCategory(id, prompt, items, opts = {}) {
  const seen = new Set();
  const list = items.filter((it) => {
    const k = clean(it.en || it.pl).toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  list.sort((a, b) => b.metric - a.metric || (b.tie ?? 0) - (a.tie ?? 0) || a.en.localeCompare(b.en));
  const n = list.length;
  if (n < 30) throw new Error(`category ${id} has only ${n} answers`);
  const answers = list.map((it, i) => ({
    pl: clean(it.pl) || clean(it.en),
    en: clean(it.en) || clean(it.pl),
    alt: uniq([it.pl, it.en, ...(it.alt ?? [])]),
    r: 1 + Math.round((99 * i) / (n - 1)),
  }));
  for (const it of opts.extra ?? []) answers.push({ pl: clean(it.pl), en: clean(it.en), alt: uniq([it.pl, it.en, ...(it.alt ?? [])]), r: 100, extra: true });
  categories.push({ id, prompt, note: opts.note, metric: opts.metric, answers });
}

/* ---------------- countries (Natural Earth admin 0, 1:50m) ---------------- */
const a0 = raw('ne_50m_admin_0_countries.geojson').features;
const STATE_TYPES = new Set(['Sovereign country', 'Country', 'Sovereignty', 'Disputed']);
const NOT_STATES = new Set(['KAS', 'ATA', 'IOT', 'FLK', 'SAH']);
const states = a0
  .filter((f) => STATE_TYPES.has(f.properties.TYPE) && !NOT_STATES.has(f.properties.ADM0_A3))
  .map((f) => {
    const p = f.properties;
    const [[minLon, minLat], [maxLon, maxLat]] = geoBounds(f);
    return {
      f,
      id: p.ADM0_A3,
      continent: p.CONTINENT,
      wb: p.REGION_WB,
      pop: p.POP_EST,
      area: geoArea(f) * 6371 ** 2,
      bounds: { minLon, minLat, maxLon, maxLat },
      item: { pl: p.NAME_PL, en: p.NAME_EN, alt: [p.NAME, p.NAME_LONG, p.ADMIN, p.FORMAL_EN, p.NAME_ALT, p.BRK_NAME], metric: p.POP_EST },
    };
  });
const stateById = new Map(states.map((s) => [s.id, s]));
const countryItems = (pred) => states.filter(pred).map((s) => s.item);
const extraCountries = (ids) => ids.map((id) => stateById.get(id).item);
const NOTE_NE = { pl: 'wg Natural Earth', en: 'per Natural Earth' };
const POP = { pl: 'populacja', en: 'population' };

addCategory('countries-europe', { pl: 'Podaj państwo w Europie', en: 'Name a country in Europe' }, countryItems((s) => s.continent === 'Europe'), {
  metric: POP,
  extra: extraCountries(['TUR', 'KAZ', 'GEO', 'ARM', 'AZE', 'CYP']),
});
addCategory('countries-asia', { pl: 'Podaj państwo w Azji', en: 'Name a country in Asia' }, countryItems((s) => s.continent === 'Asia'), {
  metric: POP,
  extra: extraCountries(['RUS', 'EGY']),
});
addCategory('countries-africa', { pl: 'Podaj państwo w Afryce', en: 'Name a country in Africa' }, countryItems((s) => s.continent === 'Africa'), { metric: POP });
addCategory(
  'countries-americas',
  { pl: 'Podaj państwo w Ameryce Północnej lub Południowej', en: 'Name a country in North or South America' },
  countryItems((s) => s.continent === 'North America' || s.continent === 'South America'),
  { metric: POP },
);
addCategory('countries-big', { pl: 'Podaj państwo o powierzchni ponad 500 000 km²', en: 'Name a country larger than 500,000 km²' }, states.filter((s) => s.area > 500000).map((s) => ({ ...s.item, metric: s.area })), {
  note: NOTE_NE,
  metric: { pl: 'powierzchnia', en: 'area' },
});
addCategory('countries-pop20', { pl: 'Podaj państwo liczące ponad 20 mln mieszkańców', en: 'Name a country with over 20 million people' }, countryItems((s) => s.pop > 20e6), { note: NOTE_NE, metric: POP });
addCategory('countries-small-pop', { pl: 'Podaj państwo liczące mniej niż 2 mln mieszkańców', en: 'Name a country with fewer than 2 million people' }, countryItems((s) => s.pop < 2e6), { note: NOTE_NE, metric: POP });
addCategory(
  'countries-south',
  { pl: 'Podaj państwo leżące w całości na półkuli południowej', en: 'Name a country lying entirely in the Southern Hemisphere' },
  countryItems((s) => s.bounds.maxLat < 0),
  { metric: POP },
);
addCategory(
  'countries-west',
  { pl: 'Podaj państwo leżące w całości na półkuli zachodniej', en: 'Name a country lying entirely in the Western Hemisphere' },
  countryItems((s) => s.bounds.minLon <= s.bounds.maxLon && s.bounds.maxLon < 0),
  { metric: POP },
);
addCategory('countries-ssa', { pl: 'Podaj państwo Afryki Subsaharyjskiej', en: 'Name a Sub-Saharan African country' }, countryItems((s) => s.wb === 'Sub-Saharan Africa'), { note: { pl: 'wg regionów Banku Światowego', en: 'World Bank regions' }, metric: POP });
addCategory('countries-latam', { pl: 'Podaj państwo Ameryki Łacińskiej lub Karaibów', en: 'Name a country of Latin America or the Caribbean' }, countryItems((s) => s.wb === 'Latin America & Caribbean'), { note: { pl: 'wg regionów Banku Światowego', en: 'World Bank regions' }, metric: POP });
addCategory('countries-eap', { pl: 'Podaj państwo Azji Wschodniej lub Pacyfiku', en: 'Name a country of East Asia or the Pacific' }, countryItems((s) => s.wb === 'East Asia & Pacific'), { note: { pl: 'wg regionów Banku Światowego', en: 'World Bank regions' }, metric: POP });
const firstLetter = (s) => s.item.pl.toLocaleUpperCase('pl')[0];
addCategory('countries-abc', { pl: 'Podaj państwo, którego polska nazwa zaczyna się na A, B lub C', en: 'Name a country whose Polish name starts with A, B or C' }, countryItems((s) => 'ABC'.includes(firstLetter(s))), { metric: POP });
addCategory('countries-mnp', { pl: 'Podaj państwo, którego polska nazwa zaczyna się na M, N lub P', en: 'Name a country whose Polish name starts with M, N or P' }, countryItems((s) => 'MNP'.includes(firstLetter(s))), { metric: POP });
addCategory('countries-s-z', { pl: 'Podaj państwo, którego polska nazwa zaczyna się na S, T, U lub W', en: 'Name a country whose Polish name starts with S, T, U or W' }, countryItems((s) => 'STUW'.includes(firstLetter(s))), { metric: POP });

/* ---------------- capitals (Natural Earth populated places) ---------------- */
const places = raw('ne_10m_populated_places.geojson').features.map((f) => f.properties);
const placeItem = (p) => ({ pl: p.NAME_PL || p.NAME, en: p.NAME_EN || p.NAME, alt: [p.NAME, p.NAMEASCII, p.NAMEALT, p.LS_NAME, p.NAMEPAR, ...(p.NAMEALT ? String(p.NAMEALT).split('|') : [])], metric: p.POP_MAX });
const capitals = places.filter((p) => (p.FEATURECLA === 'Admin-0 capital' || p.FEATURECLA === 'Admin-0 capital alt') && stateById.has(p.ADM0_A3));
const capItems = (pred) => capitals.filter((p) => pred(stateById.get(p.ADM0_A3))).map(placeItem);
addCategory('capitals-europe', { pl: 'Podaj stolicę państwa europejskiego', en: 'Name the capital of a European country' }, capItems((s) => s.continent === 'Europe'), { metric: POP });
addCategory('capitals-asia', { pl: 'Podaj stolicę państwa azjatyckiego', en: 'Name the capital of an Asian country' }, capItems((s) => s.continent === 'Asia'), { metric: POP });
addCategory('capitals-africa', { pl: 'Podaj stolicę państwa afrykańskiego', en: 'Name the capital of an African country' }, capItems((s) => s.continent === 'Africa'), { metric: POP });
addCategory('capitals-americas', { pl: 'Podaj stolicę państwa w obu Amerykach', en: 'Name the capital of a country in the Americas' }, capItems((s) => s.continent === 'North America' || s.continent === 'South America'), { metric: POP });
addCategory('capitals-world', { pl: 'Podaj stolicę dowolnego państwa', en: 'Name the capital of any country' }, capItems(() => true), { metric: POP });
addCategory(
  'us-state-capitals',
  { pl: 'Podaj stolicę stanu USA', en: 'Name a US state capital' },
  places.filter((p) => p.FEATURECLA === 'Admin-1 capital' && p.ADM0NAME === 'United States of America').map(placeItem),
  { metric: POP },
);

/* ---------------- first-level administrative divisions ---------------- */
const a1 = raw('ne_10m_admin_1_states_provinces.geojson').features;
function admin1(admin, filter = () => true) {
  const feats = a1.filter((f) => f.properties.admin === admin && filter(f.properties));
  const pts = places.filter((p) => p.ADM0NAME === admin || p.SOV0NAME === admin);
  return feats.map((f) => {
    const p = f.properties;
    let pop = 0;
    for (const c of pts) if (geoContains(f, [c.LONGITUDE, c.LATITUDE])) pop += c.POP_MAX;
    let pl = clean(p.name_pl || p.name);
    if (/^[a-ząćęłńóśźż]/.test(pl)) pl = (p.type_en === 'Region' ? 'obwód ' : p.type_en === 'Territory' ? 'kraj ' : p.type_en === 'Autonomous Province' ? 'okręg ' : '') + pl;
    const names = [pl, p.name_pl, p.name, p.name_en, p.name_local, p.gn_name, p.woe_name, p.gns_name, ...(p.name_alt ? String(p.name_alt).split('|') : [])];
    return {
      pl,
      en: p.name_en || p.name,
      alt: [...names, ...names.map(stripAdmin)],
      metric: pop,
      tie: p.area_sqkm,
    };
  });
}
const stripAdmin = (s) =>
  clean(s)
    .replace(/^(Prowincja|Prefektura|Okręg|Departament|Stan|Region|Obwód|obwód|kraj|okręg|Province of|Provincia di|Provincia de|Prefecture)\s+/i, '')
    .replace(/\s+(Province|Prefecture|County|Department|State|Oblast|Krai|Governorate|prefecture|Region)$/i, '');
const URB = { pl: 'ludność miast w regionie', en: 'urban population in the region' };
const adminCats = [
  ['us-states', 'Podaj stan USA', 'Name a US state', 'United States of America', (p) => p.type_en === 'State'],
  ['mx-states', 'Podaj stan Meksyku', 'Name a Mexican state', 'Mexico', (p) => p.type_en],
  ['in-states', 'Podaj stan lub terytorium związkowe Indii', 'Name an Indian state or union territory', 'India', (p) => p.type_en],
  ['cn-provinces', 'Podaj prowincję, region autonomiczny lub miasto wydzielone Chin', 'Name a Chinese province, autonomous region or municipality', 'China', (p) => p.type_en],
  ['jp-prefectures', 'Podaj prefekturę Japonii', 'Name a Japanese prefecture', 'Japan', () => true],
  ['es-provinces', 'Podaj prowincję Hiszpanii', 'Name a Spanish province', 'Spain', (p) => p.type_en === 'Autonomous Community'],
  ['tr-provinces', 'Podaj prowincję Turcji', 'Name a Turkish province', 'Turkey', () => true],
  ['ru-subjects', 'Podaj podmiot federalny Rosji (obwód, republikę, kraj…)', 'Name a federal subject of Russia', 'Russia', () => true],
  ['fr-departments', 'Podaj departament Francji', 'Name a French department', 'France', () => true],
  ['it-provinces', 'Podaj prowincję Włoch', 'Name an Italian province', 'Italy', () => true],
  ['ng-states', 'Podaj stan Nigerii', 'Name a Nigerian state', 'Nigeria', () => true],
  ['ir-provinces', 'Podaj prowincję (ostan) Iranu', 'Name an Iranian province', 'Iran', () => true],
  ['co-departments', 'Podaj departament Kolumbii', 'Name a Colombian department', 'Colombia', (p) => p.type_en],
  ['th-provinces', 'Podaj prowincję Tajlandii', 'Name a Thai province', 'Thailand', () => true],
  ['vn-provinces', 'Podaj prowincję Wietnamu', 'Name a Vietnamese province', 'Vietnam', () => true],
  ['ph-provinces', 'Podaj prowincję Filipin', 'Name a Philippine province', 'Philippines', (p) => p.type_en === 'Province'],
  ['id-provinces', 'Podaj prowincję Indonezji', 'Name an Indonesian province', 'Indonesia', () => true],
  ['ro-counties', 'Podaj okręg (județ) Rumunii', 'Name a Romanian county', 'Romania', () => true],
  ['dz-provinces', 'Podaj prowincję (wilaję) Algierii', 'Name an Algerian province', 'Algeria', () => true],
];
for (const [id, pl, en, admin, filter] of adminCats) addCategory(id, { pl, en }, admin1(admin, filter), { note: NOTE_NE, metric: URB });

/* ---------------- chemical elements ---------------- */
const elementsRaw = raw('elements.json').elements.filter((e) => e.number <= 118);
const plNames = local('elements-pl.json');
const elements = elementsRaw.map((e) => ({
  z: e.number,
  period: e.period,
  category: e.category,
  item: { pl: plNames[e.number - 1], en: e.name, alt: [e.symbol, e.name === 'Aluminium' ? 'Aluminum' : '', e.name === 'Caesium' ? 'Cesium' : '', e.number === 13 ? 'aluminium' : ''], metric: -e.number },
}));
const Z = { pl: 'liczba atomowa (niższa = częstsza)', en: 'atomic number (lower = more common)' };
const el = (pred) => elements.filter(pred).map((e) => e.item);
addCategory('elements-all', { pl: 'Podaj pierwiastek chemiczny', en: 'Name a chemical element' }, el(() => true), { metric: Z });
addCategory('elements-1-30', { pl: 'Podaj pierwiastek o liczbie atomowej od 1 do 30', en: 'Name an element with atomic number 1–30' }, el((e) => e.z <= 30), { metric: Z });
addCategory('elements-31-60', { pl: 'Podaj pierwiastek o liczbie atomowej od 31 do 60', en: 'Name an element with atomic number 31–60' }, el((e) => e.z >= 31 && e.z <= 60), { metric: Z });
addCategory('elements-61-90', { pl: 'Podaj pierwiastek o liczbie atomowej od 61 do 90', en: 'Name an element with atomic number 61–90' }, el((e) => e.z >= 61 && e.z <= 90), { metric: Z });
addCategory('elements-period7', { pl: 'Podaj pierwiastek z 7. okresu układu okresowego', en: 'Name an element in period 7' }, el((e) => e.period === 7), { metric: Z });
addCategory('elements-period45', { pl: 'Podaj pierwiastek z 4. lub 5. okresu układu okresowego', en: 'Name an element in period 4 or 5' }, el((e) => e.period === 4 || e.period === 5), { metric: Z });
addCategory('elements-transition', { pl: 'Podaj metal przejściowy', en: 'Name a transition metal' }, el((e) => e.category.includes('transition metal') && !e.category.includes('post-')), { metric: Z });
addCategory('elements-f-block', { pl: 'Podaj lantanowiec lub aktynowiec', en: 'Name a lanthanide or actinide' }, el((e) => e.category === 'lanthanide' || e.category === 'actinide'), { metric: Z });
addCategory('elements-metals', { pl: 'Podaj pierwiastek będący metalem', en: 'Name an element that is a metal' }, el((e) => /metal|lanthanide|actinide/.test(e.category) && !/metalloid|nonmetal/.test(e.category)), { metric: Z });

/* ---------------- physical geography (Natural Earth) ---------------- */
const SCALE = { pl: 'ranga na mapie (ważniejsze = częstsze)', en: 'map rank (more prominent = more common)' };
const stripGeneric = (s) =>
  clean(s)
    .replace(/^(Morze|Zatoka|Cieśnina|Pustynia|Góry|Jezioro|Wyspa|Wyspy|Półwysep|Wyżyna|Płaskowyż|Lake|Lago|Lac|Sea of|Gulf of|Bay of|Strait of|Isla|Île|Mount|Mt\.?|Mont|Monte|Cerro|Pico)\s+/i, '')
    .replace(/\s+(Sea|Gulf|Bay|Strait|Desert|Mountains|Range|Lake|Island|Islands|Peninsula|Plateau|Mts\.?)$/i, '');
const geoItem = (p, metric, tie = 0) => {
  const names = [p.NAME ?? p.name, p.NAME_EN ?? p.name_en, p.NAME_PL ?? p.name_pl, ...(String(p.NAMEALT ?? p.namealt ?? p.name_alt ?? '').split('|'))];
  return { pl: p.NAME_PL ?? p.name_pl ?? p.NAME ?? p.name, en: p.NAME_EN ?? p.name_en ?? p.NAME ?? p.name, alt: [...names, ...names.map(stripGeneric)], metric, tie };
};
const marine = raw('ne_10m_geography_marine_polys.geojson').features.map((f) => ({ p: f.properties, area: geoArea(f) }));
addCategory(
  'seas',
  { pl: 'Podaj morze', en: 'Name a sea' },
  marine.filter((m) => m.p.featurecla === 'sea' && !/^Inner Seas?$|^Bo Hai$/.test(m.p.name)).map((m) => geoItem(m.p, -m.p.scalerank, m.area)),
  { note: NOTE_NE, metric: SCALE },
);
addCategory('gulfs', { pl: 'Podaj zatokę morską', en: 'Name a gulf or bay' }, marine.filter((m) => ['gulf', 'bay'].includes(m.p.featurecla)).map((m) => geoItem(m.p, -m.p.scalerank, m.area)), { note: NOTE_NE, metric: SCALE });
addCategory('straits', { pl: 'Podaj cieśninę morską', en: 'Name a strait' }, marine.filter((m) => m.p.featurecla === 'strait').map((m) => geoItem(m.p, -m.p.scalerank, m.area)), { note: NOTE_NE, metric: SCALE });

const regions = raw('ne_10m_geography_regions_polys.geojson').features.map((f) => ({ p: f.properties, area: geoArea(f) }));
const reg = (cla, regionsSet) => regions.filter((r) => r.p.FEATURECLA === cla && (!regionsSet || regionsSet.includes(r.p.REGION))).map((r) => geoItem(r.p, -r.p.SCALERANK, r.area));
addCategory('deserts', { pl: 'Podaj pustynię', en: 'Name a desert' }, reg('Desert'), { note: NOTE_NE, metric: SCALE });
addCategory('plateaus', { pl: 'Podaj wyżynę lub płaskowyż', en: 'Name a plateau or upland' }, reg('Plateau'), { note: NOTE_NE, metric: SCALE });
addCategory('ranges-asia', { pl: 'Podaj pasmo górskie w Azji', en: 'Name a mountain range in Asia' }, reg('Range/mtn', ['Asia']), { note: NOTE_NE, metric: SCALE });
addCategory('ranges-americas', { pl: 'Podaj pasmo górskie w obu Amerykach', en: 'Name a mountain range in the Americas' }, reg('Range/mtn', ['North America', 'South America']), { note: NOTE_NE, metric: SCALE });
addCategory('ranges-eu-af', { pl: 'Podaj pasmo górskie w Europie lub Afryce', en: 'Name a mountain range in Europe or Africa' }, reg('Range/mtn', ['Europe', 'Africa']), { note: NOTE_NE, metric: SCALE });
const AREA = { pl: 'powierzchnia', en: 'area' };
const islands = (rs) => regions.filter((r) => r.p.FEATURECLA === 'Island' && rs.includes(r.p.REGION)).map((r) => geoItem(r.p, r.area));
addCategory('islands-oceania', { pl: 'Podaj wyspę w Oceanii', en: 'Name an island in Oceania' }, islands(['Oceania']), { note: NOTE_NE, metric: AREA });
addCategory('islands-asia', { pl: 'Podaj wyspę w Azji', en: 'Name an island in Asia' }, islands(['Asia']), { note: NOTE_NE, metric: AREA });
addCategory('islands-namerica', { pl: 'Podaj wyspę w Ameryce Północnej (z Karaibami)', en: 'Name an island in North America (incl. Caribbean)' }, islands(['North America']), { note: NOTE_NE, metric: AREA });
addCategory('islands-europe', { pl: 'Podaj wyspę w Europie', en: 'Name an island in Europe' }, islands(['Europe']), { note: NOTE_NE, metric: AREA });
addCategory('archipelagos', { pl: 'Podaj archipelag w Oceanii lub Azji', en: 'Name an archipelago in Oceania or Asia' }, reg('Island group', ['Oceania', 'Asia']), { note: NOTE_NE, metric: SCALE });

const peaks = raw('ne_10m_geography_regions_elevation_points.geojson').features.map((f) => f.properties).filter((p) => p.featurecla === 'mountain' && p.elevation >= 5000);
addCategory('peaks-5000', { pl: 'Podaj szczyt o wysokości ponad 5000 m n.p.m.', en: 'Name a peak higher than 5,000 m' }, peaks.map((p) => geoItem(p, p.elevation)), { note: NOTE_NE, metric: { pl: 'wysokość', en: 'elevation' } });

const lakesRaw = raw('ne_10m_lakes.geojson').features.filter((f) => f.properties.featurecla !== 'Reservoir' && f.properties.name);
const lakeMap = new Map();
for (const f of lakesRaw) {
  const k = clean(f.properties.name);
  const prev = lakeMap.get(k) ?? { p: f.properties, area: 0 };
  prev.area += geoArea(f) * 6371 ** 2;
  lakeMap.set(k, prev);
}
addCategory(
  'lakes-2000',
  { pl: 'Podaj jezioro o powierzchni ponad 2000 km²', en: 'Name a lake larger than 2,000 km²' },
  [...lakeMap.values()].filter((l) => l.area > 2000 && !/Bay$|Channel$/.test(clean(l.p.name))).map((l) => geoItem(l.p, l.area)),
  { note: NOTE_NE, metric: AREA },
);

// Rivers: NE river centrelines, scalerank ≤ 5, local/branch names merged with a reviewed alias table
const riverAliases = local('rivers-pl.json');
const variantToCanon = new Map();
for (const [canon, names] of Object.entries(riverAliases)) if (canon !== '_comment') for (const n of [canon, ...names.slice(1)]) variantToCanon.set(n, canon);
const rivers = new Map();
for (const f of raw('ne_10m_rivers_lake_centerlines.geojson').features) {
  const p = f.properties;
  if (p.featurecla !== 'River' || !p.name || p.scalerank > 5) continue;
  const name = clean(p.name);
  if (/Branch|Delta|Protoka|Canal|Bratul|^Arm |^Tongariro$/.test(name)) continue;
  const len = geoLength(f) * 6371;
  const canon = variantToCanon.get(name) ?? name;
  const prev = rivers.get(canon) ?? { en: canon, pl: riverAliases[canon]?.[0] ?? (clean(p.name_en) || canon), alt: [], metric: -99, tie: 0 };
  prev.tie += len;
  prev.alt.push(name, clean(p.name_en), ...String(p.name_alt ?? '').split('|'), ...(riverAliases[canon] ?? []));
  prev.metric = Math.max(prev.metric, -p.scalerank);
  rivers.set(canon, prev);
}
addCategory('rivers', { pl: 'Podaj jedną z większych rzek świata', en: 'Name one of the world’s major rivers' }, [...rivers.values()], { note: { pl: 'rzeki z mapy Natural Earth 1:10 mln', en: 'rivers on the Natural Earth 1:10m map' }, metric: SCALE });

/* ---------------- output ---------------- */
fs.writeFileSync(path.join(root, 'public/data/depth.json'), JSON.stringify({ version: 1, categories }));
console.log(
  'categories',
  categories.length,
  'answers',
  categories.reduce((a, c) => a + c.answers.length, 0),
  'min',
  Math.min(...categories.map((c) => c.answers.length)),
);
for (const c of categories) console.log(c.id.padEnd(22), String(c.answers.length).padStart(4), c.answers.slice(0, 3).map((a) => a.pl).join(', '), '…', c.answers.filter((a) => !a.extra).slice(-2).map((a) => a.pl).join(', '));
