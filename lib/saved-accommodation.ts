import type { ItineraryResponse, SavedTrip } from './contracts';

export function savedAccommodation(trip: Pick<SavedTrip, 'itinerary' | 'selectedAccommodation'>): SavedTrip['selectedAccommodation'] {
  const itinerary = trip.itinerary && typeof trip.itinerary === 'object' ? trip.itinerary as Partial<ItineraryResponse> : undefined;
  const planned = itinerary?.plannedAccommodation;
  if (typeof planned?.name === 'string' && planned.name.trim()) {
    return { name: planned.name, address: planned.address || '', selectionKind: 'planned' };
  }
  const quoted = itinerary?.accommodation;
  if (typeof quoted?.name === 'string' && quoted.name.trim()) {
    return { name: quoted.name, address: quoted.address || '', selectionKind: 'quoted' };
  }
  if (Array.isArray(itinerary?.days)) return undefined;
  return trip.selectedAccommodation;
}
