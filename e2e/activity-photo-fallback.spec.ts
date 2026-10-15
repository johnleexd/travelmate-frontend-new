import { expect, test } from '@playwright/test';
import path from 'node:path';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

test('a saved trip persists only missing exact-place photos with credit; reopening and saving preserve itinerary details', async ({ page, context }) => {
  await mockPlanningLookups(page);
  await context.addCookies([{ name: 'travelmate_session', value: 'photo-fallback-fixture', domain: 'localhost', path: '/' }]);
  const source = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Recorded_Temple.jpg';
  const credit = { creator: 'Recorded photographer', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', sourceUrl: 'https://commons.wikimedia.org/?curid=42' };
  const activity = { title: 'Visit Recorded Temple', time: '10:00', estimatedCost: 300, category: 'activity', icon: 'map', description: 'Actual saved visit', place: { provider: 'wikidata', placeId: 'Q123', name: 'Recorded Temple', city: 'Recorded City', country: 'South Korea', countryCode: 'KR', latitude: 36, longitude: 128, sourceUrl: 'https://www.wikidata.org/wiki/Q123', fetchedAt: '2040-01-01T00:00:00Z', openingHours: 'Needs confirmation', address: 'Recorded address' } };
  const original = { destination: 'Recorded City, South Korea', totalBudget: 1000, currency: 'KRW', travelers: 1, partyType: 'solo', source: 'catalog', days: [{ day: 1, date: '2040-01-01', theme: 'Recorded visits', imageUrl: '', totalCost: 700, activities: [{ ...activity, title: 'Existing photo venue', imageUrl: source + '?existing', imageAttribution: { ...credit, creator: 'Existing photographer' } }, activity, { ...activity, title: 'No supported photo', place: { ...activity.place, name: 'No supported photo', placeId: 'Q999' } }, { title: 'Daily meals', time: 'Daily allowance', description: 'Original allowance', category: 'food', estimatedCost: 100, icon: 'food' }] }], budgetSummary: { accommodation: 0, food: 100, activities: 600, transport: 0, reserve: 300, total: 1000, dailyAverage: 700, plannedSpend: 700 } };
  const trip = { id: 'photo-trip', destination: original.destination, budget: 1000, currency: 'KRW', travelers: 1, partyType: 'solo', interests: [], startDate: '2040-01-01', endDate: '2040-01-01', status: 'active', createdAt: '2040-01-01T00:00:00Z', itinerary: original };
  let lookups = 0; const writes: Record<string, unknown>[] = [];
  await page.route('**/api/platform**', route => {
    if (new URL(route.request().url()).pathname.endsWith('/trips/photo-trip/photos')) {
      lookups++; expect(route.request().postDataJSON()).toEqual({ day: 1 });
      trip.itinerary = { ...original, days: [{ ...original.days[0], activities: original.days[0].activities.map((item, index) => index === 1 ? { ...item, imageUrl: source, imageAttribution: credit } : item) }] };
      return route.fulfill({ json: { day: trip.itinerary.days[0], persisted: lookups === 1 } });
    }
    if (route.request().method() === 'POST') { writes.push(route.request().postDataJSON()); return route.fulfill({ json: { result: trip } }); }
    if (new URL(route.request().url()).pathname.endsWith('/trips/photo-trip')) return route.fulfill({ json: { trip } });
    return route.fulfill({ json: { user: { id: 'photo-owner', name: 'Photo Tester', email: 'photos@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true }, trips: [trip], listings: [], directory: [], notifications: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.route('**/api/itinerary/images', route => {
    lookups++; const body = route.request().postDataJSON(); expect(body.lookupOnly).toBe(true); expect(body.itinerary).toBeUndefined();
    expect(body.day.activities[0].imageUrl).toBe(source + '?existing');
    return route.fulfill({ json: { day: { ...body.day, totalCost: 99999, activities: body.day.activities.map((item: typeof activity, index: number) => index === 1 ? { ...item, estimatedCost: 99999, imageUrl: source, imageAttribution: credit } : item) } } });
  });
  await page.route('**/_next/image?**', route => route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' }));
  await page.goto('/dashboard'); await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  const card = page.locator('[data-daily-card]');
  await expect(card.locator('[data-day-photos] img')).toHaveCount(2);
  await expect(card.getByRole('link', { name: 'Photo: Recorded photographer', exact: true })).toHaveAttribute('href', credit.sourceUrl);
  await expect(card.getByRole('link', { name: 'CC BY-SA 4.0', exact: true }).first()).toHaveAttribute('href', credit.licenseUrl);
  await expect(card).toContainText('KRW 700'); expect(writes).toHaveLength(0);
  await expect.poll(() => lookups).toBe(2); // Partial success checks the remaining venue once.
  await card.getByRole('button', { name: 'View Itinerary', exact: true }).click();
  const details = page.locator('[data-day-details]');
  await expect(details.locator('[data-activity-index="1"] img')).toHaveAttribute('alt', 'Recorded Temple');
  await expect(details.locator('[data-activity-index="1"]')).toContainText('KRW 300');
  await expect(details.locator('[data-activity-index="2"] figure')).toContainText('Destination photo');
  await expect(details.locator('[data-activity-index="2"] figure img')).toHaveAttribute('alt', /Destination photo:/);
  await expect(details.getByRole('region', { name: 'Day 1 daily budget' }).locator('[data-photo-unavailable]')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await details.screenshot({ path: '../audit/2026-10-11/activity-photo-fallback/saved-trip-mobile.png', style: 'header, nextjs-portal { display: none !important; }' });
  await details.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  await page.getByRole('button', { name: 'Saved trips', exact: true }).click(); await page.getByRole('button', { name: 'View itinerary', exact: true }).click();
  await expect(card.locator('[data-day-photos] img')).toHaveCount(2); expect(lookups).toBe(2); expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1); expect(writes[0].itinerary).toEqual(original);
  await page.reload(); await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  await expect(card.locator('[data-day-photos] img')).toHaveCount(2); await expect.poll(() => lookups).toBe(3); expect(writes).toHaveLength(1);
});
