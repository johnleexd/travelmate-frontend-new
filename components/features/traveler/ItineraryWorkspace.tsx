import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import styles from './DailyItineraryCard.module.css';
import { itineraryCostPresentation } from '@/lib/itinerary-day-presentation';
import { DailyItineraryCard, formatItineraryDate } from './DailyItineraryCard';
import { useActivityPhotoFallback } from '@/hooks/use-activity-photo-fallback';
import { ActivityPhotoRecovery } from '@/components/common/ActivityPhotoRecovery';
import { GoogleActivityPhotos } from '@/components/common/GoogleActivityPhoto';
import { usePlacesPhotoView } from '@/components/common/PlacesPhotoMapBoundary';
import { PropertyPhoto } from './AccommodationPicker';
import { placeMapUrl } from '@/lib/place-map';
import { TripFeedbackButton } from './TripFeedbackForm';
import { BedDouble, CalendarDays, Check, ChevronRight, Clock3, LoaderCircle, Save, WalletCards } from 'lucide-react';
import { ReferenceAmount } from '@/components/common/ReferenceAmount';
import { GroundingSummary } from './GroundingSummary';
import type { ExchangeRateQuote, ItineraryResponse, WeatherData } from '@/lib/contracts';
import { formatMoney, partyBudgetLabel, partySpendLabel, PARTY_TYPE_LABELS, type CurrencyCode } from '@/lib/domain';

export type ItineraryWorkspaceProps = {
  headingRef?: RefObject<HTMLHeadingElement | null>;
  selectedDayIndex?: number | null;
  onViewDay?: (dayIndex: number) => void;
  onBackToOverview?: () => void;
  readOnly?: boolean;
  itinerary: ItineraryResponse;
  weather: WeatherData | null;
  manualDirty: boolean;
  editingTripId: string | null;
  busy: boolean;
  savingTrip?: boolean;
  updated?: boolean;
  notice?: string;
  travelers: number;
  referenceCurrency: CurrencyCode;
  exchangeQuotes: Partial<Record<CurrencyCode, ExchangeRateQuote>>;
  onSave: () => void;
  visitTripId?: string | null;
  onReorderActivity: (dayIndex: number, activityIndex: number, direction: -1 | 1) => void;
  onEditActivity: (dayIndex: number, activityIndex: number | null) => void;
  onRemoveActivity: (dayIndex: number, activityIndex: number) => void;
  onOpenDay: (day: ItineraryResponse['days'][number]) => void;
};

export function ItineraryWorkspace({ readOnly = false, itinerary: storedItinerary, weather, notice, manualDirty, editingTripId, busy, savingTrip = false, updated = false, travelers, referenceCurrency, exchangeQuotes, onSave, visitTripId, onReorderActivity, onEditActivity, onRemoveActivity, onOpenDay, headingRef, selectedDayIndex: routedDayIndex, onViewDay, onBackToOverview }: ItineraryWorkspaceProps) {
  const [localDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const selectedDayIndex = routedDayIndex === undefined ? localDayIndex : routedDayIndex !== null && storedItinerary.days[routedDayIndex] ? routedDayIndex : null;
  const visibilityKey = JSON.stringify([visitTripId, storedItinerary.destination, storedItinerary.days.map(day => day.date)]);
  const [visibility, setVisibility] = useState<{ key: string; days: number[] }>({ key: '', days: [] });
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const photoDays = useMemo(() => selectedDayIndex === null ? visibility.key === visibilityKey ? visibility.days : [] : [storedItinerary.days[selectedDayIndex]?.day].filter((day): day is number => day !== undefined), [selectedDayIndex, storedItinerary, visibility, visibilityKey]);
  const { itinerary, onPhotoFailure, googlePhotos, onGooglePhotoFailure } = useActivityPhotoFallback(storedItinerary, photoDays, visitTripId || editingTripId, manualDirty);
  usePlacesPhotoView(Object.keys(googlePhotos).length > 0);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).map(entry => Number(entry.target.getAttribute('data-itinerary-day')));
      if (visible.length) setVisibility(current => current.key === visibilityKey && visible.every(day => current.days.includes(day)) ? current : { key: visibilityKey, days: [...new Set([...(current.key === visibilityKey ? current.days : []), ...visible])] });
    }, { rootMargin: '200px' });
    workspaceRef.current?.querySelectorAll('[data-daily-card]').forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [storedItinerary, visibilityKey]);
  const opener = useRef<HTMLButtonElement | null>(null);
  const detailHeading = useRef<HTMLHeadingElement | null>(null);
  const overviewScroll = useRef(0);
  const previousDayIndex = useRef<number | null>(null);
  useEffect(() => {
    const previous = previousDayIndex.current;
    previousDayIndex.current = selectedDayIndex;
    if (previous === selectedDayIndex) return;
    const frame = requestAnimationFrame(() => {
      if (selectedDayIndex !== null) {
        detailHeading.current?.focus({ preventScroll: true });
        detailHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      } else {
        (opener.current?.isConnected ? opener.current : headingRef?.current)?.focus({ preventScroll: true });
        window.scrollTo({ top: overviewScroll.current, behavior: 'instant' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedDayIndex, headingRef]);
  const days = itinerary.days.map((day, dayIndex) => ({ day, dayIndex })).sort((a, b) => (a.day.date || '').localeCompare(b.day.date || '') || a.day.day - b.day.day);
  const cost = itineraryCostPresentation(itinerary);
  const count = itinerary.travelers ?? travelers;
  const viewDay = (dayIndex: number, button: HTMLButtonElement) => {
    opener.current = button;
    overviewScroll.current = window.scrollY;
    if (onViewDay) onViewDay(dayIndex);
    else setSelectedDayIndex(dayIndex);
  };
  const back = () => {
    if (onBackToOverview) onBackToOverview();
    else setSelectedDayIndex(null);
  };
  return <GoogleActivityPhotos.Provider value={{ photos: googlePhotos, onFailure: onGooglePhotoFailure }}><ActivityPhotoRecovery.Provider value={onPhotoFailure}><div ref={workspaceRef} className={styles.workspace} data-itinerary-workspace>
    <div className={styles.tripHeading}>
      {selectedDayIndex === null && <div className={styles.tripTitle}><h1 ref={headingRef} tabIndex={-1}>Your trip itinerary</h1><p>{itinerary.destination} · {itinerary.days.length} day{itinerary.days.length === 1 ? '' : 's'} · {count} traveler{count === 1 ? '' : 's'}</p></div>}
      {!readOnly && <button type="button" disabled={busy} aria-busy={savingTrip} onClick={onSave} className={styles.saveButton}>{savingTrip ? <LoaderCircle size={15} aria-hidden="true" className="motion-safe:animate-spin"/> : editingTripId && updated ? <Check size={15} aria-hidden="true"/> : <Save size={15} aria-hidden="true"/>}{savingTrip ? editingTripId ? 'Updating…' : 'Saving…' : editingTripId ? updated ? 'Updated' : 'Update saved trip' : manualDirty ? 'Save manual changes' : 'Save trip'}</button>}
    </div>

    {selectedDayIndex === null && <section className={styles.tripSummary} aria-label="Trip summary">
      <div><CalendarDays size={24} aria-hidden="true"/><span><small>Dates</small><strong>{days[0]?.day.date ? formatItineraryDate(days[0].day.date) : 'Date unavailable'} – {days.at(-1)?.day.date ? formatItineraryDate(days.at(-1)!.day.date) : 'Date unavailable'}</strong></span></div>
      <div><WalletCards size={24} aria-hidden="true"/><span><small>Trip budget</small><strong>{formatMoney(itinerary.totalBudget, itinerary.currency)}</strong><ReferenceAmount amount={itinerary.totalBudget} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></span></div>
      <div><Clock3 size={24} aria-hidden="true"/><span><small>Cost status</small><strong>{cost.status}</strong>{cost.amount !== undefined && <span>{cost.amountLabel}: {formatMoney(cost.amount, itinerary.currency)}</span>}{cost.unpriced > 0 && <span>{cost.unpriced} {cost.unpriced === 1 ? 'expense' : 'expenses'} unpriced</span>}</span></div>
    </section>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <div style={selectedDayIndex !== null ? { display: 'none' } : undefined}>
    {itinerary.plannedAccommodation && <section className={styles.hotelStrip}><div className={styles.hotelImage}><PropertyPhoto stay={itinerary.plannedAccommodation} compact/></div><div className={styles.hotelInfo}><small>Your accommodation</small><strong>{itinerary.plannedAccommodation.name}</strong><p>{itinerary.plannedAccommodation.address || itinerary.destination}</p><p className={styles.priceLabel}>Price and availability unconfirmed.</p></div><details className={styles.hotelDetails}><summary>View details<ChevronRight size={15}/></summary><div className="flex items-start gap-3"><BedDouble className="shrink-0 text-amber-300"/><div><strong>{itinerary.plannedAccommodation.name}</strong><p className="text-sm text-slate-400">{itinerary.plannedAccommodation.address || itinerary.destination}</p><p className="text-xs text-slate-400">Planned accommodation Â· Price and availability unconfirmed. No quoted accommodation cost is included.{itinerary.grounding ? " A labeled lodging allowance or user estimate is included in the expense breakdown." : ""}</p>{itinerary.plannedAccommodation.rating !== undefined && <p className="mt-2 text-xs text-slate-400">{itinerary.plannedAccommodation.rating}/5 hotel classification</p>}{!!itinerary.plannedAccommodation.amenities?.length && <ul aria-label="Planned hotel amenities" className="mt-2 text-xs text-slate-400">{itinerary.plannedAccommodation.amenities.map(item=><li key={item}>{item.replaceAll('_',' ').toLowerCase()}</li>)}</ul>}<a href={placeMapUrl({name:itinerary.plannedAccommodation.name,latitude:itinerary.plannedAccommodation.latitude,longitude:itinerary.plannedAccommodation.longitude,destination:[itinerary.plannedAccommodation.address,itinerary.destination].filter(Boolean).join(', ')})} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-xs text-cyan-200 underline">View on map</a></div></div></details></section>}
    {itinerary.accommodation && <section className={styles.hotelStrip}><div className={styles.hotelImage}><PropertyPhoto stay={{ name: itinerary.accommodation.name, photos: itinerary.accommodation.photos }} compact/></div><div className={styles.hotelInfo}><small>Your accommodation</small><strong>{itinerary.accommodation.name}</strong><p>{itinerary.accommodation.address || itinerary.destination}</p></div><details className={styles.hotelDetails}><summary>View details<ChevronRight size={15}/></summary><div className="flex items-start gap-3"><BedDouble className="shrink-0 text-amber-300"/><div><strong>{itinerary.accommodation.name}</strong><p className="text-sm text-slate-400">{itinerary.accommodation.address || itinerary.destination}</p><p className="text-sm">{itinerary.accommodation.rooms || 1} room(s) Â· {itinerary.accommodation.nights} nights Â· <strong>{formatMoney(itinerary.accommodation.total, itinerary.currency)} group total</strong></p><div className="mt-2 space-y-1 text-xs leading-5 text-slate-400">{itinerary.accommodation.providerQuote?.provider === 'liteapi' && <><p>Sandbox test data Â· {itinerary.accommodation.providerQuote.roomType}</p><p>Provider quoted stay total: {formatMoney(itinerary.accommodation.providerQuote.total, itinerary.accommodation.providerQuote.currency)} Â· Average per group night: {formatMoney(itinerary.accommodation.providerQuote.nightlyAverage, itinerary.accommodation.providerQuote.currency)}</p><p>{itinerary.accommodation.providerQuote.taxesAndFeesIncluded === true ? 'Provider reports taxes and fees included.' : itinerary.accommodation.providerQuote.taxesAndFeesIncluded === false ? 'Property-payable charges are additional to the provider quote and included in the budgeted group total.' : 'Tax and fee inclusion was not supplied.'}</p><p>Test quote checked {new Date(itinerary.accommodation.providerQuote.checkedAt).toLocaleString('en-US')}. Quoted prices may change; confirm directly with the property.</p><p>Selecting this hotel adds it to your itinerary. It does not reserve a room.</p></>}</div><ReferenceAmount amount={itinerary.accommodation.total} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/>{itinerary.costSharing && <p className="text-xs text-slate-400">Equal accommodation share: {formatMoney(itinerary.costSharing.accommodationShares[0], itinerary.currency)}{travelers > 1 ? ' per traveler' : ''}<ReferenceAmount amount={itinerary.costSharing.accommodationShares[0]} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></p>}</div></div><div className="flex flex-wrap gap-2">{itinerary.accommodation.source === 'liteapi' ? <span className="rounded-md border border-amber-700 px-4 py-2 text-sm text-amber-200">{itinerary.accommodation.isLive ? 'Live hotel recommendation' : 'Sandbox test hotel recommendation'}</span> : itinerary.accommodation.source === 'amadeus' ? <span className="rounded-md border border-cyan-700 px-4 py-2 text-sm text-cyan-200">{itinerary.accommodation.isLive ? 'Live' : 'Test'} Amadeus offer selected</span> : <a href={placeMapUrl({ name: itinerary.accommodation.name, latitude: itinerary.accommodation.latitude, longitude: itinerary.accommodation.longitude, destination: itinerary.destination + ", " + itinerary.accommodation.address })} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded border border-white/20 px-4 text-sm text-cyan-200">View on map</a>}{itinerary.accommodation.source !== 'travelmate' && <a href={placeMapUrl({ name: itinerary.accommodation.name, latitude: itinerary.accommodation.latitude, longitude: itinerary.accommodation.longitude, destination: [itinerary.accommodation.address, itinerary.destination].filter(Boolean).join(', ') })} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded border border-white/20 px-4 text-sm text-cyan-200">View on map</a>}</div></details></section>}
    <div className="grid min-w-0 grid-cols-1 gap-4">
      {days.map(({ day, dayIndex }) => <DailyItineraryCard key={day.day} dayIndex={dayIndex} travelers={count} itinerary={itinerary} weather={weather} readOnly={readOnly} busy={busy} referenceCurrency={referenceCurrency} exchangeQuotes={exchangeQuotes} visitTripId={visitTripId} onReorderActivity={onReorderActivity} onEditActivity={onEditActivity} onRemoveActivity={onRemoveActivity} onOpenDay={onOpenDay} onViewItinerary={button => viewDay(dayIndex, button)}/>)}
    </div></div>
    {selectedDayIndex !== null && itinerary.days[selectedDayIndex] && <DailyItineraryCard key={selectedDayIndex} detail dayIndex={selectedDayIndex} travelers={count} itinerary={itinerary} weather={weather} readOnly={readOnly} busy={busy} referenceCurrency={referenceCurrency} exchangeQuotes={exchangeQuotes} visitTripId={visitTripId} onReorderActivity={onReorderActivity} onEditActivity={onEditActivity} onRemoveActivity={onRemoveActivity} onOpenDay={onOpenDay} onBack={back} headingRef={detailHeading}/>}
    <details className={styles.tripSources}><summary>Trip budget &amp; sources</summary>{!readOnly && editingTripId && <TripFeedbackButton key={editingTripId} itineraryId={editingTripId} destination={itinerary.destination}/>}      <div><p className="text-xs uppercase tracking-widest text-cyan-300">{itinerary.source === 'gemini' ? 'Gemini generated' : itinerary.source === 'openai' ? 'OpenAI generated' : itinerary.source === 'catalog' ? 'Verified place catalog — AI scheduling unavailable' : 'Demo fallback'}{itinerary.manuallyEdited || manualDirty ? ' Â· manually edited' : ''}</p><p className="mt-1 text-xs text-white/45">{readOnly ? 'Read-only view of the current saved itinerary.' : visitTripId && !editingTripId && !manualDirty ? 'Saved trip preview. Open Saved trips to view or edit this plan.' : editingTripId ? 'This plan is saved. Save again after manual changes.' : manualDirty ? 'Automatic save failed; a browser draft is protecting this plan.' : 'Saving this generated plan...'}</p></div>
    <GroundingSummary itinerary={itinerary} draft={manualDirty}/>
    {itinerary.costSharing && <section className={`mb-5 grid gap-3 border-y border-slate-800 py-4 ${travelers > 1 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}><div><p className="text-xs uppercase text-slate-500">Party</p><strong>{PARTY_TYPE_LABELS[itinerary.costSharing.partyType]} Â· {itinerary.costSharing.travelers} traveler{itinerary.costSharing.travelers === 1 ? '' : 's'}</strong><p className="mt-1 text-xs text-slate-500">{partyBudgetLabel(itinerary.costSharing.partyType, itinerary.costSharing.travelers)}</p></div><div><p className="text-xs uppercase text-slate-500">{partySpendLabel(itinerary.costSharing.partyType)}</p><strong>{formatMoney(itinerary.costSharing.plannedGroupSpend, itinerary.currency)}</strong><ReferenceAmount amount={itinerary.costSharing.plannedGroupSpend} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></div>{travelers > 1 && <div><p className="text-xs uppercase text-slate-500">Equal share guide</p><strong>{formatMoney(itinerary.costSharing.plannedSpendShares[0], itinerary.currency)} per traveler</strong><ReferenceAmount amount={itinerary.costSharing.plannedSpendShares[0]} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/>{new Set(itinerary.costSharing.plannedSpendShares).size > 1 && <p className="text-xs text-slate-500">A one-unit remainder is assigned to the first traveler.</p>}</div>}</section>}
    </details>
  </div></ActivityPhotoRecovery.Provider></GoogleActivityPhotos.Provider>;
}
