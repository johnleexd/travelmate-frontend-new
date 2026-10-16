import { parseNextStopOptions, type NextStopOption } from '../lib/next-stop.ts';
import type { MapCoordinates } from '../lib/trip-map.ts';

const caches = new WeakMap<typeof fetch, Map<string, { expires: number; promise: Promise<NextStopOption[]> }>>();

/** Share requests across rerenders/remounts; retain failures briefly without polling. */
export function fetchNextStopOptions(origin: MapCoordinates, destination: MapCoordinates, fetcher: typeof fetch = fetch): Promise<NextStopOption[]> {
  let cache = caches.get(fetcher);
  if (!cache) { cache = new Map(); caches.set(fetcher, cache); }
  const key = JSON.stringify([origin, destination]);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const entry = { expires: Date.now() + 300_000, promise: Promise.resolve([] as NextStopOption[]) };
  entry.promise = fetcher('/api/navigation/next-stop', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination }), signal: AbortSignal.timeout(35_000),
  }).then(async response => {
    if (!response.ok) throw Error('Route unavailable.');
    const options = parseNextStopOptions(await response.json(), origin, destination);
    if (!options.length) entry.expires = Date.now() + 30_000;
    return options;
  }).catch(() => { entry.expires = Date.now() + 30_000; return []; });
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(key, entry);
  return entry.promise;
}
