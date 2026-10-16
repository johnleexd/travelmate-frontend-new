import { expect, test } from '@playwright/test';
import { buildGroundedPlan } from '../../travelmate-backend-api/src/services/itinerary/grounded-plan';
import { completeGroundedSchedule } from '../../travelmate-backend-api/src/services/itinerary/generated-day-scheduler';
import { retryIncompleteDays } from '../../travelmate-backend-api/src/services/itinerary/incomplete-day-retry';
import type { GroundedPlace } from '../../travelmate-backend-api/src/services/itinerary/grounded-places';

const owner = 'incomplete-days-isolated-owner';
const user = { id: owner, name: 'Retry test', email: 'retry@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const anchor = { id: 1133616, city: 'Mazār-e Sharīf', region: 'Balkh', country: 'Afghanistan', countryCode: 'AF', latitude: 36.70904, longitude: 67.11087 };
// Synthetic provider fixtures exercise the running UI and shared retry logic.
// They make no claim that these extra test venues exist in Mazār-e Sharīf.
const places: GroundedPlace[] = Array.from({ length: 15 }, (_, i) => ({ provider: 'wikidata', placeId: `Q${100 + i}`, name: `Fixture museum ${i}`, description: 'museum', ...anchor, latitude: anchor.latitude + i / 100000,
  sourceUrl: `https://www.wikidata.org/wiki/Q${100 + i}`, fetchedAt: '2026-10-16T00:00:00Z', openingHours: 'Opening hours need confirmation', address: 'Unconfirmed' }));
const original = buildGroundedPlan({ destination: 'Mazār-e Sharīf, Balkh, Afghanistan', anchor, startingLocation: '', startDate: '2026-10-16', endDate: '2026-10-22', budget: 40000, currency: 'AFN', travelers: 2, partyType: 'couple', rooms: 1,
  places: places.slice(0, 1), placeDataStatus: 'live', source: 'catalog', transportation: '', schedule: completeGroundedSchedule(anchor, places.slice(0, 1), [], '2026-10-16', 7, 2, 'balanced') });
const storageKey = `travelmate-itinerary-draft:${owner}`;

test('restore, edit, retry, refresh and explicitly save an incomplete AFN browser draft', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'isolated-retry', domain: 'localhost', path: '/' }]);
  const state = { requests: [] as Record<string, unknown>[], saves: [] as Record<string, unknown>[], failed: false };
  const trip = { id: '', userId: owner, destination: original.destination, budget: 40000, currency: 'AFN', startDate: '2026-10-16', endDate: '2026-10-22', travelers: 2, partyType: 'couple', interests: [], itinerary: original, status: 'active', createdAt: '2026-10-16T00:00:00Z' };
  await page.addInitScript(({ key, draft }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(draft)); }, { key: storageKey, draft: { trip, itinerary: original, weather: null, savedAt: '2026-10-16T00:00:00Z' } });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/api/platform' && request.method() === 'GET') return route.fulfill({ json: { user, trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [] } });
    if (path === '/api/itinerary/retry-days') {
      const body = request.postDataJSON(); state.requests.push(body);
      if (state.failed) return route.fulfill({ status: 503, json: { error: 'Provider temporarily unavailable. Your draft is preserved.' } });
      return route.fulfill({ json: retryIncompleteDays(body.itinerary, body.days, { places, status: 'live' }, body.includeNearby, body.providerBase ?? original) });
    }
    if (path === '/api/platform' && request.method() === 'POST') {
      const body = request.postDataJSON(); state.saves.push(body);
      return route.fulfill({ json: { result: { ...trip, ...body, id: 'isolated-retry-trip', updatedAt: '2026-10-16T01:00:00Z' } } });
    }
    return route.fulfill({ status: 503, json: { error: 'Provider isolated for browser test.' } });
  });
  await page.goto('/dashboard?tab=planner');
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(page.locator('[data-itinerary-day="7"]')).toContainText('0 activities');
  await expect(page.getByRole('button', { name: 'Find activities for all 7 days', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View day itinerary', exact: true }).first().click();
  await page.getByRole('button', { name: 'Edit Visit Fixture museum 0', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit activity', exact: true });
  await dialog.locator('[name="description"]').fill('My preserved visit notes');
  await dialog.getByRole('button', { name: 'Save activity', exact: true }).click();
  await page.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  const beforeRetry = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).itinerary, storageKey);
  const day2 = page.locator('[data-itinerary-day="2"]');
  await day2.getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await page.getByRole('button', { name: 'Full details', exact: true }).click();
  const dayDetails = page.getByRole('dialog', { name: /Day 2:/ });
  await expect(dayDetails.getByRole('button', { name: 'Find culture activities for Day 2', exact: true })).toBeVisible();
  await dayDetails.getByRole('button', { name: 'Find culture activities for Day 2', exact: true }).click();
  await expect(dayDetails.getByRole('heading', { name: /Visit Fixture museum/ }).first()).toBeVisible();
  await dayDetails.getByRole('button', { name: 'Close day details', exact: true }).click();
  await page.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  await expect(day2.getByRole('heading', { name: /Visit Fixture museum/ }).first()).toBeVisible();
  expect(state.requests).toHaveLength(1); expect(state.requests[0].includeNearby).toBe(false);
  const retried = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey);
  expect(retried.itinerary.days[0].activities[0].description).toBe('My preserved visit notes');
  expect(retried.itinerary.days[6]).toEqual(beforeRetry.days[6]);
  expect(retried.itinerary.days[1].activities.every((item: {place?: {placeId: string}}) => item.place?.placeId !== 'Q100')).toBe(true);
  expect(retried.providerBase.groundingProof).toBeTruthy(); expect(state.saves).toEqual([]);
  await page.reload();
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).itinerary.days[0].activities[0].description, storageKey)).toBe('My preserved visit notes');
  await expect(day2.getByRole('heading', { name: /Visit Fixture museum/ }).first()).toBeVisible();
  state.failed = true;
  const beforeFailure = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).itinerary, storageKey);
  const day3 = page.locator('[data-itinerary-day="3"]');
  await day3.getByRole('checkbox').check();
  await day3.getByRole('button', { name: 'Retry Day 3 activities', exact: true }).click();
  await expect(page.getByText('Provider temporarily unavailable. Your draft is preserved.', { exact: true })).toBeVisible();
  expect(state.requests[1].includeNearby).toBe(true);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).itinerary, storageKey)).toEqual(beforeFailure);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Save manual changes', exact: true }).click();
  await expect.poll(() => state.saves.length).toBe(1);
  expect(state.saves[0].action).toBe('save-trip'); expect(state.saves[0].currency).toBe('AFN');
  expect(state.saves[0].providerBase).toBeTruthy();
});
