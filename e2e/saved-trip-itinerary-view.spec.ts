import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

const trip = {
  id: 'saved-view-trip', userId: 'saved-view-owner', destination: 'Kyoto, Japan', currency: 'JPY', budget: 120000,
  travelers: 1, partyType: 'solo', interests: ['culture'], startDate: '2040-10-15', endDate: '2040-10-16',
  status: 'active', createdAt: '2026-10-12T00:00:00Z', weather: null,
  itinerary: {
    destination: 'Kyoto, Japan', currency: 'JPY', totalBudget: 120000, travelers: 1, partyType: 'solo', source: 'mock',
    preferences: { pace: 'balanced', travelStyle: 'balanced', accommodation: 'traditional', activities: ['culture'], transportation: '' },
    budgetSummary: { accommodation: 0, food: 0, activities: 4000, transport: 0, reserve: 116000, total: 120000, plannedSpend: 4000 },
    days: [1, 2].map(day => ({
      day, date: `2040-10-${14 + day}`, theme: day === 1 ? 'Temple traditions' : 'Craft heritage', totalCost: 2000,
      activities: [{ title: day === 1 ? 'Kiyomizu-dera visit' : 'Nishijin textile workshop', time: '09:00', durationMinutes: 90, travelMinutes: 0, description: 'A saved cultural activity.', estimatedCost: 2000, category: 'activity', icon: 'map' }],
    })),
  },
};

const secondTrip = {
  ...trip, id: 'saved-view-cebu', destination: 'Cebu City, Philippines', currency: 'PHP',
  itinerary: { ...trip.itinerary, destination: 'Cebu City, Philippines', currency: 'PHP',
    days: trip.itinerary.days.map(day => ({ ...day, theme: 'City heritage',
      activities: day.activities.map(item => ({ ...item, title: day.day === 1 ? 'Fort San Pedro visit' : 'Casa Gorordo Museum visit' })),
    })),
  },
};

async function setup(page: Page, context: BrowserContext, options: { initialUrl?: string; longTrip?: boolean } = {}) {
  await context.addCookies([{ name: 'travelmate_session', value: 'saved-view-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  await page.route('**/_next/image?*', route => route.abort());
  const trips = structuredClone([trip, secondTrip]);
  if (options.longTrip) {
    trips[0].endDate = '2040-11-14';
    trips[0].itinerary.days = Array.from({ length: 31 }, (_, index) => ({
      ...trips[0].itinerary.days[0], day: index + 1,
      date: new Date(Date.UTC(2040, 9, 15 + index)).toISOString().slice(0, 10),
    }));
  }
  const state = { writes: [] as string[], reads: [] as string[], fail: false };
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET' && !/photo|image/.test(path)) state.writes.push(path);
    if (path === '/api/platform/notifications') return route.fulfill({ json: { notifications: [] } });
    const selected = trips.find(item => path === '/api/platform/trips/' + item.id);
    if (selected) {
      state.reads.push(selected.id);
      return state.fail ? route.fulfill({ status: 503, json: { error: 'Saved itinerary unavailable. Please try again.' } }) : route.fulfill({ json: { trip: selected } });
    }
    if (path === '/api/platform') return route.fulfill({ json: {
      user: { id: trip.userId, name: 'Saved View Tester', email: 'saved@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true },
      trips: trips.map(item => ({ ...item, itinerary: undefined, weather: undefined })), tripsPage: { total: 2, hasMore: false, nextCursor: null },
      notifications: [], directory: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [],
    } });
    return route.fulfill({ json: { photos: [], quotes: [], locations: [] } });
  });
  await page.goto(options.initialUrl || '/dashboard?tab=bookings');
  return state;
}

const saved = (page: Page) => page.getByRole('region', { name: 'Saved plans' });
const modal = (page: Page, destination = trip.destination) => page.getByRole('dialog', { name: destination, exact: true });
const open = (page: Page, index = 0) => saved(page).getByRole('button', { name: 'View itinerary', exact: true }).nth(index).click();

test('saved itinerary opens in a focused modal, keeps the list in place, and removes duplicate actions', async ({ page, context }, info) => {
  const state = await setup(page, context);
  await open(page);
  const dialog = modal(page);
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL('/dashboard?tab=bookings&trip=saved-view-trip');
  await expect(page.locator('[data-traveler-rail] button[aria-current="page"]')).toHaveText('Saved trips');
  await expect(page.locator('[inert] [aria-labelledby="saved-plans-heading"]')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Kiyomizu-dera visit', exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Nishijin textile workshop', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Edit trip|View map$|Record visited places|Mark as done|Update saved trip/ })).toHaveCount(0);
  await expect(dialog.getByText('Trip planning settings', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Close itinerary', exact: true })).toBeFocused();
  await dialog.screenshot({ path: info.outputPath('saved-itinerary-overview.png') });
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Back to saved trips', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close itinerary', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL('/dashboard?tab=bookings');
  await expect(saved(page).getByRole('button', { name: 'View itinerary', exact: true }).first()).toBeFocused();
  expect(state.writes).toEqual([]);
});

test('each destination shows only its own generated places; modal and day scrolling preserve the saved list', async ({ page, context }, info) => {
  const state = await setup(page, context);
  const opener = saved(page).getByRole('button', { name: 'View itinerary', exact: true }).nth(1);
  await opener.scrollIntoViewIfNeeded();
  const backgroundScroll = await page.evaluate(() => window.scrollY);
  await opener.click();
  const dialog = modal(page, secondTrip.destination);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Fort San Pedro visit');
  await expect(dialog).not.toContainText('Kiyomizu-dera');
  const scroller = dialog.locator('[data-saved-itinerary-scroll]');
  await dialog.locator('[data-itinerary-day="2"]').getByRole('button', { name: 'View day itinerary', exact: true }).scrollIntoViewIfNeeded();
  const overviewScroll = await scroller.evaluate(element => element.scrollTop);
  await dialog.locator('[data-itinerary-day="2"]').getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await expect(page).toHaveURL('/dashboard?tab=bookings&trip=saved-view-cebu&day=2');
  await expect(dialog.getByRole('heading', { name: 'Casa Gorordo Museum visit', exact: true })).toBeVisible();
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(backgroundScroll);
  await dialog.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  await expect(page).toHaveURL('/dashboard?tab=bookings&trip=saved-view-cebu');
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeCloseTo(overviewScroll, 0);
  await dialog.screenshot({ path: info.outputPath('saved-itinerary-modal.png') });
  await dialog.getByRole('button', { name: 'Close itinerary', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(backgroundScroll);
  await open(page);
  await expect(modal(page)).toContainText('Kiyomizu-dera visit');
  await expect(modal(page)).not.toContainText('Fort San Pedro');
  expect(state.writes).toEqual([]);
  expect(state.reads).toEqual(['saved-view-cebu', 'saved-view-trip']);
});

test('browser history, refreshed day links and modal close work without regenerating the saved plan', async ({ page, context }) => {
  const state = await setup(page, context);
  await open(page);
  await page.goBack();
  await expect(modal(page)).toHaveCount(0);
  await page.goForward();
  await expect(modal(page)).toBeVisible();
  await modal(page).locator('[data-itinerary-day="2"]').getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await page.reload();
  await expect(modal(page).getByRole('heading', { name: 'Nishijin textile workshop', exact: true })).toBeVisible();
  await modal(page).getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  await expect(modal(page).locator('[data-daily-card]')).toHaveCount(2);
  await modal(page).getByRole('button', { name: 'Back to saved trips', exact: true }).click();
  await expect(saved(page)).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('failed trip loading leaves Saved trips usable and retry opens the chosen itinerary', async ({ page, context }) => {
  const state = await setup(page, context);
  state.fail = true;
  await open(page);
  await expect(page.getByRole('status').filter({ hasText: 'Saved itinerary unavailable' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(saved(page)).toBeVisible();
  state.fail = false;
  await open(page, 1);
  await expect(modal(page, secondTrip.destination)).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('31 days stay inside the modal and fit a 320px screen', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await setup(page, context, { longTrip: true });
  await open(page);
  const dialog = modal(page);
  await expect(dialog.locator('[data-daily-card]')).toHaveCount(31);
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  expect(box!.y + box!.height).toBeLessThanOrEqual(640);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const scroller = dialog.locator('[data-saved-itinerary-scroll]');
  expect(await scroller.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await scroller.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(dialog.getByRole('button', { name: 'Close itinerary', exact: true })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Back to saved trips', exact: true })).toBeInViewport();
  await dialog.screenshot({ path: info.outputPath('saved-itinerary-narrow.png') });
  await page.keyboard.press('Escape');
  await expect(saved(page)).toBeVisible();
});
