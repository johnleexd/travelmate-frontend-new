import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globePoint, globeQuality, globeZoom, shortestLongitude } from '../lib/discovery-globe.ts';
import { DISCOVERY_DESTINATIONS } from '../lib/discovery-destinations.ts';
import { existsSync, readFileSync } from 'node:fs';
import type { CountryPhotoManifest } from '../lib/discovery-country-photos.ts';

test('globe geography aligns with equirectangular UVs at the equator and poles', () => {
  assert.deepEqual(globePoint(0, 0), [1, 0, -0]);
  const east = globePoint(0, 90), north = globePoint(90, 0);
  assert.ok(Math.abs(east[0]) < 1e-10 && Math.abs(east[2] + 1) < 1e-10);
  assert.ok(Math.abs(north[1] - 1) < 1e-10);
  for (const destination of DISCOVERY_DESTINATIONS) {
    const point = globePoint(destination.latitude, destination.longitude);
    assert.ok(Math.abs(Math.hypot(...point) - 1) < 1e-10);
    assert.ok(Math.abs(Math.asin(point[1]) * 180 / Math.PI - destination.latitude) < 1e-8);
    assert.ok(Math.abs(Math.atan2(-point[2], point[0]) * 180 / Math.PI - destination.longitude) < 1e-8);
  }
});
test('destination coordinates retain existing GeoNames identities and licensed matching photographs', () => {
  const expected = [
    ['el-nido',1713917,11.18583,119.39556], ['tokyo',1850147,35.6895,139.69171],
    ['singapore',1880252,1.28967,103.85007], ['bangkok',1609350,13.75398,100.50144],
    ['paris',2988507,48.85341,2.3488], ['sydney',2147714,-33.86785,151.20732],
  ];
  assert.deepEqual(DISCOVERY_DESTINATIONS.map(d => [d.id,d.geonamesId,d.latitude,d.longitude]),expected);
  for (const destination of DISCOVERY_DESTINATIONS) {
    assert.equal(new URL(destination.photo.sourceUrl).host,'commons.wikimedia.org');
    assert.equal(new URL(destination.photo.licenseUrl).host,'creativecommons.org');
    assert.ok(destination.photo.creator && destination.highlights.length);
    assert.doesNotMatch(destination.photo.url, /flag|unsplash\.com\/random/i);
  }
});
test('focus crosses the date line by the shortest path, even after multiple rotations', () => {
  assert.equal(shortestLongitude(170,-170),190);
  assert.equal(shortestLongitude(-170,170),-190);
  assert.equal(shortestLongitude(1250,151),1231);
  assert.equal(shortestLongitude(-1250,151),-1289);
});

test('every country has its own licensed cached photograph and failures are explicitly reported', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/discovery/country-photos.v2.json', import.meta.url), 'utf8')) as CountryPhotoManifest;
  const countries = JSON.parse(readFileSync(new URL('../public/discovery/countries-10m.v5.1.2.json', import.meta.url), 'utf8')) as {code:string}[];
  assert.equal(manifest.total, countries.length);
  assert.equal(manifest.countries.length, countries.length);
  assert.equal(new Set(manifest.countries.map(country => country.code)).size, countries.length);
  for (const code of manifest.isoCodes) assert.equal(manifest.countries.find(country => country.code === code)?.status, 'ready', code);
  for (const country of manifest.countries) {
    if (country.status === 'unresolved') {
      assert.ok(manifest.unresolved.some(item => item.code === country.code));
      assert.equal(country.photos.length, 0);
      continue;
    }
    assert.ok(country.photos.length > 0, country.code);
    for (const photo of country.photos) {
      assert.ok(photo.src.startsWith('/discovery/country-photos/' + country.code + '-'), country.code);
      assert.ok(existsSync(new URL('../public' + photo.src, import.meta.url)), country.code);
      assert.ok(photo.creator && photo.alt && photo.title && photo.license);
      assert.equal(new URL(photo.sourceUrl).hostname, 'commons.wikimedia.org');
      assert.equal(new URL(photo.licenseUrl).hostname, 'creativecommons.org');
      assert.ok(photo.evidence.includes('wikidata.org') || (['curated','reviewed-destination'].includes(photo.origin) && new URL(photo.evidence).hostname === 'commons.wikimedia.org'));
      assert.doesNotMatch(photo.title, /\b(flag|locator map|coat of arms)\b/i);
    }
  }
});

test('zoom and constrained-device rendering stay bounded', () => {
  assert.equal(globeZoom(0),2.9); assert.equal(globeZoom(10),4.1);
  assert.equal(globeZoom(3),3);
  assert.equal(globeQuality(true).texture,1024);
  assert.ok(globeQuality(true).maxDpr < globeQuality(false).maxDpr);
  assert.equal(globeQuality(true).fps,30);
});
