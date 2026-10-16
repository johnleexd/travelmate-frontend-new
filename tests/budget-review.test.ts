import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { budgetReview, budgetSavingsSuggestions } from '../lib/budget-review.ts';
import type { DayActivity, ItineraryResponse, PriceEvidence } from '../lib/contracts.ts';

import { budgetFixture as fixture } from './fixtures/budget-review-plan.ts';
const price = (amount: number, unit: PriceEvidence['unit'] = 'per-person'): PriceEvidence => ({ status: 'estimate', source: 'user-entered', basis: 'Recorded estimate', fetchedAt: '2040-01-01T00:00:00Z', currency: 'PHP', unitAmount: amount, quantity: 1, unit, participants: 2, needsConfirmation: true });
const activity = (category: DayActivity['category'], amount: number, evidence?: DayActivity['priceEvidence']): DayActivity => ({ title: 'Recorded '+category, time: '09:00', description: 'Recorded expense', estimatedCost: amount, category, icon: category, priceEvidence: evidence });
const category = (review: ReturnType<typeof budgetReview>, key: string) => review.categories.find(item => item.key === key)!;

test('counts extended group expenses once, including rooms/nights, shared fares, selected activities and pre-trip transfers', () => {
  const plan = fixture(), before = JSON.stringify(plan), review = budgetReview(plan);
  assert.equal(review.total, 4750); assert.equal(review.remaining, 1250); assert.equal(review.status, 'within-budget');
  assert.equal(category(review, 'accommodation').amount, 2400);
  assert.equal(category(review, 'food').amount, 600);
  assert.equal(category(review, 'transportation').amount, 1250);
  assert.equal(category(review, 'activities').amount, 500);
  assert.ok(Math.abs(review.categories.reduce((sum, row) => sum + (row.percentage ?? 0), 0) - 100) < 0.00001);
  assert.equal(JSON.stringify(plan), before, 'review never changes the saved itinerary');
});

test('uses expense estimates rather than budget allocation percentages or a stale summary', () => {
  const plan = fixture(); plan.budgetSummary.food = 900000; plan.budgetSummary.plannedSpend = 900000;
  assert.equal(budgetReview(plan).total, 4750);
  plan.days[0].activities[0].estimatedCost = 300; plan.days[0].activities[0].priceEvidence!.unitAmount = 150; plan.days[0].totalCost += 100;
  assert.equal(budgetReview(plan).total, 4850);
  plan.totalBudget = 4000;
  assert.equal(budgetReview(plan).remaining, -850); assert.equal(budgetReview(plan).status, 'over-budget');
});

test('unavailable and absent prices never become a free or within-budget trip', () => {
  const plan = fixture(); delete plan.accommodation; delete plan.selectedTravelCosts;
  plan.days = [{ ...plan.days[0], totalCost: 0, activities: ['food', 'transport', 'activity'].map(key => activity(key as DayActivity['category'], 0)) }];
  const review = budgetReview(plan);
  assert.equal(review.total, null); assert.equal(review.remaining, null); assert.equal(review.status, 'incomplete');
  for (const key of ['food', 'transportation', 'activities']) assert.equal(category(review, key).status, 'unavailable');
  plan.days[0].activities[0].priceEvidence = { ...price(0), status: 'unavailable' };
  assert.equal(budgetReview(plan).total, null);
});

test('keeps documented free prices distinct from missing prices', () => {
  const plan = fixture(); delete plan.accommodation; delete plan.selectedTravelCosts;
  plan.days = [{ ...plan.days[0], totalCost: 0, activities: ['food', 'transport', 'activity'].map(key => activity(key as DayActivity['category'], 0, price(0))) }];
  const review = budgetReview(plan);
  assert.equal(review.total, 0); assert.equal(review.status, 'within-budget');
  assert.equal(category(review, 'activities').amount, 0); assert.equal(category(review, 'activities').percentage, null);
});

test('partial estimates retain known amounts and mark affordability provisional, even when below budget', () => {
  const plan = fixture(); plan.days[0].activities.push(activity('activity', 0, { ...price(0), status: 'unavailable' }));
  const review = budgetReview(plan);
  assert.equal(review.total, 4750); assert.equal(review.remaining, 1250); assert.equal(review.incomplete, true);
  assert.equal(review.status, 'incomplete'); assert.equal(category(review, 'activities').status, 'partial');
  assert.equal(budgetReview(plan, { budget: 4000 }).status, 'over-budget');
});

test('currency mismatches are excluded without inventing a conversion', () => {
  const plan = fixture(); for (const day of plan.days) day.activities[0].priceEvidence!.currency = 'USD';
  const review = budgetReview(plan);
  assert.equal(review.total, 4150); assert.equal(category(review, 'food').amount, null);
  assert.equal(review.mixedCurrency, true); assert.equal(review.status, 'incomplete');
});

test('changing or excluding a stay removes the old nightly allocation rather than adding it again', () => {
  const plan = fixture();
  const excluded = budgetReview(plan, { accommodation: { selected: false } });
  assert.equal(excluded.total, 2350); assert.equal(category(excluded, 'accommodation').status, 'excluded');
  assert.equal(excluded.status, 'incomplete');
  const unpriced = budgetReview(plan, { accommodation: { selected: true, name: 'A different suggested stay' } });
  assert.equal(unpriced.total, 2350); assert.equal(category(unpriced, 'accommodation').status, 'unavailable');
  const updated = budgetReview(plan, { accommodation: { selected: true, amount: 1800, currency: 'PHP' } });
  assert.equal(updated.total, 4150); assert.equal(updated.remaining, 1850);
  assert.equal(budgetReview(plan, { accommodation: { selected: true, amount: 1800, currency: 'USD' } }).total, 2350);
});

test('no selected accommodation is clearly excluded and overnight affordability remains incomplete', () => {
  const plan = fixture(); delete plan.accommodation;
  for (const day of plan.days) day.totalCost = 350;
  const review = budgetReview(plan);
  assert.equal(category(review, 'accommodation').status, 'excluded'); assert.equal(review.total, 2350);
  assert.equal(review.incomplete, true);
});

test('recomputes recorded contingency and fees over current estimates, rather than stale grounded totals', () => {
  const plan = fixture();
  plan.grounding = { currency: 'PHP', nights: 2, accommodation: price(1200, 'per-room-night'), categories: { accommodation: 2400 }, additionalFees: 50, contingencyPercent: 10, unpricedExpenseCount: 0, total: 5280 } as ItineraryResponse['grounding'];
  assert.equal(budgetReview(plan).total, 5280);
  plan.days[0].activities[2].estimatedCost += 400; plan.days[0].activities[2].priceEvidence!.unitAmount += 200;
  const review = budgetReview(plan);
  assert.equal(review.total, 5720); assert.equal(category(review, 'contingency').amount, 520);
  plan.grounding!.unpricedExpenseCount = 1;
  assert.equal(budgetReview(plan).status, 'incomplete');
});

test('sandbox lodging prices are unavailable rather than a real trip estimate', () => {
  const plan = fixture(); plan.accommodation!.isLive = false;
  const review = budgetReview(plan);
  assert.equal(category(review, 'accommodation').amount, null); assert.equal(review.total, 2350); assert.equal(review.incomplete, true);
});

test('draft budgets update the balance and advice remains optional and does not mutate the plan', () => {
  const plan = fixture(), before = JSON.stringify(plan);
  const review = budgetReview(plan, { budget: 5000 });
  assert.equal(review.budgetDraft, true); assert.equal(review.remaining, 250);
  assert.equal(budgetSavingsSuggestions(review).length, 3);
  assert.equal(budgetSavingsSuggestions(review)[0].key, 'accommodation');
  assert.equal(JSON.stringify(plan), before);
});

test('captured saved PHP estimates reconcile with canonical totals without treating missing travel as complete', () => {
  const plan = JSON.parse(readFileSync(new URL('./fixtures/manila-existing-plan.json', import.meta.url), 'utf8')) as ItineraryResponse;
  const review = budgetReview(plan);
  assert.equal(review.total, plan.grounding!.total);
  assert.equal(review.total, 19799.97); assert.equal(review.remaining, 200.03);
  assert.equal(review.status, 'incomplete');
});

test('saved zero-decimal currency excludes the unselected lodging allowance and recalculates contingency', () => {
  const saved = JSON.parse(readFileSync(new URL('../e2e/fixtures/gimcheon-reopened-trip.json', import.meta.url), 'utf8'));
  const review = budgetReview(saved.trip.itinerary as ItineraryResponse);
  assert.equal(review.currency, 'KRW'); assert.equal(review.total, 616000);
  assert.equal(review.remaining, 384000); assert.equal(review.status, 'incomplete');
  assert.equal(category(review, 'accommodation').status, 'excluded');
  assert.equal(category(review, 'contingency').amount, 56000);
});

test('an unverified legacy zero stay and explicitly unavailable lodging never count as free accommodation', () => {
  const plan = fixture(); delete plan.accommodation!.quotedTotal;
  plan.accommodation!.total = 0; plan.accommodation!.nightlyRate = 0;
  assert.equal(category(budgetReview(plan), 'accommodation').status, 'unavailable');
  plan.grounding = { currency: 'PHP', nights: 2, accommodation: { ...price(0), status: 'unavailable' }, categories: { accommodation: 0 }, contingencyPercent: 0 } as ItineraryResponse['grounding'];
  assert.equal(category(budgetReview(plan), 'accommodation').amount, null);
});

test('a legacy stay with only a per-room nightly rate extends rooms and nights once', () => {
  const plan = fixture(), stay = plan.accommodation! as Partial<NonNullable<ItineraryResponse['accommodation']>>;
  delete stay.quotedTotal; delete stay.total; stay.nightlyRate = 300;
  for (const [index, day] of plan.days.entries()) day.totalCost = 350 + (index < 2 ? 600 : 0);
  const review = budgetReview(plan);
  assert.equal(category(review, 'accommodation').amount, 1200);
  assert.equal(review.total, 3550); assert.equal(review.remaining, 2450);
});
