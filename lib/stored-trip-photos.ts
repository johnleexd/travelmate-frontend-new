import type { DayActivity, DayPlan, ImageAttribution, ItineraryResponse } from './contracts.ts';
import { storedImageUrl, storedPhoto, mapStoredActivity } from './generated/stored-trip-media.ts';
import { verifiedActivityImage } from './place-image.ts';
import { isDailyAllowance } from './itinerary-day-presentation.ts';
export { storedPhoto, storedImageUrl };

/** Stored selections are independent of today's place-matching fields. */
export function storedActivityImage(src?: string, credit?: ImageAttribution): string | null {
  const verified = verifiedActivityImage(src, credit);
  if (verified) return verified;
  // Missing/older rights metadata is historical provenance, not a new lookup.
  // Explicitly restricted photos still cannot be presented as reusable imagery.
  if (/all rights reserved|CC BY[- ](?:NC|ND)|KOGL Type [234]/i.test(credit?.license || '')) return null;
  return storedImageUrl(src);
}

export function mapStoredPlanPhotos(plan: ItineraryResponse): ItineraryResponse {
  return { ...plan, days: plan.days.map(day => {
    const photo = storedPhoto(day);
    return { ...day, ...(photo || {}), activities: day.activities.map(activity => mapStoredActivity(activity as unknown as Record<string, unknown>) as unknown as DayActivity) };
  }) };
}

export function existingDestinationPhoto(plan: ItineraryResponse, excludedUrls: string[] = []) {
  const raw = plan as unknown as Record<string, unknown>;
  for (const candidate of [raw.destinationPhoto, raw.coverPhoto, raw.coverImage, ...plan.days, ...plan.days.flatMap(day => day.activities)]) {
    const photo = storedPhoto(candidate);
    if (photo && !excludedUrls.includes(photo.imageUrl) && storedActivityImage(photo.imageUrl, photo.imageAttribution)) return photo;
  }
  return null;
}

export function savedDayTheme(day: DayPlan, destination: string) {
  const theme = typeof day.theme === 'string' ? day.theme.trim() : '';
  const names = day.activities.filter(item => !isDailyAllowance(item)).map(item => item.place?.name || item.title).filter(Boolean);
  // Preserve the original in details; headings never synthesize attraction lists.
  if (!theme || theme.length > 90 || /details need confirmation|no (?:additional )?supported/i.test(theme) || names.filter(name => theme.toLowerCase().includes(name.toLowerCase())).length > 1) return '';
  void destination; // Keep historical callers compatible.
  return theme;
}
