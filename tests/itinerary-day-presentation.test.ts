import test from 'node:test';
import assert from 'node:assert/strict';
import type { DayActivity, ItineraryResponse } from '../lib/contracts.ts';
import { dailyCardEntries, isDailyAllowance } from '../lib/itinerary-day-presentation.ts';

const entry = (overrides: Partial<DayActivity>): DayActivity => ({ priceEvidence: { status: 'estimate', source: 'user-entered', basis: 'Explicit party total', currency: 'PHP', fetchedAt: '2040-01-01T00:00:00Z', unitAmount: overrides.estimatedCost ?? 0, unit: 'group', quantity: 1, participants: 1, needsConfirmation: true }, title: 'Visit', time: 'Flexible', description: '', category: 'activity', icon: 'map', estimatedCost: 0, ...overrides });
test('daily cards separate untimed allowances without sorting or changing handler indices', () => {
  const meal = entry({ title: 'Daily meals in Manila', time: 'Daily allowance', category: 'food', estimatedCost: 250 });
  const museum = entry({ title: 'Museum', time: '11:00', estimatedCost: 200 });
  const earlier = entry({ title: 'Heritage site', time: '09:00', estimatedCost: 0 });
  const transport = entry({ title: 'Daily transport in Manila', time: 'Daily allowance', category: 'transport', estimatedCost: 400 });
  const plan = { currency: 'PHP', accommodation: { nights: 2, total: 3000 }, days: [{ totalCost: 2350, activities: [meal, museum, earlier, transport] }] } as ItineraryResponse;
  const snapshot = structuredClone(plan);
  const result = dailyCardEntries(plan, 0);
  assert.deepEqual(result.activities.map(item => item.index), [1, 2]);
  assert.deepEqual(result.allowances.map(item => item.index), [0, 3]);
  assert.equal(result.entryTotal + result.remainder, plan.days[0].totalCost);
  assert.equal(result.remainder, 1500);
  assert.equal(result.remainderLabel, 'Accommodation allocation');
  assert.deepEqual(plan, snapshot);
});
test('actual timed meals and named place visits remain activities, even with budget-allowance prices', () => {
  assert.equal(isDailyAllowance(entry({ title: 'Lunch at Restaurant', time: '12:00', category: 'food' })), false);
  assert.equal(isDailyAllowance(entry({ title: 'Museum visit', time: 'Daily allowance', category: 'activity' })), false);
  assert.equal(isDailyAllowance(entry({ title: 'Daily meals', location: 'Named restaurant', category: 'food' })), false);
  assert.equal(isDailyAllowance(entry({ title: 'Equipment allowance', time: 'Daily allowance', category: 'misc' })), true);
});
test('missing itemization and legacy mismatched totals remain explicit without changing saved amounts', () => {
  const plan = { currency: 'JPY', days: [{ totalCost: 100, activities: [] }, { totalCost: 50, activities: [entry({ estimatedCost: 100 })] }] } as unknown as ItineraryResponse;
  assert.equal(dailyCardEntries(plan, 0).remainder, 0);
  const negative = dailyCardEntries(plan, 1);
  assert.equal(negative.remainder, 0);
  assert.equal(negative.entryTotal, 0, 'mixed currency is excluded');
  assert.equal(plan.days[1].totalCost, 50, 'recorded totals remain untouched');
});
