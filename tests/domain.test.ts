import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateDailyBudget, allocateEqualShares, capCostsToBudget, splitBudget, travelersForParty } from '../lib/domain.ts';

test('budget split reconciles exactly to total', () => {
  const result = splitBudget(35001, 2);
  assert.equal(result.accommodation + result.food + result.activities + result.transport + result.reserve, 35001);
  assert.equal(result.dailyAverage, 5000);
});

test('daily average follows the selected trip length', () => {
  assert.equal(splitBudget(14000, 2, 14).dailyAverage, 1000);
  assert.throws(() => splitBudget(14000, 2, 15), /between 1 and 14 days/);
});

test('budget split keeps a ten percent reserve before rounding reconciliation', () => {
  const result = splitBudget(10000);
  assert.equal(result.reserve, 1000);
});

test('budget and traveler validation reject invalid input', () => {
  assert.throws(() => splitBudget(0));
  assert.throws(() => splitBudget(1000, 0));
  assert.throws(() => splitBudget(1000, 21));
});

test('daily itinerary costs vary and preserve the spendable budget', () => {
  const split = splitBudget(20000, 1);
  const days = allocateDailyBudget(split.total, split.reserve);
  assert.equal(days.length, 7);
  assert.equal(new Set(days).size, 7);
  assert.equal(days.reduce((sum, amount) => sum + amount, 0), split.total - split.reserve);
});

test('daily allocation supports variable trip lengths', () => {
  const daily = allocateDailyBudget(10000, 1000, 3);
  assert.equal(daily.length, 3);
  assert.equal(daily.reduce((sum, amount) => sum + amount, 0), 9000);
});

test('party types enforce solo, couple, and adjustable group sizes', () => {
  assert.equal(travelersForParty('solo', 9), 1);
  assert.equal(travelersForParty('couple', 9), 2);
  assert.equal(travelersForParty('family', 4), 4);
  assert.equal(travelersForParty('friends', 8), 8);
  assert.throws(() => travelersForParty('friends', 1));
});

test('equal shares reconcile exactly even with a peso remainder', () => {
  const shares = allocateEqualShares(10000, 3);
  assert.deepEqual(shares, [3334, 3333, 3333]);
  assert.equal(shares.reduce((sum, amount) => sum + amount, 0), 10000);
});

test('activity estimates are proportionally capped to the available group budget', () => {
  const costs = capCostsToBudget([3000, 2000, 1000], 3750);
  assert.deepEqual(costs, [1875, 1250, 625]);
  assert.equal(costs.reduce((sum, amount) => sum + amount, 0), 3750);
});
