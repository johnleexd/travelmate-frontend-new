import type { DestinationAnchor, LocationCandidate, ItineraryResponse } from './contracts';

export function selectedDestinationAnchor(place: LocationCandidate | null): DestinationAnchor | undefined {
  if (!place || typeof place.latitude !== 'number' || typeof place.longitude !== 'number' || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude) || !place.countryCode) return;
  return { city: place.name, region: place.region, country: place.country, countryCode: place.countryCode, latitude: place.latitude, longitude: place.longitude,
    placeType: place.placeType, ...(place.sourceFeatureCode ? { sourceFeatureCode: place.sourceFeatureCode } : {}), ...(place.scopeType ? { scopeType: place.scopeType } : {}), ...(place.locationPath ? { locationPath: place.locationPath } : {}), ...(place.parentId ? { parentId: place.parentId } : {}), ...(place.canBrowse !== undefined ? { canBrowse: place.canBrowse } : {}), ...(place.coordinateSource ? { coordinateSource: place.coordinateSource } : {}),
    ...(place.id && place.provider ? { id: place.id, provider: place.provider, providerId: place.providerId } : {}),
    ...(place.administrativeCode ? { administrativeCode: place.administrativeCode, provinceCode: place.provinceCode, geographicProvinceCode: place.geographicProvinceCode, administrativeLevel: place.administrativeLevel, coordinateSource: place.coordinateSource } : {}),
  };
}

/** Current plans persist the selected identity in grounding; older plans retain their stored point. */
export function savedDestinationAnchor(itinerary: unknown): DestinationAnchor | undefined {
  if (!itinerary || typeof itinerary !== 'object') return;
  const anchor = (itinerary as Partial<ItineraryResponse>).grounding?.destination;
  if (!anchor || !Number.isFinite(anchor.latitude) || !Number.isFinite(anchor.longitude) || typeof anchor.city !== 'string' || typeof anchor.countryCode !== 'string') return;
  return anchor;
}
