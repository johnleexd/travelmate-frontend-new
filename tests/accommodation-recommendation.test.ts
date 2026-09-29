import assert from 'node:assert/strict';
import test from 'node:test';
import { recommendAccommodation } from '../lib/accommodation-recommendation.ts';
import type { LiveAccommodation } from '../lib/contracts.ts';

const stay = (overrides: Partial<LiveAccommodation>): LiveAccommodation => ({
  id: 'stay', hotelId: 'hotel', offerId: 'offer', name: 'City Hotel', type: 'Hotel', typeSource: 'name-inferred',
  address: 'Tokyo', checkInDate: '2026-10-01', checkOutDate: '2026-10-03', nightlyRate: 5000, total: 10000,
  currency: 'JPY', roomDescription: 'Standard room', cancellationPolicy: 'Check provider terms.', available: true,
  isLive: true, source: 'amadeus', selectionToken: 'signed', fetchedAt: '2026-09-26T00:00:00.000Z', ...overrides,
});

test('accommodation recommendation prefers the requested provider-listed stay type', () => {
  const result = recommendAccommodation([
    stay({ id: 'hotel', type: 'Hotel', total: 8000 }),
    stay({ id: 'hostel', name: 'Central Hostel', type: 'Hostel', total: 9000 }),
  ], 'hostel', 40000, 'JPY');
  assert.equal(result?.accommodation.id, 'hostel');
  assert.match(result?.reason || '', /matches your hostel stay type/);
});

test('budget recommendation ignores unavailable and wrong-currency offers', () => {
  const result = recommendAccommodation([
    stay({ id: 'unavailable', total: 1000, available: false }),
    stay({ id: 'wrong-currency', total: 2000, currency: 'USD' }),
    stay({ id: 'affordable', total: 7000 }),
  ], 'budget-friendly', 30000, 'JPY');
  assert.equal(result?.accommodation.id, 'affordable');
});
