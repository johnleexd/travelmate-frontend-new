// Build-time Wikimedia provider cache. No keys, random image searches, or runtime API dependence.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, execFile } from 'node:child_process';
import sharp from 'sharp';

const audit = path.resolve('../audit/2026-10-15/globe-worldwide');
const cache = path.join(audit, 'provider-cache');
fs.mkdirSync(cache, { recursive: true });
const photosDir = 'public/discovery/country-photos';
fs.mkdirSync(photosDir, { recursive: true });
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function writeJsonAtomic(file, value) {
  fs.writeFileSync(file + '.tmp', JSON.stringify(value));
  fs.renameSync(file + '.tmp', file);
}
function download(url, file) {
  if (!fs.existsSync(file)) {
    const temp = file + '.partial';
    try {
      execFileSync('curl.exe', ['-fsSL', '--retry', '2', '--retry-delay', '2', '--max-time', '65', '-A', 'TravelMate/1.0 (country discovery; Wikimedia asset attribution retained)', '-o', temp, url], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      fs.renameSync(temp, file);
    } catch (error) { if (fs.existsSync(temp)) fs.unlinkSync(temp); throw error; }
  }
  return file;
}
function json(host, params) {
  const url = host + '/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  const file = path.join(cache, createHash('sha256').update(url).digest('hex') + '.json');
  const result = read(download(url, file));
  if (result.error) throw new Error(JSON.stringify(result.error));
  return result;
}
const pendingDownloads = new Map();
function downloadImage(url, file) {
  if (fs.existsSync(file)) return Promise.resolve(file);
  if (pendingDownloads.has(file)) return pendingDownloads.get(file);
  const promise = new Promise((resolve, reject) => {
    const temp = file + '.partial';
    execFile('curl.exe', ['-fsSL', '--retry', '2', '--retry-delay', '2', '--max-time', '55', '-A', 'TravelMate/1.0 country-photo-cache', '-o', temp, url], { windowsHide: true }, error => {
      if (error) { if (fs.existsSync(temp)) fs.unlinkSync(temp); reject(error); }
      else { fs.renameSync(temp, file); resolve(file); }
    });
  });
  pendingDownloads.set(file, promise);
  return promise;
}
const value = (entity, prop) => (entity?.claims?.[prop] || []).filter(c => c.rank !== 'deprecated' && !c.qualifiers?.P582?.some(q => q.datavalue?.value?.time && Number(q.datavalue.value.time.slice(1, 5)) <= 2026)).map(c => c.mainsnak?.datavalue?.value).filter(v => v !== undefined);
const plain = value => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim() : '';
const iso = read(path.join(audit, 'iso-countries.json'));
const original = read(path.join(audit, 'ne_10m_admin_0_countries.geojson'));
const unitsBytes = fs.readFileSync(path.join(audit, 'ne_10m_admin_0_map_units.geojson'));
const units = JSON.parse(unitsBytes);
const registry = new Map();
const features = new Map();
for (const feature of units.features) {
  const p = feature.properties;
  // NE tags US minor islands as US; ISO assigns these nine units their own code UM.
  const code = p.ADM0_A3 === 'UMI' ? 'UM' : iso.some(country => country.cca2 === p.ISO_A2_EH) ? p.ISO_A2_EH : 'WD-' + p.WIKIDATAID;
  // Wake has both a disputed-area and ISO UM feature with the same physical geometry.
  if (p.GU_A3 === 'PGA') continue;
  if (!features.has(code)) features.set(code, []);
  features.get(code).push(feature);
}
// ISO aggregate identities differ from NE's constituent-area identity in these cases.
const identityOverrides = { UM: 'Q16645', PS: 'Q219060', NL: 'Q29999', SH: 'Q19740003', SJ: 'Q842829' };
for (const [code, list] of features) {
  const reference = iso.find(c => c.cca2 === code);
  const primary = original.features.find(f => f.properties.ISO_A2_EH === code);
  const p = list[0].properties;
  registry.set(code, { code, id: reference?.cca3 || p.GU_A3, name: reference?.name.common || p.NAME_EN,
    wikidataId: identityOverrides[code] || primary?.properties.WIKIDATAID || p.WIKIDATAID,
    center: [primary?.properties.LABEL_X ?? p.LABEL_X, primary?.properties.LABEL_Y ?? p.LABEL_Y].map(n => Number(n.toFixed(5))),
    polygons: list.flatMap(f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
      .map(polygon => polygon.map(ring => ring.map(point => point.slice(0, 2).map(n => Number(n.toFixed(5)))))) });
}
const countries = [...registry.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
const missingCodes = iso.filter(c => !registry.has(c.cca2)).map(c => c.cca2);
if (missingCodes.length) throw new Error('Geometry missing for ' + missingCodes.join(', '));
writeJsonAtomic('public/discovery/countries-10m.v5.1.2.json', countries);
fs.writeFileSync('public/discovery/countries-NOTICE.txt', `Natural Earth v5.1.2, 1:10m Admin-0 map units, grouped by stable ISO 3166-1 alpha-2 codes. Includes all 249 ISO countries/territories, Kosovo (XK), and separately identified non-ISO geographic areas (WD-Q identifiers).\nSource: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_map_units.geojson\nSHA256: ${createHash('sha256').update(unitsBytes).digest('hex')}\nISO reference: https://github.com/mledoze/countries (249 ISO entries plus XK). UM geometry aggregates the nine US minor outlying islands; the duplicate disputed Wake feature is deduplicated. Coordinates rounded to five decimal places; holes and antimeridian splits retained.\nPublic domain: https://www.naturalearthdata.com/about/terms-of-use/\nGeneralized geographic discovery, not legal boundaries or navigation.\n`);
console.log('Geometry:', countries.length, 'areas;', iso.length, 'country codes, no omissions');

const entities = {};
const warmMetadata = new Map();
for (const file of fs.readdirSync(cache).filter(name => name.endsWith('.json'))) {
  const cached = read(path.join(cache, file));
  if (cached.entities) Object.assign(entities, cached.entities);
  for (const page of Object.values(cached.query?.pages || {})) if (page.imageinfo?.[0]) warmMetadata.set(page.title.replaceAll('_', ' '), page);
  for (const redirect of [...(cached.query?.redirects || []), ...(cached.query?.normalized || [])].reverse()) if (warmMetadata.has(redirect.to)) warmMetadata.set(redirect.from.replaceAll('_', ' '), warmMetadata.get(redirect.to));
}
function loadEntities(ids) {
  const unique = [...new Set(ids)].filter(id => /^Q\d+$/.test(id) && !entities[id]);
  for (let offset = 0; offset < unique.length; offset += 35) {
    const ids = unique.slice(offset, offset + 35);
    Object.assign(entities, json('https://www.wikidata.org', { action: 'wbgetentities', ids: ids.join('|'), props: 'claims|labels|sitelinks', languages: 'en' }).entities);
    console.log('Country identity cache', Math.min(offset + 35, unique.length), '/', unique.length);
  }
}
loadEntities(countries.map(c => c.wikidataId));
// Landmarks/capitals are considered only when P17 explicitly links back to the country entity.
loadEntities(countries.flatMap(c => value(entities[c.wikidataId], 'P36').map(v => v.id)));
const curatedPath = 'scripts/discovery-photo-overrides.json';
const curated = fs.existsSync(curatedPath) ? read(curatedPath) : {};
const candidates = [];
const rejectedIdentity = [];
for (const country of countries) {
  const entity = entities[country.wikidataId];
  const codeClaims = value(entity, 'P297');
  const verified = country.code.startsWith('WD-') || codeClaims.includes(country.code);
  if (!verified) { rejectedIdentity.push({ code: country.code, name: country.name, entity: country.wikidataId, actualCodes: codeClaims }); continue; }
  for (const item of curated[country.code] || []) candidates.push({ code: country.code, file: item.file, evidence: item.evidence, origin: 'curated' });
  for (const property of ['P948', 'P18']) for (const file of value(entity, property)) if (typeof file === 'string')
    candidates.push({ code: country.code, file, evidence: `https://www.wikidata.org/wiki/${country.wikidataId}#${property}`, origin: property === 'P948' ? 'country-banner' : 'country-image' });
  for (const capital of value(entity, 'P36')) {
    const capitalEntity = entities[capital.id];
    if (!value(capitalEntity, 'P17').some(v => v.id === country.wikidataId)) continue;
    for (const file of value(capitalEntity, 'P18')) if (typeof file === 'string') candidates.push({ code: country.code, file, evidence: `https://www.wikidata.org/wiki/${capital.id}#P17`, origin: 'verified-capital' });
  }
}
const safeFile = file => /\.(jpe?g|png|webp)$/i.test(file) && !/\b(flag|coat of arms|locator|map|logo|seal|blank|drawing|illustration|collage|montage|AI.generated)\b|default.*banner/i.test(file.replaceAll('_', ' '));
const files = [...new Set(candidates.filter(c => safeFile(c.file)).map(c => 'File:' + c.file.replaceAll('_', ' ')))];
const metadata = new Map(warmMetadata);
const missingMetadata = files.filter(file => !metadata.has(file));
for (let offset = 0; offset < missingMetadata.length; offset += 25) {
  const result = json('https://commons.wikimedia.org', { action: 'query', titles: missingMetadata.slice(offset, offset + 25).join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: '960', redirects: '1' });
  for (const page of Object.values(result.query?.pages || {})) if (page.imageinfo?.[0]) metadata.set(page.title.replaceAll('_', ' '), page);
  // Follow Commons' explicit normalized titles and redirect chain, rather than guessing a filename.
  for (const redirect of [...(result.query?.redirects || []), ...(result.query?.normalized || [])].reverse()) if (metadata.has(redirect.to)) metadata.set(redirect.from.replaceAll('_', ' '), metadata.get(redirect.to));
  console.log('License metadata', Math.min(offset + 25, missingMetadata.length), '/', missingMetadata.length, 'new files');
}
const manifest = { version: 2, preparedAt: new Date().toISOString(), provider: 'Wikimedia Commons / Wikidata', total: countries.length, isoCodes: iso.map(c => c.cca2).sort(), countries: [], unresolved: [], rejectedIdentity };
const rejectionLog = [];
let nextCountry = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
while (nextCountry < countries.length) {
  const country = countries[nextCountry++];
  const entry = { code: country.code, id: country.id, name: country.name, wikidataId: country.wikidataId, status: 'unresolved', photos: [] };
  for (const candidate of candidates.filter(c => c.code === country.code && safeFile(c.file))) {
    const page = metadata.get('File:' + candidate.file.replaceAll('_', ' '));
    const info = page?.imageinfo?.[0], meta = info?.extmetadata || {};
    const creator = plain(meta.Artist?.value), license = plain(meta.LicenseShortName?.value), title = plain(meta.ObjectName?.value) || candidate.file;
    const src = info?.thumburl || info?.url;
    if (!creator || !/^(CC BY(?:-SA)? [\d.]+|CC0(?: 1\.0)?|Public domain)$/i.test(license) || plain(meta.Restrictions?.value)
      || !/^image\/(jpeg|png|webp)$/.test(info?.mime || '') || !/^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\//.test(src || '')
      || !info?.width || info.width < 320 || (info.width < info.height && candidate.origin !== 'curated')
      || /always.{0,30}visible|on the picture|in the picture|on the image|immediately next to/i.test(plain(meta.Permission?.value))
      || /(?:^|\|)(?:Maps of|Locator maps|Topographic maps|Political maps)\b/i.test(plain(meta.Categories?.value))
      || /\b(AI.generated|AI generated|drawing|illustration|locator map)\b/i.test(plain(meta.ImageDescription?.value))) {
      rejectionLog.push({ code: country.code, file: candidate.file, reason: 'Photo/landscape/license validation failed', creator, license }); continue;
    }
    if (entry.photos.some(photo => photo.sourceUrl === info.descriptionurl)) continue;
    try {
      const filename = country.code.replaceAll(/[^A-Za-z0-9-]/g, '-') + '-' + createHash('sha256').update(src + ':entropy-480x300-v1').digest('hex').slice(0, 12) + '.webp';
      const output = path.join(photosDir, filename);
      const original = path.join(cache, createHash('sha256').update(src).digest('hex') + '.image');
      if (!fs.existsSync(output)) await sharp(await downloadImage(src, original)).resize(480, 300, { fit: 'cover', position: sharp.strategy.entropy }).webp({ quality: 82 }).toFile(output);
      const cc = license.match(/^CC (BY(?:-SA)?) ([\d.]+)$/i);
      const licenseUrl = cc ? `https://creativecommons.org/licenses/${cc[1].toLowerCase()}/${cc[2]}/` : /^CC0/.test(license) ? 'https://creativecommons.org/publicdomain/zero/1.0/' : 'https://creativecommons.org/publicdomain/mark/1.0/';
      entry.photos.push({ src: '/discovery/country-photos/' + filename, providerUrl: src, title, alt: `${title} — ${country.name}`, creator, license, licenseUrl,
        sourceUrl: info.descriptionurl, evidence: candidate.evidence, origin: candidate.origin, description: plain(meta.ImageDescription?.value).slice(0, 1200),
        changes: 'Resized and cropped to 480 × 300, encoded as WebP; adaptations retain the linked license.' });
      if (entry.photos.length >= 2) break;
    } catch (error) { rejectionLog.push({ code: country.code, file: candidate.file, reason: 'Download failed: ' + error.message.slice(0, 250) }); }
  }
  if (entry.photos.length) entry.status = 'ready';
  else manifest.unresolved.push({ code: country.code, name: country.name, wikidataId: country.wikidataId, reason: rejectedIdentity.some(c => c.code === country.code) ? 'Country identity code mismatch' : country.code === 'WD-Q620634' ? 'Only annotated map imagery was verified; no suitable destination photograph' : 'No verified licensed photograph could be cached' });
  manifest.countries.push(entry);
  // Keep partial runs out of the live app; publish the complete audited snapshot atomically.
  writeJsonAtomic(path.join(audit, 'photo-progress.json'), manifest);
  console.log(country.code, country.name, entry.status, entry.photos.length);
}
}));
manifest.countries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
writeJsonAtomic('public/discovery/country-photos.v2.json', manifest);
fs.writeFileSync(path.join(audit, 'photo-rejections.json'), JSON.stringify(rejectionLog, null, 2));
fs.writeFileSync(path.join(audit, 'coverage.json'), JSON.stringify({ total: manifest.total, ready: manifest.countries.filter(c => c.status === 'ready').length, unresolved: manifest.unresolved, rejectedIdentity }, null, 2));
console.log('COVERAGE', manifest.total - manifest.unresolved.length, '/', manifest.total, JSON.stringify(manifest.unresolved));
