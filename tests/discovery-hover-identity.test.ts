import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { discoveryCountryFlag } from '../lib/discovery-country-flags.ts';
import { countryBoundaryPositions } from '../lib/discovery-globe.ts';
import type { Country } from '../lib/discovery-countries.ts';
const countries=JSON.parse(readFileSync(new URL('../public/discovery/countries-10m.v5.1.2.json',import.meta.url),'utf8')) as Country[];

test('country flags resolve only by stable country codes to bundled assets',()=>{
  for(const country of countries){
    const flag=discoveryCountryFlag(country.code);
    if(flag)assert.ok(existsSync(new URL('../public'+flag,import.meta.url)),country.code);
    if(/^[A-Z]{2}$/.test(country.code)&&country.code!=='AQ')assert.equal(flag,'/flags/'+country.code.toLowerCase()+'.svg');
  }
  assert.equal(discoveryCountryFlag('WD-Q34754'),'/discovery/flags/somaliland.svg');
  assert.equal(discoveryCountryFlag('WD-Q23681'),'/discovery/flags/northern-cyprus.svg');
  assert.equal(discoveryCountryFlag('AQ'),null);
  assert.equal(discoveryCountryFlag('WD-Q620634'),null);
  assert.equal(discoveryCountryFlag('not-a-country'),null);
});

test('every country produces finite border geometry just above Earth',()=>{
  for(const country of countries){
    const positions=countryBoundaryPositions(country);
    assert.ok(positions.length>0,country.code);assert.equal(positions.length%6,0);
    for(let i=0;i<positions.length;i+=3){
      assert.ok(Math.abs(Math.hypot(positions[i],positions[i+1],positions[i+2])-1.005)<1e-6,country.code);
    }
  }
});

test('border geometry retains holes and islands without drawing the antimeridian clipping seam',()=>{
  const outer:[number,number][]=[[179,10],[180,10],[180,12],[179,12],[179,10]];
  const hole:[number,number][]=[[179.2,10.2],[179.4,10.2],[179.4,10.4],[179.2,10.2]];
  const coast=countryBoundaryPositions({polygons:[[outer]]});
  const withHole=countryBoundaryPositions({polygons:[[outer,hole]]});
  assert.ok(withHole.length>coast.length);
  for(let i=0;i<coast.length;i+=6){
    const a=Math.atan2(-coast[i+2],coast[i])*180/Math.PI;
    const b=Math.atan2(-coast[i+5],coast[i+3])*180/Math.PI;
    assert.ok(!(Math.abs(Math.abs(a)-180)<1e-4&&Math.abs(Math.abs(b)-180)<1e-4));
  }
});
