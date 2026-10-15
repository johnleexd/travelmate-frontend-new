import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

// Produced by real provider generation, PostgreSQL save, disconnect and owned reopen.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/gimcheon-reopened-trip.json', import.meta.url), 'utf8'));

test('Gimcheon autosave and reopen preserve verified visits and load genuine place photos', async ({ page, context }) => {
  // Keep the recorded generation dates valid as the real calendar advances.
  await page.clock.setFixedTime(new Date(`${fixture.body.startDate}T00:00:00+08:00`));
  await context.addCookies([{ name: 'travelmate_session', value: 'gimcheon-ui-verification', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  const user = { id: fixture.trip.userId, name: 'Gimcheon UI Tester', email: 'test@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
  const writes: Record<string, unknown>[] = [];
  const imageResponses: Array<{ url: string; status: number }> = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/_next/image') && response.url().includes('Jikjitempleentrance')) imageResponses.push({ url: response.url(), status: response.status() }); });
  let saved = false;
  await page.route('**/api/platform**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST') { writes.push(route.request().postDataJSON()); saved = true; return route.fulfill({ json: { result: fixture.trip } }); }
    if (path.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (path.endsWith(`/trips/${fixture.trip.id}`)) return route.fulfill({ json: { trip: fixture.trip } });
    return route.fulfill({ json: { user, trips: saved ? [fixture.trip] : [], tripsPage: { total: saved ? 1 : 0, nextCursor: null }, notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [], directory: [], moderation: [], audit: [] } });
  });
  await page.route('**/api/locations?**', route => route.fulfill({ json: { locations: [{ ...fixture.anchor, id: 1842944, name: fixture.anchor.city, label: fixture.trip.destination, placeType: 'City or locality' }] } }));
  await page.route('**/api/destination-context?**', route => route.fulfill({ json: { currency: 'KRW', currencySource: 'country-code', transportation: [], transportationMessage: 'No verified transport data.' } }));
  await page.route('**/api/weather?**', route => route.fulfill({ status: 503, json: { error: 'Weather unavailable in this UI fixture.' } }));
  await page.route('**/api/exchange-rates?**', route => route.fulfill({ status: 503, json: { error: 'Reference rates unavailable in this UI fixture.' } }));
  await page.route('**/api/itinerary', route => {
    expect(route.request().postDataJSON().destinationDetails).toEqual(fixture.anchor);
    return route.fulfill({ json: fixture.trip.itinerary });
  });
  await page.goto('/dashboard');
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await page.getByRole('combobox', { name: 'Destination', exact: true }).fill('Gimcheon');
  await page.locator('#destination-suggestions').getByRole('button').first().click();
  await page.getByLabel('Start date', { exact: true }).fill(fixture.body.startDate);
  await page.getByLabel(/^End date/).fill(fixture.body.endDate);
  await page.getByLabel(/trip budget/i).fill(String(fixture.body.budget));
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  const cards = page.locator('[data-daily-card]');
  await expect(cards).toHaveCount(7);
  await expect.poll(() => writes.length).toBe(1);
  expect((writes[0].itinerary as { days: unknown }).days).toEqual(fixture.trip.itinerary.days);
  const picture = cards.first().getByRole('img', { name: `Jikjisa in ${fixture.trip.destination}`, exact: true });
  await cards.first().scrollIntoViewIfNeeded();
  await expect(picture).toBeVisible();
  await expect.poll(() => picture.evaluate(image => (image as HTMLImageElement).naturalWidth), { timeout: 30000 }).toBeGreaterThan(0);
  expect(imageResponses.some(response => response.status === 200)).toBe(true);
  await expect(cards.first().getByText('Destination photo', { exact: true })).toHaveCount(0);
  await expect(cards.first()).toContainText('Photo: Crossmr');
  const noPhotoIndex = fixture.trip.itinerary.days.findIndex((day: { imageUrl?: string }) => !day.imageUrl);
  await expect(cards.nth(noPhotoIndex).locator('[data-photo-unavailable]')).toBeVisible();
  const nearbyDay = fixture.trip.itinerary.days.findIndex((day: { activities: Array<{ place?: { locationScope?: string } }> }) => day.activities.some(activity => activity.place?.locationScope === 'nearby'));
  for (const [index, day] of fixture.trip.itinerary.days.entries()) {
    const photographed = day.activities.filter((activity: { imageUrl?: string }) => activity.imageUrl);
    const card = cards.nth(index);
    await card.getByRole('button', { name: 'View Itinerary', exact: true }).click();
    for (const activity of photographed) {
      const exactPhoto = page.locator('[data-day-details]').getByRole('img', { name: activity.place.name, exact: true });
      await exactPhoto.scrollIntoViewIfNeeded();
      await expect.poll(() => exactPhoto.evaluate(image => (image as HTMLImageElement).naturalWidth), { timeout: 30000 }).toBeGreaterThan(0);
    }
    const detail = page.locator('[data-day-details]');
    await expect(detail.locator('[data-activity-index]')).toHaveCount(day.activities.filter((activity: { place?: unknown }) => activity.place).length);
    if (index === nearbyDay) { await expect(detail).toContainText('Nearby attraction'); await expect(detail).toContainText('outside Gimcheon'); await expect(detail).toContainText('km straight-line'); await expect(detail).toContainText('Return time is reserved'); }
    if (index === 0) {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await detail.screenshot({ path: '../audit/2026-10-11/itinerary-two-views/gimcheon-details-' + width + '.png', style: 'header, nextjs-portal { display: none !important; }' });
      }
    }
    await detail.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await cards.first().scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await cards.first().screenshot({ path: `../audit/2026-10-11/itinerary-two-views/gimcheon-${width}.png`, style: 'header { visibility: hidden; }' });
    if (nearbyDay >= 0) await cards.nth(nearbyDay).screenshot({ path: `../audit/2026-10-11/itinerary-two-views/nearby-${width}.png`, style: 'header { visibility: hidden; }' });
  }
  await page.reload();
  await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  await expect(cards).toHaveCount(7);
  await cards.first().scrollIntoViewIfNeeded();
  await expect.poll(() => picture.evaluate(image => (image as HTMLImageElement).naturalWidth), { timeout: 30000 }).toBeGreaterThan(0);
  expect(writes).toHaveLength(1);
  expect(errors).toEqual([]);
});
