import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { restoredExpenseAssumptions } from '../lib/expense-assumptions.ts';
import type { ItineraryResponse } from '../lib/contracts.ts';
test('reopening retains entered estimates and room/contingency settings without promoting budget allowances to researched prices', () => {
  const fixtures = JSON.parse(readFileSync(new URL('../e2e/fixtures/grounded-plans.json', import.meta.url), 'utf8'));
  const plan = fixtures[2].itinerary as ItineraryResponse;
  assert.deepEqual(restoredExpenseAssumptions(plan), { rooms: 3, foodDailyPerPerson: 100, nightlyRoomEstimate: undefined, transportFare: 100, transportFareType: 'shared-fare', fees: 100, contingencyPercent: 10 });
  plan.days[0].activities.find(activity => activity.category === 'food')!.priceEvidence!.source = 'budget-allowance';
  assert.equal(restoredExpenseAssumptions(plan).foodDailyPerPerson, undefined);
  assert.deepEqual(restoredExpenseAssumptions({ ...plan, grounding: undefined }), {});
});
