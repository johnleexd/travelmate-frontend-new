'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, MapPin, X } from 'lucide-react';
import { PlacePhoto } from '@/components/common/PlacePhoto';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import { DESTINATION_SPOTS, type DestinationSpot } from '@/lib/destination-spots';
import type { LocationSuggestion } from '@/lib/contracts';
import { resolveManualDestination, searchLocations } from '@/services/destination-planning.service';

type Props = { busy: boolean; onPlan: (location: LocationSuggestion, spot: DestinationSpot) => void };
const buttonClass = 'grid size-10 shrink-0 place-items-center rounded-full border border-white/20 text-white transition hover:border-amber-300 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-30';

function SpotPreview({ spot, busy, onClose, onPlan }: Props & { spot: DestinationSpot; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const plannedDestinationRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<LocationSuggestion[]>([]);
  useModalAccessibility({ active: true, containerRef: dialogRef, initialFocusRef: closeRef, onClose });
  useEffect(() => () => {
    requestRef.current?.abort();
    if (plannedDestinationRef.current) {
      const input = document.getElementById('destination-search');
      input?.scrollIntoView({ block: 'center', behavior: 'instant' });
      input?.focus({ preventScroll: true });
    }
  }, []);

  function chooseDestination(location: LocationSuggestion) {
    plannedDestinationRef.current = true;
    onPlan(location, spot);
    onClose();
  }

  async function planVisit() {
    if (busy || requestRef.current) return;
    const controller = new AbortController(); requestRef.current = controller;
    setLoading(true); setError(''); setCandidates([]);
    try {
      const isCity = (location: LocationSuggestion) => location.countryCode === spot.countryCode && ['City', 'Town', 'Municipality'].includes(location.placeType);
      let matches = (await searchLocations(spot.city, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))).filter(isCity);
      const exact = matches.filter(location => location.name.toLowerCase() === spot.city.toLowerCase());
      if (exact.length) matches = exact;
      if (!matches.length) {
        const resolved = await resolveManualDestination(`${spot.city}, ${spot.country}`, controller.signal);
        matches = (resolved.location ? [resolved.location] : resolved.candidates).filter(isCity);
      }
      if (controller.signal.aborted) return;
      if (matches.length === 1) chooseDestination(matches[0]);
      else if (matches.length) setCandidates(matches);
      else setError(`Could not confirm ${spot.city}, ${spot.country}. Try again or search for the city in your trip details.`);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load this destination. Please try again.');
    } finally {
      requestRef.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return createPortal(<div className="fixed inset-0 z-[85] grid place-items-center bg-[#041511]/85 p-3 backdrop-blur-sm sm:p-6" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="destination-spot-title" tabIndex={-1} className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/20 bg-[#102824] text-white shadow-2xl">
      <div className="relative h-52 overflow-hidden bg-[#19362f] sm:h-72">
        <PlacePhoto eager src={spot.photo.url} alt={`${spot.name}, ${spot.country}`} sizes="(max-width: 700px) 100vw, 672px"/>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close destination preview" className="absolute right-3 top-3 grid size-11 place-items-center rounded-full border border-white/30 bg-[#061714]/85 text-white hover:bg-[#102824]"><X size={20}/></button>
      </div>
      <div className="p-5 sm:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-200">{spot.country} · {spot.category}</p>
        <h3 id="destination-spot-title" className="mt-2 text-2xl font-black tracking-tight">{spot.name}</h3>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-white/60"><MapPin size={14}/> {spot.city}, {spot.country}{spot.planningNote ? ' · Trip base' : ''}</p>
        <p className="mt-4 text-sm leading-6 text-white/75">{spot.description}</p>
        {spot.planningNote && <p className="mt-3 text-xs leading-5 text-white/60">{spot.planningNote}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy || loading} onClick={() => void planVisit()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#ffcf70] px-4 py-3 text-sm font-bold text-[#102824] hover:bg-amber-200 disabled:opacity-50">{loading ? 'Finding destination…' : 'Plan a visit'}<ArrowRight size={16}/></button>
          <a href={spot.guideUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-amber-200 hover:underline">Official visitor guide<ExternalLink size={13}/></a>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-white/45">Adds the destination and landmark to your trip preferences. Set dates and a budget, then generate your itinerary.</p>
        {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
        {candidates.length > 0 && <div className="mt-4 grid gap-2"><p className="text-xs text-white/65">Choose the destination to plan:</p>{candidates.map(location => <button key={location.id} type="button" disabled={busy} onClick={() => chooseDestination(location)} className="rounded-lg border border-white/20 p-3 text-left text-sm hover:border-amber-300">{location.label}</button>)}</div>}
        <div className="mt-5 border-t border-white/10 pt-3 text-[10px] leading-5 text-white/45"><a href={spot.photo.sourceUrl} target="_blank" rel="noreferrer" className="hover:text-white/80">Photo: {spot.photo.creator}</a> · {spot.photo.licenseUrl ? <a href={spot.photo.licenseUrl} target="_blank" rel="noreferrer" className="hover:text-white/80">{spot.photo.license}</a> : spot.photo.license} · Cropped to fit</div>
      </div>
    </div>
  </div>, document.body);
}

export function DestinationSpotCarousel({ busy, onPlan }: Props) {
  const [carouselRef, carousel] = useEmblaCarousel({
    loop: true,
    align: 'start',
    breakpoints: { '(prefers-reduced-motion: reduce)': { duration: 0 } },
  });
  const [position, setPosition] = useState(0);
  const [spot, setSpot] = useState<DestinationSpot | null>(null);
  useEffect(() => {
    if (!carousel) return;
    const updatePosition = () => setPosition(carousel.selectedScrollSnap());
    carousel.on('select', updatePosition).on('reInit', updatePosition);
    return () => { carousel.off('select', updatePosition).off('reInit', updatePosition); };
  }, [carousel]);
  function goTo(index: number) {
    carousel?.scrollTo(index);
  }
  return <section aria-labelledby="destination-inspiration-heading" className="min-w-0">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1 basis-64"><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-200/70">03 · Find your next adventure</p><h2 id="destination-inspiration-heading" className="mt-1 text-xl font-black tracking-[-0.03em]">Famous spots around the world</h2><p className="mt-2 text-xs leading-5 text-white/55">Explore a landmark, discover its country, and start a trip of your own.</p></div>
      <div className="ml-auto flex shrink-0 gap-2"><button type="button" aria-label="Previous destination" onClick={() => carousel?.scrollPrev()} className={buttonClass}><ChevronLeft size={18}/></button><button type="button" aria-label="Next destination" onClick={() => carousel?.scrollNext()} className={buttonClass}><ChevronRight size={18}/></button></div>
    </div>
    <div ref={carouselRef} role="region" aria-label="Famous destinations carousel" aria-roledescription="carousel" tabIndex={0} onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        if (event.key === 'ArrowRight') carousel?.scrollNext();
        else carousel?.scrollPrev();
      }
    }} className="relative mt-5 overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300">
      <div className="flex touch-pan-y touch-pinch-zoom gap-4">
      {DESTINATION_SPOTS.map((item, index) => <article key={item.id} aria-label={`${index + 1} of ${DESTINATION_SPOTS.length}: ${item.name}`} aria-roledescription="slide" className="min-w-0 flex-[0_0_85%] overflow-hidden rounded-xl border border-white/15 bg-[#19362f] last:mr-4 sm:flex-[0_0_47%] lg:flex-[0_0_31%]">
        <div className="relative h-48 overflow-hidden sm:h-52"><PlacePhoto src={item.photo.url} alt={`${item.name} in ${item.country}`} sizes="(max-width: 640px) 80vw, (max-width: 1024px) 45vw, 30vw"/><button type="button" onClick={() => setSpot(item)} aria-label={`View ${item.name} in ${item.country}`} className="group absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#051b16] via-[#051b16]/10 to-transparent p-4 text-left transition hover:bg-[#051b16]/25 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-amber-300"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-amber-200">{item.country}</span><strong className="mt-1 flex items-center justify-between gap-3 text-lg leading-6 text-white">{item.name}<ArrowRight size={18} className="shrink-0 transition-transform group-hover:translate-x-1"/></strong><span className="mt-1 text-xs text-white/70">{item.city} · {item.category}</span></button></div>
        <a href={item.photo.sourceUrl} target="_blank" rel="noreferrer" className="block px-4 py-2 text-[9px] leading-4 text-white/45 hover:text-white/75">Photo: {item.photo.creator} · {item.photo.license}</a>
      </article>)}
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="basis-full text-[11px] text-white/45 sm:basis-auto">Swipe or use the arrows to explore.</p><div className="ml-auto flex gap-2">{DESTINATION_SPOTS.map((item, index) => <button key={item.id} type="button" aria-label={`Show ${item.name}`} aria-current={position === index ? 'true' : undefined} onClick={() => goTo(index)} className={`grid size-6 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-amber-300`}><span className={`h-1.5 rounded-full ${position === index ? 'w-5 bg-amber-300' : 'w-1.5 bg-white/30'}`}/></button>)}</div></div>
    {spot && <SpotPreview key={spot.id} spot={spot} busy={busy} onPlan={onPlan} onClose={() => setSpot(null)}/>}
  </section>;
}
