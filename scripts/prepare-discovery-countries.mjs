// Offline preparation; runtime discovery never contacts a geographic API.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = process.argv[2];
if (!source) throw new Error('Pass ne_50m_admin_0_countries.geojson from Natural Earth v5.1.2');
const bytes = await fs.readFile(source);
const data = JSON.parse(bytes);
const countries = data.features.map(({ properties: p, geometry: g }) => ({
  id: p.ADM0_A3, name: p.NAME_EN || p.NAME_LONG, code: p.ISO_A2_EH,
  center: [p.LABEL_X, p.LABEL_Y].map(n => Number(n.toFixed(4))),
  polygons: (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map(polygon =>
    polygon.map(ring => ring.map(point => point.slice(0, 2).map(n => Number(n.toFixed(4)))))),
})).sort((a, b) => a.name.localeCompare(b.name, 'en'));
await fs.writeFile('public/discovery/countries-50m.v5.1.2.json', JSON.stringify(countries));
await fs.writeFile('public/discovery/countries-NOTICE.txt',
  'Natural Earth v5.1.2, 1:50m Admin-0 countries. 242 countries and territories.\n' +
  'Source: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson\n' +
  'Source SHA256: ' + createHash('sha256').update(bytes).digest('hex') + '\n' +
  'Public domain: https://www.naturalearthdata.com/about/terms-of-use/\n' +
  'Only names, identifiers, label coordinates and polygons retained; coordinates rounded to four decimal places.\n' +
  'Generalized discovery boundaries, not a navigation or legal boundary dataset. Some tiny islands are omitted at this scale.\n');
console.log('Prepared', countries.length, 'countries and territories');
