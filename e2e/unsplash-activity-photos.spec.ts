import { expect, test } from '@playwright/test';
import path from 'node:path';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

test('Unsplash activity hotlinks and attribution persist on reopen; illustrative, missing and failed photos stay truthful', async ({ page, context }) => {
  await mockPlanningLookups(page);
  await context.addCookies([{ name: 'travelmate_session', value: 'isolated-unsplash-fixture', domain: 'localhost', path: '/' }]);
  const photo = (id: string, illustrative = false) => ({ imageUrl: `https://images.unsplash.com/photo-${id}?ixid=preserved&w=1080`, imageAttribution: { provider: 'unsplash', photoId: id, creator: 'Recorded photographer', photographerUrl: 'https://unsplash.com/@recorded?utm_source=travelmate&utm_medium=referral', sourceUrl: `https://unsplash.com/photos/${id}?utm_source=travelmate&utm_medium=referral`, license: 'Unsplash', licenseUrl: 'https://unsplash.com/license', illustrative, match: illustrative ? 'destination' : 'place', downloadTracked: true, selectedAt: '2040-01-01T00:00:00Z' } });
  const activity = (name: string, id: string) => ({ id, title: `Visit ${name}`, time: '10:00 AM', estimatedCost: 100, category: 'activity', icon: 'map', description: 'Original description. Price unavailable; confirm before visiting.', place: { provider: 'wikidata', placeId: id, name, city: 'Recorded City', country: 'Japan', countryCode: 'JP', latitude: 35, longitude: 139, sourceUrl: `https://www.wikidata.org/wiki/${id}`, fetchedAt: '2040-01-01T00:00:00Z', openingHours: 'Needs confirmation', address: 'Saved address' } });
  const day = { day: 1, date: '2040-01-01', theme: 'Recorded visits', imageUrl: '', totalCost: 400, weatherAlert: 'Review weather conditions before outdoor visits.', activities: [activity('Exact Temple', 'Q1'), activity('No exact source', 'Q2'), activity('No suitable source', 'Q3'), { ...activity('Broken image', 'Q4'), ...photo('broken') }] };
  const itinerary = { destination: 'Recorded City, Japan', totalBudget: 1000, currency: 'JPY', travelers: 1, partyType: 'solo', source: 'catalog', days: [day], budgetSummary: { accommodation: 0, food: 0, activities: 400, transport: 0, reserve: 600, total: 1000, dailyAverage: 400, plannedSpend: 400 } };
  const trip = { id: 'unsplash-trip', destination: itinerary.destination, budget: 1000, currency: 'JPY', travelers: 1, partyType: 'solo', interests: [], startDate: day.date, endDate: day.date, status: 'active', createdAt: '2040-01-01T00:00:00Z', itinerary };
  let lookups = 0;
  await page.route('**/api/platform**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/photos')) {
      expect(route.request().postDataJSON().day).toBe(1); lookups++;
      trip.itinerary.days = [{ ...day, activities: day.activities.map((item, index) => index < 2 ? { ...item, ...photo(index === 0 ? 'exact' : 'illustration', index === 1) } : item) }];
      return route.fulfill({ json: { day: trip.itinerary.days[0], persisted: lookups === 1 } });
    }
    if (url.pathname.endsWith('/trips/unsplash-trip')) return route.fulfill({ json: { trip } });
    return route.fulfill({ json: { user: { id: 'owner', name: 'Photo Tester', email: 'photo@example.test', role: 'traveler', emailVerified: true, accountStatus: 'active' }, trips: [trip], listings: [], bookings: [], directory: [], notifications: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [] } });
  });
  const imageRequests: string[] = [];
  await page.route('https://images.unsplash.com/**', route => { imageRequests.push(route.request().url()); return route.request().url().includes('photo-broken') ? route.fulfill({ status: 503, body: '' }) : route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' }); });
  await page.goto('/dashboard'); await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  const card = page.locator('[data-daily-card]');
  await expect(card.locator('img[data-photo-id="exact"]').first()).toBeVisible();
  await expect.poll(() => card.locator('img[data-photo-id="exact"]').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(card.locator('img[data-photo-id="exact"]').first()).toHaveAttribute('src', photo('exact').imageUrl);
  await expect(card.locator('img[data-photo-id="exact"]').first()).toHaveAttribute('loading', 'lazy');
  await expect(card.locator('figure:has(img[data-photo-id="illustration"]) [data-illustrative-photo]')).toHaveText('Illustrative photo · ');
  await expect(card.getByRole('link', { name: 'Recorded photographer', exact: true }).first()).toHaveAttribute('href', photo('exact').imageAttribution.photographerUrl);
  await expect(card.getByRole('link', { name: 'Unsplash', exact: true }).first()).toHaveAttribute('href', photo('exact').imageAttribution.sourceUrl);
  await card.getByRole('button', { name: 'View Itinerary', exact: true }).click();
  const details = page.locator('[data-day-details]');
  await expect(details.locator('[data-activity-index="0"]')).toContainText('JPY 100');
  await expect(details.locator('[data-activity-index="1"] [data-illustrative-photo]').first()).toBeVisible();
  await expect(details.locator('[data-activity-index="2"] figure')).toContainText('Destination photo');
  await expect(details.locator('[data-activity-index="3"] [data-illustrative-photo]')).toBeVisible();
  await expect(details.getByRole('button', { name: /Edit/ }).first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await details.getByRole('button', { name: 'Full details', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Unsplash', exact: true }).first()).toHaveAttribute('href', photo('exact').imageAttribution.sourceUrl);
  await page.getByRole('button', { name: 'Close day details', exact: true }).click();
  await page.reload();
  await expect(card.locator('img[data-photo-id="exact"]').first()).toHaveAttribute('src', photo('exact').imageUrl);
  await expect(card.locator('img[data-photo-id="illustration"]')).toHaveAttribute('src', photo('illustration', true).imageUrl);
  expect(imageRequests.every(url => new URL(url).searchParams.get('ixid') === 'preserved')).toBe(true);
  expect(trip.itinerary.days[0].totalCost).toBe(400); expect(trip.itinerary.days[0].activities[0].description).toBe(day.activities[0].description);
});
