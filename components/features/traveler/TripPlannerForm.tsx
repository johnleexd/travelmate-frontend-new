import Image from 'next/image';
import { ArrowRight, Compass, MapPin } from 'lucide-react';
import { ProviderFreshness } from '@/components/common/ProviderFreshness';
import { ReferenceAmount } from '@/components/common/ReferenceAmount';
import type { ExchangeRateQuote, FreshnessMetadata, LiveAccommodation, LocationSuggestion, TransportationOption } from '@/lib/contracts';
import { CURRENCY_NAMES, formatMoney, partyBudgetExplanation, partyBudgetLabel, PARTY_TYPE_LABELS, SUPPORTED_CURRENCIES, ZERO_DECIMAL_CURRENCIES, type CurrencyCode, type Listing, type PartyType } from '@/lib/domain';
import { localDateInputValue } from '@/lib/date';

type Props = {
  destination: string;
  selectedDestination: LocationSuggestion | null;
  locationSuggestions: LocationSuggestion[];
  locationsBusy: boolean;
  locationMessage: string;
  budget: number;
  currency: CurrencyCode;
  currencyResolved: boolean;
  currencyNeedsFallback: boolean;
  contextBusy: boolean;
  contextMessage: string;
  referenceCurrency: CurrencyCode;
  exchangeQuotes: Partial<Record<CurrencyCode, ExchangeRateQuote>>;
  exchangeBusy: boolean;
  exchangeMessage: string;
  startDate: string;
  endDate: string;
  maximumEndDate: string;
  tripDays: number;
  partyType: PartyType;
  travelers: number;
  stayOptions: Listing[];
  liveAccommodations: LiveAccommodation[];
  staysBusy: boolean;
  stayMessage: string;
  stayFreshness?: FreshnessMetadata | null;
  selectedStayId: string;
  selectedLiveStayId: string;
  selectedLiveAccommodation?: LiveAccommodation;
  interests: string;
  travelStyle: string;
  accommodationPreference: string;
  preferredActivities: string;
  transportationOptions: TransportationOption[];
  transportationPreference: string;
  busy: boolean;
  generationFailed: boolean;
  onDestinationChange: (value: string) => void;
  onDestinationSelect: (location: LocationSuggestion) => void;
  onBudgetChange: (value: number) => void;
  onCurrencyChange: (value: CurrencyCode) => void;
  onReferenceCurrencyChange: (value: CurrencyCode) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onPartyTypeChange: (value: PartyType) => void;
  onTravelersChange: (value: number) => void;
  onStayChange: (source: 'local' | 'live' | '', id: string) => void;
  onInterestsChange: (value: string) => void;
  onTravelStyleChange: (value: string) => void;
  onAccommodationPreferenceChange: (value: string) => void;
  onPreferredActivitiesChange: (value: string) => void;
  onTransportationChange: (value: string) => void;
  onRetryAccommodations: () => void;
  onRetryContext: () => void;
  onGenerate: () => void;
};

export function TripPlannerForm(props: Props) {
  const { destination, selectedDestination, locationSuggestions, locationsBusy, locationMessage, budget, currency, currencyResolved, currencyNeedsFallback, contextBusy, contextMessage, referenceCurrency, exchangeQuotes, exchangeBusy, exchangeMessage, startDate, endDate, maximumEndDate, tripDays, partyType, travelers, stayOptions, liveAccommodations, staysBusy, stayMessage, stayFreshness, selectedStayId, selectedLiveStayId, selectedLiveAccommodation, interests, travelStyle, accommodationPreference, preferredActivities, transportationOptions, transportationPreference, busy, generationFailed } = props;
  return <div className="space-y-5">
    <section className="relative min-h-[300px] overflow-hidden border border-white/10 bg-[#efe8d6] text-[#14231f]">
      <div className="absolute inset-y-0 right-0 w-[48%] overflow-hidden"><Image data-dashboard-image src="/mountain-hero-bg.png" alt="Mountain destination at sunrise" fill priority loading="eager" sizes="(max-width: 1024px) 100vw, 560px" className="object-cover object-center"/><div className="absolute inset-0 bg-gradient-to-r from-[#efe8d6] via-[#efe8d6]/30 to-transparent"/></div>
      <div className="relative flex min-h-[300px] w-full max-w-4xl flex-col justify-end p-6 sm:p-10"><p className="text-sm font-semibold text-[#4a655e]">How this page works</p><h2 className="mt-3 max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-6xl">Four details are enough to begin.</h2><p className="mt-5 max-w-2xl text-sm leading-6 text-[#49635c]">Choose a destination, dates, group size, and total budget. Add optional preferences if you want more personalization, then generate a plan to review before saving.</p></div>
    </section>

    <section className="grid grid-flow-dense gap-px border border-white/10 bg-white/10 xl:grid-cols-12 [&_input]:min-h-12 [&_select]:min-h-12">
      <article className="bg-[#102622] p-5 sm:p-7 xl:col-span-7">
        <div className="mb-7 flex items-start gap-4 border-b border-white/10 pb-5"><span className="grid h-11 w-11 shrink-0 place-items-center border border-cyan-300/30 text-cyan-200"><MapPin size={19}/></span><div><h2 className="text-xl font-black tracking-[-0.03em]">Required trip details</h2><p className="mt-1 text-xs text-white/42">These fields give TravelMate enough information to build a plan.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative text-xs font-medium text-slate-300 sm:col-span-2"><label htmlFor="destination-search">Destination</label><input id="destination-search" required minLength={2} role="combobox" aria-autocomplete="list" aria-expanded={locationSuggestions.length > 0} aria-controls="destination-suggestions" aria-describedby="destination-status" value={destination} onChange={(event) => props.onDestinationChange(event.target.value)} placeholder="Search city, province, or country" autoComplete="off" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition placeholder:text-slate-600 hover:border-slate-600 focus:border-cyan-400"/>{locationSuggestions.length > 0 && <ul id="destination-suggestions" role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-2xl">{locationSuggestions.map((location) => <li key={location.id} role="option" aria-selected={selectedDestination?.id === location.id}><button type="button" onClick={() => props.onDestinationSelect(location)} className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-800 focus:bg-slate-800"><strong className="block text-sm text-white">{location.name}</strong><span className="text-[11px] text-slate-400">{location.contextLabel}</span></button></li>)}</ul>}<p id="destination-status" aria-live="polite" className={`mt-1 text-[11px] ${selectedDestination ? 'text-emerald-300' : 'text-slate-500'}`}>{locationsBusy ? 'Searching destinations...' : selectedDestination ? `Confirmed: ${selectedDestination.label}` : locationMessage || 'Choose a suggestion to confirm the destination.'}</p></div>
          <label className="text-xs font-medium text-slate-300">{partyBudgetLabel(partyType, travelers)}<input type="number" min="1" step={ZERO_DECIMAL_CURRENCIES.includes(currency) ? '1' : '0.01'} value={budget} onChange={(event) => props.onBudgetChange(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition hover:border-slate-600 focus:border-amber-400"/><span className="mt-1.5 block text-[11px] font-normal text-amber-200">{partyBudgetExplanation(partyType, travelers)}</span><ReferenceAmount amount={budget} currency={currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes} className="mt-1 block text-[11px] font-normal text-cyan-200"/></label>
          <div className="text-xs font-medium text-slate-300"><div className="grid grid-cols-2 gap-2"><label>Destination currency<select value={selectedDestination && currencyResolved ? currency : ''} disabled={!selectedDestination || contextBusy || !currencyNeedsFallback} onChange={(event) => props.onCurrencyChange(event.target.value as CurrencyCode)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-amber-400 disabled:opacity-60"><option value="">{contextBusy ? 'Detecting...' : selectedDestination ? 'Select' : 'Auto'}</option>{SUPPORTED_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}</select></label><label>Show equivalents in<select value={referenceCurrency} onChange={(event) => props.onReferenceCurrencyChange(event.target.value as CurrencyCode)} className="mt-1.5 w-full rounded-xl border border-cyan-700/70 bg-slate-950/80 px-3 py-2 text-white transition hover:border-cyan-500 focus:border-cyan-400">{SUPPORTED_CURRENCIES.map((code) => <option key={code} value={code}>{code} · {CURRENCY_NAMES[code]}</option>)}</select></label></div><span className="mt-1.5 block text-[10px] text-slate-500">{currencyResolved ? `${currency} (${CURRENCY_NAMES[currency]}) detected for the destination.` : currencyNeedsFallback ? 'Automatic detection unavailable; choose a destination currency.' : 'Select a destination first.'}</span>{currencyResolved && currency !== referenceCurrency && <span className="mt-1 block text-[10px] text-cyan-200/70">{exchangeBusy ? 'Loading reference rate...' : exchangeQuotes[currency] ? `1 ${currency} ≈ ${formatMoney(exchangeQuotes[currency]!.rate, referenceCurrency)} · Frankfurter reference dated ${exchangeQuotes[currency]!.asOf}` : exchangeMessage || 'Reference conversion unavailable.'}</span>}</div>
          <label className="text-xs font-medium text-slate-300">Start date<input required type="date" min={localDateInputValue()} value={startDate} onChange={(event) => props.onStartDateChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400"/></label>
          <label className="text-xs font-medium text-slate-300">End date<input required type="date" min={startDate} max={maximumEndDate} value={endDate} onChange={(event) => props.onEndDateChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400"/><span className={`mt-1.5 block text-[10px] ${tripDays >= 1 && tripDays <= 31 ? 'text-emerald-300' : 'text-amber-300'}`}>{tripDays >= 1 && tripDays <= 31 ? `${tripDays} travel day${tripDays === 1 ? '' : 's'} selected` : 'Choose 1–31 days'}</span></label>
          <label className="text-xs font-medium text-slate-300">Traveling as<select value={partyType} onChange={(event) => props.onPartyTypeChange(event.target.value as PartyType)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400">{Object.entries(PARTY_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-medium text-slate-300">Travelers<input type="number" min={partyType === 'solo' ? 1 : 2} max="20" disabled={partyType === 'solo' || partyType === 'couple'} value={travelers} onChange={(event) => props.onTravelersChange(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400 disabled:opacity-50"/></label>
        </div>
      </article>

      <article className="bg-[#14231f] p-5 sm:p-7 xl:col-span-5">
        <div className="mb-7 flex items-start gap-4 border-b border-white/10 pb-5"><span className="grid h-11 w-11 shrink-0 place-items-center border border-amber-300/30 text-amber-200"><Compass size={19}/></span><div><h2 className="text-xl font-black tracking-[-0.03em]">Optional preferences</h2><p className="mt-1 text-xs text-white/42">Skip these if you are unsure. You can revise them and regenerate later.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="text-xs font-medium text-slate-300 sm:col-span-2"><div className="flex items-center justify-between gap-2"><label htmlFor="accommodation">Accommodation</label><button type="button" disabled={!selectedDestination || !currencyResolved || staysBusy || tripDays < 1 || tripDays > 31} onClick={props.onRetryAccommodations} className="font-bold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">{staysBusy ? 'Finding stays...' : 'Refresh stays'}</button></div><select id="accommodation" disabled={!selectedDestination || !currencyResolved || staysBusy} value={selectedLiveStayId ? `live:${selectedLiveStayId}` : selectedStayId ? `local:${selectedStayId}` : ''} onChange={(event) => { const [source, ...idParts] = event.target.value.split(':'); props.onStayChange(source as 'local' | 'live' | '', idParts.join(':')); }} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400 disabled:opacity-60"><option value="">{!selectedDestination ? 'Select a destination first' : staysBusy ? 'Finding stays...' : stayOptions.length || liveAccommodations.some((stay) => stay.currency === currency) ? 'No accommodation selected' : 'No accommodation data available'}</option>{stayOptions.length > 0 && <optgroup label="TravelMate stays (PHP)">{stayOptions.map((stay) => <option key={stay.id} value={`local:${stay.id}`}>{stay.name} - {formatMoney(stay.price, 'PHP')}/night</option>)}</optgroup>}{liveAccommodations.some((stay) => stay.currency === currency) && <optgroup label={`Amadeus hotels (${currency})`}>{liveAccommodations.filter((stay) => stay.currency === currency).map((stay) => <option key={stay.id} value={`live:${stay.id}`}>{stay.isLive ? 'LIVE' : 'TEST'} · {stay.name} - {formatMoney(stay.nightlyRate, currency)}/night{stay.rating ? ` · ${stay.rating}/5` : ''}</option>)}</optgroup>}</select>{currencyResolved && currency !== 'PHP' && <p className="mt-1 text-[11px] text-slate-500">TravelMate marketplace stays use PHP; only external offers returned in {currency} can be attached without an exchange-rate assumption.</p>}{selectedLiveAccommodation && <><p className="mt-1 text-[11px] text-cyan-200">{selectedLiveAccommodation.type}{selectedLiveAccommodation.rating ? ` · ${selectedLiveAccommodation.rating}/5` : ''} · {selectedLiveAccommodation.address} · {formatMoney(selectedLiveAccommodation.total, currency)} for {Math.max(1, tripDays - 1)} night{Math.max(1, tripDays - 1) === 1 ? '' : 's'} · {selectedLiveAccommodation.roomDescription}</p><ReferenceAmount amount={selectedLiveAccommodation.total} currency={currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></>}{stayMessage && <p aria-live="polite" className="mt-1 text-[11px] text-slate-500">{stayMessage}</p>}{selectedDestination && <div className="mt-2"><ProviderFreshness freshness={stayFreshness}/></div>}</div>
          <label className="text-xs font-medium text-slate-300 sm:col-span-2">Interests<input value={interests} onChange={(event) => props.onInterestsChange(event.target.value)} placeholder="food, culture, nature" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition placeholder:text-slate-600 hover:border-slate-600 focus:border-violet-400"/></label>
          <label className="text-xs font-medium text-slate-300">Travel style<select value={travelStyle} onChange={(event) => props.onTravelStyleChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400"><option value="budget">Budget</option><option value="balanced">Balanced</option><option value="comfort">Comfort</option><option value="luxury">Luxury</option><option value="family-friendly">Family-friendly</option></select></label>
          <label className="text-xs font-medium text-slate-300">Stay preference<select value={accommodationPreference} onChange={(event) => props.onAccommodationPreferenceChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400"><option value="budget-friendly">Budget-friendly</option><option value="central location">Central location</option><option value="resort">Resort</option><option value="family-friendly">Family-friendly</option><option value="luxury">Luxury</option></select></label>
          <label className="text-xs font-medium text-slate-300 sm:col-span-2">Preferred activities<input value={preferredActivities} onChange={(event) => props.onPreferredActivitiesChange(event.target.value)} placeholder="island hopping, museums" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition placeholder:text-slate-600 hover:border-slate-600 focus:border-violet-400"/></label>
          <div className="text-xs font-medium text-slate-300 sm:col-span-2"><div className="flex items-center justify-between gap-2"><label htmlFor="transportation">Transportation</label>{selectedDestination && <button type="button" disabled={contextBusy} onClick={props.onRetryContext} className="font-bold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">{contextBusy ? 'Finding options...' : 'Refresh options'}</button>}</div><select id="transportation" disabled={!selectedDestination || contextBusy || transportationOptions.length === 0} value={transportationPreference} onChange={(event) => props.onTransportationChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400 disabled:opacity-60"><option value="">{!selectedDestination ? 'Select a destination first' : contextBusy ? 'Finding transportation options...' : transportationOptions.length ? 'Choose a destination-relevant mode' : 'No verified options available'}</option>{transportationOptions.map((mode) => <option key={mode.id} value={mode.label.toLowerCase()}>{mode.label}</option>)}</select>{contextMessage && <p aria-live="polite" className="mt-1 text-[11px] text-slate-500">{contextMessage}</p>}</div>
        </div>
      </article>
    </section>

    <section className="flex flex-col gap-6 overflow-hidden border border-amber-300/30 bg-amber-300 p-5 text-[#14231f] sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div className="min-w-0"><h2 className="truncate text-xl font-black tracking-[-0.035em]">{selectedDestination ? destination : 'Your next destination'}</h2><p className="mt-1 text-xs text-[#345047]">{tripDays >= 1 && tripDays <= 31 ? `${tripDays} days` : 'Select valid dates'} · {travelers} traveler{travelers === 1 ? '' : 's'} · {currencyResolved && Number.isFinite(budget) ? formatMoney(budget, currency) : 'currency pending'}</p>{currencyResolved && <ReferenceAmount amount={budget} currency={currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes} className="mt-1 block text-[11px] font-semibold text-[#29463f]"/>}<p className="mt-2 text-xs font-semibold text-[#29463f]">Successful generation saves a reviewable plan automatically. Save changes keeps any manual edits.</p></div>
      <button disabled={busy || tripDays < 1 || tripDays > 31 || !selectedDestination || !currencyResolved || !Number.isFinite(budget) || budget <= 0} onClick={props.onGenerate} className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-[#14231f] px-6 py-3 font-extrabold text-[#f5edd9] transition hover:bg-[#284a41] disabled:opacity-50">{busy ? 'Building your trip...' : generationFailed ? 'Retry generation' : 'Generate my trip'}<ArrowRight size={17} className="transition-transform group-hover:translate-x-1"/></button>
    </section>
  </div>;
}
