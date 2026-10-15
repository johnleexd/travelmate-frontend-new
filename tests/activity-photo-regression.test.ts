import assert from 'node:assert/strict';
import test from 'node:test';
import { commonsPhotoLicenseUrl, verifiedActivityImage } from '../lib/place-image.ts';
import { missingDayPhotoKey, photoPatches } from '../services/activity-photo.service.ts';
import type { DayPlan } from '../lib/contracts.ts';

const photo = {
  imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Shinjuku_Gyoen_National_Garden_-_sakura_3.JPG/1280px-Shinjuku_Gyoen_National_Garden_-_sakura_3.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail',
  imageAttribution: { creator: 'Kakidai', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', sourceUrl: 'https://commons.wikimedia.org/?curid=19072665' },
};
const day: DayPlan = { day: 1, date: '2040-01-01', theme: 'Tokyo visits', imageUrl: '', totalCost: 100, activities: [{ id: 'shinjuku', title: 'Visit Shinjuku Gyoen', time: '09:00', description: 'Visit the garden.', estimatedCost: 100, category: 'activity', icon: 'map', location: 'Tokyo, Japan' }] };

test('the saved Tokyo photo remains valid without a trailing slash and is never replaced', () => {
  const stored = { ...day, activities: [{ ...day.activities[0], ...photo }] };
  assert.equal(verifiedActivityImage(photo.imageUrl, photo.imageAttribution), photo.imageUrl);
  assert.equal(missingDayPhotoKey('Tokyo, Japan', stored), null);
  assert.deepEqual(photoPatches(day, stored), [{ index: 0, ...photo }]);
  assert.deepEqual(photoPatches(stored, { ...day, activities: [{ ...day.activities[0], ...photo, imageUrl: photo.imageUrl.replace('1280px-', '960px-') }] }), []);
  assert.equal(stored.activities[0].imageAttribution.licenseUrl, photo.imageAttribution.licenseUrl);
});

test('equivalent Creative Commons URLs are canonicalized only for validation/display', () => {
  for (const licenseUrl of ['https://creativecommons.org/licenses/by-sa/3.0', 'https://creativecommons.org/licenses/by-sa/3.0/', 'http://creativecommons.org/licenses/by-sa/3.0/', 'https://www.creativecommons.org/licenses/by-sa/3.0/deed.en', 'https://creativecommons.org/licenses/by-sa/3.0/legalcode']) {
    assert.equal(commonsPhotoLicenseUrl(photo.imageAttribution.license, licenseUrl), 'https://creativecommons.org/licenses/by-sa/3.0/');
    assert.equal(verifiedActivityImage(photo.imageUrl, { ...photo.imageAttribution, licenseUrl }), photo.imageUrl);
  }
});

test('unrelated license hosts, different license versions and nonreusable rights remain rejected', () => {
  for (const licenseUrl of ['https://example.test/licenses/by-sa/3.0/', 'https://creativecommons.org.evil.test/licenses/by-sa/3.0/', 'https://creativecommons.org/licenses/by-sa/4.0/', 'https://creativecommons.org/licenses/by-nc/3.0/', 'https://user:password@creativecommons.org/licenses/by-sa/3.0/', 'https://creativecommons.org:444/licenses/by-sa/3.0/']) {
    assert.equal(verifiedActivityImage(photo.imageUrl, { ...photo.imageAttribution, licenseUrl }), null);
  }
  assert.equal(verifiedActivityImage(photo.imageUrl, { ...photo.imageAttribution, license: 'CC BY-NC 3.0' }), null);
});
