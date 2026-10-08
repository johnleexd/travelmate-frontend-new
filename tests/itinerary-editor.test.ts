import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryResponse } from '../lib/contracts.ts';
import { moveActivity, recalculateItineraryCosts, removeActivity, upsertActivity } from '../lib/itinerary-editor.ts';

const plan = (): ItineraryResponse => ({
  destination: 'Cebu', totalBudget: 10_000, currency: 'PHP', travelers: 2,
  accommodation: { listingId: 'stay', name: 'Stay', address: 'Cebu', nightlyRate: 1_000, nights: 1, total: 1_000, currency: 'PHP' },
  budgetSummary: { accommodation: 3_400, food: 2_200, activities: 2_000, transport: 1_400, reserve: 1_000, dailyAverage: 5_000, total: 10_000 },
  costSharing: { partyType: 'couple', travelers: 2, groupBudget: 10_000, plannedGroupSpend: 1_600, budgetShares: [5_000, 5_000], plannedSpendShares: [800, 800], accommodationShares: [500, 500], reserveShares: [4_200, 4_200] },
  days: [
    { day: 1, date: '2026-10-01', theme: 'Arrival', imageUrl: '/beach-bg.png', totalCost: 1_300, activities: [{ time: '09:00', title: 'Museum', description: 'Visit', estimatedCost: 300, category: 'activity', icon: 'activity' }] },
    { day: 2, date: '2026-10-02', theme: 'Food', imageUrl: '/beach-bg.png', totalCost: 300, activities: [{ time: '12:00', title: 'Lunch', description: 'Eat', estimatedCost: 300, category: 'food', icon: 'food' }] },
  ],
});

test('editing a 31-day trip retains a 30-night quote and counts flight costs once', () => {
  const original = plan();
  const long: ItineraryResponse = { ...original, totalBudget: 100000, days: Array.from({ length: 31 }, (_, i) => ({ ...original.days[0], day: i + 1, date: new Date(Date.parse('2040-01-25') + i * 86400000).toISOString().slice(0, 10) })), accommodation: { ...original.accommodation!, nights: 30, nightlyRate: 100.03, quotedTotal: 3000.99, total: 3000.99 }, selectedTravelCosts: { activities: [], total: 500, flight: { id: 'flight', name: 'Trip flight', total: 500, currency: 'PHP', fetchedAt: new Date().toISOString() } } };
  const edited = recalculateItineraryCosts(long);
  assert.equal(edited.days.length, 31);
  assert.equal(edited.days[30].totalCost, 300);
  assert.equal(edited.budgetSummary.plannedSpend, 31 * 300 + 3000.99 + 500);
  assert.equal(edited.budgetSummary.accommodationActual, 3000.99);
});

test('adding and editing activities recalculates costs', () => {
  const added = upsertActivity(plan(), 1, null, { time: '14:00', title: 'Bus ride', description: 'Transfer', estimatedCost: 500, category: 'transport' });
  assert.equal(added.days[1].totalCost, 800);
  assert.equal(added.days[1].rideFare, 500);
  assert.equal(added.budgetSummary.plannedSpend, 2_100);
  const edited = upsertActivity(added, 1, 0, { time: '12:30', title: 'Lunch updated', description: 'Eat local', estimatedCost: 700, category: 'food' });
  assert.equal(edited.days[1].totalCost, 1_200);
});

test('removing the final activity leaves a valid empty day', () => {
  const result = removeActivity(plan(), 1, 0);
  assert.deepEqual(result.days[1].activities, []);
  assert.equal(result.days[1].totalCost, 0);
});

test('activities reorder only within the selected day', () => {
  const withTwo = upsertActivity(plan(), 0, null, { time: '11:00', title: 'Second stop', description: '', estimatedCost: 200, category: 'misc' });
  const moved = moveActivity(withTwo, 0, 1, -1);
  assert.deepEqual(moved.days[0].activities.map((activity) => activity.title), ['Second stop', 'Museum']);
  assert.equal(moved.days[1].activities[0].title, 'Lunch');
});

test('manual cost changes immediately refresh review-only budget alternatives', () => {
  const result = upsertActivity(plan(), 0, 0, { time: '09:00', title: 'Premium island tour', description: 'Guided tour', estimatedCost: 10_000, category: 'activity' });
  assert.equal(result.budgetOptimization?.status, 'over_budget');
  assert.ok((result.budgetOptimization?.amountToTarget || 0) > 0);
  assert.equal(result.budgetOptimization?.suggestions.find((suggestion) => suggestion.category === 'activity')?.affectedActivityTitle, 'Premium island tour');
  assert.match(result.budgetOptimization?.disclaimer || '', /Nothing is changed automatically/);
});


test('shared fares retain their whole-party unit price and edits discard claimed provenance', () => {
  const original = plan();
  const fare = { status: 'estimate' as const, source: 'user-entered', basis: 'Shared daily taxi fare', fetchedAt: new Date().toISOString(), currency: 'PHP' as const, unit: 'shared-fare' as const, unitAmount: 300, quantity: 1, participants: 2, needsConfirmation: true };
  original.days[0].activities[0].priceEvidence = fare;
  original.days[0].activities[0].unitCost = 300;
  assert.equal(recalculateItineraryCosts(original).days[0].activities[0].unitCost, 300);
  original.grounding = { version: 1, nights: 1, categories: { accommodation: 1000 } } as NonNullable<ItineraryResponse['grounding']>;
  const edited = upsertActivity(original, 0, 0, { time: '10:00', title: 'Changed taxi route', description: 'User entered', category: 'transport', estimatedCost: 500 });
  assert.equal(edited.days[0].activities[0].priceEvidence?.unit, 'group');
  assert.equal(edited.days[0].activities[0].priceEvidence?.unitAmount, 500);
  assert.equal(edited.days[0].activities[0].priceEvidence?.status, 'estimate');
  assert.equal(edited.days[0].activities[0].place, undefined);
  assert.equal(edited.days[0].activities[0].imageUrl, undefined);
});
