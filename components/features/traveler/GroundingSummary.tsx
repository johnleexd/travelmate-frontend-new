import type { DayActivity, ItineraryResponse } from '@/lib/contracts';
import { formatMoney } from '@/lib/domain';
import { expenseLedger } from '@/lib/generated/expense-ledger';
import { ExpenseEstimate } from './ExpenseEstimate';

export function ActivityEvidence({ activity, currency }: { activity: DayActivity; currency: ItineraryResponse['currency'] }) {
  return <div className="mt-2 text-xs leading-5"><ExpenseEstimate item={activity} currency={currency}/>{activity.place && <details><summary className="cursor-pointer">Place and operating hours</summary><a className="underline" href={activity.place.sourceUrl} target="_blank" rel="noreferrer">{activity.place.name}</a><p>{activity.place.address} · {activity.place.city}, {activity.place.country}</p><p>Opening hours: {activity.place.openingHours}</p></details>}</div>;
}
export function GroundingSummary({ itinerary }: { itinerary: ItineraryResponse; draft?: boolean }) {
  const review = expenseLedger(itinerary), data = itinerary.grounding;
  const price = itinerary.accommodationEstimate ?? data?.accommodation;
  return <section aria-label="Expense sources and confidence" className="my-5 border-y border-slate-800 py-5 text-sm">
    <h2 className="font-bold">Total estimated cost{review.incomplete ? ' (partial)' : ''}: {review.total === null ? 'Estimate unavailable' : formatMoney(review.total,itinerary.currency)}</h2>
    <p className="mt-2">Includes {formatMoney(review.allowanceTotal,itinerary.currency)} in suggested allowances.</p>
    <p>{review.status === 'over-budget' ? 'Estimated costs exceed your budget.' : review.incomplete ? 'Remaining budget is provisional; some expenses remain unpriced.' : 'Compare estimated costs with your spending limit.'}</p>
    <details className="mt-3 text-xs leading-5"><summary className="cursor-pointer">Estimate calculation basis</summary>
      <p>For planning purposes only. Actual prices may vary.</p>
      <p>Amounts cover recorded participants and quantities. Daily meal and transport envelopes cover itemized expenses first. Shared expenses and selected activity costs are counted once.</p>
      {price && <p>Accommodation: {price.basis} {price.currency} {price.unitAmount} / room/night × {price.quantity} room-night(s). Recorded {new Date(price.fetchedAt).toLocaleDateString()}.</p>}
      <p>Contingency is a planning allowance, calculated once from the expense subtotal. Missing prices are excluded, never treated as free.</p>
      {!data && <p>Historical estimates are preserved; no new allowance is applied merely by opening this trip.</p>}
      {data?.limitations.map(note=><p key={note} className="mt-1">{note}</p>)}
    </details>
  </section>;
}