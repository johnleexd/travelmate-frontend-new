import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateDailyBudget, allocateEqualShares, capCostsToBudget, formatMoney, partyBudgetExplanation, partyBudgetLabel, partyEstimateLabel, partySpendLabel, splitBudget, SUPPORTED_CURRENCIES, ZERO_DECIMAL_CURRENCIES, travelersForParty } from '../lib/domain.ts';

test('money formatting keeps the selected currency visible', () => {
  assert.match(formatMoney(1234.5, 'EUR'), /EUR\s*1,234\.50/);
  assert.match(formatMoney(1234, 'JPY'), /JPY\s*1,234/);
});

test('destination currencies include the requested Asian and global fallbacks', () => {
  for (const currency of ['PHP', 'JPY', 'KRW', 'USD', 'EUR', 'THB'] as const) {
    assert.ok(SUPPORTED_CURRENCIES.includes(currency));
  }
  assert.ok(ZERO_DECIMAL_CURRENCIES.includes('KRW'));
  assert.match(formatMoney(1234, 'KRW'), /KRW\s*1,234/);
});

test('budget split reconciles exactly to total', () => {
  const result = splitBudget(35001, 2);
  assert.equal(result.accommodation + result.food + result.activities + result.transport + result.reserve, 35001);
  assert.equal(result.dailyAverage, 5000);
});

test('daily average follows the selected trip length', () => {
  assert.equal(splitBudget(14000, 2, 14).dailyAverage, 1000);
  assert.equal(splitBudget(31000, 2, 31).dailyAverage, 1000);
  assert.throws(() => splitBudget(32000, 2, 32), /between 1 and 31 days/);
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

test('budget copy states exactly who owns the entered total', () => {
  assert.equal(partyBudgetLabel('solo', 1), 'Solo trip budget');
  assert.match(partyBudgetExplanation('solo', 1), /you alone/);
  assert.equal(partyBudgetLabel('couple', 2), 'Combined couple budget');
  assert.match(partyBudgetExplanation('couple', 2), /both travelers/);
  assert.equal(partyBudgetLabel('family', 5), 'Total family budget (5 travelers)');
  assert.equal(partyBudgetLabel('friends', 7), 'Total barkada budget (7 travelers)');
  assert.equal(partySpendLabel('couple'), 'Estimated combined couple spend');
  assert.equal(partyEstimateLabel('solo'), 'solo estimate');
});

test('equal shares reconcile exactly in the selected currency minor units', () => {
  const shares = allocateEqualShares(10000, 3, 'PHP');
  assert.deepEqual(shares, [3333.34, 3333.33, 3333.33]);
  assert.equal(shares.reduce((sum, amount) => sum + amount, 0), 10000);
  assert.deepEqual(allocateEqualShares(1000.50, 3, 'USD'), [333.50, 333.50, 333.50]);
  assert.deepEqual(allocateEqualShares(10000, 3, 'JPY'), [3334, 3333, 3333]);
});

test('activity estimates are proportionally capped to the available group budget', () => {
  const costs = capCostsToBudget([3000, 2000, 1000], 3750);
  assert.deepEqual(costs, [1875, 1250, 625]);
  assert.equal(costs.reduce((sum, amount) => sum + amount, 0), 3750);
});
