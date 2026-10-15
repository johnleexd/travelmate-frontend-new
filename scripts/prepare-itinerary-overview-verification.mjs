import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const capture = JSON.parse(await readFile('e2e/fixtures/gimcheon-reopened-trip.json', 'utf8'));
const folder = '../audit/2026-10-15/itinerary-overview/photos';
await mkdir(folder, { recursive: true });
const found = new Map();
function collect(value) {
  if (!value || typeof value !== 'object') return;
  if (value.imageUrl && value.imageAttribution && value.place?.name) found.set(value.imageUrl, { name: value.place.name, src: value.imageUrl, attribution: value.imageAttribution });
  Object.values(value).forEach(item => Array.isArray(item) ? item.forEach(collect) : collect(item));
}
collect(capture);
const records = [];
for (const photo of [...found.values()].slice(0, 3)) {
  const response = await fetch(photo.src, { headers: { 'User-Agent': 'TravelMate layout verification (stored Commons photo)' }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw Error(`Stored photo returned HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const { width, height } = await sharp(buffer).metadata();
  const filename = `saved-photo-${records.length + 1}.jpg`;
  await writeFile(`${folder}/${filename}`, buffer);
  records.push({ ...photo, filename, width, height, sha256: createHash('sha256').update(buffer).digest('hex') });
}
// Extra aspect-ratio checks use actual licensed provider photos, never mockup art.
const params = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrsearch: 'Hachiko', gsrnamespace: '6', gsrlimit: '100', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '960' });
const query = await fetch('https://commons.wikimedia.org/w/api.php?' + params, { headers: { 'User-Agent': 'TravelMate layout verification' }, signal: AbortSignal.timeout(25000) });
if (!query.ok) throw Error('Photo metadata search returned HTTP ' + query.status);
const pages = Object.values((await query.json()).query?.pages || {});
for (const orientation of ['portrait', 'square']) {
  const page = pages.find(page => {
    const info = page.imageinfo?.[0], license = info?.extmetadata?.LicenseShortName?.value || '';
    return info && /CC BY(?:-SA)? [234]|Public domain|CC0/.test(license) && !/NC|ND/.test(license) &&
      /Shibuya|Hachiko|ハチ公/i.test(page.title) && /\.(?:jpg|jpeg)$/i.test(page.title) && (orientation === 'portrait' ? info.height > info.width * 1.2 : info.width === info.height);
  });
  if (!page) { console.log('No licensed ' + orientation + ' photo in this provider page'); continue; }
  const info = page.imageinfo[0], meta = info.extmetadata;
  const src = info.thumburl || info.url;
  const image = await fetch(src, { headers: { 'User-Agent': 'TravelMate layout verification' }, signal: AbortSignal.timeout(25000) });
  if (!image.ok) throw Error('Photo returned HTTP ' + image.status);
  const buffer = Buffer.from(await image.arrayBuffer()), size = await sharp(buffer).metadata();
  const filename = `provider-${orientation}.jpg`;
  await writeFile(`${folder}/${filename}`, buffer);
  const strip = value => value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
  records.push({ name: page.title.replace(/^File:/, ''), src, filename, width: size.width, height: size.height, attribution: { creator: strip(meta.Artist?.value || meta.Credit?.value || ''), license: meta.LicenseShortName.value, licenseUrl: meta.LicenseUrl?.value, sourceUrl: info.descriptionurl, ...(orientation === 'square' ? { illustrative: true, photoType: 'illustrative' } : {}) }, sha256: createHash('sha256').update(buffer).digest('hex') });
}
await writeFile(`${folder}/sources.json`, JSON.stringify(records, null, 2));
console.log(records.map(({ name, width, height }) => ({ name, width, height })));
