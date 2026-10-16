import assert from 'node:assert/strict';
import test from 'node:test';
import { itineraryCostPresentation } from '../lib/itinerary-day-presentation.ts';
import { savedDayTheme } from '../lib/stored-trip-photos.ts';
import type { ItineraryResponse, DayPlan } from '../lib/contracts.ts';
const plan = (cost: number, status?: string) => ({ currency: 'PHP', totalBudget: 30000, budgetSummary: { plannedSpend: cost }, days: [{ totalCost: cost, activities: [{ title: 'Named museum', estimatedCost: cost, ...(status ? { priceEvidence: { status } } : {}) }] }] } as ItineraryResponse);
test('all unpriced or legacy zero amounts never imply a zero-cost trip; the user budget is untouched', () => {
  for (const input of [plan(0), plan(0, 'unavailable')]) {
    const before = JSON.stringify(input), result = itineraryCostPresentation(input);
    assert.equal(result.status, 'Partial estimate'); assert.equal(result.amount, undefined); assert.equal(input.totalBudget, 30000);
    assert.equal(JSON.stringify(input), before);
  }
});
test('positive estimates, recorded free costs and unpriced expense counts keep their distinct meaning', () => {
  assert.equal(itineraryCostPresentation(plan(500)).amount, 500);
  assert.equal(itineraryCostPresentation(plan(500)).status, 'Partial estimate');
  assert.equal(itineraryCostPresentation(plan(0, 'provider-quote')).amount, 0);
  const input = plan(500); input.days[0].activities.push({ title: 'Another named place', estimatedCost: 0, priceEvidence: { status: 'unavailable' } } as never);
  assert.equal(itineraryCostPresentation(input).amount, 500); assert.ok(itineraryCostPresentation(input).unpriced >= 1);
  assert.equal(itineraryCostPresentation(input).status, 'Partial estimate');
  assert.equal(itineraryCostPresentation(input).amountLabel, 'Total estimated cost (partial)');
  const over = plan(40000); assert.equal(itineraryCostPresentation(over).status, 'Estimate exceeds budget');
});
test('short saved themes are retained; missing/long/concatenated themes are never invented', () => {
  const day = { theme: 'Museums and heritage', activities: [{ title: 'Museum A' }, { title: 'Museum B' }] } as DayPlan;
  assert.equal(savedDayTheme(day, 'Paris'), 'Museums and heritage');
  for (const theme of ['', 'Museum A, Museum B', 'x'.repeat(100), 'Paris: details need confirmation']) assert.equal(savedDayTheme({ ...day, theme }, 'Paris'), '');
  assert.equal(day.theme, 'Museums and heritage');
});
