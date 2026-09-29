import assert from 'node:assert/strict';
import test from 'node:test';
import { applyConditionSnapshot } from '../lib/conditions.ts';
import type { ItineraryResponse, WeatherData } from '../lib/contracts.ts';

test('condition refresh preserves manual itinerary content while replacing advisory metadata', () => {
  const plan = {
    destination: 'Cebu City, Philippines', totalBudget: 1000, currency: 'PHP', manuallyEdited: true,
    days: [{ day: 1, date: '2026-12-05', theme: 'Custom day', imageUrl: '/travel-illustration.png', totalCost: 250, activities: [{ time: '11:00 AM', title: 'My manual activity', description: 'Keep this.', estimatedCost: 250, category: 'activity', icon: 'activity' }], crowdLevel: 'low', crowdSource: 'estimated', crowdConfidence: 'low', crowdNote: 'Old estimate.' }],
    budgetSummary: { accommodation: 0, food: 0, activities: 250, transport: 0, reserve: 750, dailyAverage: 1000, total: 1000 },
  } satisfies ItineraryResponse;
  const conditions = {
    source: 'unavailable', city: plan.destination, country: '', temperature: 0, feelsLike: 0, humidity: 0, windSpeed: 0, description: 'unavailable', icon: '', iconUrl: '', alerts: [], forecast: [], forecastAvailable: false,
    fetchedAt: '2026-09-15T00:00:00.000Z', refreshAfter: '2026-09-15T01:00:00.000Z',
    freshness: {
      source: 'weather', status: 'unavailable', isStale: false,
      fetchedAt: '2026-09-15T00:00:00.000Z', expiresAt: '2026-09-15T01:00:00.000Z',
      staleUntil: '2026-09-15T01:00:00.000Z', policy: 'Weather data unavailable.',
    },
    crowd: [{ date: '2026-12-05', crowdLevel: 'high', crowdSource: 'estimated', crowdConfidence: 'low', crowdNote: 'New estimate; not live foot-traffic.', crowdRecommendation: 'Visit before 9:00 AM. No activity was moved automatically.', fetchedAt: '2026-09-15T00:00:00.000Z', refreshAfter: '2026-09-16T00:00:00.000Z' }],
  } satisfies WeatherData;

  const refreshed = applyConditionSnapshot(plan, conditions);
  assert.equal(refreshed.manuallyEdited, true);
  assert.deepEqual(refreshed.days[0].activities, plan.days[0].activities);
  assert.equal(refreshed.days[0].theme, 'Custom day');
  assert.equal(refreshed.days[0].totalCost, 250);
  assert.equal(refreshed.days[0].crowdLevel, 'high');
  assert.match(refreshed.days[0].crowdRecommendation || '', /No activity was moved automatically/);
});
