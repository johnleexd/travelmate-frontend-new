import test from 'node:test';
import assert from 'node:assert/strict';
import { isDestinationLocality, needsDestinationArea } from '../lib/generated/location-scope.ts';

test('locality selection is independent of display labels or child availability in every country',()=>{
  for(const placeType of ['Town (Zhen)','City (Shi)','Municipality','Commune','Administrative area','Region']) {
    const place={placeType,scopeType:'locality' as const};
    assert.equal(isDestinationLocality(place),true);assert.equal(needsDestinationArea(place),false);
  }
  for(const scopeType of ['area','country'] as const) {
    assert.equal(isDestinationLocality({placeType:'Town',scopeType}),false);
    assert.equal(needsDestinationArea({placeType:'Town',scopeType}),true);
  }
  assert.equal(isDestinationLocality({placeType:'Town'}),true);
  assert.equal(isDestinationLocality({placeType:'Independent city'}),true);
  assert.equal(isDestinationLocality({placeType:'Administrative division (level 4; local type not supplied)'}),false);
  assert.equal(isDestinationLocality({placeType:'Regency / city (local type not supplied)'}),false);
  assert.equal(isDestinationLocality({placeType:'Province / metropolitan city (Si / Do)'}),false);
  assert.equal(needsDestinationArea({placeType:'Province'}),true);
  assert.equal(isDestinationLocality({placeType:'Island',scopeType:'natural'}),false);
  assert.equal(needsDestinationArea({placeType:'Island',scopeType:'natural'}),true);
});
