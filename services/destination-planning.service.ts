import type { AccommodationSearchResponse, DestinationContext, ExchangeRateQuote, FreshnessMetadata, LiveAccommodation, LocationSearchResponse, LocationSuggestion } from '@/lib/contracts';
import type { CurrencyCode } from '@/lib/domain';
import { handleResponse } from '@/services/api.service';

export async function searchLocations(query: string, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  const response = await fetch(`/api/locations?q=${encodeURIComponent(query.trim())}`, { signal });
  const result = await handleResponse<LocationSearchResponse>(response);
  return result.locations;
}

export async function fetchCurrentLocation(latitude: number, longitude: number, signal?: AbortSignal): Promise<LocationSuggestion> {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
  const response = await fetch(`/api/locations/current?${params}`, { signal });
  const result = await handleResponse<{ location: LocationSuggestion }>(response);
  return result.location;
}

export async function fetchDestinationContext(location: Pick<LocationSuggestion, 'name' | 'countryCode'>, signal?: AbortSignal): Promise<DestinationContext> {
  const params = new URLSearchParams({ city: location.name, countryCode: location.countryCode });
  return handleResponse<DestinationContext>(await fetch(`/api/destination-context?${params}`, { signal }));
}

export async function fetchExchangeRate(base: CurrencyCode, quote: CurrencyCode, signal?: AbortSignal): Promise<ExchangeRateQuote> {
  const params = new URLSearchParams({ base, quote });
  return handleResponse<ExchangeRateQuote>(await fetch(`/api/destination-context/exchange-rate?${params}`, { signal }));
}

export async function fetchDestinationAccommodations(input: {
  destination: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  currency: CurrencyCode;
  latitude?: number;
  longitude?: number;
}, signal?: AbortSignal): Promise<{ accommodations: LiveAccommodation[]; message: string; freshness?: FreshnessMetadata }> {
  const params = new URLSearchParams({
    destination: input.destination,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    adults: String(input.adults),
    currency: input.currency,
  });
  if (Number.isFinite(input.latitude) && Number.isFinite(input.longitude)) {
    params.set('latitude', String(input.latitude));
    params.set('longitude', String(input.longitude));
  }
  const response = await fetch(`/api/accommodations?${params}`, { signal });
  const result = await handleResponse<AccommodationSearchResponse>(response);
  return { accommodations: result.accommodations, message: result.message, freshness: result.freshness };
}
