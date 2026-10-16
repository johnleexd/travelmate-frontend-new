import assert from 'node:assert/strict';
import test from 'node:test';
import type { DayActivity } from '../lib/contracts.ts';
import { activityRoutePoint, nextStopDirections, preferredRoute, parseNextStopOptions, walkingSuitable, type NextStopOption } from '../lib/next-stop.ts';
import { fetchNextStopOptions } from '../services/next-stop.service.ts';

const origin = { latitude: 14.55, longitude: 121.05 }, destination = { latitude: 14.551, longitude: 121.051 };
const walking: NextStopOption = { mode: 'walking', distanceMeters: 600, durationSeconds: 480, provider: 'osrm', fetchedAt: '2026-10-16T00:00:00Z' };
const driving: NextStopOption = { ...walking, mode: 'driving', distanceMeters: 900, durationSeconds: 240 };

test('directions use verified coordinates and never substitute activity names or the user location for a missing stop', () => {
  const activity = { title: 'Museum', time: '09:00', description: '', category: 'activity', estimatedCost: 0, icon: 'map' } as DayActivity;
  assert.equal(activityRoutePoint(activity), null);
  assert.equal(activityRoutePoint({ ...activity, location: 'Museum, Cebu', googlePlaceId: 'Unverified' }), null);
  const place = { provider: 'wikidata', placeId: 'Q100', sourceUrl: 'https://www.wikidata.org/wiki/Q100', ...origin } as DayActivity['place'];
  assert.deepEqual(activityRoutePoint({ ...activity, place }), origin);
  assert.equal(activityRoutePoint({ ...activity, place: { ...place!, sourceUrl: 'https://example.test' } }), null);
  const url = new URL(nextStopDirections(origin, destination, 'walking'));
  assert.equal(url.hostname, 'www.google.com'); assert.equal(url.pathname, '/maps/dir/');
  assert.equal(url.searchParams.get('origin'), '14.55,121.05'); assert.equal(url.searchParams.get('destination'), '14.551,121.051'); assert.equal(url.searchParams.get('travelmode'), 'walking');
  assert.equal(new URL(nextStopDirections(origin, destination)).searchParams.has('travelmode'), false);
  assert.equal(nextStopDirections(null, destination), 'https://www.google.com/maps/dir/?api=1');
});

test('suitability uses both walking route metrics, never endpoint proximity or a driving result labeled as walking', () => {
  assert.equal(walkingSuitable(walking), true); assert.equal(walkingSuitable(driving), false);
  assert.equal(walkingSuitable({ ...walking, distanceMeters: 5000 }), false);
  assert.equal(walkingSuitable({ ...walking, durationSeconds: 4000 }), false);
  assert.equal(preferredRoute([walking, driving])?.mode, 'walking');
  assert.equal(preferredRoute([{ ...walking, distanceMeters: 5000 }, driving])?.mode, 'driving');
  assert.equal(preferredRoute([{ ...walking, durationSeconds: 4000 }]), undefined);
  assert.equal(preferredRoute([]), undefined);
});

test('mismatched endpoints, invented transit modes and missing provider metrics cannot become guidance', () => {
  assert.deepEqual(parseNextStopOptions({ origin, destination, options: [walking] }, origin, destination), [walking]);
  for (const response of [{ origin: destination, destination: origin, options: [walking] }, { origin, destination, options: [{ ...walking, mode: 'transit' }] }, { origin, destination, options: [{ ...walking, durationSeconds: undefined }] }]) assert.throws(() => parseNextStopOptions(response, origin, destination));
  assert.deepEqual(parseNextStopOptions({ origin, destination, options: [{ ...walking, fare: { amount: 50, currency: 'PHP' } }] }, origin, destination), [walking], 'OSRM supplies no fare evidence');
});

test('requests coalesce/cache, changed endpoints fetch new guidance, and outages do not poll or block the itinerary', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (_input, init) => { calls++; const body = JSON.parse(String(init?.body)); return Response.json({ ...body, options: [walking] }); };
  const [first, second] = await Promise.all([fetchNextStopOptions(origin, destination, fetcher), fetchNextStopOptions(origin, destination, fetcher)]);
  assert.deepEqual(first, second); assert.equal(calls, 1);
  await fetchNextStopOptions(origin, destination, fetcher); assert.equal(calls, 1);
  await fetchNextStopOptions(destination, origin, fetcher); assert.equal(calls, 2);
  let failures = 0;
  const unavailable: typeof fetch = async () => { failures++; return Response.json({}, { status: 503 }); };
  assert.deepEqual(await fetchNextStopOptions(origin, destination, unavailable), []);
  assert.deepEqual(await fetchNextStopOptions(origin, destination, unavailable), []); assert.equal(failures, 1);
});
