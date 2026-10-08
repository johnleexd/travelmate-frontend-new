type MapPlace = { name: string; destination: string; latitude?: number; longitude?: number; googlePlaceId?: string };
export function placeMapUrl(place: MapPlace): string {
  const precise = Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
    && Math.abs(place.latitude!) <= 90 && Math.abs(place.longitude!) <= 180;
  const parameters = new URLSearchParams({ api: '1', query: precise ? `${place.latitude},${place.longitude}` : `${place.name}, ${place.destination}` });
  // Wikidata and hotel provider IDs are not Google Place IDs.
  if (place.googlePlaceId) parameters.set('query_place_id', place.googlePlaceId);
  return `https://www.google.com/maps/search/?${parameters}`;
}
