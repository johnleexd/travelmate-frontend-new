'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Bike, Car, Check, CornerDownLeft, CornerDownRight, ExternalLink, Footprints, LocateFixed, MapPin, Navigation, Search, Square, X } from 'lucide-react';
import { GpsIcon } from '@/components/common/GpsIcon';
import { useTripLocation } from '@/hooks/use-trip-location';
import { useRouteGuidance } from '@/hooks/use-route-guidance';
import { navigationDistance, navigationDuration } from '@/lib/navigation';
import { tripDirectionsUrl, type MapCoordinates } from '@/lib/trip-map';
import type { NavigationDestination, NavigationMode } from '@/lib/contracts';
import { searchNavigationPlaces } from '@/services/navigation.service';
import { GpsMapCanvas } from './GpsMapCanvas';

type Props = { initialDestination?: { name: string; point: MapCoordinates | null } | null };
const modes = [{ id: 'walking', label: 'Walking', Icon: Footprints }, { id: 'cycling', label: 'Cycling', Icon: Bike }, { id: 'driving', label: 'Driving', Icon: Car }] as const;

export function GpsNavigationWorkspace({ initialDestination }: Props) {
  const [destination, setDestination] = useState<NavigationDestination | null>(() => initialDestination?.point ? { ...initialDestination.point, id: 'saved-trip-destination', name: initialDestination.name, label: initialDestination.name } : null);
  const [query, setQuery] = useState(initialDestination?.name || '');
  const [results, setResults] = useState<NavigationDestination[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [mode, setMode] = useState<NavigationMode>('walking');
  const [following, setFollowing] = useState(false);
  const searchControllerRef = useRef<AbortController | null>(null);
  const searchVersionRef = useRef(0);
  const { position, status, message: locationMessage, start, stop, sharing } = useTripLocation();
  const live = status === 'live';
  const { route, progress, routing, message: routeMessage, guiding, reset, requestRoute, startGuidance, stopGuidance } = useRouteGuidance(position, live, destination, mode);
  const visibleRoute = position ? route : null;

  // Opening the GPS tool is the explicit action; the browser still asks permission.
  useEffect(() => { start(); }, [start]);
  useEffect(() => () => { searchVersionRef.current++; searchControllerRef.current?.abort(); }, []);

  const cancelSearch = useCallback(() => { searchVersionRef.current++; searchControllerRef.current?.abort(); setSearching(false); setResults([]); setSearchMessage(''); }, []);
  const chooseDestination = useCallback((next: NavigationDestination) => {
    cancelSearch(); reset(); setFollowing(false); setDestination(next); setQuery(next.label);
  }, [cancelSearch, reset]);
  const selectPin = useCallback((point: MapCoordinates) => chooseDestination({ ...point, id: `pin:${point.latitude},${point.longitude}`, name: 'Dropped pin', label: `Pinned destination (${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)})` }), [chooseDestination]);

  async function search(event: FormEvent) {
    event.preventDefault(); cancelSearch();
    const text = query.trim();
    if (text.length < 2 || text.length > 200) { setSearchMessage('Enter a place or address between 2 and 200 characters.'); return; }
    const controller = new AbortController(); searchControllerRef.current = controller;
    const version = ++searchVersionRef.current; setSearching(true);
    try {
      const matches = await searchNavigationPlaces(text, controller.signal);
      if (controller.signal.aborted || version !== searchVersionRef.current) return;
      setResults(matches); setSearchMessage(matches.length ? 'Choose the place you want to reach.' : 'No matching places found. Add a city/country or choose a pin on the map.');
    } catch (error) {
      if (controller.signal.aborted || version !== searchVersionRef.current) return;
      setSearchMessage(error instanceof Error ? error.message : 'Place search is unavailable. Try again.');
    } finally { if (version === searchVersionRef.current) setSearching(false); }
  }

  const activeStep = visibleRoute && progress ? visibleRoute.steps[Math.min(progress.stepIndex + 1, visibleRoute.steps.length - 1)] : null;
  const DirectionIcon = activeStep?.modifier?.includes('left') ? CornerDownLeft : activeStep?.modifier?.includes('right') ? CornerDownRight : ArrowRight;
  return <section aria-label="GPS navigation" className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/15 bg-[#132f27] p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-xl border border-amber-300/30 bg-amber-300/10 text-amber-300"><GpsIcon size={29}/></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-300">TravelMate GPS</p><h2 className="mt-1 text-xl font-bold">Find your way, as you move</h2><p role="status" className="mt-2 text-xs leading-5 text-white/65">{live && position ? `Live location · accuracy ±${Math.max(1, Math.round(position.accuracy))} m · updated ${new Date(position.timestamp).toLocaleTimeString()}` : status === 'locating' ? 'Finding where you are… Allow location when your browser asks.' : status === 'waiting' ? 'GPS signal lost · showing your last known location.' : locationMessage || 'Location sharing is off. Enable it to get directions from where you are.'}</p></div></div>
      <button onClick={() => { if (sharing) { reset(); setFollowing(false); stop(); } else start(); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm font-semibold hover:bg-white/5">{sharing ? <Square size={15}/> : <LocateFixed size={16}/>}{sharing ? 'Stop sharing location' : 'Enable my location'}</button>
    </div>

    <div className="rounded-2xl border border-white/15 bg-[#102922] p-4 sm:p-5">
      <form onSubmit={event => void search(event)} className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-64 text-xs font-semibold text-white/70" htmlFor="gps-destination">Where do you want to go?<input id="gps-destination" type="search" maxLength={200} autoComplete="off" value={query} onChange={event => { cancelSearch(); reset(); setFollowing(false); setDestination(null); setQuery(event.target.value); }} placeholder="Search a landmark, place or street address" className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-[#071c15] px-3 text-sm text-white outline-none focus:border-amber-300"/></label>
        <button disabled={searching} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-bold text-[#142c22] hover:bg-amber-200 disabled:opacity-50"><Search size={16}/>{searching ? 'Searching…' : 'Search destination'}</button>
        {destination && <button type="button" onClick={() => { cancelSearch(); reset(); setDestination(null); setQuery(''); setFollowing(false); }} aria-label="Clear GPS destination" className="grid min-h-12 min-w-12 place-items-center rounded-xl border border-white/20 hover:bg-white/5"><X size={17}/></button>}
      </form>
      {searchMessage && <p role="status" className="mt-3 text-xs text-amber-200">{searchMessage}</p>}
      {results.length > 0 && <ul aria-label="GPS destination results" className="mt-3 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/15">{results.map(result => <li key={result.id}><button onClick={() => chooseDestination(result)} className="flex min-h-14 w-full items-start gap-3 px-3 py-3 text-left hover:bg-white/5"><MapPin size={16} className="mt-1 shrink-0 text-amber-300"/><span className="min-w-0"><strong className="block text-sm">{result.name}</strong><span className="mt-1 block break-words text-xs text-white/55">{result.label}</span></span></button></li>)}</ul>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="GPS travel mode">{modes.map(item => <button key={item.id} aria-pressed={mode === item.id} onClick={() => { if (mode !== item.id) { reset(); setFollowing(false); setMode(item.id); } }} className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${mode === item.id ? 'border-amber-300/60 bg-amber-300/10 text-amber-200' : 'border-white/15 text-white/55 hover:bg-white/5'}`}><item.Icon size={15}/>{item.label}</button>)}</div>
        <button disabled={!destination || !live || routing} onClick={() => void requestRoute()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-300 px-4 text-sm font-bold text-[#142c22] hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"><Navigation size={16}/>{routing ? 'Finding a route…' : 'Show route'}</button>
      </div>
      <p className="mt-3 text-xs leading-5 text-white/50">{!destination ? 'Select a search result, click the map, or use its center to choose a destination.' : !live ? 'Enable your live location to calculate a route from where you are standing.' : `Destination selected: ${destination.name}. Choose a travel mode, then Show route.`}</p>
      <p className="mt-1 text-[11px] leading-5 text-white/40">Routing shares your position and destination with OpenStreetMap routing. TravelMate does not save your GPS history. <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Provider privacy</a></p>
      {routeMessage && <p role="alert" className="mt-3 rounded-lg border border-amber-300/25 bg-amber-300/5 p-3 text-sm text-amber-200">{routeMessage}</p>}
    </div>

    <div className={`grid min-w-0 items-start gap-4 ${visibleRoute ? 'xl:grid-cols-[minmax(0,1.65fr)_minmax(260px,1fr)]' : ''}`}>
      <div className="min-w-0 space-y-3">
        {guiding && activeStep && progress && <div role="status" className="flex items-start gap-3 rounded-xl bg-amber-300 p-4 text-[#112b21]"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#112b21]/10">{progress.arrived ? <Check size={25}/> : <DirectionIcon size={25}/>}</span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider">{progress.arrived ? 'You have arrived' : !live ? 'Guidance paused · GPS signal lost' : progress.offRoute ? routing ? 'Recalculating route…' : 'You are off the route' : `In ${navigationDistance(progress.nextTurnMeters)}`}</p><h3 className="mt-1 break-words text-base font-bold">{progress.arrived ? destination?.name : activeStep.instruction}</h3>{!progress.arrived && <p className="mt-1 text-xs">{navigationDistance(progress.remainingMeters)} remaining · about {navigationDuration(progress.remainingSeconds)}</p>}</div></div>}
        <GpsMapCanvas position={position} live={live} destination={destination} route={visibleRoute} following={following && live} onSelect={selectPin} onPan={() => setFollowing(false)}/>
        <div className="flex flex-wrap gap-2">
          <button disabled={!position} onClick={() => setFollowing(value => !value)} aria-pressed={following} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-3 text-xs font-semibold hover:bg-white/5 disabled:opacity-40"><LocateFixed size={15}/>{following ? 'Following your location' : 'Follow my location'}</button>
          {destination && <a href={tripDirectionsUrl(destination.label, destination, position)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-3 text-xs font-semibold hover:bg-white/5">Open in Google Maps<ExternalLink size={12}/></a>}
        </div>
        {position && position.accuracy > 100 && <p className="text-xs text-amber-200">Location accuracy is low. Guidance may shift; automatic rerouting waits for a more accurate reading.</p>}
      </div>
      {visibleRoute && <aside aria-label="Route guide" className="min-w-0 overflow-hidden rounded-xl border border-white/15 bg-[#102922]">
        <div className="border-b border-white/10 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">{modes.find(item => item.id === mode)?.label} route</p><h3 className="mt-2 text-xl font-bold">{navigationDuration(visibleRoute.durationSeconds)} <span className="text-sm font-normal text-white/55">· {navigationDistance(visibleRoute.distanceMeters)}</span></h3><p className="mt-2 text-xs leading-5 text-white/50">Estimated travel time. Traffic and closures may change.</p>{visibleRoute.originOffsetMeters > 50 && <p className="mt-2 text-xs text-amber-200">The route starts {navigationDistance(visibleRoute.originOffsetMeters)} from your location.</p>}{visibleRoute.destinationOffsetMeters > 50 && <p className="mt-2 text-xs text-amber-200">The route ends {navigationDistance(visibleRoute.destinationOffsetMeters)} from your pin.</p>}
          <button disabled={!live || routing} onClick={() => { if (guiding) { stopGuidance(); setFollowing(false); } else { startGuidance(); setFollowing(true); } }} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-300 px-3 text-sm font-bold text-[#142c22] hover:bg-amber-200 disabled:opacity-40"><GpsIcon size={18}/>{guiding ? 'Stop guidance' : 'Start guidance'}</button>
        </div>
        <ol aria-label="Turn-by-turn directions" className="max-h-[440px] overflow-y-auto p-2">{visibleRoute.steps.map((step, index) => <li key={`${index}:${step.instruction}`} aria-current={guiding && progress?.stepIndex === index ? 'step' : undefined} className={`flex items-start gap-3 rounded-lg p-3 ${guiding && progress?.stepIndex === index ? 'bg-amber-300/10 text-amber-200' : 'text-white/75'}`}><span className="grid size-6 shrink-0 place-items-center rounded-full border border-current/30 text-[10px] font-bold">{index + 1}</span><div className="min-w-0"><p className="break-words text-xs font-semibold leading-5">{step.instruction}</p><p className="mt-1 text-[11px] text-white/40">{navigationDistance(step.distanceMeters)}</p></div></li>)}</ol>
        <p className="border-t border-white/10 p-3 text-[10px] leading-5 text-white/40">Routes: OSRM / OpenStreetMap · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer" className="underline">Report a map issue</a></p>
      </aside>}
    </div>
  </section>;
}
