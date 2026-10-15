import type { DayPlan, ImageAttribution } from '../lib/contracts.ts';
import { commonsPhotoLicenseUrl, verifiedActivityImage } from '../lib/place-image.ts';
import { mapStoredActivity, storedPhoto } from '../lib/generated/stored-trip-media.ts';
import { googleDisplayPhotos, type GooglePlacePhoto } from '../lib/google-place-photos.ts';

export type ActivityPhotoPatch = { index: number; imageUrl: string; imageAttribution: ImageAttribution };
export type FailedActivityPhoto = { index: number; imageUrl: string };
const isFailed = (item: DayPlan['activities'][number], index: number, failures: FailedActivityPhoto[]) => failures.some(photo => photo.index === index && photo.imageUrl === storedPhoto(item)?.imageUrl);
const eligible = (day: DayPlan, failures: FailedActivityPhoto[]) => day.activities.some((item, index) => (!storedPhoto(item) || isFailed(item, index, failures)) && item.title?.trim() && !/^daily\s+(allowance|budget)$/i.test(item.time) && item.category !== 'accommodation');
export function missingDayPhotoKey(destination: string, day: DayPlan, failures: FailedActivityPhoto[] = []): string | null {
  return eligible(day, failures) ? JSON.stringify([destination, day.activities.map(item => [item.id, item.title, item.location, item.place, item.category, /^daily\s+(allowance|budget)$/i.test(item.time), storedPhoto(item)?.imageUrl]), failures]) : null;
}
export function photoPatches(day: DayPlan, response: DayPlan, failures: FailedActivityPhoto[] = []): ActivityPhotoPatch[] {
  return day.activities.flatMap((activity, index) => {
    if (activity.category === 'accommodation') return [];
    const raw = response.activities?.[index];
    const item = raw ? mapStoredActivity(raw as unknown as Record<string, unknown>) as unknown as DayPlan['activities'][number] : undefined, credit = item?.imageAttribution;
    const existing = storedPhoto(activity);
    const tracking = existing?.imageUrl === item?.imageUrl && activity.imageAttribution?.provider === 'unsplash' && !activity.imageAttribution.downloadTracked && credit?.downloadTracked;
    if (!item || item.title !== activity.title || item.id !== activity.id || item.location !== activity.location || JSON.stringify(item.place) !== JSON.stringify(activity.place) || existing && !isFailed(activity, index, failures) && !tracking || !verifiedActivityImage(item.imageUrl, credit) || !credit?.creator || !credit.license) return [];
    if (credit.provider !== 'unsplash' && (!/^https:\/\/commons\.wikimedia\.org\//.test(credit.sourceUrl) || !commonsPhotoLicenseUrl(credit.license, credit.licenseUrl))) return [];
    return [{ index, imageUrl: item.imageUrl!, imageAttribution: credit }];
  });
}
export type DayDisplayPhotos = { patches: ActivityPhotoPatch[]; googlePhotos: Record<string, GooglePlacePhoto> };
export function createDayDisplayPhotoClient(fetcher: typeof fetch = fetch, intervalMs = 3100) {
  const cache = new Map<string, { result: DayDisplayPhotos; until: number }>(), pending = new Map<string, Promise<DayDisplayPhotos>>();
  let queue: Promise<unknown> = Promise.resolve(), last = 0;
  return (destination: string, day: DayPlan, tripId?: string | null, failures: FailedActivityPhoto[] = [], googleFailedIndices: number[] = []): Promise<DayDisplayPhotos> => {
    const missing = missingDayPhotoKey(destination, day, failures); if (!missing) return Promise.resolve({ patches: [], googlePhotos: {} });
    const key = JSON.stringify([tripId, day.day, day.date, missing, googleFailedIndices]);
    const cached = cache.get(key); if (cached && cached.until > Date.now()) return Promise.resolve(cached.result);
    if (pending.has(key)) return pending.get(key)!;
    const task = queue.catch(() => undefined).then(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, last + intervalMs - Date.now()))); last = Date.now();
      let patches: ActivityPhotoPatch[] = [], googlePhotos: Record<string, GooglePlacePhoto> = {}, failed = false;
      try {
        const failedPhotos = { ...(failures.length ? { failedPhotos: failures } : {}), ...(googleFailedIndices.length ? { googleFailedIndices } : {}) };
        const response = await fetcher(tripId ? `/api/platform/trips/${encodeURIComponent(tripId)}/photos` : '/api/itinerary/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify(tripId ? { day: day.day, ...failedPhotos } : { destination, day, lookupOnly: true, ...failedPhotos }), signal: AbortSignal.timeout(55000) });
        if (!response.ok) {
          failed = true;
          if (response.status === 429) { const retry = response.headers.get('retry-after'); const seconds = Number(retry); last = Date.now() + (retry && Number.isFinite(seconds) ? Math.max(60, seconds) : 60) * 1000; }
        } else { const body = await response.json(); if (body?.day) { patches = photoPatches(day, body.day, failures); googlePhotos = googleDisplayPhotos(day, body.day, body.googlePhotos); } }
      } catch { failed = true; }
      if (cache.size >= 300) cache.delete(cache.keys().next().value!);
      const result = { patches, googlePhotos };
      // Transient Google URLs belong to the active view only, never a provider cache.
      if (!Object.keys(googlePhotos).length) cache.set(key, { result, until: Date.now() + (failed || !patches.length ? 60000 : 24 * 3600000) });
      return result;
    }).finally(() => pending.delete(key));
    queue = task.catch(() => undefined); pending.set(key, task); return task;
  };
}
export function createMissingPhotoClient(fetcher: typeof fetch = fetch, intervalMs = 3100) {
  const client = createDayDisplayPhotoClient(fetcher, intervalMs);
  return async (destination: string, day: DayPlan, tripId?: string | null, failures: FailedActivityPhoto[] = []) => (await client(destination, day, tripId, failures)).patches;
}
export const retrieveMissingDayPhotos = createMissingPhotoClient();
export const retrieveDayDisplayPhotos = createDayDisplayPhotoClient();
