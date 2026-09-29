import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, handleResponse } from '../services/api-response.ts';
import { parseTravelOptionsResponse, parseWeatherData } from '../services/provider-response.ts';
import { fetchTripWithOptionalWeather } from '../lib/trip-data.ts';

test('API error responses preserve the backend contract metadata', async () => {
  const response = Response.json({
    error: 'Provider unavailable.',
    code: 'PROVIDER_UNAVAILABLE',
    retryable: true,
    details: { provider: 'weather' },
  }, { status: 502 });

  await assert.rejects(handleResponse(response), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 502);
    assert.equal(error.code, 'PROVIDER_UNAVAILABLE');
    assert.equal(error.retryable, true);
    assert.deepEqual(error.details, { provider: 'weather' });
    return true;
  });
});

test('legacy proxy errors remain readable during contract rollout', async () => {
  await assert.rejects(handleResponse(Response.json({ error: 'Legacy failure.' }, { status: 400 })), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.message, 'Legacy failure.');
    assert.equal(error.code, undefined);
    return true;
  });
});

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
  fetchedAt: '2026-09-15T00:00:00.000Z',
  refreshAfter: '2026-09-15T01:00:00.000Z',
  freshness: {
    source: 'weather',
    status: 'unavailable',
    isStale: false,
    fetchedAt: '2026-09-15T00:00:00.000Z',
    expiresAt: '2026-09-15T01:00:00.000Z',
    staleUntil: '2026-09-15T01:00:00.000Z',
    policy: '15m fresh; stale fallback up to 60m when the provider fails.',
  },
  crowd: [],
} as const;

test('weather response parsing accepts the explicit unavailable state', () => {
  assert.deepEqual(parseWeatherData(validWeather), validWeather);
});

test('weather response parsing accepts internally consistent freshness metadata', () => {
  const withFreshness = {
    ...validWeather,
    freshness: {
      source: 'weather',
      status: 'stale-cache',
      isStale: true,
      fetchedAt: '2026-09-15T00:00:00.000Z',
      expiresAt: '2026-09-15T00:15:00.000Z',
      staleUntil: '2026-09-15T01:00:00.000Z',
      policy: '15m fresh; stale fallback up to 60m when the provider fails.',
    },
  } as const;
  assert.deepEqual(parseWeatherData(withFreshness), withFreshness);
});

test('weather response parsing rejects a stale status without the stale flag', () => {
  assert.throws(() => parseWeatherData({
    ...validWeather,
    freshness: {
      source: 'weather', status: 'stale-cache', isStale: false,
      fetchedAt: '', expiresAt: '', staleUntil: '', policy: '',
    },
  }), { message: 'Weather service returned an invalid response.' });
});

test('weather response parsing rejects malformed provider payloads', () => {
  assert.throws(() => parseWeatherData({ source: 'open-meteo', city: 'Cordova' }), {
    message: 'Weather service returned an invalid response.',
  });
});

test('trip generation succeeds when optional weather lookup fails', async () => {
  const itinerary = { destination: 'Tokyo', days: [{ day: 1 }] };
  const result = await fetchTripWithOptionalWeather(
    async () => itinerary,
    async () => { throw new Error('Weather provider unavailable'); },
  );
  assert.equal(result.itinerary, itinerary);
  assert.equal(result.weather, null);
});

test('trip generation still fails when the itinerary service fails', async () => {
  await assert.rejects(fetchTripWithOptionalWeather(
    async () => { throw new Error('AI provider unavailable'); },
    async () => validWeather,
  ), /AI provider unavailable/);
});

test('travel comparison parsing requires normalized provider freshness', () => {
  const freshness = (source: 'flights' | 'activities') => ({
    source,
    status: 'live',
    isStale: false,
    fetchedAt: '2026-09-18T00:00:00.000Z',
    expiresAt: '2026-09-18T00:05:00.000Z',
    staleUntil: '2026-09-18T00:15:00.000Z',
    policy: 'Provider-specific cache policy.',
  });
  const response = {
    fetchedAt: '2026-09-18T00:00:00.000Z',
    provider: { name: 'amadeus', configured: true, isLive: false },
    flights: [],
    activities: [],
    flightMessage: 'No offers.',
    activityMessage: 'No offers.',
    freshness: { flights: freshness('flights'), activities: freshness('activities') },
  };
  assert.deepEqual(parseTravelOptionsResponse(response), response);
  assert.throws(() => parseTravelOptionsResponse({ ...response, freshness: undefined }), {
    message: 'Travel option service returned an invalid response.',
  });
});
