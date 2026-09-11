import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryResponse } from '../lib/contracts.ts';
import { moveActivity, removeActivity, upsertActivity } from '../lib/itinerary-editor.ts';

const plan = (): ItineraryResponse => ({
  destination: 'Cebu', totalBudget: 10_000, currency: 'PHP', travelers: 2,
  accommodation: { listingId: 'stay', name: 'Stay', address: 'Cebu', nightlyRate: 1_000, nights: 1, total: 1_000 },
  budgetSummary: { accommodation: 3_400, food: 2_200, activities: 2_000, transport: 1_400, reserve: 1_000, dailyAverage: 5_000, total: 10_000 },
  costSharing: { partyType: 'couple', travelers: 2, groupBudget: 10_000, plannedGroupSpend: 1_600, budgetShares: [5_000, 5_000], plannedSpendShares: [800, 800], accommodationShares: [500, 500], reserveShares: [4_200, 4_200] },
  days: [
    { day: 1, date: '2026-10-01', theme: 'Arrival', imageUrl: '/beach-bg.png', totalCost: 1_300, activities: [{ time: '09:00', title: 'Museum', description: 'Visit', estimatedCost: 300, category: 'activity', icon: 'activity' }] },
    { day: 2, date: '2026-10-02', theme: 'Food', imageUrl: '/beach-bg.png', totalCost: 300, activities: [{ time: '12:00', title: 'Lunch', description: 'Eat', estimatedCost: 300, category: 'food', icon: 'food' }] },
  ],
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
