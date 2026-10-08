'use client';

import { PlacePhoto } from '@/components/common/PlacePhoto';
import { verifiedPlaceImage } from '@/lib/place-image';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BedDouble, Check, ChevronLeft, ChevronRight, ImageOff, MapPin, RefreshCw, Search, Star, X } from 'lucide-react';
import type { AccommodationQuote, ProviderAccommodation, PropertyPhoto as PropertyPhotoData, RoomOccupancy, ImageAttribution, LiveAccommodation, NearbyAccommodation, PlannedAccommodation, Listing } from '@/lib/contracts';
import { formatMoney, type CurrencyCode } from '@/lib/domain';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';

export type StaySelection = { value: string; planned?: PlannedAccommodation; quoteToken?: string; confirmedQuote?: AccommodationQuote; liveOffer?: LiveAccommodation; preview?: StayPreview };
type Props = {
  destinationLabel?: string; latitude?: number; longitude?: number;
  providerAccommodations?: ProviderAccommodation[]; providerStatus?: string; providerMessage?: string; providerEnvironment?: 'sandbox' | 'production'; occupancy?: RoomOccupancy;
  enabled: boolean; needsArea: boolean; busy: boolean; message: string; currency: CurrencyCode;
  offers: LiveAccommodation[]; nearby: NearbyAccommodation[]; listings: Listing[];
  selection: StaySelection | null; onChange: (selection: StaySelection) => void; onRefresh: () => void;
  status?: 'idle' | 'ready' | 'no-results' | 'provider-error' | 'needs-area';
  destinationName?: string;
};
type StayCard = {
  liveOffer?: LiveAccommodation;
  providerStay?: ProviderAccommodation; photos?: PropertyPhotoData[]; nameSource?: string; originalName?: string;
  value: string; name: string; type: string; address: string; distanceKm?: number;
  price?: number; currency: CurrencyCode; priceBasis?: string; total?: number;
  rating?: number; amenities?: string[]; test?: boolean; source: string;
  imageUrl?: string; imageAttribution?: ImageAttribution; planned?: PlannedAccommodation;
};
type StayPreview = Pick<StayCard, 'name' | 'type' | 'address' | 'distanceKm' | 'rating' | 'amenities' | 'photos' | 'imageUrl' | 'imageAttribution' | 'source'>;
function stayPreview(stay: StayPreview): StayPreview {
  // Keep display details in client selection state while search results refresh.
  const { name, type, address, distanceKm, rating, amenities, photos, imageUrl, imageAttribution, source } = stay;
  return { name, type, address, distanceKm, rating, amenities, photos, imageUrl, imageAttribution, source };
}
const inputStyle = 'mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#0b1d1a] px-3 text-sm text-white outline-none focus:border-[#ffcf70]/60 focus:ring-1 focus:ring-[#ffcf70]/30';
const buttonStyle = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#ffcf70] disabled:opacity-40';
const PAGE_SIZE = 6;
function readableAddress(address: string, fallback: string) {
  return !address || /location\s+-?\d+\.\d+|not (supplied|available)/i.test(address) ? fallback + ' · Address unavailable' : address;
}

export function PropertyPhoto({ stay, compact = false }: { stay: Pick<StayPreview, 'name' | 'photos' | 'imageUrl' | 'imageAttribution'>; compact?: boolean }) {
  const photos = stay.photos || (stay.imageUrl && stay.imageAttribution ? [{ url: stay.imageUrl, reference: stay.imageUrl, caption: stay.name, attribution: stay.imageAttribution }] : []);
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<string[]>([]);
  const photo = photos[index];
  const permitted = photo && ['https://upload.wikimedia.org/', 'https://thumb.wikimedia.org/', 'https://images.trvl-media.com/', 'https://a.travel-assets.com/', 'https://static.cupid.travel/', 'https://liteapi-travel-static-data.s3.amazonaws.com/'].some(host => photo.url.startsWith(host));
  const show = permitted && photo.attribution.creator && photo.attribution.license && !broken.includes(photo.url);
  return <div className={compact ? 'contents' : undefined}>
    <div className={'relative overflow-hidden bg-[#18352e] ' + (compact ? 'row-start-1 h-20 w-20 rounded-lg sm:h-24 sm:w-24' : 'aspect-[16/10]')}>
      {show ? verifiedPlaceImage(photo.url) ? <PlacePhoto src={photo.url} alt={stay.name + ' accommodation'} sizes={compact ? '(min-width: 640px) 96px, 80px' : '(max-width: 640px) 90vw, 320px'}/> : <>
        {!loaded.includes(photo.url) && <span role="status" className="absolute inset-0 grid animate-pulse place-items-center text-xs text-white/40 motion-reduce:animate-none">Loading photo…</span>}
        {/* Provider URLs are displayed directly; no image download, proxy cache, or storage. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={stay.name + ' accommodation'} loading="lazy" decoding="async" width={960} height={600} referrerPolicy="no-referrer" onLoad={() => setLoaded(current => [...current, photo.url])} onError={() => setBroken(current => [...current, photo.url])} className={'size-full object-cover ' + (loaded.includes(photo.url) ? '' : 'opacity-0')}/>
      </> : <div className="flex size-full flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_top,rgba(255,207,112,.07),transparent_70%)] text-white/40"><ImageOff size={compact ? 20 : 28} strokeWidth={1.3}/><span className={compact ? 'text-center text-[9px]' : 'text-xs'}>Photo unavailable</span></div>}
    </div>
    {!compact && photos.length > 1 && <div aria-label="Property photo gallery" className="flex flex-wrap gap-1.5 border-t border-white/10 p-2">
      {photos.map((item, i) => {
        const hasThumbnail = !broken.includes(item.url) && ['https://upload.wikimedia.org/', 'https://thumb.wikimedia.org/', 'https://images.trvl-media.com/', 'https://a.travel-assets.com/', 'https://static.cupid.travel/', 'https://liteapi-travel-static-data.s3.amazonaws.com/'].some(host => item.url.startsWith(host));
        return <button key={item.reference} type="button" aria-label={'View photo ' + (i+1) + ' of ' + stay.name} aria-pressed={i === index} onClick={() => setIndex(i)} className={'min-h-9 min-w-9 rounded-md border px-2 text-[11px] focus-visible:outline-2 focus-visible:outline-[#ffcf70] ' + (i === index ? 'border-[#ffcf70] text-[#ffcf70]' : 'border-white/15 text-white/50')}>
          {hasThumbnail ? <>
            {/* Direct provider URLs avoid retaining an optimized image copy. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt="" loading="lazy" decoding="async" width={960} height={600} referrerPolicy="no-referrer" onError={() => setBroken(current => [...current, item.url])} className="h-9 w-12 rounded-sm object-cover"/>
          </> : <ImageOff size={15}/>}
          <span className="sr-only">{i+1}</span>
        </button>;
      })}
    </div>}
    {show && <p className={(compact ? 'col-span-2 row-start-2' : 'border-t border-white/10 px-3 py-2') + ' text-[9px] leading-4 text-white/45 [overflow-wrap:anywhere]'}><a href={photo.attribution.sourceUrl} target="_blank" rel="noreferrer" className="underline">{photo.attribution.creator}</a> · <a href={photo.attribution.licenseUrl || photo.attribution.sourceUrl} target="_blank" rel="noreferrer" className="underline">{photo.attribution.license}</a>{!compact && ' · Cropped to fit'}</p>}
  </div>;
}

export function AccommodationPicker({ enabled, needsArea, busy, message, currency, offers, nearby, listings, selection, onChange, onRefresh, status = 'idle', destinationName = '', providerAccommodations = [], providerStatus, providerMessage, providerEnvironment, occupancy = [], destinationLabel, latitude, longitude }: Props) {
  const selectionRequest = useRef<AbortController | null>(null);
  useEffect(() => () => selectionRequest.current?.abort(), []);
  const [checking, setChecking] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [sort, setSort] = useState('recommended');
  const [page, setPage] = useState(1);
  const [detailsFor, setDetailsFor] = useState('');
  const detailsId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  function close() {
    selectionRequest.current?.abort();
    setChecking('');
    setOpen(false);
  }
  function resetFilters() {
    setSearch(''); setMinPrice(''); setMaxPrice(''); setMinRating(''); setSort('recommended'); setPage(1);
  }
  useModalAccessibility({ active: open, containerRef: modalRef, initialFocusRef: searchRef, onClose: close });
  const value = selection?.value || 'later';
  const cards: StayCard[] = [
    ...providerAccommodations.map(stay => ({ value: 'provider:' + stay.id, name: stay.name, type: stay.type, address: stay.address, distanceKm: stay.distanceKm, currency: (stay.quote?.currency || currency) as CurrencyCode, price: stay.quote?.nightlyAverage, priceBasis: 'average / group / night', total: stay.quote?.total, rating: stay.rating, amenities: stay.amenities, test: stay.environment === 'sandbox' || (stay.quote ? !stay.quote.isLive : false), source: stay.id.startsWith('liteapi:') ? 'Nuitée Connect' : 'Room provider', photos: stay.photos, nameSource: stay.nameSource, originalName: stay.originalName, providerStay: stay })),
    ...offers.filter(stay => stay.currency === currency && stay.available).map(stay => ({
      liveOffer: stay, originalName: stay.originalName, nameSource: stay.nameSource, value: 'live:' + stay.id, name: stay.name, type: stay.type, address: readableAddress(stay.address, destinationName),
      distanceKm: stay.distanceKm, price: stay.nightlyRate, currency, priceBasis: 'group / night', total: stay.total,
      rating: stay.rating, amenities: stay.amenities, test: !stay.isLive, source: stay.isLive ? 'Room quote' : 'Test room quote',
    })),
    ...listings.map(stay => ({
      value: 'local:' + stay.id, name: stay.name, type: 'Accommodation', address: readableAddress(stay.address, stay.municipality),
      price: stay.price, currency: 'PHP' as const, priceBasis: '/ night · listing rate', amenities: stay.amenities, source: 'TravelMate listing',
    })),
    ...nearby.map(stay => ({
      value: 'mapped:' + stay.id, name: stay.nameSource === 'unavailable' ? 'Accommodation name unavailable in English' : stay.name, nameSource: stay.nameSource, originalName: stay.originalName, type: stay.type, address: readableAddress(stay.address, stay.city || destinationName),
      distanceKm: stay.distanceKm, currency, source: 'Mapped property', imageUrl: stay.imageUrl, imageAttribution: stay.imageAttribution,
      planned: { name: stay.name, address: stay.address, source: 'openstreetmap' as const, sourceId: stay.id, type: stay.type },
    })),
  ];
  const selected = cards.find(stay => stay.value === value);
  const selectedDetails = selected || selection?.preview;
  const detailsOpen = detailsFor === value;
  const hasPriceFilter = minPrice !== '' || maxPrice !== '';
  const hasFilters = Boolean(search.trim() || hasPriceFilter || minRating);
  const invalidPriceRange = hasPriceFilter && ((minPrice !== '' && (!Number.isFinite(Number(minPrice)) || Number(minPrice) < 0)) || (maxPrice !== '' && (!Number.isFinite(Number(maxPrice)) || Number(maxPrice) < 0)) || (minPrice !== '' && maxPrice !== '' && Number(minPrice) > Number(maxPrice)));
  const matches = cards.filter(stay => {
    if (!stay.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) || invalidPriceRange) return false;
    if (minRating && (stay.rating === undefined || stay.rating < Number(minRating))) return false;
    if (hasPriceFilter && (stay.currency !== currency || stay.price === undefined || !Number.isFinite(stay.price) || (minPrice !== '' && stay.price < Number(minPrice)) || (maxPrice !== '' && stay.price > Number(maxPrice)))) return false;
    return true;
  });
  if (sort === 'rating') matches.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  if (sort === 'price-asc' || sort === 'price-desc') matches.sort((a, b) => {
    const aPrice = a.currency === currency ? a.price : undefined;
    const bPrice = b.currency === currency ? b.price : undefined;
    if (aPrice === undefined) return bPrice === undefined ? 0 : 1;
    if (bPrice === undefined) return -1;
    return sort === 'price-asc' ? aPrice - bPrice : bPrice - aPrice;
  });
  // Keep the selected stay first, before dividing matching results into pages.
  const selectedIndex = matches.findIndex(stay => stay.value === value);
  if (selectedIndex > 0) matches.unshift(...matches.splice(selectedIndex, 1));
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstResult = (currentPage - 1) * PAGE_SIZE;
  const visible = matches.slice(firstResult, firstResult + PAGE_SIZE);
  function changePage(nextPage: number) {
    setPage(nextPage);
    resultsRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }
  const unavailable = !enabled ? 'Select a destination to browse stays.' : needsArea ? 'Choose a city or town to browse relevant stays.' : '';
  async function choose(stay: StayCard) {
    setDetailsFor('');
    setQuoteError('');
    selectionRequest.current?.abort();
    const controller = new AbortController(); selectionRequest.current = controller;
    if (stay.liveOffer) {
      setChecking(stay.value);
      try {
        const response = await fetch('/api/accommodations/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ liveOffer: stay.liveOffer, checkInDate: stay.liveOffer.checkInDate, checkOutDate: stay.liveOffer.checkOutDate, occupancy, destination: destinationLabel, latitude, longitude }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
        const result = await response.json() as { liveOffer?: LiveAccommodation; error?: string };
        if (controller.signal.aborted) return;
        if (!response.ok || !result.liveOffer) throw new Error(result.error || 'Could not confirm the room quote.');
        onChange({ value: stay.value, liveOffer: result.liveOffer, preview: stayPreview({ ...stay, ...result.liveOffer }) }); setOpen(false);
      } catch (error) { if (controller.signal.aborted) return; setQuoteError(error instanceof Error ? error.message : 'Could not confirm the room quote. Retry.'); }
      finally { if (!controller.signal.aborted) setChecking(''); }
      return;
    }
    if (stay.providerStay) {
      const quote = stay.providerStay.quote;
      if (!quote || !stay.providerStay.quoteToken || stay.providerStay.availability !== 'available') {
        onChange({ value: stay.value, preview: stayPreview(stay), planned: { name: stay.name.slice(0, 150), address: stay.address.slice(0, 300), type: stay.type.slice(0, 60), source: 'provider', sourceId: (stay.providerStay.id.startsWith('liteapi:') ? 'liteapi:' : 'rapid:') + stay.providerStay.propertyId } });
        setOpen(false);
        return;
      }
      if (quote.currency !== currency) { setQuoteError('This quote is in ' + quote.currency + '. Use that budget currency before selecting it. Converted amounts are approximate.'); return; }
      setChecking(stay.value);
      try {
        const response = await fetch('/api/accommodations/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteToken: stay.providerStay.quoteToken, checkInDate: quote.checkInDate, checkOutDate: quote.checkOutDate, occupancy }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
        const result = await response.json() as { accommodation?: ProviderAccommodation; error?: string };
        if (controller.signal.aborted) return;
        if (!response.ok || !result.accommodation?.quoteToken) throw new Error(result.error || 'Could not confirm the room quote. Refresh accommodations.');
        onChange({ value: stay.value, preview: stayPreview({ ...stay, ...result.accommodation }), quoteToken: result.accommodation.quoteToken, confirmedQuote: result.accommodation.quote });
        setOpen(false);
      } catch (error) { if (controller.signal.aborted) return; setQuoteError(error instanceof Error ? error.message : 'Could not confirm this room quote. Retry accommodations.'); }
      finally { if (!controller.signal.aborted) setChecking(''); }
      return;
    }
    onChange({ value: stay.value, preview: stayPreview(stay), ...(stay.planned ? { planned: stay.planned } : {}) }); setOpen(false);
  }
  return <div className="sm:col-span-2 text-xs text-white/70">
    <div className="mb-2 flex items-center justify-between gap-2"><p className="font-medium">Accommodation</p><button type="button" disabled={!enabled || needsArea || busy} onClick={onRefresh} className="inline-flex min-h-9 items-center gap-1.5 font-semibold text-[#ffcf70] disabled:opacity-40"><RefreshCw size={13}/>{busy ? 'Finding stays…' : 'Refresh stays'}</button></div>
    <section aria-label="Accommodation preference" className="min-w-0 rounded-xl border border-white/15 bg-[#0b1d1a]/50 p-3">
      {selectedDetails ? <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 sm:grid-cols-[6rem_minmax(0,1fr)]">
        <PropertyPhoto key={value} stay={selectedDetails} compact/>
        <div className="col-start-2 row-start-1 min-w-0">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-[#ffcf70]"><Check size={12}/>Selected</p>
          <strong className="block text-sm leading-5 text-white [overflow-wrap:anywhere]">{selectedDetails.name}</strong>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/50 [overflow-wrap:anywhere]" title={selectedDetails.address}>{selectedDetails.address}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
            {selectedDetails.rating !== undefined && <p aria-label={selectedDetails.rating + '/5 hotel classification'} className="flex items-center gap-1 text-[#ffcf70]"><Star size={12}/>{selectedDetails.rating}/5 hotel stars</p>}
            {selectedDetails.distanceKm !== undefined && <p className="text-white/45">{selectedDetails.distanceKm} km from center</p>}
          </div>
        </div>
      </div> : <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#ffcf70]/10 text-[#ffcf70]"><BedDouble size={18}/></span><div className="min-w-0"><strong className="block text-sm text-white [overflow-wrap:anywhere]">{selection?.planned?.name || (value === 'manual' ? 'Enter your accommodation' : 'Find a stay for your trip')}</strong><p className="mt-1 text-[11px] leading-4 text-white/50">{unavailable || 'Choose a hotel for your itinerary.'}</p></div></div>}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" aria-label="Browse accommodations" disabled={!enabled || needsArea} onClick={() => { resetFilters(); setQuoteError(''); setOpen(true); }} className={buttonStyle + ' min-w-0 flex-1 border-[#ffcf70]/35 bg-[#ffcf70]/10 text-[#ffcf70]'}>{selectedDetails ? 'Change hotel' : 'Browse accommodations'}</button>
        {selectedDetails && <button type="button" aria-expanded={detailsOpen} aria-controls={detailsId} onClick={() => setDetailsFor(detailsOpen ? '' : value)} className={buttonStyle + ' border-transparent px-2 text-white/60'}>Details<ChevronRight size={14} className={detailsOpen ? 'rotate-90' : ''}/></button>}
      </div>
      {selectedDetails && <div id={detailsId} hidden={!detailsOpen} className="mt-2 space-y-2 border-t border-white/10 pt-2 text-[11px] leading-4">
        <p className="flex items-start gap-1.5 text-white/50"><MapPin size={13} className="shrink-0"/><span className="[overflow-wrap:anywhere]">{selectedDetails.address}</span></p>
        {selectedDetails.distanceKm !== undefined && <p className="text-white/45">{selectedDetails.distanceKm} km from {destinationName || 'destination'} center · straight-line distance</p>}
        {!!selectedDetails.amenities?.length && <ul aria-label="Selected hotel amenities" className="flex flex-wrap gap-1.5">{selectedDetails.amenities.slice(0, 4).map(item => <li key={item} className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-white/60 [overflow-wrap:anywhere]">{item.replaceAll('_', ' ').toLowerCase()}</li>)}</ul>}
        <p className="text-white/40">{selectedDetails.type} · {selectedDetails.source}</p>
        {selection?.planned && <p className="text-white/45">Your budget uses a lodging allowance or entered estimate, not a confirmed hotel price.</p>}
        {selection?.confirmedQuote && <p className="text-[#ffcf70]">Room quote rechecked {new Date(selection.confirmedQuote.checkedAt).toLocaleString('en-US')}. Prices can change until booking.</p>}
      </div>}
      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
        <button type="button" aria-label="Choose accommodation later" aria-pressed={value === 'later'} onClick={() => { setDetailsFor(''); onChange({ value: 'later' }); }} className={buttonStyle + ' px-2' + (value === 'later' ? ' border-[#ffcf70]/40 text-[#ffcf70]' : '')}>{value === 'later' && <Check size={14}/>}Choose later</button>
        <button type="button" aria-label="Enter accommodation manually" disabled={!enabled} aria-pressed={value === 'manual'} onClick={() => { setDetailsFor(''); onChange({ value: 'manual', planned: { name: '', address: '', source: 'manual' } }); }} className={buttonStyle + ' px-2' + (value === 'manual' ? ' border-[#ffcf70]/40 text-[#ffcf70]' : '')}>Enter manually</button>
      </div>
      {busy && <p role="status" className="mt-2 text-[11px] text-white/45">Loading relevant accommodation…</p>}
      {value === 'manual' && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label>Accommodation name<input className={inputStyle} maxLength={150} value={selection?.planned?.name || ''} onChange={event => onChange({ value: 'manual', planned: { name: event.target.value, address: selection?.planned?.address || '', source: 'manual' } })} placeholder="Hotel, hostel or guesthouse name"/></label><label>Accommodation location<input className={inputStyle} maxLength={300} value={selection?.planned?.address || ''} onChange={event => onChange({ value: 'manual', planned: { name: selection?.planned?.name || '', address: event.target.value, source: 'manual' } })} placeholder="Address or area"/></label></div>}
      <p className="mt-2 text-[11px] leading-4 text-white/45">{selection?.planned ? 'Planning preference · Price and availability unconfirmed. No room reserved.' : 'For trip planning only. No room reserved.'}</p>
      {providerStatus === 'not-configured' && !offers.length && <p className="mt-2 text-[11px] leading-4 text-white/45">Live prices unavailable. Mapped hotels are planning references.</p>}
      {(providerMessage || providerStatus === 'provider-error' || status === 'provider-error') && <p role={providerStatus === 'provider-error' || status === 'provider-error' ? 'alert' : 'status'} className="mt-2 text-[11px] leading-4 text-amber-200">{providerMessage || 'Could not load stays. Refresh or enter a hotel manually.'}</p>}
      {providerEnvironment === 'sandbox' && <p className="mt-2 text-[11px] leading-4 text-[#ffcf70]">Sandbox data · Test prices and availability only.</p>}
      {!selection?.planned && selected?.total !== undefined && <p className="mt-2 text-[11px] leading-4 text-[#ffcf70]">{selected.test ? 'Sandbox quote · ' : ''}{formatMoney(selection?.confirmedQuote?.total ?? selected.total, selected.currency)} total stay · Price may change.</p>}
      {!busy && status === 'no-results' && <p role="status" className="mt-2 text-[11px] leading-4 text-white/45">No stays found. Try a nearby area or enter a hotel manually.</p>}
      {!busy && status === 'idle' && message && !unavailable && <p role="status" className="mt-2 text-[11px] leading-4 text-white/45">Check your destination and dates to browse stays.</p>}
    </section>
    {open && createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#04120f]/85 p-3 text-white backdrop-blur-sm sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="accommodations-title" tabIndex={-1} className="flex max-h-[calc(100dvh-1.5rem)] w-full min-w-0 max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#102824] shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#ffcf70]">Your stay, your choice</p><h2 id="accommodations-title" className="mt-1 text-xl font-bold tracking-tight">Browse accommodations</h2><p className="mt-2 text-xs text-white/50">Stays near {destinationName || 'your destination'} · Select before generating your itinerary.</p><p className="mt-2 text-[11px] leading-5 text-white/50">Selecting this hotel adds it to your itinerary. It does not reserve a room.</p>{providerEnvironment === 'sandbox' && <p className="mt-2 text-[11px] font-semibold text-[#ffcf70]">Sandbox test data · Not production prices or availability</p>}</div><button type="button" aria-label="Close accommodations" onClick={close} className={buttonStyle + ' size-11 shrink-0 px-0'}><X size={18}/></button></div>
        <div className="shrink-0 border-b border-white/10 p-4 sm:px-6"><label className="relative block"><span className="sr-only">Search accommodations by name</span><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"/><input ref={searchRef} type="search" maxLength={150} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search accommodation names…" className={inputStyle + ' mt-0 pl-10'}/></label></div>
        <div ref={resultsRef} className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="mb-4 grid grid-cols-2 gap-3 text-xs text-white/70 lg:grid-cols-4">
            <label>Minimum nightly price ({currency})<input type="number" min="0" step="any" inputMode="decimal" value={minPrice} onChange={event => { setMinPrice(event.target.value); setPage(1); }} placeholder="No minimum" className={inputStyle}/></label>
            <label>Maximum nightly price ({currency})<input type="number" min="0" step="any" inputMode="decimal" value={maxPrice} onChange={event => { setMaxPrice(event.target.value); setPage(1); }} placeholder="No maximum" className={inputStyle}/></label>
            <label>Minimum hotel star rating<select value={minRating} onChange={event => { setMinRating(event.target.value); setPage(1); }} className={inputStyle}><option value="">Any rating</option>{[1,2,3,4,5].map(rating => <option key={rating} value={rating}>{rating} star{rating === 1 ? '' : 's'} and up</option>)}</select></label>
            <label>Sort accommodations<select value={sort} onChange={event => { setSort(event.target.value); setPage(1); }} className={inputStyle}><option value="recommended">Recommended</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="rating">Star rating: high to low</option></select></label>
          </div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[11px] leading-5 text-white/50"><p>Filters use displayed nightly rates in {currency}. Unknown prices and other currencies are excluded by price filters; star ratings are hotel classifications.</p>{(hasFilters || sort !== 'recommended') && <button type="button" onClick={resetFilters} className="min-h-11 font-semibold text-[#ffcf70] focus-visible:outline-2 focus-visible:outline-[#ffcf70]">Clear filters</button>}</div>
          {invalidPriceRange && <p role="alert" className="mb-4 text-xs text-amber-200">Enter non-negative prices with a maximum at least as high as the minimum.</p>}
          {providerMessage && <p role={providerStatus === 'provider-error' ? 'alert' : 'status'} className="mb-4 text-xs leading-5 text-amber-200">{providerMessage}</p>}
          {quoteError && <p role="alert" className="mb-4 rounded-lg border border-amber-300/30 p-3 text-sm text-amber-200">{quoteError}</p>}
          {busy && <div role="status"><p className="mb-4 text-sm text-white/60">Loading relevant accommodation…</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div aria-hidden="true" key={i} className="h-72 animate-pulse rounded-xl border border-white/10 bg-white/5 motion-reduce:animate-none"/>)}</div></div>}
          {!busy && visible.length > 0 && <ul aria-label="Accommodation choices" className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(stay => <li key={stay.value} className={'flex min-w-0 flex-col overflow-hidden rounded-xl border bg-[#0b1d1a]/50 ' + (value === stay.value ? 'border-[#ffcf70] ring-1 ring-[#ffcf70]/30' : 'border-white/15')}>
            <PropertyPhoto key={stay.imageUrl || stay.value} stay={stay}/>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-[#ffcf70]/80">{stay.type}</span>{value === stay.value && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#ffcf70]"><Check size={12}/>Selected</span>}</div>
              {(stay.nameSource === 'transliterated' || stay.nameSource === 'unavailable') && <p className="mt-2 text-[10px] text-white/45">{stay.nameSource === 'transliterated' ? 'Transliterated name' : 'English name unavailable'}{stay.originalName ? ' · Original: ' + stay.originalName : ''}</p>}
              <h3 className="mt-2 text-base font-semibold leading-6 [overflow-wrap:anywhere]">{stay.name}</h3>
              <button type="button" aria-label={'Select accommodation: ' + stay.name} aria-pressed={value === stay.value} disabled={Boolean(checking)} onClick={() => void choose(stay)} className={buttonStyle + ' mt-3 w-full border-[#ffcf70]/40 ' + (value === stay.value ? 'bg-[#ffcf70] text-[#102824]' : 'bg-[#ffcf70]/10 text-[#ffcf70]')}>{checking === stay.value ? 'Checking room quote…' : value === stay.value ? <><Check size={15}/>Selected accommodation</> : 'Select accommodation'}</button>
              {stay.providerStay && (!stay.providerStay.quote || !stay.providerStay.quoteToken || stay.providerStay.availability !== 'available') && <p className="mt-2 text-[11px] leading-5 text-white/50">Select as a planning preference. Room price and availability are unconfirmed; no reservation is made.</p>}
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-white/50"><MapPin size={13} className="mt-1 shrink-0"/><span>{stay.address}</span></p>
              <p className="mt-1 text-[11px] text-white/40">{stay.distanceKm !== undefined ? stay.distanceKm + ' km from ' + (destinationName || 'destination') + ' center · straight-line distance' : 'Distance unavailable'}</p>
              {stay.test && <p className="mt-2 text-[10px] font-semibold text-[#ffcf70]">Sandbox test data</p>}
              {stay.rating !== undefined && <p className="mt-3 flex items-center gap-1.5 text-xs text-[#ffcf70]"><Star size={13}/>{stay.rating}/5 hotel classification</p>}
              {stay.amenities && stay.amenities.length > 0 && <ul aria-label="Reported amenities" className="mt-3 flex flex-wrap gap-1.5">{stay.amenities.slice(0, 4).map(item => <li key={item} className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-white/60">{item.replaceAll('_', ' ').toLowerCase()}</li>)}</ul>}
              {stay.liveOffer && <div className="mt-3 space-y-1 text-[11px] leading-5 text-white/55"><p>{stay.liveOffer.roomDescription}</p><p>Total stay: {formatMoney(stay.liveOffer.total, stay.currency)}</p><p>Tax and fee inclusion not supplied; confirm with the property.</p><p>Checked {new Date(stay.liveOffer.fetchedAt).toLocaleString('en-US')}</p><p>Prices can change until booking.</p></div>}
              {stay.providerStay?.quote && <div className="mt-3 space-y-1 text-[11px] leading-5 text-white/55"><p>{stay.providerStay.quote.roomType}</p><p>{stay.providerStay.quote.checkInDate} → {stay.providerStay.quote.checkOutDate} · {stay.providerStay.quote.occupancy.length} room(s)</p><p>Total stay: {formatMoney(stay.providerStay.quote.total, stay.currency)}</p><p>{stay.providerStay.quote.taxesAndFeesIncluded === true ? 'Provider reports taxes and fees included in the quoted total.' : stay.providerStay.quote.taxesAndFeesIncluded === false ? 'Additional charges payable at the property are excluded from the quoted total.' : 'Tax and fee inclusion was not supplied by the provider.'}</p>{stay.providerStay.quote.payableAtProperty.map((fee, i) => <p key={i}>Payable at property: {fee.currency} {fee.amount.toLocaleString('en-US')} {stay.providerStay?.quote?.provider === 'liteapi' ? '(additional to quoted total)' : '(included in total)'}</p>)}{stay.providerStay.quote.budgetTotal !== undefined && stay.providerStay.quote.budgetTotal !== stay.providerStay.quote.total && <p>Budgeted stay cost: {formatMoney(stay.providerStay.quote.budgetTotal, stay.currency)} · quoted total plus property-payable charges</p>}{stay.providerStay.quote.approximateTotal && <p>Approximately {stay.providerStay.quote.approximateTotal.currency} {stay.providerStay.quote.approximateTotal.amount.toLocaleString('en-US')} · converted</p>}{stay.providerStay.quote.priceBreakdown.length > 0 && <details className="pt-1"><summary className="cursor-pointer text-[#ffcf70]">Quoted price breakdown</summary><ul className="mt-1 space-y-1">{stay.providerStay.quote.priceBreakdown.map((part, i) => <li key={i}>{part.label}: {part.currency} {part.amount.toLocaleString('en-US')}</li>)}</ul></details>}<p>Checked {new Date(stay.providerStay.quote.checkedAt).toLocaleString('en-US')}</p><p>Prices can change until booking.</p></div>}
              <div className="mt-auto pt-4"><p className="text-[10px] text-white/35">{stay.source}</p><p className="mt-1 text-sm font-semibold text-white/90">{stay.providerStay && stay.providerStay.availability !== 'available' ? ({ 'sold-out': 'Sold out', 'unavailable': 'Rooms unavailable for these guests/dates', 'price-unavailable': 'Price unavailable', 'provider-error': 'Could not load room prices', 'available': '' }[stay.providerStay.availability]) : stay.price !== undefined ? (stay.test ? 'Sandbox test price · ' : '') + formatMoney(stay.price, stay.currency) : 'Price unavailable'}</p>{stay.price !== undefined && <p className="mt-1 text-[10px] text-white/45">{stay.priceBasis}</p>}
              </div>
            </div>
          </li>)}</ul>}
          {!busy && visible.length === 0 && <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-4 text-center"><BedDouble size={28} className="text-[#ffcf70]/60"/><h3 className="font-semibold">{hasFilters ? 'No matching accommodations' : status === 'provider-error' ? 'Could not load accommodations' : 'No accommodations found'}</h3><p className="max-w-sm text-sm leading-6 text-white/50">{hasFilters ? 'Try another name, price range or star rating. Properties with unknown prices or ratings are excluded by those filters.' : 'Retry the search, choose a nearby area, or enter your accommodation manually.'}</p><button type="button" onClick={hasFilters ? resetFilters : onRefresh} className={buttonStyle}>{hasFilters ? 'Reset accommodation filters' : 'Retry accommodations'}</button></div>}
          {nearby.length > 0 && <p className="mt-5 text-[10px] leading-5 text-white/35">Property locations: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a>. Mapped properties have no confirmed room price or availability.</p>}
        </div>
        {!busy && matches.length > 0 && <nav aria-label="Accommodation pagination" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 sm:px-6">
          <p role="status" aria-live="polite" className="text-[11px] text-white/60">Showing {firstResult + 1}–{Math.min(firstResult + PAGE_SIZE, matches.length)} of {matches.length} accommodations</p>
          <div className="flex items-center gap-2"><button type="button" aria-label="Previous accommodation page" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)} className={buttonStyle + ' px-2 sm:px-3'}><ChevronLeft size={16}/><span className="hidden sm:inline">Previous</span></button><span aria-live="polite" className="text-xs text-white/70">Page {currentPage} of {pageCount}</span><button type="button" aria-label="Next accommodation page" disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)} className={buttonStyle + ' px-2 sm:px-3'}><span className="hidden sm:inline">Next</span><ChevronRight size={16}/></button></div>
        </nav>}
      </div>
    </div>, document.body)}
  </div>;
}
