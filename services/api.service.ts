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

import type { ItineraryResponse, WeatherData } from '@/lib/contracts';
import type { PartyType } from '@/lib/domain';
import { parseWeatherData } from '@/services/provider-response';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isAuthenticationError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

type TripOptions = { travelers?: number; partyType?: PartyType; startDate?: string; endDate?: string; latitude?: number; longitude?: number; interests?: string[]; preferredActivities?: string[]; travelStyle?: string; accommodationPreference?: string; transportationPreference?: string; weatherContext?: Array<{ date: string; description: string; precipitationProbability: number; tempMax: number }>; accommodationListingId?: string; externalAccommodation?: { hotelId: string; offerId: string; name: string; address: string; nightlyRate: number; isLive: boolean; selectionToken: string } };

// ─── Internal helpers ─────────────────────────────────────────────────────────

export async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch {
      throw new Error(res.ok ? 'The server returned an invalid response.' : 'TravelMate could not reach a required service. Please try again.');
    }
  }
  if (!res.ok) {
    const error = data && typeof data === 'object' && 'error' in data ? String((data as { error?: unknown }).error || '') : '';
    throw new ApiError(error || `Request failed (${res.status}).`, res.status);
  }
  return data as T;
}

// ─── Itinerary ─────────────────────────────────────────────────────────────────

/**
 * Fetch a date-range AI-generated itinerary from the configured provider.
 *
 * Falls back to realistic mock data automatically when:
 *  - OPENAI_API_KEY is not configured on the server
 *  - The OpenAI request fails for any reason
 *
 * @param destination  City / region name e.g. "Tokyo, Japan"
 * @param budget       Total group trip budget in PHP
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: destination.trim(), budget, ...options }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    throw new Error(error instanceof DOMException && error.name === 'TimeoutError' ? 'Itinerary generation timed out. Please try again.' : 'Cannot connect to TravelMate services. Check that the backend is running.');
  }

  return handleResponse<ItineraryResponse>(res);
}

// ─── Weather ───────────────────────────────────────────────────────────────────

/**
 * Fetch current weather plus any forecast available for the selected dates.
 *
 * Falls back to mock weather data automatically when:
 *  - OPENWEATHER_API_KEY is not configured on the server
 *  - The OpenWeatherMap request fails for any reason
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
 * Fetch both itinerary and weather in parallel.
 * Useful for the main trip planning flow where both are needed simultaneously.
 */
export async function fetchTripData(
  destination: string,
  budget: number,
  options?: TripOptions,
): Promise<{ itinerary: ItineraryResponse; weather: WeatherData }> {
  const weather = await fetchWeather(destination, options?.startDate, options?.endDate, options);
  const weatherContext = weather.forecast.map((day) => ({ date: day.date, description: day.description, precipitationProbability: day.precipitationProbability, tempMax: day.tempMax }));
  const itinerary = await fetchItineraryFromAI(destination, budget, { ...options, weatherContext });
  return { itinerary, weather };
}
