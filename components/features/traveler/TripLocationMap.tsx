'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, LocateFixed, MapPin, Maximize2, Navigation, Square } from 'lucide-react';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './TripLocationMap.module.css';
import { GpsIcon } from '@/components/common/GpsIcon';
import { useTripLocation, type TripLocation } from '@/hooks/use-trip-location';
import { longitudeNear, straightLineDistanceKm, tripDirectionsUrl, type MapCoordinates } from '@/lib/trip-map';

type Props = { destination: string; point: MapCoordinates | null; onNavigate?: () => void };
type MapRuntime = { map: Leaflet.Map; leaflet: typeof Leaflet; location: Leaflet.Marker | null; accuracy: Leaflet.Circle | null };

function label(text: string) {
  const element = document.createElement('span'); element.textContent = text; return element;
}

function fitLocations(runtime: MapRuntime, destination: MapCoordinates, position: TripLocation | null) {
  const target: Leaflet.LatLngTuple = [destination.latitude, destination.longitude];
  if (position) runtime.map.fitBounds([target, [position.latitude, longitudeNear(position.longitude, destination.longitude)]], { padding: [45, 45], maxZoom: 15, animate: false });
  else runtime.map.setView(target, 12, { animate: false });
}

export function TripLocationMap({ destination, point, onNavigate }: Props) {
  const { position, status, message, start, stop, sharing } = useTripLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<MapRuntime | null>(null);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latitude = point?.latitude;
  const longitude = point?.longitude;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, []);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container || latitude === undefined || longitude === undefined) return;
    let disposed = false;
    let map: Leaflet.Map | null = null;
    let observer: ResizeObserver | null = null;
    void import('leaflet').then(leaflet => {
      if (disposed) return;
      map = leaflet.map(container, { scrollWheelZoom: false, minZoom: 2, maxZoom: 19 }).setView([latitude, longitude], 12);
      const runtime: MapRuntime = { map, leaflet, location: null, accuracy: null };
      runtimeRef.current = runtime;
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).on('tileerror', () => { if (!disposed) setTilesUnavailable(true); })
        .on('tileload', () => { if (!disposed) setTilesUnavailable(false); }).addTo(map);
      leaflet.marker([latitude, longitude], {
        title: `Destination: ${destination}`, alt: `Destination: ${destination}`,
        icon: leaflet.divIcon({ className: styles.destinationMarker, html: '<span aria-hidden="true">●</span>', iconSize: [30, 30], iconAnchor: [15, 15] }),
      }).addTo(map).bindPopup(label(`Destination: ${destination}`));
      map.attributionControl.setPrefix(false);
      observer = new ResizeObserver(() => { if (!disposed) { runtime.map.invalidateSize(); fitLocations(runtime, { latitude, longitude }, runtime.location ? { latitude: runtime.location.getLatLng().lat, longitude: runtime.location.getLatLng().lng, accuracy: 0, timestamp: 0 } : null); } });
      observer.observe(container);
      setMapStatus('ready');
    }).catch(() => { if (!disposed) setMapStatus('error'); });
    return () => { disposed = true; observer?.disconnect(); map?.remove(); runtimeRef.current = null; };
  }, [latitude, longitude, destination, attempt]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || mapStatus !== 'ready' || latitude === undefined || longitude === undefined) return;
    if (!position) {
      runtime.location?.remove(); runtime.accuracy?.remove(); runtime.location = null; runtime.accuracy = null;
      fitLocations(runtime, { latitude, longitude }, null); return;
    }
    const coordinates: Leaflet.LatLngTuple = [position.latitude, longitudeNear(position.longitude, longitude)];
    const firstFix = !runtime.location;
    if (!runtime.location) runtime.location = runtime.leaflet.marker(coordinates, {
      title: 'Your current location', alt: 'Your current location',
      icon: runtime.leaflet.divIcon({ className: styles.locationMarker, html: '<span aria-hidden="true">●</span>', iconSize: [26, 26], iconAnchor: [13, 13] }),
    }).addTo(runtime.map).bindPopup(label('Your current location'));
    else runtime.location.setLatLng(coordinates);
    runtime.location.setOpacity(status === 'waiting' ? 0.55 : 1);
    if (!runtime.accuracy) runtime.accuracy = runtime.leaflet.circle(coordinates, { radius: position.accuracy, color: '#1d4ed8', fillOpacity: 0.08, weight: 1, interactive: false }).addTo(runtime.map);
    else runtime.accuracy.setLatLng(coordinates).setRadius(position.accuracy);
    if (firstFix) fitLocations(runtime, { latitude, longitude }, position);
  }, [position, status, mapStatus, latitude, longitude]);

  const distance = position && point ? straightLineDistanceKm(position, point) : null;
  return <section className="my-6 min-w-0 overflow-hidden rounded-2xl border border-white/15 bg-[#112d26]" aria-labelledby="trip-location-heading">
    <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
      <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">Find your way</p><h2 id="trip-location-heading" ref={headingRef} tabIndex={-1} className="mt-1 scroll-mt-24 text-lg font-bold outline-none">Your trip map</h2><p className="mt-1 break-words text-sm text-white/65">{destination}</p></div>
      <div className="flex flex-wrap gap-2">
        {onNavigate && <button onClick={onNavigate} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-300/40 px-3 text-sm font-bold text-amber-200 hover:bg-amber-300/10"><GpsIcon size={18}/>Open GPS navigation</button>}
        <button onClick={sharing ? stop : start} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-300 px-3 text-sm font-bold text-[#10241e] hover:bg-amber-200">{sharing ? <Square size={15}/> : <LocateFixed size={16}/>}{sharing ? 'Stop sharing location' : status === 'error' ? 'Try location again' : 'Show my location'}</button>
        <a href={tripDirectionsUrl(destination, point, position)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm font-semibold hover:bg-white/5"><Navigation size={15}/>Get directions<ExternalLink size={12}/></a>
      </div>
    </div>
    {point ? <div className="relative">
      <div ref={canvasRef} role="region" aria-label={`Interactive trip map for ${destination}`} className={`${styles.canvas} h-64 w-full bg-[#dce5db] sm:h-80`}/>
      {mapStatus !== 'ready' && <div className="absolute inset-0 grid place-content-center gap-3 p-4 text-center text-sm text-slate-800" role="status">{mapStatus === 'loading' ? 'Loading your destination map…' : <><p>The map could not load.</p><button className="rounded-lg border border-slate-500 px-3 py-2 font-semibold" onClick={() => { setMapStatus('loading'); setAttempt(value => value + 1); }}>Retry map</button></>}</div>}
    </div> : <p className="border-y border-white/10 px-4 py-6 text-sm text-white/65">This saved trip has no destination coordinates. Use Get directions to find {destination} by name.</p>}
    <div className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap gap-x-5 gap-y-2"><span className="inline-flex items-center gap-2"><MapPin size={15} className="text-amber-300"/>Destination</span><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-400"/>Your location{position ? ` · accuracy ±${Math.max(1, Math.round(position.accuracy)).toLocaleString()} m` : ' · not shared'}</span></div>
        {point && <button disabled={mapStatus !== 'ready'} onClick={() => { if (runtimeRef.current) fitLocations(runtimeRef.current, point, position); }} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/15 px-3 font-semibold hover:bg-white/5 disabled:opacity-50"><Maximize2 size={13}/>{position ? 'Show both locations' : 'Show destination'}</button>}
      </div>
      <div role="status" aria-live="polite" className="text-xs leading-5 text-white/70">{status === 'locating' ? 'Finding your location… Allow location access when your browser asks.' : position ? <><span className="font-semibold text-blue-200">{status === 'waiting' ? 'Last known location' : 'Live location'}</span>{distance !== null && ` · ${distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`} straight-line distance to destination`}<span className="block text-white/50">Updated {new Date(position.timestamp).toLocaleTimeString()} · Use Get directions for a travel route.</span>{status === 'waiting' && <span className="block text-amber-200">{message}</span>}</> : message || 'Show your current location beside your destination.'}</div>
      {tilesUnavailable && <p role="status" className="text-xs text-amber-200">Map tiles are unavailable. You can still open Get directions.</p>}
      <p className="text-[11px] leading-5 text-white/45">Location sharing is optional and stops when you leave this view. Your location is not saved to your trip. Map tiles load from OpenStreetMap; Get directions opens Google Maps.</p>
    </div>
  </section>;
}
