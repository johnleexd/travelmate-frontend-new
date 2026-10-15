import { expect, test, type BrowserContext, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { ItineraryResponse } from '../lib/contracts';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';
const manila: ItineraryResponse = JSON.parse(fs.readFileSync('tests/fixtures/manila-existing-plan.json', 'utf8'));
const wiki = { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Original_museum.jpg', imageAttribution: { creator: 'Saved photographer', license: 'CC BY 4.0', sourceUrl: 'https://commons.wikimedia.org/?curid=123', photoType: 'place' as const } };
const unsplash = { imageUrl: 'https://images.unsplash.com/photo-saved-illustration?ixid=keep&w=1080', imageAttribution: { creator: 'Unsplash photographer', license: 'Unsplash', provider: 'unsplash' as const, photoId: 'saved-illustration', sourceUrl: 'https://unsplash.com/photos/saved-illustration?utm_source=travelmate&utm_medium=referral', photographerUrl: 'https://unsplash.com/@saved?utm_source=travelmate&utm_medium=referral', illustrative: true, match: 'activity' as const, downloadTracked: true, photoType: 'illustrative' as const } };
const makePlan = (): ItineraryResponse => ({ destination: 'Manila, National Capital Region, Philippines', currency: 'PHP', totalBudget: 12000, travelers: 1, partyType: 'solo', source: 'mock', days: [{ day: 1, date: '2040-01-01', theme: 'Manila: details need confirmation', imageUrl: '', totalCost: 200, activities: [{ id: 'museum', title: 'Original museum', time: '09:00', durationMinutes: 60, estimatedCost: 100, description: 'Original museum description', category: 'activity', icon: 'map', location: 'Manila, Philippines' }, { id: 'garden', title: 'Original garden', time: '12:00', durationMinutes: 60, estimatedCost: 100, description: 'Original garden description', category: 'activity', icon: 'map', location: 'Manila, Philippines' }] }], budgetSummary: { accommodation: 0, food: 0, activities: 200, transport: 0, reserve: 11800, total: 12000, plannedSpend: 200, dailyAverage: 200 } });

async function setup(page: Page, context: BrowserContext, initialPlan: ItineraryResponse | null, replacement?: typeof wiki) {
  await context.addCookies([{ name: 'travelmate_session', value: 'stored-media-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await mockPlanningLookups(page);
  const trip = (itinerary: ItineraryResponse) => ({ id: 'stored-photo-trip', destination: itinerary.destination, budget: itinerary.totalBudget, currency: itinerary.currency, travelers: 1, partyType: 'solo', interests: [], status: 'active', startDate: itinerary.days[0].date, endDate: itinerary.days.at(-1)!.date, createdAt: '2026-10-08T08:59:18Z', itinerary });
  const state = { saved: initialPlan ? trip(structuredClone(initialPlan)) : null, writes: [] as Record<string, unknown>[], lookups: [] as Record<string, unknown>[] };
  await page.route('**/api/platform**', route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint.endsWith('/photos')) {
      const body = route.request().postDataJSON(); state.lookups.push(body);
      if (replacement && body.failedPhotos?.[0]?.imageUrl === wiki.imageUrl) {
        Object.assign(state.saved!.itinerary.days[0].activities[0], replacement);
        return route.fulfill({ json: { day: state.saved!.itinerary.days[0], persisted: true } });
      }
      return route.fulfill({ status: 503, json: { error: 'External image APIs are unavailable.' } });
    }
    if (route.request().method() === 'POST') { const body = route.request().postDataJSON(); state.writes.push(body); state.saved = trip(body.itinerary); return route.fulfill({ json: { result: state.saved } }); }
    if (endpoint.endsWith('/trips/stored-photo-trip')) return route.fulfill({ json: { trip: state.saved } });
    if (endpoint.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    return route.fulfill({ json: { user: { id: 'stored-photo-owner', name: 'Saved Photo Tester', email: 'stored@example.test', role: 'traveler', emailVerified: true, accountStatus: 'active' }, trips: state.saved ? [state.saved] : [], notifications: [], directory: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.goto('/dashboard');
  return state;
}
async function open(page: Page) { await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click(); await page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'View itinerary', exact: true }).click(); }
async function loaded(image: Locator) { await image.scrollIntoViewIfNeeded(); await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true); }
const mockImages = async (page: Page) => { await page.route('**/_next/image?**', route => route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' })); await page.route('https://images.unsplash.com/**', route => route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' })); };

test('the actual older Manila plan reopens and refreshes offline, with honest destination photos for days that never contained attractions', async ({ page, context }) => {
  test.setTimeout(60000);
  const state = await setup(page, context, manila), before = JSON.stringify(state.saved);
  await open(page);
  const cards = page.locator('[data-daily-card]'); await expect(cards).toHaveCount(7);
  await loaded(cards.first().locator('img'));
  await expect(cards.first()).toContainText('Plaza Miranda');
  for (let index = 1; index < 7; index++) {
    const card = cards.nth(index); await loaded(card.locator('img'));
    await expect(card.locator('figcaption')).toHaveText('Destination photo');
    await expect(card.locator('img')).toHaveAttribute('alt', /Destination photo:/);
    await expect(card.getByRole('heading')).toContainText('details need confirmation');
    await card.getByRole('button', { name: 'View Itinerary', exact: true }).click();
    await expect(page.locator('[data-day-details] [data-activity-index]')).toHaveCount(0);
    await expect(page.locator('[data-day-details]')).toContainText('No activities scheduled');
    await page.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 900 }); await cards.nth(1).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await cards.nth(1).screenshot({ path: '../audit/2026-10-12/saved-photo-preservation/manila-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await cards.nth(1).screenshot({ path: '../audit/2026-10-12/saved-photo-preservation/manila-desktop.png', style: 'header { visibility: hidden; }' });
  await page.reload(); await open(page); await loaded(cards.nth(6).locator('img'));
  expect(state.lookups).toEqual([]); expect(state.writes).toEqual([]); expect(JSON.stringify(state.saved)).toBe(before);
});

test('legacy image fields and absent matching metadata keep original photos, credits and names without enrichment', async ({ page, context }) => {
  await mockImages(page);
  const plan = makePlan();
  const legacyName = plan.days[0].activities[0] as unknown as Record<string, unknown>;
  legacyName.name = legacyName.title; delete legacyName.title;
  Object.assign(plan.days[0].activities[0], { photoUrl: wiki.imageUrl, photoAttribution: wiki.imageAttribution });
  Object.assign(plan.days[0].activities[1], { image: { src: unsplash.imageUrl, attribution: unsplash.imageAttribution } });
  const state = await setup(page, context, plan), before = JSON.stringify(state.saved);
  await open(page); const card = page.locator('[data-daily-card]');
  await expect(card.getByRole('heading')).toHaveText('Day 1: Manila: Original museum, Original garden');
  await expect(card.locator('img')).toHaveCount(2); for (const img of await card.locator('img').all()) await loaded(img);
  await expect(card).toContainText('Saved photographer'); await expect(card).toContainText('Illustrative photo');
  await card.getByRole('button', { name: 'View Itinerary', exact: true }).click();
  await expect(page.locator('[data-day-details] [data-activity-index="0"] figure img')).toHaveAttribute('src', /Original_museum/);
  await expect(page.locator('[data-day-details] [data-activity-index="1"] figure img')).toHaveAttribute('src', unsplash.imageUrl);
  await page.getByRole('button', { name: 'Edit Original museum', exact: true }).click();
  await expect(page.getByLabel('Activity title', { exact: true })).toHaveValue('Original museum');
  await page.getByRole('button', { name: 'Close activity editor', exact: true }).click();
  await page.reload(); await open(page); await expect(card.locator('img')).toHaveCount(2);
  expect(state.lookups).toEqual([]); expect(JSON.stringify(state.saved)).toBe(before);
});

test('a genuinely failed image is replaced and persisted without changing activities; refresh uses the replacement', async ({ page, context }) => {
  const plan = makePlan(); Object.assign(plan.days[0].activities[0], wiki); Object.assign(plan.days[0].activities[1], unsplash);
  const replacement = { ...wiki, imageUrl: wiki.imageUrl.replace('Original', 'Replacement') };
  await mockImages(page);
  await page.route('**/_next/image?**', route => new URL(route.request().url()).searchParams.get('url') === wiki.imageUrl ? route.fulfill({ status: 503, body: '' }) : route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' }));
  const state = await setup(page, context, plan, replacement); await open(page);
  const card = page.locator('[data-daily-card]');
  await expect(card.locator('img[alt="Original museum in Manila, National Capital Region, Philippines"]')).toHaveAttribute('src', /Replacement_museum/);
  expect(state.lookups[0]).toEqual({ day: 1, failedPhotos: [{ index: 0, imageUrl: wiki.imageUrl }] });
  expect(state.saved!.itinerary.days[0].activities[0]).toMatchObject({ title: 'Original museum', description: 'Original museum description', estimatedCost: 100, time: '09:00', imageUrl: replacement.imageUrl });
  await card.getByRole('button', { name: 'View Itinerary', exact: true }).click();
  await page.getByRole('button', { name: 'Full details', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.h-36 img')).toHaveAttribute('src', /Replacement_museum/);
  await page.getByRole('button', { name: 'Close day details' }).click();
  const count = state.lookups.length; await page.reload(); await open(page);
  await expect(card.locator('img').first()).toHaveAttribute('src', /Replacement_museum/);
  expect(state.lookups.length).toBe(count); expect(state.writes).toEqual([]);
});

for (const offline of [false, true]) test(`create → display → automatic save → reopen → refresh preserves selected photos (providers offline: ${offline})`, async ({ page, context }) => {
  await mockImages(page); const state = await setup(page, context, null);
  await page.route('**/api/locations?**', route => route.fulfill({ json: { locations: [{ id: 'manila', name: 'Manila', country: 'Philippines', countryCode: 'PH', latitude: 14.5995, longitude: 120.9842, label: 'Manila, National Capital Region, Philippines' }] } }));
  await page.route('**/api/weather?**', route => route.fulfill({ status: 503, json: { error: 'Weather unavailable.' } }));
  let generated: ItineraryResponse;
  await page.route('**/api/itinerary', route => {
    const body = route.request().postDataJSON(); generated = makePlan(); generated.days[0].date = body.startDate;
    if (!offline) { Object.assign(generated.days[0].activities[0], wiki); Object.assign(generated.days[0].activities[1], unsplash); }
    return route.fulfill({ json: generated });
  });
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await page.getByRole('combobox', { name: 'Destination', exact: true }).fill('Manila');
  await page.getByRole('option', { name: /Manila/ }).getByRole('button').click();
  await page.getByRole('combobox', { name: 'Destination currency', exact: true }).selectOption('PHP');
  await page.getByLabel('Start date', { exact: true }).fill('2040-01-01'); await page.getByLabel('End date').fill('2040-01-01');
  await page.getByRole('spinbutton', { name: /Solo trip budget/ }).fill('12000');
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  const card = page.locator('[data-daily-card]'); await expect(card).toBeVisible();
  await expect.poll(() => state.writes.filter(write => write.action === 'save-trip').length).toBe(1);
  const savedPhotos = state.saved!.itinerary.days[0].activities.map(({ imageUrl, imageAttribution }) => ({ imageUrl, imageAttribution }));
  if (!offline) { await expect(card.locator('img')).toHaveCount(2); await expect(card).toContainText('Illustrative photo'); }
  else await expect(card.locator('[data-photo-unavailable]')).toBeVisible();
  await card.getByRole('button', { name: 'View Itinerary', exact: true }).click();
  if (!offline) await expect(page.locator('[data-day-details] [data-activity-index] figure img')).toHaveCount(2);
  else await expect(page.locator('[data-day-details] [data-photo-unavailable]')).toHaveCount(2);
  await open(page); await page.reload(); await open(page);
  const expected = offline ? 0 : 2; await expect(card.locator('img')).toHaveCount(expected);
  expect(state.saved!.itinerary.days[0].activities.map(({ imageUrl, imageAttribution }) => ({ imageUrl, imageAttribution }))).toEqual(savedPhotos);
  expect(state.saved!.itinerary.days[0].activities.map(item => item.title)).toEqual(['Original museum', 'Original garden']);
  if (!offline) { expect(state.lookups).toEqual([]); expect(savedPhotos.map(photo => photo.imageAttribution?.photoType)).toEqual(['place', 'illustrative']); }
});
