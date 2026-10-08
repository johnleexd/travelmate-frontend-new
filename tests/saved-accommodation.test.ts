import test from 'node:test';
import assert from 'node:assert/strict';
import { savedAccommodation } from '../lib/saved-accommodation.ts';

test('trip summaries show the saved selection without needing an itinerary', () => {
  const stay = { name: 'Selected Tokyo Hotel', address: 'Tokyo, Japan', selectionKind: 'planned' } as const;
  assert.deepEqual(savedAccommodation({ itinerary: null, selectedAccommodation: stay }), stay);
  assert.equal(savedAccommodation({ itinerary: null }), undefined);
});

test('complete itineraries use the current planned or quoted stay over stale summary metadata', () => {
  const summary = { name: 'Previous Hotel', address: 'Old address', selectionKind: 'quoted' } as const;
  assert.deepEqual(savedAccommodation({ itinerary: { plannedAccommodation: { name: 'New Guesthouse', address: 'New address' } }, selectedAccommodation: summary }), { name: 'New Guesthouse', address: 'New address', selectionKind: 'planned' });
  assert.deepEqual(savedAccommodation({ itinerary: { accommodation: { name: 'Quoted Hotel', address: 'Tokyo' } } }), { name: 'Quoted Hotel', address: 'Tokyo', selectionKind: 'quoted' });
  assert.equal(savedAccommodation({ itinerary: { plannedAccommodation: { name: '' } } }), undefined);
  assert.equal(savedAccommodation({ itinerary: { days: [] }, selectedAccommodation: summary }), undefined);
});
