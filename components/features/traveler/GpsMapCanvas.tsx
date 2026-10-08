'use client';

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { NavigationDestination, NavigationRoute } from '@/lib/contracts';
import type { TripLocation } from '@/hooks/use-trip-location';
import { longitudeNear, type MapCoordinates } from '@/lib/trip-map';
import styles from './TripLocationMap.module.css';

type Props = { position: TripLocation | null; live: boolean; destination: NavigationDestination | null; route: NavigationRoute | null; following: boolean; onSelect: (point: MapCoordinates) => void; onPan: () => void };
type Runtime = { map: Leaflet.Map; leaflet: typeof Leaflet; marker: Leaflet.Marker | null; accuracy: Leaflet.Circle | null; destination: Leaflet.Marker | null; route: Leaflet.Polyline | null };
const pin = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40"><path d="M16 38S2 24 2 15a14 14 0 1 1 28 0c0 9-14 23-14 23Z" fill="#fcd34d" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15" r="5" fill="#193a30"/></svg>';
const fix = '<span aria-hidden="true"></span>';
function popup(text: string) { const element = document.createElement('span'); element.textContent = text; return element; }

export function GpsMapCanvas({ position, live, destination, route, following, onSelect, onPan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const handlersRef = useRef({ onSelect, onPan });
  const followingRef = useRef(following);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [tileError, setTileError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { handlersRef.current = { onSelect, onPan }; }, [onSelect, onPan]);
  useEffect(() => { followingRef.current = following; }, [following]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false, map: Leaflet.Map | null = null, observer: ResizeObserver | null = null;
    void import('leaflet').then(leaflet => {
      if (disposed) return;
      map = leaflet.map(container, { scrollWheelZoom: false, minZoom: 2, maxZoom: 19 }).setView([20, 0], 2);
      runtimeRef.current = { map, leaflet, marker: null, accuracy: null, destination: null, route: null };
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' })
        .on('tileerror', () => { if (!disposed) setTileError(true); }).on('tileload', () => { if (!disposed) setTileError(false); }).addTo(map);
      map.attributionControl.setPrefix(false);
      map.on('click', (event: Leaflet.LeafletMouseEvent) => handlersRef.current.onSelect({ latitude: event.latlng.lat, longitude: event.latlng.wrap().lng }));
      map.on('dragstart', () => handlersRef.current.onPan());
      observer = new ResizeObserver(() => map?.invalidateSize()); observer.observe(container);
      setReady(true);
    }).catch(() => { if (!disposed) setMapError('The map could not load. Retry or use the directions link.'); });
    return () => { disposed = true; observer?.disconnect(); map?.remove(); runtimeRef.current = null; };
  }, [attempt]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !ready) return;
    if (!position) { runtime.marker?.remove(); runtime.accuracy?.remove(); runtime.marker = null; runtime.accuracy = null; return; }
    const coordinates: Leaflet.LatLngTuple = [position.latitude, longitudeNear(position.longitude, runtime.map.getCenter().lng)];
    const firstFix = !runtime.marker;
    if (!runtime.marker) runtime.marker = runtime.leaflet.marker(coordinates, { title: 'Your current location', alt: 'Your current location', icon: runtime.leaflet.divIcon({ className: styles.gpsMarker, html: fix, iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(runtime.map).bindPopup(popup('You are here'));
    else runtime.marker.setLatLng(coordinates);
    runtime.marker.setOpacity(live ? 1 : 0.5);
    if (!runtime.accuracy) runtime.accuracy = runtime.leaflet.circle(coordinates, { radius: position.accuracy, color: '#2563eb', weight: 1, fillOpacity: .07, interactive: false }).addTo(runtime.map);
    else runtime.accuracy.setLatLng(coordinates).setRadius(position.accuracy);
    if (firstFix && !runtime.route) {
      if (runtime.destination) runtime.map.fitBounds(runtime.leaflet.latLngBounds([coordinates, runtime.destination.getLatLng()]), { padding: [45, 45], maxZoom: 16, animate: false });
      else runtime.map.setView(coordinates, 16, { animate: false });
    }
    if (following) runtime.map.setView(coordinates, Math.max(16, runtime.map.getZoom()), { animate: false });
  }, [position, live, following, ready]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !ready) return;
    runtime.destination?.remove(); runtime.destination = null;
    if (!destination) return;
    const coordinates: Leaflet.LatLngTuple = [destination.latitude, longitudeNear(destination.longitude, runtime.map.getCenter().lng)];
    runtime.destination = runtime.leaflet.marker(coordinates, { title: `Destination: ${destination.name}`, alt: `Destination: ${destination.name}`, icon: runtime.leaflet.divIcon({ className: styles.gpsDestination, html: pin, iconSize: [32, 40], iconAnchor: [16, 39] }) }).addTo(runtime.map).bindPopup(popup(destination.label));
    if (!runtime.route) {
      if (runtime.marker) runtime.map.fitBounds(runtime.leaflet.latLngBounds([coordinates, runtime.marker.getLatLng()]), { padding: [45, 45], maxZoom: 16, animate: false });
      else runtime.map.setView(coordinates, 14, { animate: false });
    }
  }, [destination, ready]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !ready) return;
    runtime.route?.remove(); runtime.route = null;
    if (!route) return;
    const points: Leaflet.LatLngTuple[] = route.geometry.map(point => [point.latitude, longitudeNear(point.longitude, route.origin.longitude)]);
    runtime.route = runtime.leaflet.polyline(points, { color: '#2563eb', weight: 6, opacity: .9, interactive: false, className: 'gps-route-line' }).addTo(runtime.map);
    if (followingRef.current && runtime.marker) runtime.map.setView(runtime.marker.getLatLng(), 16, { animate: false });
    else runtime.map.fitBounds(runtime.route.getBounds(), { padding: [45, 45], maxZoom: 17, animate: false });
  }, [route, ready]);

  const recenter = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (runtime.route) runtime.map.fitBounds(runtime.route.getBounds(), { padding: [45, 45], maxZoom: 17, animate: false });
    else if (runtime.marker && runtime.destination) runtime.map.fitBounds(runtime.leaflet.latLngBounds([runtime.marker.getLatLng(), runtime.destination.getLatLng()]), { padding: [45, 45], maxZoom: 16, animate: false });
    else if (runtime.marker || runtime.destination) runtime.map.setView((runtime.marker || runtime.destination)!.getLatLng(), 16, { animate: false });
  };

  return <div className="min-w-0 overflow-hidden rounded-xl border border-white/15">
    <div className="relative">
      <div ref={containerRef} role="region" aria-label="GPS navigation map. Click to choose a destination." className={`${styles.canvas} h-[360px] w-full bg-[#dce5db] lg:h-[520px]`}/>
      {!ready && <div role="status" className="absolute inset-0 grid place-content-center gap-3 p-4 text-center text-sm text-slate-800">{mapError || 'Loading GPS map…'}{mapError && <button className="rounded-lg border border-slate-500 px-3 py-2" onClick={() => { setMapError(''); setAttempt(value => value + 1); }}>Retry map</button>}</div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0c241d] px-3 py-2 text-xs text-white/65"><span>Blue · you are here <span className="mx-1 text-white/30">/</span> Gold · destination</span><div className="flex flex-wrap gap-2"><button disabled={!ready} onClick={() => { const center = runtimeRef.current?.map.getCenter().wrap(); if (center) handlersRef.current.onSelect({ latitude: center.lat, longitude: center.lng }); }} className="min-h-10 rounded-lg border border-white/15 px-3 font-semibold hover:bg-white/5 disabled:opacity-40">Use map center</button><button onClick={recenter} disabled={!ready} className="min-h-10 rounded-lg border border-white/15 px-3 font-semibold hover:bg-white/5 disabled:opacity-40">Fit map</button></div></div>
    {tileError && <p role="status" className="px-3 py-2 text-xs text-amber-200">Map tiles are unavailable. Route instructions and the directions link are still available.</p>}
  </div>;
}
