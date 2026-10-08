import type { AccommodationSearchResponse, DestinationContext, ExchangeRateQuote, FreshnessMetadata, LiveAccommodation, NearbyAccommodation, LocationSearchResponse, LocationSuggestion } from '@/lib/contracts';
import type { CurrencyCode } from '@/lib/domain';
import { handleResponse } from '@/services/api.service';
import { exchangeRateClient } from './exchange-rate-client';

export async function searchLocations(query: string, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  const response = await fetch(`/api/locations?q=${encodeURIComponent(query.trim())}`, { signal });
  const result = await handleResponse<LocationSearchResponse>(response);
  return result.locations;
}

export async function resolveManualDestination(query: string, signal?: AbortSignal): Promise<{ location: LocationSuggestion | null; candidates: LocationSuggestion[]; areas: LocationSuggestion[]; message: string }> {
  const response = await fetch(`/api/locations/resolve?q=${encodeURIComponent(query.trim())}`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(35000)]) : AbortSignal.timeout(35000) });
  return handleResponse(response);
}

export async function fetchCurrentLocation(latitude: number, longitude: number, signal?: AbortSignal): Promise<LocationSuggestion> {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
  const timeout = AbortSignal.timeout(15000);
  const response = await fetch(`/api/locations/current?${params}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  const result = await handleResponse<{ location: LocationSuggestion }>(response);
  return result.location;
}

export async function fetchDestinationContext(location: Pick<LocationSuggestion, 'name' | 'countryCode'>, signal?: AbortSignal): Promise<DestinationContext> {
  const params = new URLSearchParams({ city: location.name, countryCode: location.countryCode });
  return handleResponse<DestinationContext>(await fetch(`/api/destination-context?${params}`, { signal }));
}

export async function fetchExchangeRate(base: CurrencyCode, quote: CurrencyCode, signal?: AbortSignal): Promise<ExchangeRateQuote> {
  return exchangeRateClient.fetch(base, quote, signal);
}

export async function fetchDestinationAccommodations(input: {
  destination: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  guestNationality?: string;
  occupancy?: import('@/lib/contracts').RoomOccupancy;
  currency: CurrencyCode;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  placeType?: string;
  quotes?: boolean;
}, signal?: AbortSignal): Promise<{ providerAccommodations?: import('@/lib/contracts').ProviderAccommodation[]; providerStatus?: AccommodationSearchResponse['providerStatus']; providerMessage?: string; providerEnvironment?: 'sandbox' | 'production'; accommodations: LiveAccommodation[]; nearbyAccommodations: NearbyAccommodation[]; message: string; status?: AccommodationSearchResponse['status']; freshness?: FreshnessMetadata }> {
  const params = new URLSearchParams({
    destination: input.destination,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    adults: String(input.adults),
    ...(input.occupancy ? { occupancy: JSON.stringify(input.occupancy) } : {}),
    currency: input.currency,
    guestNationality: input.guestNationality || '',
    countryCode: input.countryCode || '',
    placeType: input.placeType || '',
    quotes: String(input.quotes !== false),
  });
  if (Number.isFinite(input.latitude) && Number.isFinite(input.longitude)) {
    params.set('latitude', String(input.latitude));
    params.set('longitude', String(input.longitude));
  }
  const response = await fetch(`/api/accommodations?${params}`, { signal });
  const result = await handleResponse<AccommodationSearchResponse>(response);
  return { providerAccommodations: result.providerAccommodations, providerStatus: result.providerStatus, providerMessage: result.providerMessage, providerEnvironment: result.providerEnvironment, accommodations: result.accommodations, nearbyAccommodations: result.nearbyAccommodations || [], message: result.message, status: result.status, freshness: result.freshness };
}
