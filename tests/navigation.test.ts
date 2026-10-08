import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRouteGuide, navigationProgress, parseNavigationRoute } from '../lib/navigation.ts';
import type { NavigationRoute } from '../lib/contracts.ts';
const route: NavigationRoute = { mode: 'walking', origin: { latitude: 0, longitude: 0 }, destination: { latitude: .001, longitude: .001 }, geometry: [{ latitude: 0, longitude: 0 }, { latitude: .001, longitude: 0 }, { latitude: .001, longitude: .001 }], steps: [
  { instruction: 'Head north', location: { latitude: 0, longitude: 0 }, distanceMeters: 111, durationSeconds: 90, maneuver: 'depart' },
  { instruction: 'Turn right', location: { latitude: .001, longitude: 0 }, distanceMeters: 111, durationSeconds: 90, maneuver: 'turn', modifier: 'right' },
  { instruction: 'Arrive', location: { latitude: .001, longitude: .001 }, distanceMeters: 0, durationSeconds: 0, maneuver: 'arrive' },
], distanceMeters: 222, durationSeconds: 180, originOffsetMeters: 0, destinationOffsetMeters: 0, fetchedAt: '2026-10-08T00:00:00Z', provider: 'osrm' };

test('route progress follows path segments and advances directions without relying on nearest destination', () => {
  const guide = buildRouteGuide(route);
  const start = navigationProgress(guide, route.origin, 10);
  assert.equal(start.stepIndex, 0); assert.equal(start.offRoute, false); assert.equal(start.arrived, false);
  const turn = navigationProgress(guide, { latitude: .001, longitude: .0003 }, 10);
  assert.equal(turn.stepIndex, 1); assert.ok(turn.remainingMeters < start.remainingMeters); assert.ok(turn.nextTurnMeters > 70 && turn.nextTurnMeters < 90);
  assert.equal(navigationProgress(guide, route.destination, 10).arrived, true);
  assert.equal(navigationProgress(guide, route.destination, 500).arrived, false);
});

test('off-route detection respects reported accuracy and projection works across the date line', () => {
  const guide = buildRouteGuide(route);
  assert.equal(navigationProgress(guide, { latitude: .004, longitude: .004 }, 10).offRoute, true);
  assert.equal(navigationProgress(guide, { latitude: .004, longitude: .004 }, 1000).offRoute, false);
  const crossing = buildRouteGuide({ ...route, geometry: [{ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 }], origin: { latitude: 0, longitude: 179.999 }, destination: { latitude: 0, longitude: -179.999 }, steps: [route.steps[0]] });
  assert.ok(crossing.length < 300);
  assert.ok(navigationProgress(crossing, { latitude: 0, longitude: 180 }, 5).offRouteMeters < 1);
});

test('malformed route responses cannot crash or masquerade as usable guidance', () => {
  assert.equal(parseNavigationRoute(route), route);
  for (const value of [null, {}, { ...route, durationSeconds: NaN }, { ...route, geometry: [{ latitude: 91, longitude: 0 }] }, { ...route, steps: [] }, { ...route, fetchedAt: 'invalid' }, { ...route, mode: 'flying' }]) assert.equal(parseNavigationRoute(value), null);
});
