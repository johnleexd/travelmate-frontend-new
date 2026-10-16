'use client';

import { useEffect, useState } from 'react';
import { Car, Footprints, Route, ArrowUpRight } from 'lucide-react';
import type { DayActivity } from '@/lib/contracts';
import { activityRoutePoint, nextStopDirections, preferredRoute, walkingSuitable, type NextStopOption } from '@/lib/next-stop';
import { fetchNextStopOptions } from '@/services/next-stop.service';
import styles from './NextStopCard.module.css';

export function NextStopCard({ from, to }: { from: DayActivity; to: DayActivity }) {
  const origin = activityRoutePoint(from), destination = activityRoutePoint(to);
  const key = JSON.stringify([origin, destination]);
  const [result, setResult] = useState<{ key: string; options: NextStopOption[] } | null>(null);
  useEffect(() => {
    const [start, end] = JSON.parse(key);
    if (!start || !end) return;
    let active = true;
    void fetchNextStopOptions(start, end).then(options => { if (active) setResult({ key, options }); });
    return () => { active = false; };
  }, [key]);
  const options = result?.key === key ? result.options : [];
  const preferred = preferredRoute(options);
  const Icon = preferred?.mode === 'walking' ? Footprints : preferred?.mode === 'driving' ? Car : Route;
  const href = nextStopDirections(origin, destination, preferred?.mode);
  return <li className={styles.card} data-next-stop aria-label={`Travel from ${from.title} to ${to.title}`}>
    <Icon size={22} className={styles.icon} aria-hidden="true"/>
    <div className={styles.body}>
      <h4>To your next stop</h4>
      <p className={styles.endpoints}>{from.place?.name || from.title} → {to.place?.name || to.title}</p>
      <p aria-live="polite" data-route-summary>{preferred ? <><strong>{preferred.mode === 'walking' ? 'Walking route' : 'Driving route'}</strong> · {preferred.distanceMeters < 1000 ? `${Math.round(preferred.distanceMeters)} m` : `${(preferred.distanceMeters / 1000).toFixed(1)} km`} · {Math.ceil(preferred.durationSeconds / 60)} min estimated</> : 'Check route and local transport options.'}</p>
      <details className={styles.details}><summary>Route details</summary>
        {!origin || !destination ? <p>Exact location missing. Choose both stops in Google Maps.</p> : !options.length ? <p>Route estimates are unavailable for these locations. The directions link opens Google Maps; it does not verify a route.</p> : null}
        {preferred?.mode === 'walking' && <p>Walking may suit this leg. Check pedestrian access and conditions. This suggestion uses a returned walking route of up to 1.5 km and 20 minutes.</p>}
        {preferred?.mode === 'driving' && <p>Driving route available. Taxi availability needs local confirmation.</p>}
        {options.length > 0 && <><ul aria-label="Provider route estimates" className={styles.options}>{options.map(option => <li key={option.mode}>
          <strong>{option.mode === 'walking' ? 'Walking route' : 'Driving route'}</strong> · {option.distanceMeters < 1000 ? `${Math.round(option.distanceMeters)} m` : `${(option.distanceMeters / 1000).toFixed(1)} km`} · {Math.ceil(option.durationSeconds / 60)} min estimated{option.mode === 'walking' && !walkingSuitable(option) ? ' · Long walk; consider local transport' : ''}
        </li>)}</ul><p>No live traffic. Retrieved {new Date(options[0].fetchedAt).toLocaleString()}.</p></>}
        <p>Fare unavailable; confirm locally. Route guidance does not add expenses to your itinerary.</p>
      </details>
      {options.length > 0 && <small>OSRM · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Fix the map</a></small>}
    </div>
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.directions} aria-label={`View directions from ${from.title} to ${to.title}`}>View directions <ArrowUpRight size={15} aria-hidden="true"/></a>
  </li>;
}
