import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

const photo = 'https://upload.wikimedia.org/wikipedia/commons/6/6e/The_Hachiko_statue_at_Shibuya%2C_Tokyo%2C_Japan.jpg';
const attribution = { creator: 'Saved photographer', license: 'CC BY-SA 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fixture.jpg' };

async function setup(page: Page, context: BrowserContext, url = '/dashboard') {
  await context.addCookies([{ name: 'travelmate_session', value: 'history-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  await page.route('**/api/**', route => route.fulfill({ json: { photos: [], quotes: [], locations: [] } }));
  await page.route('**/_next/image?**', route => route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' }));
  const state = { reads: [] as string[], writes: [] as Record<string, unknown>[], trips: ['trip-A', 'trip-B'].map((id, index) => ({
    id, userId: 'history-owner', destination: index === 0 ? 'Manila, Philippines' : 'Tokyo, Japan',
    currency: 'PHP', budget: 10000, travelers: 1, partyType: 'solo', interests: ['culture'],
    status: 'active', startDate: '2040-10-15', endDate: '2040-10-22', createdAt: '2026-10-12T00:00:00Z', weather: null,
    itinerary: {
      destination: index === 0 ? 'Manila, Philippines' : 'Tokyo, Japan', currency: 'PHP', totalBudget: 10000, travelers: 1, partyType: 'solo', source: 'mock',
      preferences: { pace: 'balanced', travelStyle: 'balanced', accommodation: 'budget-friendly', activities: ['sightseeing'], transportation: '' },
      budgetSummary: { accommodation: 0, food: 0, activities: 1600, transport: 0, reserve: 8400, total: 10000, plannedSpend: 1600 },
      days: Array.from({ length: 8 }, (_, dayIndex) => ({
        day: dayIndex + 1, date: `2040-10-${15 + dayIndex}`, theme: `${id} day ${dayIndex + 1}`, totalCost: 200,
        activities: [{ title: `${id} attraction ${dayIndex + 1}`, time: '09:00', durationMinutes: 60, travelMinutes: 0,
          description: 'Recorded visit.', estimatedCost: 200, category: 'activity', icon: 'map', imageUrl: photo, imageAttribution: attribution }],
      })),
    },
  })) };
  await page.route('**/api/platform**', route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); state.writes.push(body);
      const trip = state.trips.find(item => item.id === body.id)!;
      if (body.itinerary) trip.itinerary = body.itinerary;
      return route.fulfill({ json: { result: trip } });
    }
    if (endpoint.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (endpoint.includes('/trips/')) {
      state.reads.push(endpoint);
      return route.fulfill({ json: { trip: state.trips.find(item => endpoint.endsWith(item.id)) } });
    }
    return route.fulfill({ json: {
      user: { id: 'history-owner', name: 'History Tester', email: 'history@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true },
      trips: state.trips.map(trip => ({ ...trip, itinerary: undefined })), tripsPage: { total: 2, hasMore: false, nextCursor: null },
      notifications: [], directory: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [],
    } });
  });
  await page.goto(url);
  return state;
}

const list = (page: Page) => page.getByRole('region', { name: 'Saved plans' });
const details = (page: Page) => page.locator('[data-day-details]');
const overview = (page: Page) => page.getByRole('heading', { name: 'Your trip itinerary', exact: true });
const backOverview = (page: Page) => page.getByRole('button', { name: 'Back to itinerary', exact: true });
const backSaved = (page: Page) => page.getByRole('button', { name: 'Back to saved trips', exact: true });
const warning = (page: Page) => page.getByRole('dialog', { name: 'Leave without saving?' });
async function openSaved(page: Page, index = 0) {
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  await list(page).getByRole('button', { name: 'View itinerary', exact: true }).nth(index).click();
  await expect(overview(page)).toBeVisible();
}

for (const width of [1440, 390]) {
  test(`in-app Back preserves same trip, photos, edits and overview scroll at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 850 });
    const state = await setup(page, context);
    await openSaved(page);
    await expect(page).toHaveURL(/tab=planner&trip=trip-A&from=saved$/);
    const card = page.locator('[data-daily-card][data-itinerary-day="6"]');
    const opener = card.getByRole('button', { name: 'View day itinerary', exact: true });
    await opener.scrollIntoViewIfNeeded();
    await expect(card.locator('img')).toBeVisible();
    const src = await card.locator('img').getAttribute('src');
    await opener.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => window.scrollY);
    await opener.click();
    await expect(page).toHaveURL(/trip=trip-A&day=6&from=saved$/);
    await expect(backSaved(page)).toHaveCount(0);
    await expect(details(page)).toContainText('trip-A attraction 6');
    await expect(details(page).locator('img')).toHaveAttribute('src', src!);
    await details(page).getByRole('button', { name: 'Edit trip-A attraction 6', exact: true }).click();
    await page.getByLabel('Activity title').fill('Edited sixth attraction');
    await page.getByRole('button', { name: 'Save activity', exact: true }).click();
    await backOverview(page).click();
    await expect(overview(page)).toBeVisible();
    await expect(warning(page)).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 0);
    await expect(card).toContainText('Edited sixth attraction');
    await expect(card.locator('img')).toHaveAttribute('src', src!);
    await expect(card).toContainText('Saved photographer');
    expect(state.reads).toEqual(['/api/platform/trips/trip-A']);
    expect(state.writes).toEqual([]);
    await backSaved(page).click(); await expect(warning(page)).toBeVisible();
    await warning(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(card).toContainText('Edited sixth attraction');
    await backSaved(page).click(); await warning(page).getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(list(page)).toBeVisible(); await expect(page).toHaveURL(/tab=bookings$/);
  });
}

test('browser Back/Forward follows list → overview → day and warns only when leaving an edited trip', async ({ page, context }) => {
  const state = await setup(page, context);
  await openSaved(page);
  const card = page.locator('[data-daily-card][data-itinerary-day="4"]');
  const opener = card.getByRole('button', { name: 'View day itinerary', exact: true });
  await opener.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  await opener.click();
  await details(page).getByRole('button', { name: 'Edit trip-A attraction 4', exact: true }).click();
  await page.getByLabel('Activity title').fill('Browser draft attraction');
  await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  await page.goBack();
  await expect(overview(page)).toBeVisible(); await expect(warning(page)).toHaveCount(0);
  await expect(card).toContainText('Browser draft attraction');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 0);
  await page.goForward();
  await expect(details(page)).toContainText('Browser draft attraction');
  await expect(page).toHaveURL(/trip=trip-A&day=4&from=saved$/);
  await page.goBack(); await expect(overview(page)).toBeVisible();
  await page.goBack(); await expect(warning(page)).toBeVisible();
  // Cancel must restore the overview history entry, not add a duplicate.
  await page.keyboard.press('Escape');
  await expect(warning(page)).toHaveCount(0); await expect(page).toHaveURL(/trip=trip-A&from=saved$/);
  await expect(card).toContainText('Browser draft attraction');
  await page.goBack(); await expect(warning(page)).toBeVisible();
  await warning(page).getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(list(page)).toBeVisible(); await expect(page).toHaveURL(/tab=bookings$/);
  expect(state.reads).toEqual(['/api/platform/trips/trip-A']); expect(state.writes).toEqual([]);
  await page.goForward(); await expect(overview(page)).toBeVisible();
  await expect(card).toContainText('trip-A attraction 4');
  await expect(card).not.toContainText('Browser draft attraction');
});

test('a clean browser Back returns to Saved Trips and opening another trip selects its own day', async ({ page, context }) => {
  const state = await setup(page, context); await openSaved(page);
  await page.locator('[data-daily-card][data-itinerary-day="3"]').getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await page.goBack(); await expect(overview(page)).toBeVisible();
  await page.goBack(); await expect(list(page)).toBeVisible();
  await list(page).getByRole('button', { name: 'View itinerary', exact: true }).nth(1).click();
  await expect(overview(page)).toBeVisible(); await expect(details(page)).toHaveCount(0);
  await page.locator('[data-daily-card][data-itinerary-day="2"]').getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await expect(page).toHaveURL(/trip=trip-B&day=2&from=saved$/);
  await expect(details(page)).toContainText('trip-B attraction 2');
  await backOverview(page).click(); await expect(overview(page)).toBeVisible();
  await expect(page.locator('[data-itinerary-workspace]')).toContainText('Tokyo, Japan');
  await backSaved(page).click(); await expect(list(page)).toBeVisible();
  expect(state.reads).toEqual(['/api/platform/trips/trip-A', '/api/platform/trips/trip-B']); expect(state.writes).toEqual([]);
});

test('explicit trip/day URL survives refresh; Back has a correct destination without prior browser history', async ({ page, context }) => {
  const state = await setup(page, context, '/dashboard?tab=planner&trip=trip-B&day=7&from=saved');
  await expect(details(page)).toContainText('trip-B attraction 7');
  await expect(details(page).locator('img')).toBeVisible();
  await page.reload(); await expect(details(page)).toContainText('trip-B attraction 7');
  await expect(details(page).locator('img')).toBeVisible();
  await backOverview(page).click(); await expect(overview(page)).toBeVisible();
  await expect(page).toHaveURL(/trip=trip-B&from=saved$/);
  await backSaved(page).click(); await expect(list(page)).toBeVisible();
  expect(state.reads).toEqual(['/api/platform/trips/trip-B', '/api/platform/trips/trip-B']); expect(state.writes).toEqual([]);
});

test('legacy day history cannot make in-app or browser Back skip its trip overview', async ({ page, context }) => {
  await setup(page, context);
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  // Simulate the existing tab's pre-fix day entry: list -> day, and a stale
  // purported overview index. Refresh retains history.state in real browsers.
  await page.evaluate(() => {
    const listEntry = history.state.travelmateItineraryView;
    const view = { tab: 'planner', tripId: 'trip-A', day: 1, fromSavedTrips: true };
    history.pushState({ travelmateItineraryView: {
      view, session: listEntry.session, index: listEntry.index + 2,
      ancestors: [...listEntry.ancestors, { view: listEntry.view, index: listEntry.index },
        { view: { ...view, day: undefined }, index: listEntry.index }],
    } }, '', '/dashboard?tab=planner&trip=trip-A&day=1&from=saved');
  });
  await page.reload();
  await expect(details(page)).toContainText('trip-A attraction 1');
  await expect(backSaved(page)).toHaveCount(0);
  await page.goBack(); await expect(overview(page)).toBeVisible();
  await page.goForward(); await expect(details(page)).toBeVisible();
  await backOverview(page).click();
  await expect(overview(page)).toBeVisible();
  await expect(page).toHaveURL(/tab=planner&trip=trip-A&from=saved$/);
  await backSaved(page).click(); await expect(list(page)).toBeVisible();
});

test('upgrading a valid older day history does not insert a duplicate overview', async ({ page, context }) => {
  await setup(page, context); await openSaved(page);
  await page.locator('[data-daily-card][data-itinerary-day="1"]').getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await expect(details(page)).toBeVisible();
  await page.evaluate(() => {
    const entry = structuredClone(history.state.travelmateItineraryView);
    delete entry.version;
    history.replaceState({ ...history.state, travelmateItineraryView: entry }, '', location.href);
  });
  await page.reload(); await expect(details(page)).toBeVisible();
  await page.goBack(); await expect(overview(page)).toBeVisible();
  await page.goBack(); await expect(list(page)).toBeVisible();
});

test('stale overview indexes cannot jump over the real Cheonan-style overview entry', async ({ page, context }) => {
  await setup(page, context); await openSaved(page);
  await page.locator('[data-daily-card][data-itinerary-day="1"]').getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await expect(details(page)).toBeVisible();
  await page.evaluate(() => {
    const entry = structuredClone(history.state.travelmateItineraryView);
    delete entry.version;
    // The previous returnTo calculation would history.go(-2), landing on
    // Saved Trips, despite the real overview being the previous browser entry.
    entry.ancestors.at(-1).index = entry.index - 2;
    history.replaceState({ ...history.state, travelmateItineraryView: entry }, '', location.href);
  });
  await page.reload(); await expect(details(page)).toBeVisible();
  // Execute the previous handler's offset calculation to demonstrate the
  // reported failure, then return to this day and verify the corrected handler.
  await page.evaluate(() => {
    const entry = history.state.travelmateItineraryView;
    const overview = entry.ancestors.findLast((stop: { view: { tab: string; tripId: string; day?: number } }) => stop.view.tab === 'planner' && stop.view.tripId === entry.view.tripId && stop.view.day === undefined);
    history.go(overview.index - entry.index);
  });
  await expect(list(page)).toBeVisible();
  await page.goForward(); await expect(overview(page)).toBeVisible();
  await page.goForward(); await expect(details(page)).toBeVisible();
  await backOverview(page).click(); await expect(overview(page)).toBeVisible();
  await expect(page).toHaveURL(/tab=planner&trip=trip-A&from=saved$/);
  await backSaved(page).click(); await expect(list(page)).toBeVisible();
});

test('Day 2 in-app Back explicitly removes day and never calls browser Back', async ({ page, context }) => {
  const state = await setup(page, context); await openSaved(page);
  await page.locator('[data-daily-card][data-itinerary-day="2"]').getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await expect(details(page)).toBeVisible();
  await page.evaluate(() => {
    const browser = window as unknown as { dayBackCalls: number };
    browser.dayBackCalls = 0;
    const original = history.back.bind(history);
    history.back = () => { browser.dayBackCalls++; original(); };
  });
  await backOverview(page).click(); await expect(overview(page)).toBeVisible();
  await expect(page).toHaveURL(/tab=planner&trip=trip-A&from=saved$/);
  await page.waitForTimeout(2500);
  await expect(overview(page)).toBeVisible();
  await expect(page.locator('[data-daily-card]:visible')).toHaveCount(8);
  await expect(page).toHaveURL(/tab=planner&trip=trip-A&from=saved$/);
  expect(await page.evaluate(() => (window as unknown as { dayBackCalls: number }).dayBackCalls)).toBe(0);
  expect(state.reads).toEqual(['/api/platform/trips/trip-A']); expect(state.writes).toEqual([]);
  await backSaved(page).click(); await expect(list(page)).toBeVisible();
});

test('saving edited day clears the browser leave warning and retains saved photos on refresh', async ({ page, context }) => {
  const state = await setup(page, context); await openSaved(page);
  const card = page.locator('[data-daily-card][data-itinerary-day="2"]');
  await card.getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await details(page).getByRole('button', { name: 'Edit trip-A attraction 2', exact: true }).click();
  await page.getByLabel('Activity title').fill('Saved second attraction');
  await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Updated', exact: true })).toBeVisible();
  await page.goBack(); await expect(overview(page)).toBeVisible();
  await page.goBack(); await expect(list(page)).toBeVisible(); await expect(warning(page)).toHaveCount(0);
  await list(page).getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await expect(card).toContainText('Saved second attraction');
  await page.reload(); await expect(card).toContainText('Saved second attraction');
  await expect(card.locator('img')).toBeVisible(); await expect(card).toContainText('Saved photographer');
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({ action: 'update-trip-itinerary', id: 'trip-A' });
});
