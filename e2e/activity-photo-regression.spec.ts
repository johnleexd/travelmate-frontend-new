import { expect, test, type Page, type BrowserContext, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';
import type { DayActivity } from '../lib/contracts';
import { placePhotoCandidates } from '../lib/place-image';

// Public provider records from the reported saved Tokyo trip, including slashless license URLs.
const activities: DayActivity[] = JSON.parse(fs.readFileSync('tests/fixtures/tokyo-activity-photos.json', 'utf8'));
const photos = (plan: { days: { activities: DayActivity[] }[] }) => plan.days[0].activities.map(({ imageUrl, imageAttribution }) => ({ imageUrl, imageAttribution }));

async function setup(page: Page, context: BrowserContext) {
  await context.addCookies([{ name: 'travelmate_session', value: 'photo-regression-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  const itinerary = {
    destination: 'Tokyo, Japan', currency: 'JPY', totalBudget: 30000, travelers: 1, partyType: 'solo', source: 'mock',
    budgetSummary: { accommodation: 0, food: 0, activities: 6000, transport: 0, reserve: 24000, total: 30000, plannedSpend: 6000 },
    days: [{ day: 1, date: '2040-10-15', theme: 'Tokyo gardens and museum', totalCost: 6000, imageUrl: activities[0].imageUrl!, imageAttribution: activities[0].imageAttribution, activities: structuredClone(activities) }],
  };
  const trip = { id: 'tokyo-photo-trip', destination: itinerary.destination, currency: 'JPY', budget: 30000, travelers: 1, partyType: 'solo', interests: [], startDate: '2040-10-15', endDate: '2040-10-15', status: 'active', createdAt: '2040-10-01T00:00:00Z', itinerary };
  const state = { writes: [] as Record<string, unknown>[], photoLookups: 0, trip };
  await page.route('**/api/destination-context/photo?*', route => route.fulfill({ json: { photo: null } }));
  await page.route('**/api/platform**', route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint.endsWith('/photos')) { state.photoLookups++; return route.fulfill({ json: { day: trip.itinerary.days[0], persisted: false } }); }
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); state.writes.push(body);
      if (body.itinerary) trip.itinerary = body.itinerary;
      return route.fulfill({ json: { result: trip } });
    }
    if (endpoint.endsWith('/trips/tokyo-photo-trip')) return route.fulfill({ json: { trip } });
    if (endpoint.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    return route.fulfill({ json: { user: { id: 'photo-regression-owner', name: 'Photo Tester', email: 'photos@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true }, trips: [trip], directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.goto('/dashboard');
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  await page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'View itinerary', exact: true }).click();
  return state;
}

async function expectLoaded(image: Locator, source: string) {
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  expect(await image.evaluate((el: HTMLImageElement) => new URL(el.src).searchParams.get('url'))).toBe(source);
}

test('real Tokyo photos and credits display in overview/details and survive an edit, save, reopen and refresh', async ({ page, context }) => {
  test.setTimeout(120000);
  const requests: { url: string; status: number }[] = [], errors: string[] = [];
  page.on('response', response => { if (response.url().includes('/_next/image?') && response.url().includes('wikimedia')) requests.push({ url: response.url(), status: response.status() }); });
  page.on('pageerror', error => errors.push(error.message));
  const state = await setup(page, context), originalPhotos = photos(state.trip.itinerary);
  const card = page.locator('[data-daily-card]'), details = page.locator('[data-day-details]');
  const checkOverview = async () => {
    for (const activity of activities) {
      const figure = card.locator('figure').filter({ has: page.locator('img[alt="' + activity.place!.name + ' in Tokyo, Japan"]') });
      await expectLoaded(figure.locator('img'), activity.imageUrl!);
      await expect(figure.getByRole('link', { name: 'Photo: ' + activity.imageAttribution!.creator, exact: true })).toHaveAttribute('href', activity.imageAttribution!.sourceUrl);
      await expect(figure.getByRole('link', { name: activity.imageAttribution!.license, exact: true })).toHaveAttribute('href', activity.imageAttribution!.licenseUrl! + '/');
    }
  };
  const checkDetails = async () => {
    for (const [index, activity] of activities.entries()) {
      const figure = details.locator('[data-activity-index="' + index + '"] figure');
      await expectLoaded(figure.locator('img'), activity.imageUrl!);
      await expect(figure.getByRole('link', { name: 'Photo: ' + activity.imageAttribution!.creator, exact: true })).toBeVisible();
    }
    await expect(details.locator('[data-photo-unavailable]')).toHaveCount(0);
  };
  await checkOverview(); await card.getByRole('button', { name: 'View Itinerary', exact: true }).click(); await checkDetails();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await details.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await details.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `../audit/2026-10-12/activity-photo-regression/details-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Edit Visit Shinjuku Gyoen', exact: true }).click();
  await page.getByLabel('Time', { exact: true }).fill('09:15');
  await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  await checkDetails();
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Trip updated successfully' })).toBeVisible();
  expect(state.writes.at(-1)?.action).toBe('update-trip-itinerary');
  expect(photos(state.trip.itinerary)).toEqual(originalPhotos);
  await page.getByRole('button', { name: 'Back to saved trips', exact: true }).click();
  await page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'View itinerary', exact: true }).click();
  await checkOverview();
  await page.reload(); // Refresh keeps the current trip overview route.
  await checkOverview(); await card.getByRole('button', { name: 'View Itinerary', exact: true }).click(); await checkDetails();
  expect(state.photoLookups).toBe(0); expect(errors).toEqual([]);
  expect(requests.length).toBeGreaterThan(0); expect(requests.every(request => request.status === 200)).toBe(true);
  fs.writeFileSync('../audit/2026-10-12/activity-photo-regression/live-browser-check.json', JSON.stringify({ requests, errors, photosPreserved: true, unnecessaryPhotoLookups: state.photoLookups }, null, 2));
});

test('load failures hide credits, report a load error, retry and reset when cycling back to an earlier URL', async ({ page, context }) => {
  let recovered = false;
  const candidates = placePhotoCandidates(activities[0].imageUrl);
  await page.route('**/_next/image?**', route => {
    const source = new URL(route.request().url()).searchParams.get('url');
    if (candidates.includes(source || '') && !recovered) return route.fulfill({ status: source === candidates[0] ? 404 : 503, body: '' });
    return route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' });
  });
  const state = await setup(page, context), originalPhotos = photos(state.trip.itinerary);
  const card = page.locator('[data-daily-card]');
  const failedOverview = card.locator('figure').filter({ hasText: 'Shinjuku Gyoen' });
  await expect(failedOverview.locator('[data-photo-state="error"]')).toHaveText(/Photo could not load/);
  await expect(failedOverview.locator('a')).toHaveCount(0);
  await card.getByRole('button', { name: 'View Itinerary', exact: true }).click();
  const firstPhoto = page.locator('[data-day-details] [data-activity-index="0"] figure');
  await expect(firstPhoto.locator('[data-photo-state="error"]')).toBeVisible();
  await expect(firstPhoto.locator('a')).toHaveCount(0);
  await page.getByRole('button', { name: 'Full details', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Day 1:/ }), hero = dialog.locator('.h-36');
  await expect(hero.locator('[data-photo-state="error"]')).toBeVisible();
  await expect(hero.locator('a')).toHaveCount(0);
  const next = dialog.getByRole('button', { name: 'Next activity', exact: true });
  await next.focus(); await page.keyboard.press('Enter'); await expect(next).toBeFocused();
  await expectLoaded(hero.locator('img'), activities[1].imageUrl!);
  recovered = true;
  await dialog.getByRole('button', { name: 'Previous activity', exact: true }).click();
  await expectLoaded(hero.locator('img'), activities[0].imageUrl!);
  await expect(hero.getByRole('link', { name: 'Photo: Kakidai', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close day details' }).click();
  await firstPhoto.getByRole('button', { name: 'Retry photo', exact: true }).click();
  await expectLoaded(firstPhoto.locator('img'), activities[0].imageUrl!);
  await expect(firstPhoto.getByRole('link', { name: 'Photo: Kakidai', exact: true })).toBeVisible();
  expect(photos(state.trip.itinerary)).toEqual(originalPhotos); expect(state.writes).toEqual([]);
});
