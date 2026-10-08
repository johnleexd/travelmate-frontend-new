import assert from 'node:assert/strict';
import test from 'node:test';
import { placePhotoCandidates, savedTripCoverImage, verifiedPlaceImage } from '../lib/place-image.ts';

test('generated itinerary cards reject unattributed local assets', () => {
  assert.equal(verifiedPlaceImage('https://upload.wikimedia.org/example.jpg'), 'https://upload.wikimedia.org/example.jpg');
  assert.equal(verifiedPlaceImage('/cordova-mangrove.png'), null);
  assert.equal(verifiedPlaceImage('/mountain-hero-bg.png'), null);
  assert.equal(verifiedPlaceImage('/beach-bg.png'), null);
  assert.equal(verifiedPlaceImage('/travel-illustration.png'), null);
});

test('saved trips prefer a verified destination photo and preserve its attribution', () => {
  assert.deepEqual(savedTripCoverImage({ days: [{ imageUrl: 'https://upload.wikimedia.org/japan.jpg', imageAttribution: { creator: 'Example author', license: 'CC BY-SA', sourceUrl: 'https://commons.wikimedia.org/example' } }] }, 'JP'), {
    src: 'https://upload.wikimedia.org/japan.jpg',
    kind: 'destination-photo',
    attribution: { creator: 'Example author', license: 'CC BY-SA', sourceUrl: 'https://commons.wikimedia.org/example' },
  });
});

test('saved trips fall back to a deterministic country visual', () => {
  assert.deepEqual(savedTripCoverImage({ days: [] }, 'jp'), { src: 'https://flagcdn.com/w1280/jp.png', kind: 'country-flag' });
  assert.equal(savedTripCoverImage({}, undefined), null);
  assert.equal(savedTripCoverImage({}, 'Japan'), null);
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
