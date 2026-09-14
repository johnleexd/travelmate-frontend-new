import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWeatherData } from '../services/provider-response.ts';

const validWeather = {
  source: 'unavailable',
  city: 'Cordova, Cebu, Philippines',
  country: '',
  temperature: 0,
  feelsLike: 0,
  humidity: 0,
  windSpeed: 0,
  description: 'Unavailable',
  icon: '',
  iconUrl: '',
  alerts: [],
  forecast: [],
  forecastAvailable: false,
  forecastMessage: 'Forecast unavailable for the selected travel dates.',
} as const;

test('weather response parsing accepts the explicit unavailable state', () => {
  assert.deepEqual(parseWeatherData(validWeather), validWeather);
});

test('weather response parsing rejects malformed provider payloads', () => {
  assert.throws(() => parseWeatherData({ source: 'open-meteo', city: 'Cordova' }), {
    message: 'Weather service returned an invalid response.',
  });
});
