import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getContactNumberError, getRegistrationDetailsError } from '../lib/registration-validation.ts';

test('registration accepts multi-part and international names, and optional formatted contacts', () => {
  assert.equal(getRegistrationDetailsError('Mary Jane', 'O’Neill-Santos', '+63 (912) 345-6789'), null);
  assert.equal(getRegistrationDetailsError('李', '明', ''), null);
  assert.equal(getContactNumberError('   '), null);
});

test('registration validates both name fields, combined storage limit and contact characters', () => {
  assert.match(getRegistrationDetailsError(' ', 'Last', '')!, /first name/);
  assert.match(getRegistrationDetailsError('First', ' ', '')!, /last name/);
  assert.match(getRegistrationDetailsError('a'.repeat(40), 'b'.repeat(40), '')!, /80 characters/);
  assert.equal(getRegistrationDetailsError('a'.repeat(39), 'b'.repeat(40), ''), null);
  assert.match(getContactNumberError('call me')!, /10-digit/);
  assert.match(getContactNumberError('+---')!, /10-digit/);
  assert.match(getContactNumberError('1'.repeat(31))!, /10-digit/);
});
