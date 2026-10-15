/** Compatibility links only: navigation belongs to an owned saved-trip map. */
export const savedNavigationMessage = 'Navigation is available in Saved trips. Choose a saved trip and select “View map / Navigate” to open its itinerary routes and activity controls.';
export function firstQueryValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}
export function validMapTripId(value: unknown): string | undefined {
  const id = firstQueryValue(value);
  return id && /^[A-Za-z0-9_-]{1,100}$/.test(id) ? id : undefined;
}
export function validMapDay(value: unknown): number | undefined {
  const day = Number(firstQueryValue(value));
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : undefined;
}
export function legacyNavigationRedirect(input: { trip?: unknown; day?: unknown }) {
  const params = new URLSearchParams({ tab: 'bookings', navigation: 'moved' });
  const trip = validMapTripId(input.trip), day = validMapDay(input.day);
  if (trip) { params.set('map', trip); if (day) params.set('day', String(day)); }
  return `/dashboard?${params}`;
}
