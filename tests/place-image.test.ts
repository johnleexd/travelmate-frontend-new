import assert from 'node:assert/strict';
import test from 'node:test';
import { placePhotoCandidates, savedTripCoverImage, verifiedPlaceImage, verifiedSavedTripCover, resolveSavedTripCover, savedTripPhotoQuery } from '../lib/place-image.ts';

test('generated itinerary cards reject unattributed local assets', () => {
  assert.equal(verifiedPlaceImage('https://upload.wikimedia.org/example.jpg'), 'https://upload.wikimedia.org/example.jpg');
  assert.equal(verifiedPlaceImage('/cordova-mangrove.png'), null);
  assert.equal(verifiedPlaceImage('/mountain-hero-bg.png'), null);
  assert.equal(verifiedPlaceImage('/beach-bg.png'), null);
  assert.equal(verifiedPlaceImage('/travel-illustration.png'), null);
});

test('failed Commons thumbnails can recover using the original photo without altering its filename', () => {
  const thumbnail = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/The_Hachiko_statue_at_Shibuya%2C_Tokyo%2C_Japan.jpg/1280px-The_Hachiko_statue_at_Shibuya%2C_Tokyo%2C_Japan.jpg?utm_source=commons.wikimedia.org';
  assert.deepEqual(placePhotoCandidates(thumbnail), [thumbnail, 'https://upload.wikimedia.org/wikipedia/commons/6/6e/The_Hachiko_statue_at_Shibuya%2C_Tokyo%2C_Japan.jpg']);
  assert.deepEqual(placePhotoCandidates(thumbnail.replace('thumb.wikimedia.org', 'upload.wikimedia.org')), [thumbnail.replace('thumb.wikimedia.org', 'upload.wikimedia.org'), 'https://upload.wikimedia.org/wikipedia/commons/6/6e/The_Hachiko_statue_at_Shibuya%2C_Tokyo%2C_Japan.jpg']);
});

test('photo recovery rejects unattributed local images and unrelated sources', () => {
  assert.deepEqual(placePhotoCandidates('/cordova-nalusuan.png'), []);
  assert.deepEqual(placePhotoCandidates('https://example.com/image.jpg'), []);
  assert.deepEqual(placePhotoCandidates(undefined), []);
  const vectorThumbnail = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Map.svg/1280px-Map.svg.png';
  assert.deepEqual(placePhotoCandidates(vectorThumbnail), [vectorThumbnail]);
});

const manila = { destination: 'Manila, National Capital Region, Philippines', destinationCity: 'Manila', destinationCountryCode: 'PH', latitude: 14.6042, longitude: 120.9822 };
const photo = { src: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/The_Manila_Cathedral.jpg', kind: 'destination-photo', city: 'Manila', countryCode: 'PH', scope: 'destination', label: 'Manila Cathedral, Manila',
  attribution: { creator: 'Kuranges', license: 'CC BY-SA 3.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Manila_Cathedral.jpg' } };
const activity = { imageUrl: photo.src, imageAttribution: photo.attribution, place: { provider: 'wikidata', city: 'Manila', countryCode: 'PH', country: 'Philippines', name: 'Manila Cathedral', latitude: 14.604, longitude: 120.98 } };

test('saved trips reuse a licensed geographically matched activity photograph', () => {
  const result = savedTripCoverImage({ days: [{ activities: [activity] }] }, manila);
  assert.equal(result?.src, photo.src);
  assert.equal(result?.city, 'Manila');
  assert.equal(result?.attribution.creator, 'Kuranges');
  assert.equal(result?.attribution.licenseUrl, 'https://creativecommons.org/licenses/by-sa/3.0/');
});

test('empty, unattributed, flag, and geographically unrelated covers never become saved-trip photos', () => {
  for (const invalid of [
    { ...activity, imageUrl: 'https://flagcdn.com/w1280/ph.png' },
    { ...activity, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Flag_of_Philippines.png' },
    { ...activity, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Map.svg.png' },
    { ...activity, imageAttribution: undefined },
    { ...activity, place: { ...activity.place, city: 'Fukuoka' } },
    { ...activity, place: { ...activity.place, countryCode: 'JP' } },
    { ...activity, place: { ...activity.place, latitude: 33.6, longitude: 130.4 } },
  ]) assert.equal(savedTripCoverImage({ days: [{ activities: [invalid] }] }, manila), null);
  assert.equal(savedTripCoverImage({ days: [] }, manila), null);
  assert.equal(savedTripCoverImage({ days: [{ imageUrl: photo.src, imageAttribution: photo.attribution }] }, manila), null);
});

test('country fallback labels identify the place actually shown; city and country mismatches are rejected', () => {
  assert.equal(verifiedSavedTripCover({ ...photo, city: 'Fukuoka' }, manila), null);
  assert.equal(verifiedSavedTripCover({ ...photo, countryCode: 'JP' }, manila), null);
  const cebu = { destination: 'Cebu City, Philippines', destinationCountryCode: 'PH' };
  assert.equal(verifiedSavedTripCover(photo, cebu), null);
  assert.equal(verifiedSavedTripCover({ ...photo, scope: 'country' }, cebu), null);
  assert.equal(verifiedSavedTripCover({ ...photo, scope: 'country', label: 'Country photo: Manila Cathedral, Philippines' }, cebu)?.scope, 'country');
});

test('cover requests include country and coordinates, deduplicate concurrent cards, and reuse cached URLs', async () => {
  const destination = { ...manila, destinationCity: 'Cache test Manila' };
  const responsePhoto = { ...photo, city: destination.destinationCity };
  let calls = 0;
  const fetcher = (async (url: string | URL | Request) => {
    calls++;
    const params = new URL(String(url), 'http://localhost').searchParams;
    assert.equal(params.get('countryCode'), 'PH');
    assert.equal(params.get('latitude'), '14.6042');
    assert.equal(params.get('longitude'), '120.9822');
    return Response.json({ photo: responsePhoto });
  }) as typeof fetch;
  const result = await Promise.all([resolveSavedTripCover(destination, fetcher), resolveSavedTripCover(destination, fetcher)]);
  assert.equal(result[0]?.src, photo.src);
  await resolveSavedTripCover(destination, fetcher);
  assert.equal(calls, 1);
});

test('cover lookup failures and invalid responses resolve to a neutral missing photo', async () => {
  assert.equal(await resolveSavedTripCover({ destination: 'Failed photo, Philippines' }, (async () => { throw new Error('offline'); }) as typeof fetch), null);
  assert.equal(await resolveSavedTripCover({ destination: 'Flag photo, Philippines' }, (async () => Response.json({ photo: { ...photo, src: 'https://flagcdn.com/w1280/ph.png' } })) as typeof fetch), null);
});

test('legacy recorded destination coordinates are reused without accepting out-of-range points', () => {
  const query = new URLSearchParams(savedTripPhotoQuery({ destination: 'Manila, Philippines', itinerary: { grounding: { destination: { latitude: 14.6042, longitude: 120.9822 } } } }));
  assert.equal(query.get('latitude'), '14.6042');
  assert.equal(query.get('longitude'), '120.9822');
  assert.equal(new URLSearchParams(savedTripPhotoQuery({ destination: 'Manila', latitude: 100, longitude: 0 })).has('latitude'), false);
});
