/**
 * lib/apiService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side API service for TravelMate.
 *
 * All calls go through our own Next.js API routes (/api/itinerary, /api/weather)
 * so that third-party API keys are NEVER exposed to the browser.
 *
 * Usage:
 *   import { fetchItineraryFromAI, fetchWeather } from '@/lib/apiService';
 *
 *   const itinerary = await fetchItineraryFromAI('Tokyo', 3000);
 *   const weather   = await fetchWeather('Tokyo');
 */

// ─── Re-export shared types for convenience ───────────────────────────────────
export type {
  DayActivity,
  DayPlan,
  ItineraryResponse,
} from '@/app/api/itinerary/route';

export type {
  WeatherData,
  ForecastDay,
} from '@/app/api/weather/route';

import type { ItineraryResponse } from '@/app/api/itinerary/route';
import type { WeatherData } from '@/app/api/weather/route';

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const json = await res.json();
      if (json?.error) message = json.error;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ─── Itinerary ─────────────────────────────────────────────────────────────────

/**
 * Fetch a 7-day AI-generated itinerary from OpenAI (via our server-side proxy).
 *
 * Falls back to realistic mock data automatically when:
 *  - OPENAI_API_KEY is not configured on the server
 *  - The OpenAI request fails for any reason
 *
 * @param destination  City / region name e.g. "Tokyo, Japan"
 * @param budget       Total trip budget in USD (positive integer)
 * @returns            Parsed ItineraryResponse ready to drive the 7-day panel UI
 */
export async function fetchItineraryFromAI(
  destination: string,
  budget: number,
): Promise<ItineraryResponse> {
  if (!destination?.trim()) throw new Error('destination must not be empty.');
  if (!Number.isFinite(budget) || budget <= 0) throw new Error('budget must be a positive number.');

  const res = await fetch('/api/itinerary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destination: destination.trim(), budget }),
  });

  return handleResponse<ItineraryResponse>(res);
}

// ─── Weather ───────────────────────────────────────────────────────────────────

/**
 * Fetch current weather + 7-day forecast for a city (via our server-side proxy).
 *
 * Falls back to mock weather data automatically when:
 *  - OPENWEATHER_API_KEY is not configured on the server
 *  - The OpenWeatherMap request fails for any reason
 *
 * @param city  City name e.g. "Tokyo" or "Paris, FR"
 * @returns     WeatherData including alerts and daily forecast array
 */
export async function fetchWeather(city: string): Promise<WeatherData> {
  if (!city?.trim()) throw new Error('city must not be empty.');

  const url = `/api/weather?city=${encodeURIComponent(city.trim())}`;
  const res = await fetch(url, { method: 'GET' });

  return handleResponse<WeatherData>(res);
}

// ─── Combined helper ───────────────────────────────────────────────────────────

/**
 * Fetch both itinerary and weather in parallel.
 * Useful for the main trip planning flow where both are needed simultaneously.
 */
export async function fetchTripData(
  destination: string,
  budget: number,
): Promise<{ itinerary: ItineraryResponse; weather: WeatherData }> {
  const [itinerary, weather] = await Promise.all([
    fetchItineraryFromAI(destination, budget),
    fetchWeather(destination),
  ]);
  return { itinerary, weather };
}
