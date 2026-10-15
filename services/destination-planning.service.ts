import type { AccommodationSearchResponse, DestinationContext, ExchangeRateQuote, FreshnessMetadata, LiveAccommodation, NearbyAccommodation, LocationSearchResponse, LocationSuggestion, LocationCandidate } from '@/lib/contracts';
import type { CurrencyCode } from '@/lib/domain';
import { handleResponse } from '@/services/api.service';
import { exchangeRateClient } from './exchange-rate-client';

export async function searchLocations(query: string, signal?: AbortSignal): Promise<LocationCandidate[]> {
  return (await searchLocationPage(query, 0, signal)).locations;
}
export async function searchLocationPage(query: string, offset = 0, signal?: AbortSignal, countryCode?: string): Promise<LocationSearchResponse> {
  const params = new URLSearchParams({ q: query.trim(), offset: String(offset), ...(countryCode ? {countryCode} : {}) });
  return handleResponse<LocationSearchResponse>(await fetch(`/api/locations?${params}`, { signal }));
}

export async function resolveAdministrativeDestination(location: Pick<LocationCandidate, 'id' | 'countryCode'>, signal?: AbortSignal): Promise<LocationSuggestion> {
  const params = new URLSearchParams({ locationId: String(location.id), countryCode: location.countryCode });
  const response = await fetch(`/api/locations/resolve?${params}`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(35000)]) : AbortSignal.timeout(35000) });
  const result = await handleResponse<{ location: LocationSuggestion }>(response);
  if (!result.location || result.location.id !== location.id || result.location.countryCode !== location.countryCode || !Number.isFinite(result.location.latitude) || !Number.isFinite(result.location.longitude)) throw Error('The selected location coordinates could not be verified.');
  return result.location;
}

export async function resolveManualDestination(query: string, signal?: AbortSignal): Promise<{ location: LocationSuggestion | null; candidates: LocationSuggestion[]; areas: LocationSuggestion[]; message: string }> {
  const response = await fetch(`/api/locations/resolve?q=${encodeURIComponent(query.trim())}&secondary=true`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(35000)]) : AbortSignal.timeout(35000) });
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
  currency: CurrencyCode;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  locationId?: number;
  locationProvider?: string;
  locationProviderId?: string;
  administrativeCode?: string;
  provinceCode?: string;
  placeType?: string;
}, signal?: AbortSignal): Promise<{ providerAccommodations?: import('@/lib/contracts').ProviderAccommodation[]; providerStatus?: AccommodationSearchResponse['providerStatus']; providerMessage?: string; providerEnvironment?: 'sandbox' | 'production'; accommodations: LiveAccommodation[]; nearbyAccommodations: NearbyAccommodation[]; message: string; status?: AccommodationSearchResponse['status']; freshness?: FreshnessMetadata }> {
  const params = new URLSearchParams({
    destination: input.destination,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    adults: String(input.adults),
    mode: 'suggestions',
    currency: input.currency,
    countryCode: input.countryCode || '',
    placeType: input.placeType || '',
    quotes: 'false',
    ...(input.locationId ? { locationId: String(input.locationId), locationProvider: input.locationProvider || '', locationProviderId: input.locationProviderId || '' } : {}),
    ...(input.administrativeCode ? { administrativeCode: input.administrativeCode } : {}),
    ...(input.provinceCode ? { provinceCode: input.provinceCode } : {}),
  });
  if (Number.isFinite(input.latitude) && Number.isFinite(input.longitude)) {
    params.set('latitude', String(input.latitude));
    params.set('longitude', String(input.longitude));
  }
  const response = await fetch(`/api/accommodations?${params}`, { signal });
  const result = await handleResponse<AccommodationSearchResponse>(response);
  return { providerAccommodations: result.providerAccommodations, providerStatus: result.providerStatus, providerMessage: result.providerMessage, providerEnvironment: result.providerEnvironment, accommodations: result.accommodations, nearbyAccommodations: result.nearbyAccommodations || [], message: result.message, status: result.status, freshness: result.freshness };
}
