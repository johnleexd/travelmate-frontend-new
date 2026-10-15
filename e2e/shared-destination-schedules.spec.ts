import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';
import type { ItineraryResponse } from '../lib/contracts';
import type { TripMapManifest } from '../lib/trip-navigation';

// Reopened records produced by the backend's isolated PostgreSQL generation/save test.
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/shared-destination-schedules.json', import.meta.url), 'utf8')) as Array<{ anchor: { city: string; country: string; countryCode: string; latitude: number; longitude: number }; trip: { id: string; destination: string; itinerary: ItineraryResponse; [key: string]: unknown }; manifest: TripMapManifest }>;
for (const fixture of fixtures) test(`${fixture.anchor.city}: generation, autosave, reopen and map agree on desktop/mobile`, async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'isolated-reopened-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await mockPlanningLookups(page);
  const writes: Record<string, unknown>[] = [];
  let saved = false;
  const user = { id: fixture.trip.userId, name: 'Shared generation tester', email: 'shared-generation@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e4ede0"/></svg>' }));
  await page.route('**/api/platform**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') { writes.push(route.request().postDataJSON()); saved = true; return route.fulfill({ json: { result: fixture.trip } }); }
    if (path.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (path.endsWith(`/trips/${fixture.trip.id}`)) return route.fulfill({ json: { trip: fixture.trip } });
    return route.fulfill({ json: { user, trips: saved ? [fixture.trip] : [], directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.route('**/api/navigation/trips/**', route => {
    const endpoint = new URL(route.request().url()).pathname.split('/').at(-1);
    if (endpoint === 'map') return route.fulfill({ json: { map: fixture.manifest } });
    const body = route.request().postDataJSON();
    if (endpoint === 'activity') return route.fulfill({ json: { activity: fixture.manifest.days[body.dayIndex].activities[body.activityIndex], candidates: [], message: '' } });
    return route.fulfill({ json: { weather: { status: 'unavailable', kind: 'forecast', message: 'Weather unavailable in this isolated test.' } } });
  });
  await page.route('**/api/locations?**', route => route.fulfill({ json: { locations: [{ id: 'reference-destination', name: fixture.anchor.city, label: fixture.trip.destination, ...fixture.anchor, source: 'geonames', placeType: 'City' }] } }));
  await page.route('**/api/destination-context?**', route => route.fulfill({ json: { currency: 'EUR', currencySource: 'country-code', transportation: [], transportationMessage: 'No verified transport data.' } }));
  await page.route('**/api/accommodations?**', route => route.fulfill({ json: { configured: false, accommodations: [], nearbyAccommodations: [], message: 'Prices unavailable.' } }));
  await page.route('**/api/weather?**', route => route.fulfill({ status: 503, json: { error: 'Weather unavailable in this isolated test.' } }));
  await page.route('**/api/exchange-rates?**', route => route.fulfill({ status: 503, json: { error: 'Reference rates unavailable in this isolated test.' } }));
  await page.route('**/api/itinerary', route => {
    const request = route.request().postDataJSON();
    expect(request.destinationDetails).toEqual(fixture.anchor);
    return route.fulfill({ json: fixture.trip.itinerary });
  });
  await page.goto('/dashboard'); await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await page.getByRole('combobox', { name: 'Destination', exact: true }).fill(fixture.anchor.city);
  await page.locator('#destination-suggestions').getByRole('button').first().click();
  await page.getByLabel('Start date', { exact: true }).fill('2040-01-25'); await page.getByLabel(/^End date/).fill('2040-01-27');
  await page.getByLabel(/trip budget/i).fill('10000');
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  const cards = page.locator('[data-daily-card]'); await expect(cards).toHaveCount(3);
  await expect.poll(() => writes.length).toBe(1);
  expect((writes[0].itinerary as ItineraryResponse).days).toEqual(fixture.trip.itinerary.days);
  const populated = fixture.manifest.days[0].activities.some(activity => !activity.budgetOnly);
  for (const card of await cards.all()) {
    await card.getByRole('button', { name: 'View Itinerary', exact: true }).click();
    const detail = page.locator('[data-day-details]');
    await expect(detail.locator('[data-activity-index]')).toHaveCount(populated ? 3 : 0);
    if (populated) { await expect(detail.locator('ol')).toContainText('Opening hours need confirmation'); await expect(detail.locator('ol')).toContainText('Suggested'); }
    else { await expect(card).toContainText('Incomplete itinerary — more places needed'); await expect(detail.getByText('No activities scheduled', { exact: true })).toHaveCount(1); }
    await detail.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 }); await cards.first().scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await cards.first().screenshot({ path: `../audit/2026-10-11/itinerary-two-views/${fixture.anchor.city}-${width}-reopened.png`, style: 'header { visibility: hidden; }' });
  }
  await page.reload(); await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  await expect(cards).toHaveCount(3);
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  await page.getByRole('button', { name: 'View map / Navigate', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: fixture.trip.destination, exact: true }); await expect(dialog).toBeVisible();
  for (const [index, day] of fixture.manifest.days.entries()) {
    await dialog.getByRole('button', { name: `Day ${index + 1} ${day.date}`, exact: true }).click();
    for (const activity of day.activities.filter(activity => !activity.budgetOnly && activity.place)) await expect(dialog.getByRole('button', { name: `Activity ${activity.index + 1}: ${activity.title}`, exact: true })).toBeVisible();
    expect(day.activities.filter(activity => activity.budgetOnly).every(activity => !activity.place)).toBe(true);
  }
  await dialog.screenshot({ path: `../audit/2026-10-11/generation-fix/${fixture.anchor.city}-mobile-map.png` });
  await dialog.getByRole('button', { name: 'Close trip map' }).click();
  expect(writes).toHaveLength(1); // Reloading, reopening and mapping never overwrite the saved itinerary.
});
