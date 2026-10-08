import { test } from 'node:test';
import assert from 'node:assert/strict';
import { longitudeNear, mapCoordinates, straightLineDistanceKm, tripDirectionsUrl, tripMapDestination } from '../lib/trip-map.ts';

test('saved destination coordinates are validated, with recorded grounding as the legacy fallback', () => {
  assert.deepEqual(mapCoordinates({ latitude: 0, longitude: 0 }), { latitude: 0, longitude: 0 });
  for (const value of [{ latitude: '14', longitude: 121 }, { latitude: NaN, longitude: 121 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }, { latitude: 0, longitude: -181 }]) assert.equal(mapCoordinates(value), null);
  const destination = { latitude: 14.5995, longitude: 120.9842 };
  assert.deepEqual(tripMapDestination(destination, { latitude: 35, longitude: 139 }), destination);
  assert.deepEqual(tripMapDestination({}, destination), destination);
  assert.equal(tripMapDestination({}), null);
});

test('directions use actual coordinates and encode legacy names without inventing an origin', () => {
  const destination = { latitude: 14.5995, longitude: 120.9842 };
  const origin = { latitude: 10.25, longitude: 123.95 };
  const url = new URL(tripDirectionsUrl('Manila', destination, origin));
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('origin'), '10.25,123.95');
  assert.equal(url.searchParams.get('destination'), '14.5995,120.9842');
  const legacy = new URL(tripDirectionsUrl('Museum & City, France', null, null));
  assert.equal(legacy.searchParams.get('destination'), 'Museum & City, France');
  assert.equal(legacy.searchParams.has('origin'), false);
});

test('straight-line distances remain finite at identical points, poles and antipodes', () => {
  assert.equal(straightLineDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
  assert.ok(Math.abs(straightLineDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 }) - 20015.0868) < 0.001);
  assert.ok(Number.isFinite(straightLineDistanceKm({ latitude: 90, longitude: -180 }, { latitude: -90, longitude: 180 })));
});

test('date-line trips show nearby markers together rather than zooming around the world', () => {
  assert.equal(longitudeNear(-179, 179), 181);
  assert.equal(longitudeNear(179, -179), -181);
  assert.equal(longitudeNear(121, 123), 121);
});
