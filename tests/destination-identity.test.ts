import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedDestinationAnchor, savedDestinationAnchor } from '../lib/destination-identity.ts';

test('selected PSGC identity survives serialization and reopening rather than becoming an anonymous saved point', () => {
  const place={id:1000702233000,name:'Moalboal',region:'Cebu',country:'Philippines',countryCode:'PH',latitude:9.91667,longitude:123.43333,label:'Moalboal, Cebu, Philippines',placeType:'Municipality',contextLabel:'Moalboal, Cebu, Philippines — Municipality',provider:'psgc' as const,providerId:'0702233000',administrativeCode:'0702233000',provinceCode:'0702200000',geographicProvinceCode:'0702200000',administrativeLevel:'Municipality' as const,coordinateSource:'https://www.geonames.org/1699455'};
  const selected=selectedDestinationAnchor(place);
  const stored=JSON.parse(JSON.stringify({grounding:{destination:selected}}));
  assert.deepEqual(savedDestinationAnchor(stored),selected);
  assert.equal(savedDestinationAnchor(stored)?.providerId,'0702233000');
  assert.equal(savedDestinationAnchor(stored)?.latitude,9.91667);
});

test('unresolved catalogue entries cannot supply invented generation coordinates; old saved destinations do not invent IDs', () => {
  const legacy={id:0,name:'Old trip',region:'',country:'Philippines',countryCode:'PH',label:'Old trip',placeType:'Saved destination',contextLabel:'Saved destination'};
  assert.equal(selectedDestinationAnchor(legacy),undefined);
  assert.equal(selectedDestinationAnchor({...legacy,latitude:10,longitude:123})?.id,undefined);
  assert.equal(savedDestinationAnchor({days:[]}),undefined);
});
