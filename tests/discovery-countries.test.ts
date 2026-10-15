import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countryAt, smallCountryAt, indexCountries, type Country } from '../lib/discovery-countries.ts';
const countries: Country[] = JSON.parse(readFileSync(new URL('../public/discovery/countries-10m.v5.1.2.json', import.meta.url), 'utf8'));
const index = indexCountries(countries);
test('worldwide discovery uses unique dataset identities and valid geographic boundaries', () => {
  assert.ok(countries.length >= 250);
  assert.equal(new Set(countries.map(c => c.id)).size, countries.length);
  assert.equal(new Set(countries.map(c => c.code)).size, countries.length);
  for (const country of countries) {
    assert.ok(country.name && country.polygons.length);
    for (const polygon of country.polygons) for (const ring of polygon) {
      assert.ok(ring.length >= 4);
      for (const [x, y] of ring) assert.ok(Math.abs(x) <= 180 && Math.abs(y) <= 90);
    }
  }
});
test('indexed picking recognizes actual locations across all inhabited continents', () => {
  for (const [lat, lon, code] of [
    [45.42,-75.69,'CA'], [38.9,-77.04,'US'], [-15.79,-47.88,'BR'],
    [52.52,13.41,'DE'], [30.04,31.24,'EG'], [-1.29,36.82,'KE'],
    [35.69,139.69,'JP'], [-25.28,133.78,'AU'], [1.35,103.82,'SG'],
  ] as const) assert.equal(countryAt(index,lat,lon)?.code,code);
});
test('split antimeridian polygons resolve both sides without connecting across the Pacific', () => {
  assert.equal(countryAt(index,67,179)?.code,'RU');
  assert.equal(countryAt(index,67,-179)?.code,'RU');
  assert.equal(countryAt(index,67,539)?.code,'RU');
  assert.equal(countryAt(index,0,180),null);
  assert.equal(countryAt(index,0,0),null);
});
test('enclaves respect polygon holes, oceans and invalid input remain unselected', () => {
  assert.equal(countryAt(index,-29.32,27.48)?.code,'LS');
  assert.equal(countryAt(index,-28,28)?.code,'ZA');
  assert.equal(countryAt(index,NaN,0),null);
  assert.equal(countryAt(index,91,0),null);
  assert.equal(countryAt(index,0,Infinity),null);
});

test('small states and island countries keep physical polygons and usable invisible hit areas', () => {
  const samples = [
    ['VA',41.9029,12.4534],['MC',43.7384,7.4246],['SM',43.936,12.447],['LI',47.14,9.52],['AD',42.5078,1.5211],
    ['MT',35.899,14.514],['SG',1.35,103.82],['MV',4.1755,73.5093],['SC',-4.62,55.45],['MU',-20.16,57.5],
    ['CV',14.92,-23.51],['ST',.34,6.73],['NR',-.525,166.933],['TV',-8.5167,179.2167],['TO',-21.139,-175.2],
    ['KI',1.33,172.98],['BB',13.1,-59.61],['LC',14.01,-60.99],['GD',12.05,-61.75],['KN',17.3,-62.72],
    ['DM',15.3,-61.39],['AG',17.12,-61.85],['UM',28.21,-177.37],
  ] as const;
  for(const [code,lat,lon] of samples) {
    const country=countries.find(country=>country.code===code);
    assert.ok(country,code);
    const detected=countryAt(index,lat,lon) || smallCountryAt(index,lat,lon,.4);
    assert.equal(detected?.code,code,code+' geographic detection');
    assert.ok(index.smallTargets.some(target=>target.country.code===code),code+' invisible hit target');
  }
  assert.equal(smallCountryAt(index,0,-140,.8),null);
});
