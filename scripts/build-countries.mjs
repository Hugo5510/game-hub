// Natural Earth 1:50m Admin 0 countries -> compact TopoJSON + metadata (PL/EN names).
import fs from 'node:fs';
import path from 'node:path';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { quantize } from 'topojson-client';
import { geoArea, geoCentroid } from 'd3-geo';

const root = path.resolve(import.meta.dirname, '..');
const src = JSON.parse(fs.readFileSync(path.join(root, 'data-raw/ne_50m_admin_0_countries.geojson'), 'utf8'));
const R = 6371;
const features = src.features
  .filter((f) => f.properties.ADM0_A3 !== 'ATA' || true)
  .map((f) => {
    const p = f.properties;
    const id = p.ADM0_A3;
    const names = new Set([p.NAME_PL, p.NAME_EN, p.NAME, p.NAME_LONG, p.ADMIN, p.FORMAL_EN, p.NAME_ALT, p.BRK_NAME, p.GEOUNIT, p.SUBUNIT].filter((x) => typeof x === 'string' && x.trim()));
    return {
      type: 'Feature',
      id,
      properties: {
        pl: p.NAME_PL,
        en: p.NAME_EN,
        aliases: [...names],
        type: p.TYPE,
        continent: p.CONTINENT,
        subregion: p.SUBREGION,
        pop: p.POP_EST,
        labelrank: p.LABELRANK,
        lx: p.LABEL_X,
        ly: p.LABEL_Y,
        area: Math.round(geoArea(f) * R * R),
      },
      geometry: f.geometry,
    };
  });

let topo = topology({ countries: { type: 'FeatureCollection', features } });
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, 0.8));
topo = quantize(topo, 1e5);
// strip properties out of topology into a separate metadata list for fast loading
const meta = topo.objects.countries.geometries.map((g) => ({ id: g.id, ...g.properties }));
for (const g of topo.objects.countries.geometries) delete g.properties;
fs.writeFileSync(path.join(root, 'public/data/countries-50m.topo.json'), JSON.stringify(topo));
fs.writeFileSync(path.join(root, 'src/data/countries-meta.json'), JSON.stringify(meta));
console.log('countries', meta.length, 'topo bytes', JSON.stringify(topo).length);
