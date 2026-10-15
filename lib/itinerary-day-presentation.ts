import type { DayActivity, ItineraryResponse } from './contracts.ts';
import { allocateNightlyCosts } from './domain.ts';

/** Partition for display only; retain saved order and original handler indices. */
export function isDailyAllowance(item: DayActivity): boolean {
  if (item.place || item.location?.trim() || /\bat\s+\S/i.test(item.title)) return false;
  return /^daily\s+(?:meals?|food|transport(?:ation)?)(?:$|\s+(?:in|allowance|budget)\b)/i.test(item.title)
    || /\b(?:daily|meals?|food|transport(?:ation)?)\s+(?:budget|allowance)\b/i.test(item.title)
    || /^(?:daily allowance|daily budget)$/i.test(item.time?.trim() || '') && item.category !== 'activity';
}

export function dailyCardEntries(itinerary: ItineraryResponse, dayIndex: number) {
  const day = itinerary.days[dayIndex];
  const entries = day.activities.map((activity, index) => ({ activity, index }));
  const activities = entries.filter(({ activity }) => !isDailyAllowance(activity));
  const allowances = entries.filter(({ activity }) => isDailyAllowance(activity));
  const entryTotal = day.activities.reduce((sum, item) => sum + item.estimatedCost, 0);
  const remainder = Math.round((day.totalCost - entryTotal) * 100) / 100;
  let remainderLabel = remainder < 0 ? 'Recorded total adjustment — needs confirmation' : 'Other costs included in daily total';
  const nights = itinerary.accommodation?.nights || itinerary.grounding?.nights || 0;
  const stayTotal = itinerary.accommodation?.quotedTotal ?? itinerary.grounding?.categories.accommodation ?? itinerary.accommodation?.total;
  if (nights && stayTotal !== undefined) {
    try {
      const lodging = allocateNightlyCosts(stayTotal, nights, itinerary.currency)[dayIndex] || 0;
      if (remainder > 0 && Math.abs(lodging - remainder) < 0.005) remainderLabel = 'Accommodation allocation';
    } catch { /* Older records may not contain a valid stay allocation; do not invent its basis. */ }
  }
  return { activities, allowances, entryTotal, remainder, remainderLabel };
}

/** Presentation only: unavailable prices never become a zero-cost trip. */
export function itineraryCostPresentation(itinerary: ItineraryResponse, dayIndex?: number) {
  const days = dayIndex === undefined ? itinerary.days : [itinerary.days[dayIndex]];
  const entries = days.flatMap(day => day.activities);
  const missing = entries.filter(item => item.priceEvidence?.status === 'unavailable' || !Number.isFinite(item.estimatedCost) || item.estimatedCost === 0 && !item.priceEvidence).length;
  const unpriced = dayIndex === undefined ? Math.max(missing, itinerary.grounding?.unpricedExpenseCount || 0) : missing;
  const supplied = dayIndex !== undefined ? days[0].totalCost : itinerary.budgetSummary.plannedSpend ?? itinerary.costSharing?.plannedGroupSpend ?? itinerary.grounding?.total;
  const amount = supplied !== undefined && Number.isFinite(supplied) ? supplied : days.every(day => Number.isFinite(day.totalCost)) ? days.reduce((sum, day) => sum + day.totalCost, 0) : undefined;
  const estimated = entries.some(item => item.priceEvidence?.status !== 'provider-quote') || !itinerary.grounding;
  const exceeds = dayIndex === undefined && amount !== undefined && amount > itinerary.totalBudget;
  return { amount: amount !== undefined && (amount !== 0 || !unpriced && entries.length > 0) ? amount : undefined, unpriced,
    status: exceeds ? estimated ? 'Estimate exceeds budget' : 'Recorded expenses exceed budget' : unpriced || amount === undefined || !entries.length ? 'Costs not confirmed' : estimated ? 'Estimated expenses' : 'Recorded expenses',
    amountLabel: unpriced ? estimated ? 'Estimated subtotal' : 'Known subtotal' : estimated ? 'Estimated expenses' : 'Recorded expenses' };
}
