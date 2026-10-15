import assert from 'node:assert/strict';
import test from 'node:test';
import { existingDestinationPhoto, mapStoredPlanPhotos, savedDayTheme, storedActivityImage, storedPhoto } from '../lib/stored-trip-photos.ts';
import { createMissingPhotoClient, missingDayPhotoKey, photoPatches } from '../services/activity-photo.service.ts';
import type { DayPlan, ItineraryResponse } from '../lib/contracts.ts';
const source = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Recorded_place.jpg';
const credit = { creator: 'Recorded author', license: 'CC BY 4.0', sourceUrl: 'https://commons.wikimedia.org/?curid=42' };
const activity = { title: 'Original museum', time: '09:00', estimatedCost: 100, description: 'Keep this description', category: 'activity' as const, icon: 'map', location: 'Manila, Philippines' };
const day = { day: 1, date: '2040-01-01', theme: 'Manila: details need confirmation', totalCost: 100, imageUrl: '', activities: [activity] } as DayPlan;

test('older field shapes map locally with attribution and do not trigger a provider request', async () => {
  for (const fields of [{ photoUrl: source, photoAttribution: credit }, { image_url: source, image_attribution: credit }, { image: { src: source, attribution: credit } }, { photo: { url: source, attribution: credit } }, { imageAttribution: {}, photo: { url: source, attribution: credit } }]) {
    const stored = { ...day, activities: [{ ...activity, ...fields }] } as unknown as DayPlan;
    const before = JSON.stringify(stored);
    assert.deepEqual(storedPhoto(stored.activities[0]), { imageUrl: source, imageAttribution: credit });
    assert.equal(missingDayPhotoKey('Manila', stored), null);
    let requests = 0; const client = createMissingPhotoClient(async () => { requests++; throw new Error('Image APIs are offline'); }, 0);
    assert.deepEqual(await client('Manila', stored, 'legacy-trip'), []); assert.equal(requests, 0); assert.equal(JSON.stringify(stored), before);
    assert.equal(storedActivityImage(source), source);
    assert.equal(storedActivityImage(source, { ...credit, license: 'Legacy license record' }), source);
    assert.equal(storedActivityImage(source, { ...credit, license: 'CC BY-NC 4.0' }), null);
    const mapped = mapStoredPlanPhotos({ destination: 'Manila', days: [stored] } as ItineraryResponse);
    assert.equal(mapped.days[0].activities[0].imageUrl, source); assert.deepEqual(mapped.days[0].activities[0].imageAttribution, credit);
  }
});

test('metadata gaps preserve a stored URL; failures and empty responses never erase it', async () => {
  const stored = { ...day, activities: [{ ...activity, imageUrl: source }] } as DayPlan;
  assert.equal(missingDayPhotoKey('Manila', stored), null);
  const failures = [{ index: 0, imageUrl: source }];
  assert.ok(missingDayPhotoKey('Manila', stored, failures));
  for (const response of [new Response('', { status: 503 }), Response.json({ day }), null]) {
    const client = createMissingPhotoClient(async () => { if (!response) throw new Error('Timeout'); return response.clone(); }, 0);
    assert.deepEqual(await client('Manila', stored, 'legacy', failures), []);
    assert.equal(stored.activities[0].imageUrl, source); assert.equal(stored.activities[0].description, activity.description);
  }
  const replacement = { ...day, activities: [{ ...activity, imageUrl: source + '?replacement=1', imageAttribution: credit }] };
  assert.equal(photoPatches(stored, replacement).length, 0);
  assert.equal(photoPatches(stored, replacement, failures).length, 1);
  assert.equal(photoPatches(stored, replacement, [{ index: 0, imageUrl: 'different' }]).length, 0);
});

test('destination fallback is a separate asset and headings use only actual saved activity names', () => {
  const empty = { ...day, day: 2, activities: [], totalCost: 0 };
  const plan = { destination: 'Manila', days: [{ ...day, imageUrl: source, imageAttribution: credit }, empty] } as ItineraryResponse;
  assert.equal(existingDestinationPhoto(plan)?.imageUrl, source);
  assert.equal(savedDayTheme(day, 'Manila, Philippines'), '');
  assert.equal(savedDayTheme(empty, 'Manila, Philippines'), '');
  assert.equal(empty.activities.length, 0);
});
