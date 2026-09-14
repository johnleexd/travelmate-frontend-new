import assert from "node:assert/strict";
import test from "node:test";
import { isStrongPassword, STRONG_PASSWORD_PATTERN } from "../lib/password-validation.ts";

test("strong passwords satisfy every required character class", () => {
  assert.equal(isStrongPassword("Travel123!"), true);
  assert.equal(STRONG_PASSWORD_PATTERN.test("CebuTrip#2026"), true);
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
