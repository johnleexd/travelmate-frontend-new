import { ArrowRight, Plane, Ticket } from 'lucide-react';
import { ProviderFreshness } from '@/components/common/ProviderFreshness';
import { ReferenceAmount } from '@/components/common/ReferenceAmount';
import type { ActivityOption, ExchangeRateQuote, FlightOption, FreshnessMetadata, LiveAccommodation, TravelOptionsResponse } from '@/lib/contracts';
import { isCurrencyCode } from '@/lib/currency-conversion';
import type { CurrencyCode, Listing } from '@/lib/domain';

type Props = {
  flightOrigin: string;
  destination: string;
  selectedDestination: boolean;
  startDate: string;
  endDate: string;
  travelers: number;
  busy: boolean;
  message: string;
  travelOptions: TravelOptionsResponse | null;
  selectedFlightId: string;
  selectedActivityIds: string[];
  stayOptions: Listing[];
  liveAccommodations: LiveAccommodation[];
  stayFreshness?: FreshnessMetadata | null;
  tripDays: number;
  referenceCurrency: CurrencyCode;
  exchangeQuotes: Partial<Record<CurrencyCode, ExchangeRateQuote>>;
  onFlightOriginChange: (value: string) => void;
  onSearch: () => void;
  onSelectFlight: (flight: FlightOption) => void;
  onToggleActivityCost: (activity: ActivityOption) => void;
  onSelectLocalStay: (stay: Listing) => void;
  onSelectLiveStay: (stay: LiveAccommodation) => void;
  onAddActivity: (name: string) => void;
};

function offerTime(value: string | undefined): string {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : value;
}

export function TravelComparisonWorkspace({
  flightOrigin, destination, selectedDestination, startDate, endDate, travelers, busy, message,
  travelOptions, selectedFlightId, selectedActivityIds, stayOptions, liveAccommodations, stayFreshness, tripDays, referenceCurrency,
  exchangeQuotes, onFlightOriginChange, onSearch, onSelectFlight, onToggleActivityCost, onSelectLocalStay, onSelectLiveStay, onAddActivity,
}: Props) {
  return <div className="space-y-6">
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6">
      <div className="flex max-w-full items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Plane size={20}/></span>
        <div className="min-w-0"><h2 className="break-words font-bold">Search one trip across providers</h2><p className="mt-1 break-words text-sm text-slate-400">Compare normalized flight, hotel, and activity results. Prices are references only; TravelMate does not complete external bookings.</p></div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-slate-400">Starting location or departure airport<input value={flightOrigin} onChange={(event) => onFlightOriginChange(event.target.value)} placeholder="Cordova, Cebu or Austin (AUS)" className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white"/></label>
        <label className="text-xs text-slate-400">Destination<input value={selectedDestination ? destination : ''} readOnly placeholder="Select in Plan a trip first" className="mt-1 min-h-11 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-slate-300"/></label>
        <label className="text-xs text-slate-400">Departure<input type="date" value={startDate} readOnly className="mt-1 min-h-11 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-slate-300"/></label>
        <label className="text-xs text-slate-400">Return<input type="date" value={endDate} readOnly className="mt-1 min-h-11 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-slate-300"/></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button disabled={busy || travelers > 9 || flightOrigin.trim().length < 2 || destination.trim().length < 2} onClick={onSearch} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-400 px-5 py-2 font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{busy ? 'Checking providers...' : 'Compare prices'}<ArrowRight size={16}/></button><p className="text-xs text-slate-500">{travelers} traveler{travelers === 1 ? '' : 's'} · dates and party size come from the Plan tab</p></div>
      {message && <p role="status" className="mt-4 rounded-lg border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">{message}</p>}
    </section>

    <section aria-labelledby="flight-results-heading">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-800 pb-3"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Flights</p><h2 id="flight-results-heading" className="text-lg font-bold">{flightOrigin} to {destination}</h2></div>{travelOptions && <div className="flex flex-col items-end gap-1"><ProviderFreshness freshness={travelOptions.freshness?.flights}/><span className="text-xs text-slate-500">{travelOptions.provider.isLive ? 'Amadeus production' : 'Amadeus test/non-live'}</span></div>}</div>
      {!travelOptions ? <p className="py-8 text-center text-sm text-slate-500">Run a comparison to retrieve flight offers.</p> : travelOptions.flights.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">{travelOptions.flightMessage}</p> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{travelOptions.flights.map((flight) => <article key={flight.id} className={`rounded-xl border p-4 ${selectedFlightId === flight.id ? 'border-cyan-300 bg-cyan-300/10' : 'border-slate-800 bg-slate-900/45'}`}><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase text-cyan-300">{flight.airline} · {flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop${flight.stops === 1 ? '' : 's'}`}</span><h3 className="mt-1 text-lg font-bold">{flight.origin} → {flight.destination}</h3></div><span className="text-right"><strong className="text-lg text-amber-300">{flight.currency} {flight.price.toLocaleString()}</strong>{isCurrencyCode(flight.currency) && <ReferenceAmount amount={flight.price} currency={flight.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/>}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><small className="text-slate-500">Depart</small><p>{offerTime(flight.departure)}</p></div><div><small className="text-slate-500">Arrive</small><p>{offerTime(flight.arrival)}</p></div>{flight.returnDeparture && <div><small className="text-slate-500">Return departure</small><p>{offerTime(flight.returnDeparture)}</p></div>}{flight.returnArrival && <div><small className="text-slate-500">Return arrival</small><p>{offerTime(flight.returnArrival)}</p></div>}</div><p className="mt-3 text-xs text-slate-500">Duration {flight.duration} · {flight.seatsAvailable === undefined ? 'Seat count unavailable' : `${flight.seatsAvailable} bookable seat${flight.seatsAvailable === 1 ? '' : 's'}`} · fetched {new Date(flight.fetchedAt).toLocaleString()}</p><p className="mt-2 text-xs text-amber-200">Search result only. Recheck fare and availability with the provider before booking.</p><button type="button" onClick={() => onSelectFlight(flight)} className="mt-4 rounded-lg border border-cyan-400/60 px-3 py-2 text-sm font-bold text-cyan-200">{selectedFlightId === flight.id ? 'Remove from budget' : 'Include in trip budget'}</button></article>)}</div>}
    </section>

    <section aria-labelledby="hotel-results-heading">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-800 pb-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Hotels</p><h2 id="hotel-results-heading" className="text-lg font-bold">TravelMate listings and Amadeus offers</h2></div><ProviderFreshness freshness={stayFreshness}/></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{stayOptions.map((stay) => { const nights = Math.max(1, tripDays - 1); return <article key={`compare-${stay.id}`} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><span className="text-xs font-bold uppercase text-emerald-300">TravelMate database · not live</span><h3 className="mt-1 font-bold">{stay.name}</h3><p className="text-sm text-slate-400">{stay.address}</p><strong className="mt-3 block text-amber-300">PHP {(stay.price * nights).toLocaleString()} · {nights} night{nights === 1 ? '' : 's'}</strong><ReferenceAmount amount={stay.price * nights} currency="PHP" referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/><p className="mt-2 text-xs text-slate-500">PHP {stay.price.toLocaleString()}/night · {stay.available}/{stay.capacity} guest slots recorded</p><button onClick={() => onSelectLocalStay(stay)} className="mt-4 rounded-lg border border-emerald-500/50 px-3 py-2 text-sm font-bold text-emerald-300">Select for plan</button></article>; })}{liveAccommodations.map((stay) => <article key={`compare-${stay.id}`} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><span className="text-xs font-bold uppercase text-cyan-300">Amadeus {stay.isLive ? 'live' : 'test/non-live'}</span><h3 className="mt-1 font-bold">{stay.name}</h3><p className="text-sm text-slate-400">{stay.address}</p><strong className="mt-3 block text-amber-300">{stay.currency} {stay.total.toLocaleString()} total</strong>{isCurrencyCode(stay.currency) && <ReferenceAmount amount={stay.total} currency={stay.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/>}<p className="mt-2 text-xs text-slate-500">{stay.currency} {stay.nightlyRate.toLocaleString()}/night · fetched {new Date(stay.fetchedAt).toLocaleString()}</p><p className="mt-2 text-xs text-slate-400">{stay.roomDescription}</p><button onClick={() => onSelectLiveStay(stay)} className="mt-4 rounded-lg border border-cyan-500/50 px-3 py-2 text-sm font-bold text-cyan-300">Select for plan</button></article>)}</div>
      {travelOptions && stayOptions.length === 0 && liveAccommodations.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No hotel options were returned for this destination and date.</p>}
    </section>

    <section aria-labelledby="activity-results-heading">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-800 pb-3"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-300">Activities</p><h2 id="activity-results-heading" className="text-lg font-bold">Local and external experiences</h2></div>{travelOptions && <ProviderFreshness freshness={travelOptions.freshness?.activities}/>}</div>
      {!travelOptions ? <p className="py-8 text-center text-sm text-slate-500">Run a comparison to retrieve activity options.</p> : travelOptions.activities.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">{travelOptions.activityMessage}</p> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{travelOptions.activities.map((activity) => <article key={activity.id} className={`rounded-xl border p-4 ${selectedActivityIds.includes(activity.id) ? 'border-violet-300 bg-violet-300/10' : 'border-slate-800 bg-slate-900/45'}`}><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase text-violet-300">{activity.provider === 'amadeus' ? `Amadeus ${activity.isLive ? 'live' : 'test/non-live'}` : 'TravelMate approved listing'}</span><h3 className="mt-1 font-bold">{activity.name}</h3></div><span className="shrink-0 text-right"><strong className="text-amber-300">{activity.currency} {activity.price.toLocaleString()} / traveler</strong>{isCurrencyCode(activity.currency) && <ReferenceAmount amount={activity.price} currency={activity.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/>}</span></div><p className="mt-2 text-sm text-slate-400">{activity.description}</p><p className="mt-3 text-xs text-slate-500">{activity.location}{activity.rating !== undefined ? ` · Rating ${activity.rating}/5` : ''} · fetched {new Date(activity.fetchedAt).toLocaleString()}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => onAddActivity(activity.name)} className="inline-flex items-center gap-2 rounded-lg border border-violet-500/50 px-3 py-2 text-sm font-bold text-violet-300"><Ticket size={14}/>Add to preferences</button><button type="button" onClick={() => onToggleActivityCost(activity)} className="rounded-lg border border-violet-400/60 px-3 py-2 text-sm font-bold text-violet-200">{selectedActivityIds.includes(activity.id) ? 'Remove cost' : `Include ${travelers}-traveler cost`}</button>{activity.referenceUrl && <a href={activity.referenceUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-bold">Provider details</a>}</div></article>)}</div>}
    </section>
  </div>;
}
