import { test, expect } from '@playwright/test';
import path from 'node:path';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

test('Google photo display stays transient across overview, details, save, reopen and refresh', async ({ page, context }) => {
  await mockPlanningLookups(page);
  await context.addCookies([{ name: 'travelmate_session', value: 'isolated-google-fixture', domain: 'localhost', path: '/' }]);
  const id = 'ChIJ_verified_place';
  const activity = { id: 'visit-1', title: 'Visit Exact Temple', time: '09:00', description: 'Original description', estimatedCost: 100, category: 'activity', icon: 'map', location: 'Recorded City', place: { provider: 'wikidata', placeId: 'Q1', name: 'Exact Temple', city: 'Recorded City', country: 'Japan', countryCode: 'JP', latitude: 35, longitude: 139, sourceUrl: 'https://www.wikidata.org/wiki/Q1', fetchedAt: '2040-01-01T00:00:00Z', openingHours: 'Confirm', address: 'Recorded address' } };
  const day = { day: 1, date: '2040-01-01', theme: 'Recorded visits', imageUrl: '', totalCost: 100, activities: [activity] };
  const itinerary = { destination: 'Recorded City, Japan', totalBudget: 1000, currency: 'JPY', travelers: 1, partyType: 'solo', source: 'catalog', days: [day], budgetSummary: { accommodation: 0, food: 0, activities: 100, transport: 0, reserve: 900, total: 1000, dailyAverage: 100 } };
  const trip = { id: 'google-trip', destination: itinerary.destination, latitude: 35, longitude: 139, budget: 1000, currency: 'JPY', travelers: 1, partyType: 'solo', interests: [], startDate: day.date, endDate: day.date, status: 'active', createdAt: '2040-01-01T00:00:00Z', itinerary };
  let lookups = 0, saves = 0;
  const user = { id: 'owner', name: 'Photo Tester', email: 'photo@example.test', role: 'traveler', emailVerified: true, accountStatus: 'active' };
  const workspace = () => ({ user, trips: [trip], listings: [], bookings: [], directory: [], notifications: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [] });
  await page.route('**/api/platform**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.endsWith('/photos')) {
      lookups++; (trip.itinerary.days[0].activities[0] as typeof activity & { googlePlaceId?: string }).googlePlaceId = id;
      return route.fulfill({ json: { day: trip.itinerary.days[0], persisted: true, googlePhotos: { 0: { placeId: id, imageUrl: `https://lh3.googleusercontent.com/current-image-${lookups}`, googleMapsUri: 'https://www.google.com/maps/?photo=source', authors: [{ displayName: 'Actual Author', uri: 'https://www.google.com/maps/contrib/1', photoUri: 'https://lh3.googleusercontent.com/avatar' }] } } }, headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (request.method() === 'POST') {
      saves++; const body = request.postDataJSON();
      expect(JSON.stringify(body)).not.toContain('googleusercontent'); expect(JSON.stringify(body)).not.toContain('current-image');
      return route.fulfill({ json: { result: trip } });
    }
    if (url.pathname.endsWith('/trips/google-trip')) return route.fulfill({ json: { trip } });
    return route.fulfill({ json: workspace() });
  });
  await page.route('https://*.googleusercontent.com/**', route => route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' }));
  await page.goto('/dashboard'); await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  const card = page.locator('[data-daily-card]');
  await expect(card.locator('[data-google-place-photo] img')).toBeVisible();
  await expect(card.locator('[data-google-place-photo] img')).toHaveAttribute('loading', 'lazy');
  await expect(card.getByText('Google Maps', { exact: true })).toBeVisible();
  expect(await card.getByText('Google Maps', { exact: true }).evaluate(element => getComputedStyle(element).color)).toBe('rgb(31, 31, 31)');
  await expect(card.getByRole('link', { name: 'Photo: Actual Author', exact: true })).toHaveAttribute('href', 'https://www.google.com/maps/contrib/1');
  await expect(card.getByRole('link', { name: 'View source photo', exact: true })).toHaveAttribute('href', 'https://www.google.com/maps/?photo=source');
  await card.screenshot({ path: '../audit/2026-10-12/google-places-photos/mock-google-overview.png' });
  const first = lookups;
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  await page.getByRole('button', { name: 'View trip map', exact: true }).click();
  await expect(page.locator('[data-google-place-photo]')).toHaveCount(0);
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.getByRole('button', { name: 'Back to activity photos', exact: true }).click();
  await expect(card.locator('[data-google-place-photo] img')).toBeVisible();
  await expect(page.locator('.leaflet-container')).toHaveCount(0); expect(lookups).toBe(first);
  await page.setViewportSize({ width: 1000, height: 800 });
  await card.getByRole('button', { name: 'View Itinerary', exact: true }).click();
  const details = page.locator('[data-day-details]');
  await expect(details.locator('[data-google-place-photo] img')).toBeVisible(); expect(lookups).toBe(first);
  await expect(details.locator('[data-activity-index="0"]')).toContainText('Original description');
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect.poll(() => saves).toBe(1);
  await page.goto('/dashboard'); await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  await expect(card.locator('[data-google-place-photo] img')).toBeVisible(); expect(lookups).toBeGreaterThan(first);
  const reopened = lookups;
  await page.reload(); await expect(card.locator('[data-google-place-photo] img')).toBeVisible(); expect(lookups).toBeGreaterThan(reopened);
  expect(JSON.stringify(trip.itinerary)).not.toContain('googleusercontent'); expect(trip.itinerary.days[0].totalCost).toBe(100);
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })); expect(storage).not.toContain('googleusercontent');
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a failed Google image switches to the labeled existing fallback once', async ({ page, context }) => {
  await mockPlanningLookups(page);
  await context.addCookies([{ name: 'travelmate_session', value: 'isolated-google-failure', domain: 'localhost', path: '/' }]);
  const activity = { id: 'a1', title: 'Exact Temple', time: '09:00', description: 'Preserved', estimatedCost: 0, category: 'activity', icon: 'map', location: 'Recorded City' };
  const day = { day: 1, date: '2040-01-01', theme: 'Recorded visits', imageUrl: '', totalCost: 0, activities: [activity] };
  const itinerary = { destination: 'Recorded City, Japan', totalBudget: 1000, currency: 'JPY', travelers: 1, partyType: 'solo', days: [day], budgetSummary: { accommodation: 0, food: 0, activities: 0, transport: 0, reserve: 1000, total: 1000, dailyAverage: 0 } };
  const trip = { id: 'failure-trip', destination: itinerary.destination, budget: 1000, currency: 'JPY', travelers: 1, partyType: 'solo', interests: [], startDate: day.date, endDate: day.date, status: 'active', createdAt: '2040-01-01T00:00:00Z', itinerary };
  let calls = 0;
  const credit = { provider: 'unsplash', photoId: 'fallback', creator: 'Fallback Author', photographerUrl: 'https://unsplash.com/@author?utm_source=travelmate&utm_medium=referral', sourceUrl: 'https://unsplash.com/photos/fallback?utm_source=travelmate&utm_medium=referral', license: 'Unsplash', illustrative: true, match: 'destination', downloadTracked: true };
  await page.route('**/api/platform**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/photos')) {
      calls++; const body = route.request().postDataJSON();
      if (calls === 1) return route.fulfill({ json: { day: { ...day, activities: [{ ...activity, googlePlaceId: 'ChIJ_verified_place' }] }, googlePhotos: { 0: { placeId: 'ChIJ_verified_place', imageUrl: 'https://lh3.googleusercontent.com/broken', googleMapsUri: 'https://www.google.com/maps/?photo=source', authors: [] } } } });
      expect(body.googleFailedIndices).toEqual([0]);
      return route.fulfill({ json: { day: { ...day, activities: [{ ...activity, imageUrl: 'https://images.unsplash.com/photo-fallback', imageAttribution: credit }] } } });
    }
    if (url.pathname.endsWith('/trips/failure-trip')) return route.fulfill({ json: { trip } });
    return route.fulfill({ json: { user: { id: 'owner', name: 'Photo Tester', email: 'photo@example.test', role: 'traveler', emailVerified: true, accountStatus: 'active' }, trips: [trip], listings: [], bookings: [], directory: [], notifications: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [] } });
  });
  await page.route('https://lh3.googleusercontent.com/**', route => route.fulfill({ status: 503, body: '' }));
  await page.route('https://images.unsplash.com/**', route => route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' }));
  await page.goto('/dashboard'); await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  await expect(page.locator('[data-daily-card] [data-illustrative-photo]')).toBeVisible();
  await expect(page.locator('[data-daily-card] [data-google-place-photo]')).toHaveCount(0);
  expect(calls).toBe(2);
});
