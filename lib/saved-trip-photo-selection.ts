import { savedTripCoverImage, savedTripPhotoQuery, verifiedSavedTripCover, type SavedTripCoverImage, type SavedTripPhotoDestination } from './place-image.ts';

type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;
type PhotoTrip = SavedTripPhotoDestination & { id: string };
interface Selection { query: string; photoId: string; photo: SavedTripCoverImage; tracked: boolean }
const PREFIX = 'travelmate:saved-cover:v2:';
const DAY = 86_400_000;
const RESOLVER_VERSION = 3;
const pools = new Map<string, { expires: number; photos: SavedTripCoverImage[]; resolverVersion?: number }>();
const pending = new Map<string, Promise<SavedTripCoverImage[]>>();
const tracking = new Map<string, Promise<void>>();
const selections = new Map<string, Selection>();
function browserStorage(): StorageAccess | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}
function read(storage: StorageAccess | undefined, key: string): unknown {
  try { return JSON.parse(storage?.getItem(PREFIX + key) || 'null'); } catch { return null; }
}
function write(storage: StorageAccess | undefined, key: string, value: unknown) {
  try { storage?.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* Private browsing or full storage still permits memory caching. */ }
}
const identity = (photo: SavedTripCoverImage) => photo.id || photo.src;
function legacyQuery(query: string) { const params = new URLSearchParams(query); params.delete('region'); return params.toString(); }
function storedSelection(trip: PhotoTrip, storage: StorageAccess | undefined): Selection | null {
  const value = read(storage, 'trip:' + trip.id) || selections.get(trip.id);
  if (!value || typeof value !== 'object') return null;
  const row = value as Selection;
  const photo = verifiedSavedTripCover(row.photo, trip);
  const query = savedTripPhotoQuery(trip);
  return photo && photo.scope === 'destination' && (row.query === query || !new URLSearchParams(row.query).has('region') && row.query === legacyQuery(query)) && row.photoId === identity(photo)
    ? { ...row, photo, tracked: row.tracked === true } : null;
}
function persist(trip: PhotoTrip, selection: Selection, storage: StorageAccess | undefined) {
  selections.set(trip.id, selection);
  write(storage, 'trip:' + trip.id, selection);
}
/** One cached search per destination; browser persistence avoids repeating it after refresh. */
export async function loadSavedTripPhotoPool(destination: SavedTripPhotoDestination, fetcher: typeof fetch = fetch, storage = browserStorage()): Promise<SavedTripCoverImage[]> {
  const query = savedTripPhotoQuery(destination);
  const cached = pools.get(query) || read(storage, 'pool:' + query) || read(storage, 'pool:' + legacyQuery(query)) as { expires: number; photos: unknown[]; resolverVersion?: number } | null;
  const entry = cached as { expires: number; photos: unknown[]; resolverVersion?: number } | null;
  if (entry && entry.expires > Date.now() && Array.isArray(entry.photos)) {
    const photos = entry.photos.map(photo => verifiedSavedTripCover(photo, destination)).filter((photo): photo is SavedTripCoverImage => Boolean(photo && photo.scope === 'destination'));
    if (photos.length || entry.resolverVersion === RESOLVER_VERSION) return photos;
  }
  const running = pending.get(query);
  if (running) return running;
  const request = (async () => {
    let photos: SavedTripCoverImage[] = [];
    try {
      const response = await fetcher('/api/destination-context/photo?' + query, { signal: AbortSignal.timeout(90_000) });
      if (response.ok) {
        const body = await response.json();
        const candidates: unknown[] = Array.isArray(body.photos) ? body.photos : body.photo ? [body.photo] : [];
        photos = candidates.map(photo => verifiedSavedTripCover(photo, destination)).filter((photo): photo is SavedTripCoverImage => Boolean(photo && photo.scope === 'destination'));
        photos = [...new Map(photos.map(photo => [identity(photo), photo])).values()];
      }
    } catch { /* Covers must never block trip actions. */ }
    const entry = { expires: Date.now() + (photos.length ? DAY : 60_000), photos, resolverVersion: RESOLVER_VERSION };
    if (pools.size >= 200) pools.delete(pools.keys().next().value!);
    pools.set(query, entry);
    write(storage, 'pool:' + query, entry);
    return photos;
  })().finally(() => pending.delete(query));
  pending.set(query, request);
  return request;
}
function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}
function track(trip: PhotoTrip, selection: Selection, fetcher: typeof fetch, storage: StorageAccess | undefined) {
  if (selection.tracked || selection.photo.provider !== 'unsplash' || !selection.photo.id) return;
  const key = trip.id + ':' + selection.photoId;
  if (tracking.has(key)) return;
  const request = (async () => {
    try {
      const response = await fetcher('/api/destination-context/photo-selection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id, photoId: selection.photoId }), signal: AbortSignal.timeout(20_000),
      });
      if (response.ok && (await response.json()).tracked === true) {
        const current = storedSelection(trip, storage);
        if (current?.photoId === selection.photoId) persist(trip, { ...current, tracked: true }, storage);
      }
    } catch { /* Retry a failed provider event later without affecting the cover. */ }
  })().finally(() => tracking.delete(key));
  tracking.set(key, request);
}
/** Stable trip-ID associations; allocate unused exact matches before reusing any image. */
export async function resolveSavedTripCovers(trips: PhotoTrip[], fetcher: typeof fetch = fetch, storage = browserStorage()): Promise<Record<string, SavedTripCoverImage | null>> {
  const groups = new Map<string, PhotoTrip[]>();
  for (const trip of trips) {
    const query = savedTripPhotoQuery(trip);
    groups.set(query, [...(groups.get(query) || []), trip]);
  }
  const candidatesByQuery = new Map<string, SavedTripCoverImage[]>();
  await Promise.all([...groups.entries()].map(async ([query, group]) => {
    const needsPhoto = group.some(trip => !storedSelection(trip, storage));
    const pool = needsPhoto ? await loadSavedTripPhotoPool(group[0], fetcher, storage) : [];
    // An existing exact itinerary photo outranks a generic country fallback.
    const originals = group.map(trip => savedTripCoverImage(trip.itinerary, trip)).filter((photo): photo is SavedTripCoverImage => Boolean(photo));
    const exact = pool.filter(photo => photo.scope === 'destination');
    candidatesByQuery.set(query, exact.length ? exact : originals.length
      ? [...new Map(originals.map(photo => [identity(photo), photo])).values()] : pool);
  }));
  const assigned = new Map(trips.map(trip => [trip.id, storedSelection(trip, storage)]));
  // Count IDs across query variants too (for example legacy records without coordinates).
  const counts = new Map<string, number>();
  for (const selection of assigned.values()) if (selection) counts.set(selection.photoId, (counts.get(selection.photoId) || 0) + 1);
  const result: Record<string, SavedTripCoverImage | null> = {};
  for (const trip of [...trips].sort((a, b) => a.id.localeCompare(b.id))) {
    let selection = assigned.get(trip.id);
    const query = savedTripPhotoQuery(trip), candidates = candidatesByQuery.get(query) || [];
    if (!selection && candidates.length) {
      const minimum = Math.min(...candidates.map(photo => counts.get(identity(photo)) || 0));
      const available = candidates.filter(photo => (counts.get(identity(photo)) || 0) === minimum);
      const photo = available[hash(trip.id) % available.length];
      selection = { query, photoId: identity(photo), photo, tracked: false };
      counts.set(selection.photoId, (counts.get(selection.photoId) || 0) + 1);
      persist(trip, selection, storage);
    }
    result[trip.id] = selection?.photo || null;
    if (selection) track(trip, selection, fetcher, storage);
  }
  return result;
}
