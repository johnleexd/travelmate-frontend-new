import type { DayActivity, ItineraryResponse } from '@/lib/contracts';
import { formatMoney } from '@/lib/domain';

export function ActivityEvidence({ activity, currency }: { activity: DayActivity; currency: ItineraryResponse['currency'] }) {
  const evidence = activity.priceEvidence;
  if (!evidence) return null;
  return <div className="mt-2 text-[11px] leading-5 text-white/50">
    <p className={evidence.status === 'provider-quote' ? 'text-cyan-200' : 'text-amber-200'}>{evidence.status === 'provider-quote' ? 'Provider quote — recheck before booking' : evidence.status === 'unavailable' ? 'Price: Not available' : evidence.source === 'budget-allowance' ? 'Budget allowance — market price not available' : evidence.source === 'user-entered' ? 'User-entered estimate — not a confirmed price' : 'Estimate — not a confirmed price'}</p>
    <p>{evidence.quantity === 0 ? 'Included once in selected activity costs' : evidence.unit === 'shared-fare' ? `${formatMoney(evidence.unitAmount, currency)} shared fare` : evidence.unit === 'group' ? 'Whole-group amount' : `${formatMoney(evidence.unitAmount, currency)} per person × ${evidence.participants} participant${evidence.participants === 1 ? '' : 's'}`} · {formatMoney(activity.estimatedCost, currency)} additional group amount</p>
    <details><summary className="cursor-pointer text-white/65">Price and place sources</summary><p>{evidence.basis}</p><p>Source: {evidence.source} · {new Date(evidence.fetchedAt).toLocaleString()} · {evidence.currency}</p>{activity.place && <p><a className="underline" href={activity.place.sourceUrl} target="_blank" rel="noreferrer">{activity.place.name}</a> · {activity.place.city}, {activity.place.country} · {activity.place.placeId} · retrieved {new Date(activity.place.fetchedAt).toLocaleString()}<br/>Opening hours: {activity.place.openingHours}<br/>Address: {activity.place.address}</p>}</details>
  </div>;
}

export function GroundingSummary({ itinerary, draft = false }: { itinerary: ItineraryResponse; draft?: boolean }) {
  const data = itinerary.grounding;
  if (!data) return <p className="mb-5 text-xs text-amber-200">This older plan has no recorded price or place provenance. Its estimates and photos need confirmation.</p>;
  return <section aria-label="Expense sources and confidence" className="my-5 border-y border-slate-800 py-5 text-sm">
    <h2 className="font-bold">Expense sources and confidence</h2>
    <p className="mt-2 text-xs text-white/55">{data.startingLocation ? `From ${data.startingLocation} to ` : 'Destination: '}{data.destination.city}, {data.destination.country} · {data.startDate}–{data.endDate} · {data.destination.latitude.toFixed(4)}, {data.destination.longitude.toFixed(4)}</p>
    <p className="mt-2 text-amber-200">{draft ? 'Manual draft: save changes to recompute the source-backed expense breakdown.' : data.budgetStatus === 'exceeds-budget' ? 'These expenses exceed your group budget.' : data.budgetStatus === 'needs-confirmation' ? 'Affordability needs confirmation: some prices, fees or travel costs are unavailable.' : 'Quoted costs fit the budget; availability and unquoted fees still need confirmation.'}</p>
    {!draft && <><dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">{Object.entries(data.categories).map(([category, amount]) => <div key={category} className="flex justify-between gap-3"><dt className="capitalize text-white/60">{category === 'contingency' ? `Contingency (${data.contingencyPercent}% of subtotal)` : category}</dt><dd className="font-mono">{formatMoney(amount, itinerary.currency)}</dd></div>)}</dl>
    <div className="mt-3 flex justify-between gap-3 border-t border-slate-800 pt-3 font-bold"><span>Whole-group total including contingency</span><span>{formatMoney(data.total, itinerary.currency)}</span></div><p className="mt-1 text-xs text-white/55">Provider-quoted: {formatMoney(data.verifiedAmount, itinerary.currency)} · estimates/allowances: {formatMoney(data.estimatedAmount, itinerary.currency)}. Unavailable expenses are not a zero-price guarantee.</p></>}
    <details className="mt-3 text-xs leading-5 text-white/55"><summary className="cursor-pointer text-cyan-200">Calculation basis and information to confirm</summary>
      <p className="mt-2">Accommodation: {data.rooms} room(s) × {data.nights} nights × {formatMoney(data.accommodation.unitAmount, itinerary.currency)} average per room/night. {data.accommodation.basis}</p>
      <p>Food: {formatMoney(data.foodDailyPerPerson, itinerary.currency)} daily per person × {itinerary.travelers || 1} travelers × {itinerary.days.length} days.</p>
      <p>Activity amounts use their participating travelers. Shared fares are counted once. Fees include entered and quoted amounts only; unspecified taxes and mandatory fees are not verified.</p>
      {data.limitations.map(note => <p key={note} className="mt-1">{note}</p>)}
      <p className="mt-2">Place references: Wikipedia/Wikidata · {data.placeDataStatus} · plan assembled {new Date(data.fetchedAt).toLocaleString()}; individual place retrieval times are listed with activity sources. Photos use place-linked Commons files with attribution, never generated substitute images.</p>
    </details>
  </section>;
}
