import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatPhilippineMobile, normalizePhilippineMobile } from '../lib/philippine-mobile.ts';
import { normalizePhilippineMobile as normalizeBackend } from '../../travelmate-backend-api/src/schemas/auth/philippine-mobile.ts';

test('client and server agree on complete local, domestic and international mobile numbers', () => {
  for (const input of ['9171234567', '917 123 4567', '09171234567', '639171234567', '+639171234567', '+63 (917) 123-4567']) {
    assert.equal(normalizePhilippineMobile(input), '+639171234567');
    assert.equal(normalizeBackend(input), '+639171234567');
    assert.equal(formatPhilippineMobile(input), '917 123 4567');
  }
  assert.equal(normalizePhilippineMobile('08171234567'), '+638171234567');
  assert.equal(normalizeBackend('08171234567'), '+638171234567');
  for (const input of ['', '   ']) {
    assert.equal(normalizePhilippineMobile(input), '');
    assert.equal(normalizeBackend(input), '');
  }
});

test('incomplete, overlong, nonmobile and foreign numbers are rejected without silent truncation', () => {
  for (const input of ['917123456', '91712345678', '+6391712345678', '091712345678', '2234567890', '+649171234567', 'call 9171234567', '++639171234567']) {
    assert.equal(normalizePhilippineMobile(input), null, input);
    assert.equal(normalizeBackend(input), null, input);
  }
  assert.equal(formatPhilippineMobile('917123456789012345'), '917 123 456789012345');
});
