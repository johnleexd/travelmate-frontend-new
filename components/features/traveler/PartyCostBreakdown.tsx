import type { ItineraryResponse } from '@/lib/contracts';
import { formatMoney, PARTY_TYPE_LABELS } from '@/lib/domain';
import { expenseLedger } from '@/lib/generated/expense-ledger';

export function PartyCostBreakdown({ itinerary, review = expenseLedger(itinerary) }: { itinerary: ItineraryResponse; review?: ReturnType<typeof expenseLedger> }) {
  const { party, shares } = review;
  const money = (amount: number) => formatMoney(amount, itinerary.currency);
  return <section aria-label="Travel party cost breakdown" className="my-4 rounded-xl border border-current/20 p-4 text-sm leading-6">
    <p>{itinerary.destination}</p>
    <p className="font-semibold">{party ? `${PARTY_TYPE_LABELS[party.partyType]} · ${party.travelers} ${party.travelers === 1 ? 'traveler' : 'travelers'}` : 'Travel party details need confirmation'}</p>
    <p>Trip budget: {review.budget === null ? 'Unavailable' : money(review.budget)} · {party?.travelers === 1 ? 'covers 1 traveler' : 'covers the entire party'}</p>
    <p><strong>Full-trip estimated cost{review.incomplete ? ' (partial)' : ''}: {review.total === null ? 'Unavailable' : money(review.total)}</strong>{party && party.travelers > 1 ? ` combined for ${party.travelers} travelers` : ''}</p>
    {shares && shares.length > 1 && <>
      <p>{new Set(shares).size === 1 ? money(shares[0]) : `${money(Math.min(...shares))}–${money(Math.max(...shares))}`} estimated equal share per traveler.</p>
      <details open={party?.partyType === 'couple'}><summary className="cursor-pointer">Estimated traveler breakdown</summary><ul className="mt-2 grid gap-x-6 sm:grid-cols-2">{shares.map((share, index) => <li key={index}>Traveler {index + 1}: <strong>{money(share)}</strong></li>)}</ul><p className="mt-2 text-xs">Planning shares add up to the combined total, including rounding. Actual individual prices may differ; no ages or discounts are assumed.</p></details>
    </>}
    {review.needsBudgetRefresh && <p role="status" className="mt-2">Budget refresh or clarification needed: some recorded costs or party details have missing or different coverage. Saved activities and amounts are preserved; ambiguous costs are excluded and traveler shares are withheld. Edit the affected activity’s total or refresh its estimate before relying on the budget.</p>}
    {review.partyDraft && <p role="status" className="mt-2">Traveling mode or traveler count has changed in trip details. These costs still describe the recorded party above. Generate and save an updated plan to price the new party; traveler shares are withheld.</p>}
  </section>;
}
