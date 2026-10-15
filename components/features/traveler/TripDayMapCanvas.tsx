'use client';

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { longitudeNear, type MapCoordinates } from '@/lib/trip-map';
import type { NavigationRoute } from '@/lib/contracts';
import type { TripLocation } from '@/hooks/use-trip-location';
import type { TripMapActivity } from '@/lib/trip-navigation';
import styles from './SavedTripMap.module.css';

type Runtime = { map: Leaflet.Map; leaflet: typeof Leaflet; stops: Leaflet.LayerGroup; markers: Map<number, Leaflet.Marker>; line: Leaflet.Polyline | null; gps: Leaflet.CircleMarker | null; accuracy: Leaflet.Circle | null };
export function TripDayMapCanvas({ activities, selected, onSelect, anchor, dayKey, route, position, live }: {
  activities: TripMapActivity[]; selected: number; onSelect: (index: number) => void; anchor: MapCoordinates | null; dayKey: string;
  route: NavigationRoute | null; position: TripLocation | null; live: boolean;
}) {
  const container = useRef<HTMLDivElement>(null), runtime = useRef<Runtime | null>(null), select = useRef(onSelect);
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [tilesFailed, setTilesFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!container.current) return;
    let disposed = false, map: Leaflet.Map | undefined, observer: ResizeObserver | undefined;
    void import('leaflet').then(leaflet => {
      if (disposed || !container.current) return;
      map = leaflet.map(container.current, { scrollWheelZoom: false, minZoom: 2, maxZoom: 19 }).setView([20, 0], 2);
      const stops = leaflet.layerGroup().addTo(map);
      runtime.current = { map, leaflet, stops, markers: new Map(), line: null, gps: null, accuracy: null };
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' })
        .on('tileerror', () => { if (!disposed) setTilesFailed(true); }).on('tileload', () => { if (!disposed) setTilesFailed(false); }).addTo(map);
      map.attributionControl.setPrefix(false);
      observer = new ResizeObserver(() => map?.invalidateSize()); observer.observe(container.current);
      setReady(true);
    }).catch(() => { if (!disposed) setError('The map is unavailable. The activity list and routing controls remain available.'); });
    return () => { disposed = true; observer?.disconnect(); map?.remove(); runtime.current = null; };
  }, [attempt]);
  const stopKey = JSON.stringify(activities.map(item => [item.index, item.title, item.time, item.place?.latitude, item.place?.longitude]));
  const pointsKey = activities.filter(activity => activity.place).map(activity => activity.place!.latitude + ':' + activity.place!.longitude).join('|');
  function fit() {
    const state = runtime.current;
    if (!state) return;
    const reference = activities.find(activity => activity.place)?.place?.longitude || anchor?.longitude || 0;
    const points: Leaflet.LatLngTuple[] = activities.flatMap(activity => activity.place ? [[activity.place.latitude, longitudeNear(activity.place.longitude, reference)] as Leaflet.LatLngTuple] : []);
    if (points.length) state.map.fitBounds(state.leaflet.latLngBounds(points), { padding: [45, 45], maxZoom: 16, animate: false });
    else if (anchor) state.map.setView([anchor.latitude, anchor.longitude], 12, { animate: false });
  }
  const fitRef = useRef(fit);
  useEffect(() => { fitRef.current = fit; });
  useEffect(() => {
    const state = runtime.current;
    if (!state || !ready) return;
    state.stops.clearLayers(); state.markers.clear();
    const reference = activities.find(activity => activity.place)?.place?.longitude || anchor?.longitude || 0;
    for (const activity of activities) {
      if (!activity.place) continue;
      const label = 'Activity ' + (activity.index + 1) + ': ' + activity.title;
      const icon = state.leaflet.divIcon({ html: '<button type="button">' + (activity.index + 1) + '</button>', className: styles.pin,
        iconSize: [34, 40], iconAnchor: [17, 39] });
      const marker = state.leaflet.marker([activity.place.latitude, longitudeNear(activity.place.longitude, reference)], { icon, title: label, keyboard: false }).addTo(state.stops);
      state.markers.set(activity.index, marker);
      const element = marker.getElement()?.querySelector('button');
      element?.setAttribute('aria-label', label);
      if (element) state.leaflet.DomEvent.disableClickPropagation(element);
      element?.addEventListener('click', event => { event.stopPropagation(); select.current(activity.index); });
      // Native buttons keep pointer, Enter and Space selection independent of Leaflet's drag handling.
    }
    // Photo and selection changes must retain the focused native pin button.
  }, [stopKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    for (const [index, marker] of runtime.current?.markers || []) {
      marker.getElement()?.classList.toggle(styles.selectedPin, index === selected);
      marker.getElement()?.querySelector('button')?.setAttribute('aria-pressed', String(index === selected));
    }
  }, [selected, stopKey, ready]);
  useEffect(() => { if (ready) fitRef.current(); }, [pointsKey, dayKey, ready]);
  useEffect(() => {
    const state = runtime.current;
    if (!state || !ready) return;
    state.line?.remove(); state.line = null;
    const reference = activities.find(activity => activity.place)?.place?.longitude || anchor?.longitude || 0;
    const points: Leaflet.LatLngTuple[] = route ? route.geometry.map(point => [point.latitude, longitudeNear(point.longitude, reference)])
      : activities.flatMap(activity => activity.place && activity.status !== 'skipped' ? [[activity.place.latitude, longitudeNear(activity.place.longitude, reference)] as Leaflet.LatLngTuple] : []);
    if (points.length > 1) state.line = state.leaflet.polyline(points, { color: route ? '#28594C' : '#8b743f', weight: route ? 5 : 3, opacity: .85,
      ...(route ? {} : { dashArray: '7 9' }), interactive: false, className: route ? 'trip-road-route' : 'trip-straight-preview' }).addTo(state.map);
    if (route && state.line) state.map.fitBounds(state.line.getBounds(), { padding: [40, 40], maxZoom: 16, animate: false });
  }, [route, activities, anchor, ready]);
  useEffect(() => {
    const state = runtime.current;
    if (!state || !ready) return;
    if (!position) { state.gps?.remove(); state.accuracy?.remove(); state.gps = null; state.accuracy = null; return; }
    const point: Leaflet.LatLngTuple = [position.latitude, longitudeNear(position.longitude, state.map.getCenter().lng)];
    if (!state.gps) state.gps = state.leaflet.circleMarker(point, { radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1, interactive: false }).addTo(state.map);
    else state.gps.setLatLng(point);
    state.gps.setStyle({ opacity: live ? 1 : .5, fillOpacity: live ? 1 : .4 });
    if (!state.accuracy) state.accuracy = state.leaflet.circle(point, { radius: position.accuracy, color: '#2563eb', weight: 1, fillOpacity: .08, interactive: false }).addTo(state.map);
    else state.accuracy.setLatLng(point).setRadius(position.accuracy);
  }, [position, live, ready]);
  return <div className={styles.mapBox}>
    <div ref={container} role="region" aria-label="Daily itinerary map" className={styles.canvas}/>
    {!ready && <div role="status" className={styles.mapLoading}>{error || 'Loading itinerary map…'}{error && <button onClick={() => { setError(''); setAttempt(value => value + 1); }}>Retry map</button>}</div>}
    <div className={styles.mapFooter}><span>{route ? 'Solid green · road/path route' : 'Dashed gold · straight-line preview, not a navigable route'}</span><button onClick={() => fitRef.current()} disabled={!ready}>Fit day</button></div>
    {tilesFailed && <p role="status" className={styles.notice}>Map tiles are unavailable. You can still use the activity list.</p>}
  </div>;
}
