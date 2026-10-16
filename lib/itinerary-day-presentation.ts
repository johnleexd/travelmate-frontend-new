import type { DayActivity, ItineraryResponse } from './contracts.ts';
import { allocateNightlyCosts, roundMoney, sumMoney } from './domain.ts';
import { expenseLedger } from './generated/expense-ledger.ts';

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
  const costs = expenseLedger(itinerary).days[dayIndex];
  const entryTotal = sumMoney(costs.rows.map(row=>row.amount ?? 0),itinerary.currency);
  const remainder = roundMoney((costs.amount ?? 0)-entryTotal,itinerary.currency);
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
  const review = expenseLedger(itinerary);
  const day = dayIndex === undefined ? undefined : review.days[dayIndex];
  const unpriced = day ? day.unpriced : review.incomplete ? Math.max(1, review.unpriced) : 0;
  return { amount: (day ? day.amount : review.total) ?? undefined, unpriced,
    allowance: day ? day.allowance : review.allowanceTotal,
    status: review.status === 'over-budget' ? 'Estimate exceeds budget' : unpriced ? 'Partial estimate' : 'Total estimated cost',
    amountLabel: unpriced ? 'Total estimated cost (partial)' : 'Total estimated cost' };
}
