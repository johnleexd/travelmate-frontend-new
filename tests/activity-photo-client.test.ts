import assert from 'node:assert/strict';
import test from 'node:test';
import { createMissingPhotoClient, missingDayPhotoKey, photoPatches } from '../services/activity-photo.service.ts';
import type { DayPlan } from '../lib/contracts.ts';
import { verifiedActivityImage, verifiedPlaceImage } from '../lib/place-image.ts';
const day = { day: 1, date: '2040-01-01', theme: 'Recorded itinerary', imageUrl: '', totalCost: 123, activities: [{ title: 'Exact recorded venue', time: '10:00', description: 'Saved description', estimatedCost: 123, category: 'activity', icon: 'map', location: 'City, Country' }] } as DayPlan;
const photo = { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Recorded_venue.jpg', imageAttribution: { creator: 'Recorded author', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', sourceUrl: 'https://commons.wikimedia.org/?curid=123' } };
test('saved-trip missing-photo requests are coalesced/cached and send display-only lookup without a plan or draft proof', async () => {
  let calls = 0;
  const client = createMissingPhotoClient(async (_url, init) => {
    calls++; const body = JSON.parse(String(init?.body)); assert.equal(body.lookupOnly, true); assert.equal(body.itinerary, undefined); assert.deepEqual(body.day, day);
    return Response.json({ day: { ...day, totalCost: 9999, activities: [{ ...day.activities[0], estimatedCost: 9999, ...photo }] } });
  }, 0);
  const [a, b] = await Promise.all([client('City, Country', day), client('City, Country', day)]);
  assert.deepEqual(a, [{ index: 0, ...photo }]); assert.deepEqual(a, b); assert.equal(calls, 1);
  await client('City, Country', day); assert.equal(calls, 1); assert.equal(day.totalCost, 123); assert.equal(day.activities[0].estimatedCost, 123);
});
test('existing activity images, mismatched activities, unsupported hosts and missing attribution are never replaced or mapped', () => {
  assert.deepEqual(photoPatches(day, { ...day, activities: [{ ...day.activities[0], title: 'Different venue', ...photo }] }), []);
  assert.deepEqual(photoPatches(day, { ...day, activities: [{ ...day.activities[0], ...photo, imageUrl: 'https://example.test/random.jpg' }] }), []);
  assert.deepEqual(photoPatches(day, { ...day, activities: [{ ...day.activities[0], imageUrl: photo.imageUrl }] }), []);
  const existing = { ...day, activities: [{ ...day.activities[0], ...photo }] };
  assert.equal(missingDayPhotoKey('City, Country', existing), null); assert.deepEqual(photoPatches(existing, { ...day, activities: [{ ...day.activities[0], ...photo }] }), []);
});
test('allowances are not searched, provider failures/zero matches are cached and preserve placeholders', async () => {
  const allowance = { ...day, activities: [{ ...day.activities[0], title: 'Daily meals', time: 'Daily allowance', location: undefined }] };
  assert.equal(missingDayPhotoKey('City, Country', allowance), null);
  for (const response of [new Response('', { status: 429, headers: { 'Retry-After': '120' } }), Response.json({ day }), null]) {
    let calls = 0; const client = createMissingPhotoClient(async () => { calls++; if (!response) throw new Error('Offline'); return response.clone(); }, 0);
    assert.deepEqual(await client('City, Country', day), []); assert.deepEqual(await client('City, Country', day), []); assert.equal(calls, 1);
  }
});

test('evidenced KOGL Type 1 maps with its attribution; restricted or mismatched licenses stay missing', () => {
  for (const license of ['KOGL Type 1', 'KOGL Type 2', 'KOGL Type 3', 'KOGL Type 4']) {
    const credit = { ...photo.imageAttribution, creator: '문화재청', license, licenseUrl: 'https://www.kogl.or.kr/info/licenseType1.do' };
    const patches = photoPatches(day, { ...day, activities: [{ ...day.activities[0], ...photo, imageAttribution: credit }] });
    assert.equal(patches.length, license === 'KOGL Type 1' ? 1 : 0);
    if (patches.length) assert.deepEqual(patches[0].imageAttribution, credit);
  }
  assert.deepEqual(photoPatches(day, { ...day, activities: [{ ...day.activities[0], ...photo, imageAttribution: { ...photo.imageAttribution, licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' } }] }), []);
});

test('controlled saved enrichment sends only day identity and maps complete Unsplash credit without changing details', async () => {
  const unsplash = { imageUrl: 'https://images.unsplash.com/photo-123?ixid=preserved&w=1080', imageAttribution: { provider: 'unsplash' as const, photoId: 'photo-id', creator: 'Real photographer', photographerUrl: 'https://unsplash.com/@author?utm_source=travelmate&utm_medium=referral', sourceUrl: 'https://unsplash.com/photos/photo-id?utm_source=travelmate&utm_medium=referral', license: 'Unsplash', illustrative: true, match: 'destination' as const, downloadTracked: true } };
  const requests: string[] = [];
  const client = createMissingPhotoClient(async (url, init) => {
    requests.push(String(url)); assert.deepEqual(JSON.parse(String(init?.body)), { day: 1 });
    return Response.json({ day: { ...day, activities: [{ ...day.activities[0], ...unsplash }] }, persisted: true });
  }, 0);
  const patches = await client('City, Country', day, 'stored-trip');
  assert.deepEqual(patches, [{ index: 0, ...unsplash }]); assert.deepEqual(requests, ['/api/platform/trips/stored-trip/photos']);
  await client('City, Country', day, 'stored-trip'); assert.equal(requests.length, 1);
  assert.equal(verifiedActivityImage(unsplash.imageUrl, unsplash.imageAttribution), unsplash.imageUrl);
  assert.equal(verifiedPlaceImage(unsplash.imageUrl), null); // Hotel/Commons consumers stay scoped.
  assert.equal(verifiedActivityImage(unsplash.imageUrl, { ...unsplash.imageAttribution, photographerUrl: 'https://evil.test/@author' }), null);
  assert.equal(verifiedActivityImage(unsplash.imageUrl, { ...unsplash.imageAttribution, illustrative: false }), null);
  assert.equal(day.activities[0].imageUrl, undefined); assert.equal(day.totalCost, 123);
  assert.deepEqual(photoPatches(day, { ...day, activities: [{ ...day.activities[0], location: 'Different city', ...unsplash }] }), []);
});

test('new Commons photos require reusable rights; existing records are not overwritten without a load failure', () => {
  assert.equal(verifiedActivityImage(photo.imageUrl), null);
  for (const license of ['All rights reserved', 'CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY 99.0']) {
    const invalid = { ...photo.imageAttribution, license };
    assert.equal(verifiedActivityImage(photo.imageUrl, invalid), null);
    const old = { ...day, activities: [{ ...day.activities[0], imageUrl: photo.imageUrl, imageAttribution: invalid }] };
    assert.equal(missingDayPhotoKey('City, Country', old), null);
    assert.deepEqual(photoPatches(old, { ...day, activities: [{ ...day.activities[0], ...photo }] }), []);
    assert.deepEqual(photoPatches(old, { ...day, activities: [{ ...day.activities[0], ...photo }] }, [{ index: 0, imageUrl: photo.imageUrl }]), [{ index: 0, ...photo }]);
  }
  assert.equal(verifiedActivityImage(photo.imageUrl, photo.imageAttribution), photo.imageUrl);
  assert.equal(verifiedActivityImage(photo.imageUrl, { ...photo.imageAttribution, licenseUrl: 'https://example.test/rights' }), null);
});
