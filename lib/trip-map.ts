export type MapCoordinates = { latitude: number; longitude: number };

export function mapCoordinates(value?: { latitude?: unknown; longitude?: unknown } | null): MapCoordinates | null {
  if (!value || typeof value.latitude !== 'number' || typeof value.longitude !== 'number'
    || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)
    || Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180) return null;
  return { latitude: value.latitude, longitude: value.longitude };
}

export function tripMapDestination(trip: { latitude?: unknown; longitude?: unknown }, recordedDestination?: { latitude?: unknown; longitude?: unknown }): MapCoordinates | null {
  return mapCoordinates(trip) || mapCoordinates(recordedDestination);
}

// Keep both markers together when a trip crosses the international date line.
export function longitudeNear(longitude: number, reference: number): number {
  return reference + ((longitude - reference + 540) % 360) - 180;
}

export function straightLineDistanceKm(from: MapCoordinates, to: MapCoordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(radians(to.latitude - from.latitude) / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(radians(to.longitude - from.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function tripDirectionsUrl(destination: string, point: MapCoordinates | null, origin: MapCoordinates | null): string {
  const params = new URLSearchParams({ api: '1', destination: point ? `${point.latitude},${point.longitude}` : destination });
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params}`;
}
