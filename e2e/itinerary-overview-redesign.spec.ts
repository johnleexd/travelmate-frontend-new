import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import capture from './fixtures/gimcheon-reopened-trip.json' with { type: 'json' };
import type { ItineraryResponse, SavedTrip, ImageAttribution } from '../lib/contracts';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';
const folder = '../audit/2026-10-15/itinerary-overview';
const photos = JSON.parse(readFileSync(folder + '/photos/sources.json', 'utf8')) as { name: string; src: string; filename: string; width: number; height: number; attribution: ImageAttribution }[];
const original = capture.trip.itinerary as unknown as ItineraryResponse;
const user = { id: 'overview-layout-owner', name: 'Layout verification', email: 'overview@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
async function setup(page: Page, context: BrowserContext, plan = structuredClone(original), fresh = false) {
  await context.addCookies([{ name: 'travelmate_session', value: 'overview-layout-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await mockPlanningLookups(page);
  const base = { ...capture.trip, id: 'overview-saved', userId: user.id, itinerary: plan, weather: null } as unknown as SavedTrip;
  const state = { trip: base, trips: fresh ? [] as SavedTrip[] : [base], writes: [] as Record<string, unknown>[], generation: null as Record<string, unknown> | null };
  await page.route('**/_next/image?*', route => {
    const src = decodeURIComponent(new URL(route.request().url()).searchParams.get('url') || '');
    const photo = photos.find(photo => src.includes(decodeURIComponent(photo.src).split('?')[0].split('/').at(-1)!.replace(/^\d+px-/, '')));
    return photo ? route.fulfill({ path: path.resolve(folder + '/photos/' + photo.filename), contentType: 'image/jpeg' }) : route.continue();
  });
  await page.route('**/api/platform**', route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint.endsWith('/photos')) return route.fulfill({ json: { day: state.trip.itinerary && (state.trip.itinerary as ItineraryResponse).days.find(day => day.day === route.request().postDataJSON().day) } });
    if (endpoint.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); state.writes.push(body);
      if (body.itinerary) { state.trip = { ...state.trip, ...body, id: 'overview-saved', userId: user.id } as SavedTrip; state.trips = [state.trip]; }
      return route.fulfill({ json: { result: state.trip } });
    }
    if (endpoint.endsWith('/trips/overview-saved')) return route.fulfill({ json: { trip: state.trip } });
    return route.fulfill({ json: { user, trips: state.trips.map(trip => ({ ...trip, itinerary: null })), tripsPage: { total: state.trips.length, hasMore: false }, directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.goto(fresh ? '/dashboard?tab=planner' : '/dashboard?tab=bookings');
  if (!fresh) await page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'View itinerary', exact: true }).click();
  return state;
}
test('actual reopened itinerary retains every value, chronological days, source photos, concise header and same-trip navigation on desktop/mobile', async ({ page, context }) => {
  await page.setViewportSize({ width: 1680, height: 1050 });
  const state = await setup(page, context), cards = page.locator('[data-daily-card]'), first = cards.first();
  await expect(cards).toHaveCount(original.days.length);
  await expect(page.getByRole('region', { name: 'Trip summary' })).toContainText('KRW 1,000,000');
  await expect(page.getByRole('region', { name: 'Trip summary' })).toContainText('Estimated expenses');
  await expect(page.getByRole('heading', { name: 'Day 1', exact: true })).toBeVisible();
  await expect(first.locator('[data-overview-activity-index]')).toHaveCount(original.days[0].activities.filter(item => !/^daily (?:meals|transport)/i.test(item.title)).length);
  await expect(first.getByText('Local time (Asia/Seoul)', { exact: false })).toBeVisible();
  await expect(first.getByRole('img').first()).toBeVisible();
  await expect(first.getByRole('link', { name: 'Photo: Crossmr', exact: true }).first()).toBeVisible();
  const heading = (await page.getByRole('heading', { name: 'Your trip itinerary', exact: true }).boundingBox())!, header = (await page.getByRole('banner').boundingBox())!;
  expect(heading.y).toBeGreaterThanOrEqual(header.y + header.height);
  await page.screenshot({ path: folder + '/overview-desktop.png', fullPage: true });
  await page.screenshot({ path: folder + '/overview-desktop-viewport.png' });
  await first.screenshot({ path: folder + '/day-card-desktop.png', style: 'header, nextjs-portal { visibility: hidden !important; }' });
  const open = first.getByRole('button', { name: 'View day itinerary', exact: true }); await open.click();
  await expect(page.locator('[data-day-details]')).toContainText(original.days[0].activities[0].title);
  await page.locator('[data-day-details]').getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  await expect(first).toBeVisible(); await expect(open).toBeFocused(); await expect(page).toHaveURL(/trip=overview-saved/);
  await page.setViewportSize({ width: 390, height: 844 });
  await first.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const widths = await first.locator('[data-overview-activity-index]').evaluateAll(items => items.map(item => item.getBoundingClientRect().width));
  expect(widths[0]).toBeGreaterThan(270);
  await first.screenshot({ path: folder + '/day-card-mobile.png', style: 'header, nextjs-portal { visibility: hidden !important; }' });
  await page.getByRole('heading', { name: 'Your trip itinerary', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: folder + '/overview-mobile.png' });
  expect(JSON.stringify(state.trip.itinerary)).toBe(JSON.stringify(original)); expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Back to saved trips', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Saved plans' })).toBeVisible();
});
test('portrait, landscape, square photos and long names remain uncropped; every activity is visible with honest zero/unpriced costs', async ({ page, context }) => {
  const selected = [photos[0], photos.find(photo => photo.height > photo.width)!, photos.find(photo => photo.height === photo.width)!];
  expect(selected.every(Boolean)).toBe(true);
  const savedActivity = original.days[0].activities.find(item => item.place)!;
  const activities = Array.from({ length: 5 }, (_, index) => ({ ...structuredClone(savedActivity), id: 'layout-' + index,
    title: index === 1 ? 'A very long user-entered activity title that must remain fully readable across multiple lines without truncation or clipping' : 'Aspect ratio verification ' + (index + 1),
    place: undefined, location: 'Photo layout verification only',
    imageUrl: selected[index % 3].src, imageAttribution: { ...selected[index % 3].attribution, illustrative: true, photoType: 'illustrative' as const },
    time: `${String(9 + index).padStart(2, '0')}:00`, estimatedCost: 0, priceEvidence: { ...savedActivity.priceEvidence!, status: 'unavailable' as const, unitAmount: 0 },
  }));
  const plan = { ...structuredClone(original), budgetSummary: { ...original.budgetSummary, plannedSpend: 0 },
    grounding: { ...original.grounding!, total: 0, unpricedExpenseCount: 5 },
    days: [{ ...original.days[0], theme: 'Photo orientation verification', totalCost: 0, activities }] };
  await setup(page, context, plan);
  const first = page.locator('[data-daily-card]').first();
  await expect(first.locator('[data-overview-activity-index]')).toHaveCount(5);
  for (const width of [1680, 1100, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const image of await first.getByRole('img').all()) {
      await image.scrollIntoViewIfNeeded(); await expect(image).toBeVisible();
      const value = await image.evaluate(img => { const picture = img as HTMLImageElement; return { width: picture.naturalWidth, height: picture.naturalHeight, fit: getComputedStyle(img).objectFit, position: getComputedStyle(img).objectPosition, frame: img.parentElement!.getBoundingClientRect().height }; });
      expect(value.fit).toBe('contain'); expect(value.position).toBe('50% 50%'); expect(value.width).toBeGreaterThan(0); expect(value.frame).toBe(width < 640 ? 210 : 220);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(first.getByRole('heading', { name: activities[1].title, exact: true })).toBeVisible();
  await expect(first).toContainText('Costs not confirmed');
  await expect(page.getByRole('region', { name: 'Trip summary' })).not.toContainText('KRW 0');
  await expect(first.getByText('Cropped to fit', { exact: false })).toHaveCount(0);
  await page.setViewportSize({ width: 1680, height: 1100 });
  await first.screenshot({ path: folder + '/photo-aspect-ratios.png', style: 'header, nextjs-portal { visibility: hidden !important; }' });
});
test('new generation keeps the save flow and reopens the same destination, dates and all activity data', async ({ page, context }) => {
  const state = await setup(page, context, structuredClone(original), true);
  const location = { ...capture.anchor, id: 1842943, provider: 'geonames', providerId: '1842943', name: 'Gimcheon', region: 'Gyeongsangbuk-do', label: original.destination, placeType: 'City', contextLabel: 'Gyeongsangbuk-do, South Korea', scopeType: 'locality', canBrowse: false };
  await page.route('**/api/locations?*', route => route.fulfill({ json: { locations: [location], total: 1, nextOffset: null } }));
  await page.route('**/api/destination-context?*', route => route.fulfill({ json: { currency: 'KRW', currencySource: 'country-code', transportation: [{ id: 'walking', label: 'Walking' }], transportationSource: 'curated-country-city-guidance', transportationMessage: '' } }));
  await page.route('**/api/itinerary', route => {
    const body = route.request().postDataJSON(); state.generation = body;
    const generated = structuredClone(original); generated.days.forEach((day, index) => { const date = new Date(body.startDate + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + index); day.date = date.toISOString().slice(0, 10); });
    state.trip = { ...state.trip, itinerary: generated }; return route.fulfill({ json: generated });
  });
  await page.getByPlaceholder('Where do you want to go?').fill('Gimcheon');
  await page.getByRole('button', { name: /Gimcheon.*Gyeongsangbuk-do/ }).first().click();
  await page.locator('#trip-budget').fill(String(original.totalBudget));
  await page.locator('#trip-start-date').fill('2040-01-01'); await page.locator('#trip-end-date').fill('2040-01-07');
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your trip itinerary', exact: true })).toBeVisible();
  await expect.poll(() => state.writes.filter(item => item.action === 'save-trip').length).toBe(1);
  expect(state.generation).toMatchObject({ destination: original.destination, currency: 'KRW', budget: original.totalBudget, startDate: '2040-01-01', endDate: '2040-01-07' });
  await expect(page.getByRole('button', { name: 'Update saved trip', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect.poll(() => state.writes.filter(item => item.action === 'update-trip').length).toBe(1);
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  await page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'View itinerary', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Trip summary' })).toContainText('January 1, 2040');
  await expect(page.locator('[data-daily-card]')).toHaveCount(original.days.length);
});
