import type { NavigationDestination, NavigationRequest, NavigationRoute } from '@/lib/contracts';
import { handleResponse } from './api.service';
import { mapCoordinates } from '@/lib/trip-map';
import { parseNavigationRoute } from '@/lib/navigation';

export async function searchNavigationPlaces(query: string, signal: AbortSignal): Promise<NavigationDestination[]> {
  const result = await handleResponse<{ destinations: NavigationDestination[] }>(await fetch('/api/navigation/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }), signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) }));
  if (!Array.isArray(result.destinations)) throw new Error('Place search returned an unreadable result. Try again.');
  return result.destinations.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.label === 'string' && mapCoordinates(item));
}

export async function fetchNavigationDirections(input: NavigationRequest, signal: AbortSignal): Promise<NavigationRoute> {
  const result = await handleResponse<{ route: unknown }>(await fetch('/api/navigation/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) }));
  const route = parseNavigationRoute(result.route);
  if (!route || route.mode !== input.mode || route.destination.latitude !== input.destination.latitude || route.destination.longitude !== input.destination.longitude
    || route.origin.latitude !== input.origin.latitude || route.origin.longitude !== input.origin.longitude) throw new Error('Route guidance returned an incomplete or mismatched route. Try again.');
  return route;
}
