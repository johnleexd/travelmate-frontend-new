import type { FreshnessMetadata, TravelOptionsResponse, WeatherData } from '@/lib/contracts';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function validFreshness(value: unknown): value is FreshnessMetadata {
  const freshness = record(value);
  if (!freshness) return false;
  return ['flights', 'hotels', 'activities', 'weather', 'exchange-rates'].includes(String(freshness.source))
    && ['live', 'fresh-cache', 'stale-cache', 'unavailable'].includes(String(freshness.status))
    && typeof freshness.isStale === 'boolean'
    && freshness.isStale === (freshness.status === 'stale-cache')
    && ['fetchedAt', 'expiresAt', 'staleUntil', 'policy'].every((field) => typeof freshness[field] === 'string');
}

export function parseWeatherData(value: unknown): WeatherData {
  const weather = record(value);
  const validSources = new Set<WeatherData['source']>(['openweathermap', 'open-meteo', 'unavailable', 'mock']);
  const forecast = Array.isArray(weather?.forecast) ? weather.forecast : null;
  const requiredText = ['city', 'country', 'description', 'icon', 'iconUrl'] as const;
  const requiredNumbers = ['temperature', 'feelsLike', 'humidity', 'windSpeed'] as const;
  const validForecast = forecast?.every((day) => {
    const item = record(day);
    if (!item) return false;
    return typeof item.date === 'string'
      && typeof item.tempMin === 'number'
      && typeof item.tempMax === 'number'
      && typeof item.description === 'string'
      && typeof item.icon === 'string'
      && typeof item.iconUrl === 'string'
      && typeof item.precipitationProbability === 'number'
      && (item.weatherAlert === undefined || typeof item.weatherAlert === 'string');
  });
  const crowd = Array.isArray(weather?.crowd) ? weather.crowd : null;
  const validCrowd = crowd?.every((condition) => {
    const item = record(condition);
    return item
      && typeof item.date === 'string'
      && ['low', 'moderate', 'high'].includes(String(item.crowdLevel))
      && item.crowdSource === 'estimated'
      && item.crowdConfidence === 'low'
      && ['crowdNote', 'crowdRecommendation', 'fetchedAt', 'refreshAfter'].every((field) => typeof item[field] === 'string');
  });
  if (!weather
    || !validSources.has(weather.source as WeatherData['source'])
    || !requiredText.every((field) => typeof weather[field] === 'string')
    || !requiredNumbers.every((field) => typeof weather[field] === 'number' && Number.isFinite(weather[field]))
    || !Array.isArray(weather.alerts) || !weather.alerts.every((alert) => typeof alert === 'string')
    || !validForecast
    || !validCrowd
    || typeof weather.forecastAvailable !== 'boolean'
    || typeof weather.fetchedAt !== 'string'
    || typeof weather.refreshAfter !== 'string'
    || !validFreshness(weather.freshness)
    || (weather.forecastMessage !== undefined && typeof weather.forecastMessage !== 'string')) {
    throw new Error('Weather service returned an invalid response.');
  }
  return value as WeatherData;
}

export function parseTravelOptionsResponse(value: unknown): TravelOptionsResponse {
  const result = record(value);
  const provider = record(result?.provider);
  const freshness = record(result?.freshness);
  const flights = Array.isArray(result?.flights) ? result.flights : null;
  const activities = Array.isArray(result?.activities) ? result.activities : null;
  const validFlight = (value: unknown) => {
    const flight = record(value);
    if (!flight) return false;
    const requiredText = ['id', 'airline', 'origin', 'destination', 'departure', 'arrival', 'duration', 'currency', 'fetchedAt', 'selectionToken'] as const;
    return flight.provider === 'amadeus'
      && requiredText.every((field) => typeof flight[field] === 'string')
      && typeof flight.price === 'number' && Number.isFinite(flight.price)
      && typeof flight.stops === 'number' && Number.isInteger(flight.stops)
      && typeof flight.isLive === 'boolean'
      && (flight.returnDeparture === undefined || typeof flight.returnDeparture === 'string')
      && (flight.returnArrival === undefined || typeof flight.returnArrival === 'string')
      && (flight.seatsAvailable === undefined || (typeof flight.seatsAvailable === 'number' && Number.isInteger(flight.seatsAvailable)));
  };
  const validActivity = (value: unknown) => {
    const activity = record(value);
    if (!activity) return false;
    const requiredText = ['id', 'name', 'location', 'description', 'currency', 'fetchedAt', 'selectionToken'] as const;
    return ['amadeus', 'travelmate'].includes(String(activity.provider))
      && requiredText.every((field) => typeof activity[field] === 'string')
      && typeof activity.price === 'number' && Number.isFinite(activity.price)
      && typeof activity.isLive === 'boolean'
      && (activity.rating === undefined || (typeof activity.rating === 'number' && Number.isFinite(activity.rating)))
      && (activity.referenceUrl === undefined || typeof activity.referenceUrl === 'string');
  };
  if (!result
    || typeof result.fetchedAt !== 'string'
    || !provider || provider.name !== 'amadeus' || typeof provider.configured !== 'boolean' || typeof provider.isLive !== 'boolean'
    || !flights || !flights.every(validFlight)
    || !activities || !activities.every(validActivity)
    || typeof result.flightMessage !== 'string' || typeof result.activityMessage !== 'string'
    || !freshness || !validFreshness(freshness.flights) || !validFreshness(freshness.activities)
    || (freshness.flights as FreshnessMetadata).source !== 'flights'
    || (freshness.activities as FreshnessMetadata).source !== 'activities') {
    throw new Error('Travel option service returned an invalid response.');
  }
  return value as TravelOptionsResponse;
}
