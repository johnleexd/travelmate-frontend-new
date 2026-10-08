import assert from "node:assert/strict";
import test from "node:test";
import {
  getPasswordStrength,
  getPasswordValidationError,
  isStrongPassword,
  STRONG_PASSWORD_PATTERN,
} from "../lib/password-validation.ts";

test("strong passwords satisfy every required character class", () => {
  assert.equal(isStrongPassword("Travel123!"), true);
  assert.equal(STRONG_PASSWORD_PATTERN.test("CebuTrip#2026"), true);
});

test('password errors identify the failing rule without normalizing input', () => {
  assert.equal(getPasswordValidationError('Travel123!'), null);
  assert.equal(getPasswordValidationError(' Travel123!'), 'Password must not contain spaces or other whitespace.');
  assert.equal(getPasswordValidationError('travel123!'), 'Password must include an uppercase letter.');
  assert.equal(getPasswordValidationError('TravelMate!'), 'Password must include a number.');
  assert.equal(getPasswordValidationError('Travel1234'), 'Password must include a special character.');
});

test("password validation rejects missing character classes and whitespace", () => {
  for (const password of [
    "short1!",
    "travel123!",
    "TRAVEL123!",
    "TravelMate!",
    "Travel1234",
    "Travel 123!",
    `Travel123!${"a".repeat(55)}`,
  ]) {
    assert.equal(isStrongPassword(password), false, `${password} should be rejected`);
  }
});

test("password strength reports progressive, deterministic indicator states", () => {
  assert.equal(getPasswordStrength(""), "empty");
  assert.equal(getPasswordStrength("abc"), "weak");
  assert.equal(getPasswordStrength("Travel12"), "medium");
  assert.equal(getPasswordStrength("Travel123!"), "strong");
});
