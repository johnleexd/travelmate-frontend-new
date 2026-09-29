import assert from 'node:assert/strict';
import test from 'node:test';
import { convertCurrency, isCurrencyCode } from '../lib/currency-conversion.ts';

test('destination amounts convert into the selected traveler reference currency', () => {
  const converted = convertCurrency(2_000, 'JPY', 'PHP', {
    JPY: {
      base: 'JPY', quote: 'PHP', rate: 0.40611, asOf: '2026-09-16',
      fetchedAt: '2026-09-16T05:00:00.000Z', refreshAfter: '2026-09-16T11:00:00.000Z',
      source: 'frankfurter', sourceUrl: 'https://frankfurter.dev/', disclaimer: 'Reference only.',
      freshness: {
        source: 'exchange-rates', status: 'live', isStale: false,
        fetchedAt: '2026-09-16T05:00:00.000Z', expiresAt: '2026-09-16T11:00:00.000Z',
        staleUntil: '2026-09-17T11:00:00.000Z', policy: 'Fresh exchange-rate data.',
      },
    },
  });
  assert.equal(converted, 812.22);
});

test('same-currency amounts stay exact and missing rates never fabricate a value', () => {
  assert.equal(convertCurrency(25, 'USD', 'USD', {}), 25);
  assert.equal(convertCurrency(25, 'USD', 'PHP', {}), null);
  assert.equal(isCurrencyCode('PHP'), true);
  assert.equal(isCurrencyCode('XYZ'), false);
});
