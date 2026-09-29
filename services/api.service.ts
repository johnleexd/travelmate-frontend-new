/**
 * services/api.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side API service for TravelMate.
 *
 * All calls go through our own Next.js API routes (/api/itinerary, /api/weather)
 * so that third-party API keys are NEVER exposed to the browser.
 *
 * Usage:
 *   import { fetchItineraryFromAI, fetchWeather } from '@/services/api.service';
 *
 *   const itinerary = await fetchItineraryFromAI('Tokyo', 3000);
 *   const weather   = await fetchWeather('Tokyo');
 */

// ─── Re-export shared types for convenience ───────────────────────────────────
export type {
  DayActivity,
  DayPlan,
  ItineraryResponse,
} from '@/lib/contracts';

export type {
  WeatherData,
  ForecastDay,
} from '@/lib/contracts';

import type { DayPlan, ItineraryDayResponse, ItineraryResponse, WeatherData } from '@/lib/contracts';
import type { CurrencyCode, PartyType } from '@/lib/domain';
import { parseWeatherData } from '@/services/provider-response';
import { handleResponse } from '@/services/api-response';
import { fetchTripWithOptionalWeather } from '@/lib/trip-data';
export { ApiError, handleResponse, isAuthenticationError } from '@/services/api-response';

type TripOptions = { idempotencyKey?: string; currency?: CurrencyCode; travelers?: number; partyType?: PartyType; startDate?: string; endDate?: string; latitude?: number; longitude?: number; interests?: string[]; preferredActivities?: string[]; travelStyle?: string; accommodationPreference?: string; transportationPreference?: string; accommodationListingId?: string; externalAccommodation?: { hotelId: string; offerId: string; name: string; address: string; nightlyRate: number; currency: string; isLive: boolean; selectionToken: string }; selectedFlight?: { id: string; name: string; price: number; currency: string; fetchedAt: string; selectionToken: string }; selectedActivities?: Array<{ id: string; name: string; price: number; currency: string; fetchedAt: string; selectionToken: string }>; preTripCosts?: { startingLocation?: string; departureAirport?: string; passportCountry?: string; passportStatus?: 'valid' | 'needs_application' | 'needs_renewal' | 'not_sure'; airportTransferOutbound: number; airportTransferReturn: number; passport: number; visaOrAuthorization: number; departureTaxes: number; insurance: number; other: number } };

// ─── Internal helpers ─────────────────────────────────────────────────────────

// ─── Itinerary ─────────────────────────────────────────────────────────────────

/**
 * Fetch a date-range AI-generated itinerary from the configured provider.
 *
 * A disclosed mock is available only when the backend explicitly enables its
 * non-production fallback. Configured-provider failures remain errors.
 *
 * @param destination  City / region name e.g. "Tokyo, Japan"
 * @param budget       Total group trip budget in the selected currency
 * @returns            Parsed ItineraryResponse ready to drive the itinerary UI
 */
export async function fetchItineraryFromAI(
  destination: string,
  budget: number,
  options?: TripOptions,
): Promise<ItineraryResponse> {
  if (!destination?.trim()) throw new Error('destination must not be empty.');
  if (!Number.isFinite(budget) || budget <= 0) throw new Error('budget must be a positive number.');

  let res: Response;
  try {
    res = await fetch('/api/itinerary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}) },
      body: JSON.stringify({ destination: destination.trim(), budget, ...options }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    throw new Error(error instanceof DOMException && error.name === 'TimeoutError' ? 'Itinerary generation timed out. Please try again.' : 'Cannot connect to TravelMate services. Check that the backend is running.');
  }

  return handleResponse<ItineraryResponse>(res);
}

export async function refreshItineraryDayImages(destination: string, day: DayPlan): Promise<DayPlan> {
  let res: Response;
  try {
    res = await fetch('/api/itinerary/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, day }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(error instanceof DOMException && error.name === 'TimeoutError' ? 'Activity photo refresh timed out.' : 'Activity photos are temporarily unavailable.');
  }
  const payload = await handleResponse<ItineraryDayResponse>(res);
  return payload.day;
}

// ─── Weather ───────────────────────────────────────────────────────────────────

/**
 * Fetch current weather plus any forecast available for the selected dates.
 *
 * The backend uses its configured weather providers and returns an explicit
 * unavailable state rather than fabricating weather.
 *
 * @param city  City name e.g. "Tokyo" or "Paris, FR"
 * @returns     WeatherData including alerts and daily forecast array
 */
export async function fetchWeather(city: string, startDate?: string, endDate?: string, coordinates?: { latitude?: number; longitude?: number }): Promise<WeatherData> {
  if (!city?.trim()) throw new Error('city must not be empty.');

  const params = new URLSearchParams({ city: city.trim() });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (Number.isFinite(coordinates?.latitude) && Number.isFinite(coordinates?.longitude)) {
    params.set('latitude', String(coordinates!.latitude));
    params.set('longitude', String(coordinates!.longitude));
  }
  const url = `/api/weather?${params}`;
  let res: Response;
  try { res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(20_000) }); }
  catch { throw new Error('Weather service is currently unavailable.'); }

  return parseWeatherData(await handleResponse<unknown>(res));
}

// ─── Combined helper ───────────────────────────────────────────────────────────

/**
 * Fetch an itinerary and optional weather context in parallel. Weather
 * provider failure must not prevent the itinerary from being generated.
 */
export async function fetchTripData(
  destination: string,
  budget: number,
  options?: TripOptions,
): Promise<{ itinerary: ItineraryResponse; weather: WeatherData | null }> {
  return fetchTripWithOptionalWeather(
    () => fetchItineraryFromAI(destination, budget, options),
    () => fetchWeather(destination, options?.startDate, options?.endDate, options),
  );
}
