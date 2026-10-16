export { expenseLedger as budgetReview } from './generated/expense-ledger.ts';
export type { BudgetCategory, AccommodationPreview, BudgetReviewOptions } from './generated/expense-ledger.ts';
import { expenseLedger as budgetReview } from './generated/expense-ledger.ts';
export function budgetSavingsSuggestions(review: ReturnType<typeof budgetReview>) {
  const items: { key: 'accommodation' | 'transportation' | 'activities' | 'food'; title: string; description: string }[] = [];
  if (review.selectedAccommodation) items.push({ key: 'accommodation', title: 'Compare suggested stays', description: 'Explore other areas or accommodation types, and compare the full stay estimate. Confirm rates with the property before deciding.' });
  if (review.categories.some(item => item.key === 'transportation' && (item.amount === null || item.amount > 0))) items.push({ key: 'transportation', title: 'Consider public transport', description: 'Compare local public or shared transport with private rides, where available. Check routes, travel time, luggage and accessibility needs.' });
  if (review.categories.some(item => item.key === 'activities' && (item.amount === null || item.amount > 0))) items.push({ key: 'activities', title: 'Mix free and paid activities', description: 'Look for suitable free-entry places alongside paid visits. Confirm admission prices, opening hours and travel costs before changing your plan.' });
  if (review.categories.some(item => item.key === 'food' && item.amount !== null && item.amount > 0)) items.push({ key: 'food', title: 'Set a daily food allowance', description: 'Compare menus and local markets, then choose a daily allowance that fits your group. Keep dietary needs and convenience in mind.' });
  return items.slice(0, 3);
}
