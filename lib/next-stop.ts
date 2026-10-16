import type { DayActivity } from './contracts';
import { mapCoordinates, tripDirectionsUrl, type MapCoordinates } from './trip-map.ts';

export type NextStopOption = {
  mode: 'walking' | 'driving'; distanceMeters: number; durationSeconds: number;
  provider: 'osrm'; fetchedAt: string;
};

/** Reuse recorded place evidence; never geocode an activity title into a stop. */
export function activityRoutePoint(activity: DayActivity): MapCoordinates | null {
  const place = activity.place;
  if (!place || place.provider !== 'wikidata' || !/^Q\d+$/.test(place.placeId)
    || place.sourceUrl !== `https://www.wikidata.org/wiki/${place.placeId}`) return null;
  return mapCoordinates(place);
}

export function walkingSuitable(option: NextStopOption): boolean {
  return option.mode === 'walking' && option.distanceMeters <= 1500 && option.durationSeconds <= 1200;
}

export function preferredRoute(options: NextStopOption[]): NextStopOption | undefined {
  return options.find(walkingSuitable) || options.find(option => option.mode === 'driving');
}

export function nextStopDirections(origin: MapCoordinates | null, destination: MapCoordinates | null, mode?: NextStopOption['mode']): string {
  // Without both exact endpoints, open the directions form for manual selection.
  if (!origin || !destination) return 'https://www.google.com/maps/dir/?api=1';
  const url = new URL(tripDirectionsUrl('', destination, origin));
  if (mode) url.searchParams.set('travelmode', mode);
  return url.toString();
}

export function parseNextStopOptions(value: unknown, origin: MapCoordinates, destination: MapCoordinates): NextStopOption[] {
  if (!value || typeof value !== 'object') throw Error('Route response unavailable.');
  const result = value as { origin?: MapCoordinates; destination?: MapCoordinates; options?: NextStopOption[] };
  if (result.origin?.latitude !== origin.latitude || result.origin.longitude !== origin.longitude
    || result.destination?.latitude !== destination.latitude || result.destination.longitude !== destination.longitude
    || !Array.isArray(result.options) || result.options.length > 2) throw Error('Route endpoints do not match.');
  const modes = new Set<string>();
  return result.options.map(option => {
    if (!option || !['walking', 'driving'].includes(option.mode) || modes.has(option.mode) || option.provider !== 'osrm'
      || !Number.isFinite(option.distanceMeters) || option.distanceMeters < 0 || !Number.isFinite(option.durationSeconds) || option.durationSeconds < 0
      || typeof option.fetchedAt !== 'string' || !Number.isFinite(Date.parse(option.fetchedAt))) throw Error('Route evidence incomplete.');
    modes.add(option.mode);
    return { mode: option.mode, distanceMeters: option.distanceMeters, durationSeconds: option.durationSeconds, provider: option.provider, fetchedAt: option.fetchedAt };
  });
}
