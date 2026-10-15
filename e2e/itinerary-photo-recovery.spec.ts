import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

test.beforeEach(async ({ page }) => { await mockPlanningLookups(page); });
import path from 'node:path';

const thumbnail = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/The_Hachiko_statue_at_Shibuya%2C_Tokyo%2C_Japan.jpg/1280px-The_Hachiko_statue_at_Shibuya%2C_Tokyo%2C_Japan.jpg';
const original = 'https://upload.wikimedia.org/wikipedia/commons/6/6e/The_Hachiko_statue_at_Shibuya%2C_Tokyo%2C_Japan.jpg';

async function openItinerary(page: Page, context: BrowserContext, checkCover = false, destinationFallback = false) {
  const date = '2026-10-10';
  const day = {
    day: 1, date, theme: 'Shibuya Sightseeing', imageUrl: thumbnail, totalCost: 100,
    activities: [{ title: 'Hachiko Statue', time: '10:00 AM', description: 'Visit the famous meeting point.', estimatedCost: 100, category: 'activity', icon: 'map', imageUrl: thumbnail, imageAttribution: { creator: 'Test author', license: 'CC BY-SA 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Hachiko_statue_at_Shibuya,_Tokyo,_Japan.jpg' }, place: { provider: 'wikidata', name: 'Hachiko Statue', city: 'Tokyo', country: 'Japan', countryCode: 'JP', latitude: 35.659, longitude: 139.701 } }],
  };
  if (destinationFallback) { day.activities[0].imageUrl = ''; Object.assign(day, { imageAttribution: day.activities[0].imageAttribution }); }
  const itinerary = {
    destination: 'Tokyo, Japan', currency: 'JPY', totalBudget: 1000, days: [day],
    budgetSummary: { accommodation: 0, food: 0, activities: 100, transport: 0, reserve: 900, dailyAverage: 100, total: 1000 },
  };
  await context.addCookies([{ name: 'travelmate_session', value: 'photo-test', domain: 'localhost', path: '/' }]);
  await page.route('**/api/platform**', route => route.fulfill({ json: {
    user: { id: 'photo', name: 'Photo Test', email: 'photo@example.test', role: 'traveler', emailVerified: true, accountStatus: 'active' },
    trips: [{ id: 'trip', destination: itinerary.destination, startDate: date, endDate: date, budget: 1000, currency: 'JPY', travelers: 1, partyType: 'solo', interests: [], status: 'active', itinerary, createdAt: date }],
    listings: [], bookings: [], directory: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {},
  } }));
  await page.route('**/api/itinerary/images', route => route.fulfill({ json: { day } }));
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
  if (checkCover) {
    const cover = page.getByAltText('Hachiko Statue, Tokyo, Japan', { exact: true });
    await expect(cover).toHaveAttribute('src', /[?&]url=https%3A%2F%2Fupload\.wikimedia\.org%2F/);
    await expect.poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  }
  await page.getByRole('button', { name: 'View itinerary', exact: true }).click();
  await page.getByRole('heading', { name: 'Day 1: Shibuya Sightseeing', exact: true }).scrollIntoViewIfNeeded();
}

test('a rate-limited Commons thumbnail recovers in the saved cover, day card and activity dialog', async ({ page, context }) => {
  await page.route('**/_next/image?url=' + encodeURIComponent(thumbnail) + '&*', route => route.fulfill({ status: 429, body: '' }));
  await page.route('**/_next/image?url=' + encodeURIComponent(original) + '&*', route => route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' }));
  await openItinerary(page, context, true);
  const cardPhoto = page.getByAltText('Hachiko Statue in Tokyo, Japan', { exact: true });
  await expect(cardPhoto).toHaveAttribute('src', /[?&]url=https%3A%2F%2Fupload\.wikimedia\.org%2F/);
  await expect.poll(() => cardPhoto.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'View Itinerary', exact: true }).click();
  await page.getByRole('button', { name: 'Full details', exact: true }).click();
  const activityPhotos = page.getByRole('dialog').getByAltText('Hachiko Statue in Tokyo, Japan', { exact: true });
  await expect(activityPhotos).toHaveCount(2);
  for (const activityPhoto of await activityPhotos.all()) {
    await activityPhoto.scrollIntoViewIfNeeded();
    await expect(activityPhoto).toHaveAttribute('src', /[?&]url=https%3A%2F%2Fupload\.wikimedia\.org%2F/);
    await expect.poll(() => activityPhoto.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  }
});

test('unavailable photos show a retry action and can recover without regenerating the itinerary', async ({ page, context }) => {
  let recovered = false;
  await page.route('**/_next/image?url=' + encodeURIComponent(thumbnail) + '&*', route => route.fulfill({ status: 404, body: '' }));
  await page.route('**/_next/image?url=' + encodeURIComponent(original) + '&*', route => recovered
    ? route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' })
    : route.fulfill({ status: 503, body: '' }));
  await openItinerary(page, context);
  await expect(page.getByText('Photo could not load. Please retry.', { exact: true })).toBeVisible();
  await expect(page.locator('[data-day-photos] a')).toHaveCount(0);
  await expect(page.getByAltText('Shibuya Sightseeing in Tokyo, Japan', { exact: true })).toHaveCount(0);
  recovered = true;
  await page.getByRole('button', { name: 'Retry photo', exact: true }).first().click();
  const cardPhoto = page.getByAltText('Hachiko Statue in Tokyo, Japan', { exact: true });
  await expect(cardPhoto).toHaveAttribute('src', /[?&]url=https%3A%2F%2Fupload\.wikimedia\.org%2F/);
  await expect.poll(() => cardPhoto.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Day 1: Shibuya Sightseeing', exact: true })).toBeVisible();
});

test('a day photo without an exact scheduled-place link is labeled Destination photo', async ({ page, context }) => {
  await page.route('**/_next/image?url=' + encodeURIComponent(thumbnail) + '&*', route => route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' }));
  await openItinerary(page, context, false, true);
  await expect(page.getByAltText('Destination photo: Tokyo, Japan', { exact: true })).toBeVisible();
  await expect(page.getByText('Destination photo', { exact: true })).toBeVisible();
});
