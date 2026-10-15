import type { DayPlan } from './contracts.ts';
export type GooglePlacePhoto = { placeId: string; imageUrl: string; googleMapsUri: string; authors: { displayName: string; uri?: string; photoUri?: string }[]; activityName?: string };
const safeUrl = (value: unknown, image = false) => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.searchParams.has('key') && (image ? /(^|\.)googleusercontent\.com$/.test(url.hostname) : /^(?:www\.|maps\.)?google\.com$/.test(url.hostname) && /^\/maps(?:\/|$)/.test(url.pathname));
  } catch { return false; }
};
/** Google content is display-only; reject mismatched activities and unsafe links. */
export function googleDisplayPhotos(day: DayPlan, response: DayPlan, value: unknown): Record<string, GooglePlacePhoto> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, raw]) => {
    if (!/^[0-7]$/.test(key) || !raw || typeof raw !== 'object') return [];
    const index = Number(key), activity = day.activities[index], returned = response.activities?.[index];
    const photo = raw as GooglePlacePhoto;
    if (!activity || !returned || activity.category === 'accommodation' || returned.id !== activity.id || returned.title !== activity.title || returned.time !== activity.time || returned.location !== activity.location || JSON.stringify(returned.place) !== JSON.stringify(activity.place) || typeof photo.placeId !== 'string' || !/^[\w-]{10,255}$/.test(photo.placeId) || returned.googlePlaceId !== photo.placeId || !safeUrl(photo.imageUrl, true) || !safeUrl(photo.googleMapsUri) || !Array.isArray(photo.authors) || photo.authors.some(author => !author.displayName?.trim() || !safeUrl(author.uri) || author.photoUri && !safeUrl(author.photoUri, true))) return [];
    return [[key, { ...photo, activityName: [activity.place?.name || activity.title, activity.place?.city].filter(Boolean).join(', ') }]];
  }));
}
