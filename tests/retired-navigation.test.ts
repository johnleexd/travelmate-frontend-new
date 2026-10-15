import assert from 'node:assert/strict';
import test from 'node:test';
import { legacyNavigationRedirect, validMapDay, validMapTripId } from '../lib/retired-navigation.ts';

test('old navigation bookmarks go to Saved trips without guessing a trip', () => {
  assert.equal(legacyNavigationRedirect({}), '/dashboard?tab=bookings&navigation=moved');
  assert.equal(legacyNavigationRedirect({ day: '2' }), '/dashboard?tab=bookings&navigation=moved');
});
test('a valid owned-trip lookup and day survive the compatibility redirect', () => {
  assert.equal(legacyNavigationRedirect({ trip: ['trip-a', 'trip-b'], day: ['2'] }), '/dashboard?tab=bookings&navigation=moved&map=trip-a&day=2');
  assert.equal(validMapTripId('49d6876b-b0ea-4327-bb42-75d3b43aa10e'), '49d6876b-b0ea-4327-bb42-75d3b43aa10e');
});
test('invalid map IDs and day values cannot redirect to arbitrary URLs', () => {
  for (const trip of ['https://example.com', '../other', 'a/b', 'x'.repeat(101), { id: 'trip-a' }]) {
    assert.equal(legacyNavigationRedirect({ trip, day: '1' }), '/dashboard?tab=bookings&navigation=moved');
  }
  for (const day of ['0', '-1', '32', '1.5', 'invalid', null]) assert.equal(validMapDay(day), undefined);
  assert.equal(legacyNavigationRedirect({ trip: 'trip-a', day: 'invalid' }), '/dashboard?tab=bookings&navigation=moved&map=trip-a');
});
