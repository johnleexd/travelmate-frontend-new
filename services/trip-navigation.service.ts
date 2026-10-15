import { handleResponse } from './api-response.ts';
import { parseNavigationRoute } from '../lib/navigation.ts';
import { mapCoordinates } from '../lib/trip-map.ts';
import type { NavigationMode } from '@/lib/contracts';
import type { ActivityMapResult, ActivityMapWeather, DayMapRoute, MapSelection, TripMapManifest } from '@/lib/trip-navigation';

/** Each dialog owns its cache; no itinerary or activity selection crosses trip/account boundaries. */
export function createTripNavigationClient(tripId: string, fetcher: typeof fetch = fetch) {
  const cache = new Map<string, { expires: number; value: unknown }>();
  const pending = new Map<string, { promise: Promise<unknown>; controller: AbortController; consumers: Set<symbol> }>();
  const prefix = '/api/navigation/trips/' + encodeURIComponent(tripId);
  function request<T>(endpoint: string, body: unknown, signal: AbortSignal, ttl: number): Promise<T> {
    if (signal.aborted) return Promise.reject(new DOMException('Request cancelled.', 'AbortError'));
    const key = endpoint + JSON.stringify(body);
    const stored = cache.get(key);
    if (stored && stored.expires > Date.now()) return Promise.resolve(stored.value as T);
    let running = pending.get(key);
    if (!running || running.controller.signal.aborted) {
      const controller = new AbortController();
      const entry = { controller, consumers: new Set<symbol>(), promise: Promise.resolve(undefined) as Promise<unknown> };
      entry.promise = (async () => {
        const response = await fetcher(prefix + endpoint, { ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45_000)]) });
        const value = await handleResponse<T>(response);
        if (!controller.signal.aborted) cache.set(key, { expires: Date.now() + ttl, value });
        return value;
      })().finally(() => { if (pending.get(key) === entry) pending.delete(key); });
      pending.set(key, entry); running = entry;
    }
    const entry = running, token = Symbol('map-consumer');
    entry.consumers.add(token);
    return new Promise<T>((resolve, reject) => {
      const cleanup = () => {
        signal.removeEventListener('abort', abort); entry.consumers.delete(token);
        // A same-tick effect remount can join the request before its last consumer cancels it.
        queueMicrotask(() => { if (!entry.consumers.size && pending.get(key) === entry) entry.controller.abort(); });
      };
      const abort = () => { cleanup(); reject(new DOMException('Request cancelled.', 'AbortError')); };
      signal.addEventListener('abort', abort, { once: true });
      entry.promise.then(value => { cleanup(); if (!signal.aborted) resolve(value as T); }, error => { cleanup(); reject(error); });
    });
  }
  return {
    invalidate() { for (const entry of pending.values()) entry.controller.abort(); pending.clear(); cache.clear(); },
    async manifest(signal: AbortSignal) {
      const result = await request<{ map: TripMapManifest }>('/map', undefined, signal, 0);
      if (!result.map || result.map.tripId !== tripId || !Array.isArray(result.map.days) ||
        result.map.days.some(day => !day || !Array.isArray(day.activities) || day.activities.some(activity => !activity || typeof activity.title !== 'string' || typeof activity.time !== 'string' || !Number.isInteger(activity.index) || activity.place && !mapCoordinates(activity.place)))) throw new Error('This map does not match the selected saved trip.');
      return result.map;
    },
    activity(selection: MapSelection, signal: AbortSignal) { return request<ActivityMapResult>('/activity', selection, signal, 3_600_000); },
    async weather(selection: MapSelection, current: boolean, signal: AbortSignal) {
      return (await request<{ weather: ActivityMapWeather }>('/weather', { selection, current }, signal, 900_000)).weather;
    },
    async route(dayIndex: number, mode: NavigationMode, selections: MapSelection[], signal: AbortSignal): Promise<DayMapRoute> {
      const result = await request<DayMapRoute>('/day-route', { dayIndex, mode, selections: selections.filter(item => item.placeId && item.query)
        .map(({ activityIndex, query, placeId }) => ({ activityIndex, query, placeId })) }, signal, 300_000);
      const route = parseNavigationRoute(result.route);
      if (!route || route.mode !== mode || !Array.isArray(result.stopIndices)) throw new Error('The day route is incomplete or uses a different travel mode.');
      return { ...result, route };
    },
  };
}
