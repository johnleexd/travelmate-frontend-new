import type { WeatherData } from '@/lib/contracts';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
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
  if (!weather
    || !validSources.has(weather.source as WeatherData['source'])
    || !requiredText.every((field) => typeof weather[field] === 'string')
    || !requiredNumbers.every((field) => typeof weather[field] === 'number' && Number.isFinite(weather[field]))
    || !Array.isArray(weather.alerts) || !weather.alerts.every((alert) => typeof alert === 'string')
    || !validForecast
    || typeof weather.forecastAvailable !== 'boolean'
    || (weather.forecastMessage !== undefined && typeof weather.forecastMessage !== 'string')) {
    throw new Error('Weather service returned an invalid response.');
  }
  return value as WeatherData;
}
