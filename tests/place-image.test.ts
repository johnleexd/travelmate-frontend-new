import assert from 'node:assert/strict';
import test from 'node:test';
import { savedTripCoverImage, verifiedPlaceImage } from '../lib/place-image.ts';

test('generated itinerary cards show only sourced or curated place images', () => {
  assert.equal(verifiedPlaceImage('https://upload.wikimedia.org/example.jpg'), 'https://upload.wikimedia.org/example.jpg');
  assert.equal(verifiedPlaceImage('/cordova-mangrove.png'), '/cordova-mangrove.png');
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
