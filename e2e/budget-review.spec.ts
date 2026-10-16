import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { budgetFixture } from '../tests/fixtures/budget-review-plan';
import type { SavedTrip } from '../lib/contracts';

const user = { id: 'budget-owner', name: 'Budget tester', email: 'budget@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
async function setup(page: Page, context: BrowserContext, plan = budgetFixture(), fresh = false) {
  await context.addCookies([{ name: 'travelmate_session', value: 'isolated-budget-fixture', domain: new URL(test.info().project.use.baseURL!).hostname, path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Photography is outside this review; keep incidental itinerary images offline.
  await page.route('**/_next/image?*', route => route.abort());
  const trip = { id: 'budget-a', userId: user.id, destination: plan.destination, destinationCity: 'Dumaguete', destinationCountryCode: 'PH', destinationLatitude: 9.3, destinationLongitude: 123.3, budget: plan.totalBudget, currency: plan.currency, travelers: plan.travelers, partyType: plan.partyType, interests: [], startDate: plan.days[0].date, endDate: plan.days.at(-1)!.date, status: 'active', createdAt: '2039-01-01T00:00:00Z', updatedAt: '2039-01-01T00:00:00Z', itinerary: plan, weather: null } as unknown as SavedTrip;
  const state = { trip, trips: fresh ? [] as SavedTrip[] : [trip], writes: [] as Record<string, unknown>[] };
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/platform') {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON(); state.writes.push(body);
        if (body.itinerary) { state.trip = { ...state.trip, ...body } as SavedTrip; state.trips = [state.trip]; }
        return route.fulfill({ json: { result: state.trip } });
      }
      return route.fulfill({ json: { user, trips: state.trips.map(item => ({ ...item, itinerary: null })), tripsPage: { total: state.trips.length, hasMore: false }, notifications: [], directory: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
    }
    if (path === '/api/platform/trips/budget-a') return route.fulfill({ json: { trip: state.trip } });
    if (path === '/api/platform/notifications') return route.fulfill({ json: { notifications: [] } });
    if (path === '/api/platform/profile') return route.fulfill({ json: { user } });
    return route.fulfill({ status: 503, json: { error: 'Unavailable in isolated budget UI test' } });
  });
  await page.goto(fresh ? '/dashboard?tab=budget' : '/dashboard?tab=budget&trip=budget-a&from=saved');
  return state;
}
const amount = (page: Page, key: string) => page.locator(`[data-budget-amount="${key}"]`);
const budgetNav = (page: Page) => page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Budget review', exact: true });

test('empty review opens trip details and focuses the budget', async ({ page, context }) => {
  await setup(page, context, budgetFixture(), true);
  await expect(page.getByRole('heading', { name: 'Budget review begins after itinerary generation.' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to trip details' }).click();
  await expect(page.locator('#trip-budget')).toBeFocused();
  await expect(page).toHaveURL(/tab=planner/);
});

test('saved review, responsive layout, navigation, reload and budget preview preserve trip context', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1536, height: 1000 });
  const state = await setup(page, context);
  await expect(amount(page, 'cost')).toHaveText(/4,750/);
  await expect(amount(page, 'budget')).toHaveText(/6,000/);
  await expect(amount(page, 'remaining')).toHaveText(/1,250/);
  await expect(page.getByText('Within your estimated budget', { exact: true })).toBeVisible();
  await expect(page.getByText('Dumaguete, Philippines', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await page.getByRole('button', { name: 'Open profile menu for Budget tester' }).click();
  await expect(page.getByRole('button', { name: 'Account settings', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: info.outputPath('budget-desktop.png'), fullPage: true });
  for (const width of [1100, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('heading', { name: 'Estimated cost breakdown' })).toBeVisible();
    if (width === 390) await page.screenshot({ path: info.outputPath('budget-mobile.png'), fullPage: true });
  }
  await page.setViewportSize({ width: 1536, height: 1000 });
  await page.reload(); await expect(amount(page, 'cost')).toHaveText(/4,750/);
  await page.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  await expect(page).toHaveURL(/tab=planner.*trip=budget-a.*from=saved/);
  await expect(page.getByRole('heading', { name: 'Your trip itinerary', exact: true })).toBeVisible();
  await budgetNav(page).click();
  await page.getByRole('button', { name: 'Edit trip budget', exact: true }).click();
  await expect(page.locator('#trip-budget')).toBeFocused();
  await page.locator('#trip-budget').fill('7000');
  await budgetNav(page).click();
  await expect(amount(page, 'remaining')).toHaveText(/2,250/);
  await expect(page.getByText('Trip detail preview.', { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  expect(state.trip.budget).toBe(6000);
  await page.getByRole('button', { name: 'Edit trip budget', exact: true }).click();
  await page.getByRole('button', { name: 'Choose accommodation later', exact: true }).click();
  await budgetNav(page).click();
  await expect(amount(page, 'cost')).toHaveText(/2,350/);
  await expect(page.locator('[data-budget-category="accommodation"]')).toContainText('No supported accommodation estimate recorded');
  await expect(page.getByText('Within your estimated budget', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit trip budget', exact: true }).click();
  await page.getByRole('button', { name: 'Enter accommodation manually', exact: true }).click();
  await page.getByPlaceholder('Hotel, hostel or guesthouse name').fill('Another suggested stay');
  await budgetNav(page).click();
  await expect(amount(page, 'cost')).toHaveText(/2,350/);
  await expect(page.locator('[data-budget-category="accommodation"]')).toContainText('Estimate unavailable');
  await expect(page.locator('[data-budget-category="accommodation"]')).toContainText('Another suggested stay');
  expect(state.writes).toHaveLength(0);
});

test('switching the selected saved trip replaces its budget and currency', async ({ page, context }) => {
  const state = await setup(page, context);
  await expect(amount(page, 'cost')).toHaveText(/4,750/);
  const plan = budgetFixture(); plan.currency = 'JPY'; plan.destination = 'Kyoto, Japan'; plan.totalBudget = 9000;
  plan.accommodation!.currency = 'JPY';
  for (const day of plan.days) for (const item of day.activities) item.priceEvidence!.currency = 'JPY';
  plan.selectedTravelCosts!.flight!.currency = 'JPY'; plan.selectedTravelCosts!.activities[0].currency = 'JPY'; plan.selectedTravelCosts!.preTrip!.currency = 'JPY';
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/platform/trips/budget-b', async route => { await gate; return route.fulfill({ json: { trip: { ...state.trip, id: 'budget-b', destination: plan.destination, destinationCity: 'Kyoto', destinationCountryCode: 'JP', budget: 9000, currency: 'JPY', itinerary: plan } } }); });
  await page.evaluate(() => { history.pushState({}, '', '/dashboard?tab=budget&trip=budget-b&from=saved'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByText('Loading this trip’s budget review…', { exact: true })).toBeVisible();
  await expect(amount(page, 'cost')).toHaveCount(0);
  release();
  await expect(amount(page, 'budget')).toHaveText('JPY 9,000');
  await expect(amount(page, 'cost')).toHaveText('JPY 4,750');
  await expect(amount(page, 'remaining')).toHaveText('JPY 4,250');
  await expect(page.getByText('Kyoto, Japan', { exact: true }).first()).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test('manual itinerary costs update the review without a save or an itinerary change from savings advice', async ({ page, context }) => {
  const state = await setup(page, context);
  await expect(amount(page, 'cost')).toHaveText(/4,750/);
  await page.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  await page.getByRole('button', { name: 'View day itinerary', exact: true }).first().click();
  await page.getByRole('button', { name: 'Edit Recorded activity', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Edit activity', exact: true });
  await dialog.locator('[name="estimatedCost"]').fill('300');
  await dialog.locator('[name="time"]').fill('Flexible');
  await dialog.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await budgetNav(page).click();
  await expect(amount(page, 'cost')).toHaveText(/4,950/);
  await expect(amount(page, 'remaining')).toHaveText(/1,050/);
  await expect(page.getByRole('heading', { name: 'Ways to spend less', exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  expect(state.trip.itinerary).toEqual(budgetFixture());
});

test('partial and over-budget estimates remain honest', async ({ page, context }) => {
  const plan = budgetFixture(); plan.totalBudget = 4000;
  plan.days[0].activities.push({ ...plan.days[0].activities[2], estimatedCost: 0, priceEvidence: { ...plan.days[0].activities[2].priceEvidence!, status: 'unavailable' } });
  await setup(page, context, plan);
  await expect(page.getByRole('heading', { name: 'Amount over budget', exact: true })).toBeVisible();
  await expect(amount(page, 'remaining')).toHaveText(/750/);
  await expect(page.getByRole('region', { name: 'Budget summary' }).getByRole('heading', { name: 'Total estimated cost (partial)', exact: true })).toBeVisible();
  await expect(page.getByText('Within your estimated budget', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-budget-category="activities"]')).toContainText('Additional estimates unavailable');
});

test('missing estimates and unselected accommodation are explicit', async ({ page, context }) => {
  const plan = budgetFixture(); delete plan.accommodation; delete plan.selectedTravelCosts;
  for (const day of plan.days) { day.totalCost = 0; for (const item of day.activities) { item.estimatedCost = 0; delete item.priceEvidence; } }
  await setup(page, context, plan);
  await expect(amount(page, 'cost')).toHaveText('Estimate unavailable');
  await expect(amount(page, 'remaining')).toHaveText('Estimate unavailable');
  await expect(page.locator('[data-budget-category="accommodation"]')).toContainText('No supported accommodation estimate recorded');
  await expect(page.getByText('Provisional · affordability needs confirmation', { exact: true })).toBeVisible();
});

test('fresh generation saves and opens the generated trip budget', async ({ page, context }) => {
  const state = await setup(page, context, budgetFixture(), true);
  await page.route('**/api/locations?*', route => route.fulfill({ json: { locations: [{ id: 1714201, name: 'Dumaguete', region: 'Negros Oriental', country: 'Philippines', countryCode: 'PH', latitude: 9.3, longitude: 123.3, label: 'Dumaguete, Philippines', placeType: 'City', scopeType: 'city' }], total: 1, nextOffset: null } }));
  await page.route('**/api/destination-context?*', route => route.fulfill({ json: { currency: 'PHP', currencySource: 'country-code', transportation: [{ id: 'bus', label: 'Bus' }], transportationSource: 'curated-country-city-guidance', transportationMessage: '' } }));
  await page.route('**/api/itinerary', route => route.fulfill({ json: budgetFixture() }));
  await page.getByRole('button', { name: 'Go to trip details' }).click();
  await page.getByPlaceholder('Where do you want to go?').fill('Dumaguete');
  await page.getByRole('button', { name: /Dumaguete.*Philippines/ }).first().click();
  await page.locator('#trip-budget').fill('6000');
  await page.locator('#trip-party-type').selectOption('couple');
  await page.locator('#trip-start-date').fill('2040-01-01'); await page.locator('#trip-end-date').fill('2040-01-03');
  await page.getByRole('button', { name: 'Enter accommodation manually', exact: true }).click();
  await page.getByPlaceholder('Hotel, hostel or guesthouse name').fill('Selected guesthouse');
  await page.getByPlaceholder('Address or area').fill('Dumaguete');
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect.poll(() => state.writes.filter(write => write.action === 'save-trip').length).toBe(1);
  await budgetNav(page).click();
  await expect(amount(page, 'cost')).toHaveText(/4,750/);
  await expect(page.getByText('Trip detail preview.', { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/tab=budget.*trip=budget-a/);
  await page.reload(); await expect(amount(page, 'cost')).toHaveText(/4,750/);
});
