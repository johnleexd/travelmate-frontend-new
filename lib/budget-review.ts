import type { ItineraryResponse } from './contracts.ts';
import { allocateNightlyCosts, currencyFractionDigits, type CurrencyCode } from './domain.ts';

type CategoryKey = 'accommodation' | 'food' | 'transportation' | 'activities' | 'other' | 'contingency';
export type BudgetCategory = {
  key: CategoryKey; label: string; amount: number | null; percentage: number | null;
  status: 'estimated' | 'partial' | 'unavailable' | 'excluded';
};
export type AccommodationPreview = { selected: boolean; name?: string; amount?: number; currency?: CurrencyCode };
export type BudgetReviewOptions = { budget?: number; accommodation?: AccommodationPreview };
const validAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const labels: Record<CategoryKey, string> = { accommodation: 'Accommodation', food: 'Food', transportation: 'Transportation', activities: 'Activities', other: 'Other estimates & fees', contingency: 'Contingency' };

/** Read group expense amounts, never the budget-allocation targets in budgetSummary. */
export function budgetReview(plan: ItineraryResponse, options: BudgetReviewOptions = {}) {
  const scale = 10 ** currencyFractionDigits(plan.currency);
  const round = (value: number) => Math.round(value * scale) / scale;
  const buckets = Object.fromEntries(Object.keys(labels).map(key => [key, { units: 0, priced: 0, missing: 0 }])) as Record<CategoryKey, { units: number; priced: number; missing: number }>;
  let mixedCurrency = false, inconsistent = false;
  const add = (key: CategoryKey, value: unknown, currency: string = plan.currency, unavailable = false) => {
    const bucket = buckets[key];
    if (currency !== plan.currency) mixedCurrency = true;
    if (unavailable || currency !== plan.currency || !validAmount(value)) { bucket.missing++; return; }
    bucket.units += Math.round(value * scale); bucket.priced++;
  };
  const grounding = plan.grounding?.currency === plan.currency ? plan.grounding : undefined;
  if (plan.grounding && !grounding) mixedCurrency = true;
  const stay = plan.accommodation;
  const recordedStayTotal = stay?.quotedTotal ?? stay?.total
    ?? (grounding?.accommodation.status !== 'unavailable' ? grounding?.categories.accommodation : undefined)
    ?? (stay && validAmount(stay.nightlyRate) && validAmount(stay.nights) ? round(stay.nightlyRate * stay.nights * (stay.rooms ?? 1)) : undefined);
  const lodgingItems = plan.days.flatMap(day => day.activities).filter(item => item.category === 'accommodation');
  const selectedAccommodation = options.accommodation?.selected ?? Boolean(stay || plan.plannedAccommodation || lodgingItems.some(item => item.estimatedCost > 0));
  const accommodationName = options.accommodation?.name ?? stay?.name ?? plan.plannedAccommodation?.name;
  if (options.accommodation) {
    if (selectedAccommodation) add('accommodation', options.accommodation.amount, options.accommodation.currency);
  } else if (selectedAccommodation && (stay || plan.plannedAccommodation)) {
    add('accommodation', recordedStayTotal, stay?.currency ?? grounding?.accommodation.currency,
      stay?.isLive === false || stay?.providerQuote?.isLive === false || grounding?.accommodation.status === 'unavailable'
      || recordedStayTotal === 0 && !grounding && stay?.quotedTotal === undefined && !stay?.providerQuote);
  }
  for (const day of plan.days) for (const item of day.activities) {
    const key: CategoryKey = item.category === 'transport' ? 'transportation' : item.category === 'activity' ? 'activities' : item.category === 'misc' ? 'other' : item.category;
    // A selected stay is allocated into day totals already. Never add it again.
    if (key === 'accommodation' && (stay || plan.plannedAccommodation || options.accommodation)) continue;
    if (key === 'accommodation' && !selectedAccommodation) continue;
    const price = item.priceEvidence;
    // estimatedCost is already the extended group amount, including its recorded
    // daily/participant/shared-fare basis. quantity=0 is included in selected costs.
    add(key, item.estimatedCost, price?.currency, price?.status === 'unavailable' || item.estimatedCost === 0 && !price);
  }
  const selected = plan.selectedTravelCosts;
  if (selected?.flight) add('transportation', selected.flight.total, selected.flight.currency, selected.flight.isLive === false);
  for (const item of selected?.activities ?? []) add('activities', item.total, item.currency, item.isLive === false);
  const preTrip = selected?.preTrip;
  if (preTrip) {
    const transfers = preTrip.airportTransferOutbound + preTrip.airportTransferReturn;
    const other = preTrip.passport + preTrip.visaOrAuthorization + preTrip.departureTaxes + preTrip.insurance + preTrip.other;
    if (transfers > 0) add('transportation', transfers, preTrip.currency);
    if (other > 0) add('other', other, preTrip.currency);
    if (!validAmount(transfers) || !validAmount(other)) buckets.other.missing++;
  }
  if (selected && !selected.flight && !selected.activities.length && !preTrip && selected.total > 0) buckets.other.missing++;
  if (grounding && grounding.additionalFees > 0) add('other', grounding.additionalFees);
  // Older day totals can include additional recorded costs. Remove the original
  // lodging allocation before reconciling; a draft stay change must not restore it.
  if (!grounding) {
    let lodging: number[] = [];
    const nights = stay?.nights ?? plan.grounding?.nights ?? 0;
    const allocated = recordedStayTotal ?? plan.budgetSummary.accommodationActual;
    if (nights && validAmount(allocated)) {
      try { lodging = allocateNightlyCosts(allocated, nights, plan.currency); } catch { inconsistent = true; }
    }
    plan.days.forEach((day, index) => {
      const items = day.activities.reduce((sum, item) => sum + (validAmount(item.estimatedCost) ? item.estimatedCost : 0), 0);
      if (!validAmount(day.totalCost)) { inconsistent = true; return; }
      const remainder = round(day.totalCost - items - (lodging[index] ?? 0));
      if (remainder > 0) add('other', remainder);
      if (remainder < 0) inconsistent = true;
    });
  }
  for (const key of ['food', 'transportation', 'activities'] as const) if (!buckets[key].priced && !buckets[key].missing) buckets[key].missing++;
  const subtotalUnits = Object.values(buckets).reduce((sum, bucket) => sum + bucket.units, 0);
  if (grounding && grounding.contingencyPercent > 0 && Object.values(buckets).some(bucket => bucket.priced > 0)) add('contingency', round(subtotalUnits / scale * grounding.contingencyPercent / 100));
  const totalUnits = Object.values(buckets).reduce((sum, bucket) => sum + bucket.units, 0);
  const hasPrices = Object.values(buckets).some(bucket => bucket.priced > 0);
  const total = hasPrices ? totalUnits / scale : null;
  const budgetValue = options.budget ?? plan.totalBudget;
  const budget = validAmount(budgetValue) && budgetValue > 0 ? round(budgetValue) : null;
  const nights = grounding?.nights ?? stay?.nights ?? Math.max(0, plan.days.length - 1);
  const incomplete = Object.values(buckets).some(bucket => bucket.missing > 0)
    || Boolean(grounding?.unpricedExpenseCount) || Boolean(grounding && !selected?.flight)
    || !selectedAccommodation && nights > 0 || mixedCurrency || inconsistent || !hasPrices;
  const remaining = budget !== null && total !== null ? round(budget - total) : null;
  const categories = (Object.keys(labels) as CategoryKey[]).filter(key => !['other', 'contingency'].includes(key) || buckets[key].units > 0 || buckets[key].missing > 0).map((key): BudgetCategory => {
    const bucket = buckets[key], excluded = key === 'accommodation' && !selectedAccommodation;
    return { key, label: labels[key], amount: excluded || !bucket.priced ? null : bucket.units / scale,
      percentage: !excluded && bucket.priced && totalUnits > 0 ? bucket.units / totalUnits * 100 : null,
      status: excluded ? 'excluded' : !bucket.priced ? 'unavailable' : bucket.missing ? 'partial' : 'estimated' };
  });
  return { currency: plan.currency, budget, total, remaining, categories, incomplete, mixedCurrency, inconsistent,
    selectedAccommodation, accommodationName, nights,
    budgetDraft: budget !== null && budget !== plan.totalBudget,
    accommodationDraft: options.accommodation !== undefined,
    status: remaining !== null && remaining < 0 ? 'over-budget' as const : incomplete || remaining === null ? 'incomplete' as const : 'within-budget' as const };
}

export function budgetSavingsSuggestions(review: ReturnType<typeof budgetReview>) {
  const items: { key: 'accommodation' | 'transportation' | 'activities' | 'food'; title: string; description: string }[] = [];
  if (review.selectedAccommodation) items.push({ key: 'accommodation', title: 'Compare suggested stays', description: 'Explore other areas or accommodation types, and compare the full stay estimate. Confirm rates with the property before deciding.' });
  if (review.categories.some(item => item.key === 'transportation' && (item.amount === null || item.amount > 0))) items.push({ key: 'transportation', title: 'Consider public transport', description: 'Compare local public or shared transport with private rides, where available. Check routes, travel time, luggage and accessibility needs.' });
  if (review.categories.some(item => item.key === 'activities' && (item.amount === null || item.amount > 0))) items.push({ key: 'activities', title: 'Mix free and paid activities', description: 'Look for suitable free-entry places alongside paid visits. Confirm admission prices, opening hours and travel costs before changing your plan.' });
  if (review.categories.some(item => item.key === 'food' && item.amount !== null && item.amount > 0)) items.push({ key: 'food', title: 'Set a daily food allowance', description: 'Compare menus and local markets, then choose a daily allowance that fits your group. Keep dietary needs and convenience in mind.' });
  return items.slice(0, 3);
}
