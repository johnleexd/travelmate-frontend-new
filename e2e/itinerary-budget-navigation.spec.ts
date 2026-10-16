import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { budgetFixture } from '../tests/fixtures/budget-review-plan';
import type { ItineraryResponse, SavedTrip } from '../lib/contracts';

const owner = 'budget-navigation-owner';
const user = { id: owner, name: 'Budget Navigation', email: 'budget-navigation@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const reviewButton = (page: Page) => page.getByRole('button', { name: 'Review budget', exact: true });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Update saved trip', exact: true });
const backButton = (page: Page) => page.getByRole('button', { name: 'Back to itinerary', exact: true });
const amount = (page: Page, key: string) => page.locator(`[data-budget-amount="${key}"]`);
const nav = (page: Page) => page.getByRole('navigation', { name: 'Traveler workspace' });

function savedTrip(id: string, plan: ItineraryResponse): SavedTrip {
  return {
    id, userId: owner, destination: plan.destination, budget: plan.totalBudget, currency: plan.currency,
    travelers: plan.travelers, partyType: plan.partyType, interests: [],
    startDate: plan.days[0].date, endDate: plan.days.at(-1)!.date,
    status: 'active', createdAt: '2039-01-01T00:00:00Z', updatedAt: '2039-01-01T00:00:00Z',
    itinerary: plan, weather: null,
  } as SavedTrip;
}

async function setup(page: Page, context: BrowserContext) {
  await context.addCookies([{ name: 'travelmate_session', value: 'isolated-budget-navigation', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/_next/image?*', route => route.abort());
  const second = budgetFixture();
  second.destination = 'Kyoto, Japan'; second.currency = 'JPY'; second.totalBudget = 3000;
  second.accommodation = { ...second.accommodation!, name: 'Kyoto garden stay', currency: 'JPY', total: 1000, quotedTotal: 1000, nightlyRate: 500, address: 'Kyoto' };
  for (const [index, day] of second.days.entries()) {
    day.totalCost = 350 + (index < 2 ? 500 : 0);
    for (const item of day.activities) if (item.priceEvidence) item.priceEvidence.currency = 'JPY';
  }
  const costs = second.selectedTravelCosts!;
  costs.flight!.currency = 'JPY'; costs.preTrip!.currency = 'JPY';
  for (const item of costs.activities!) item.currency = 'JPY';
  second.days[0].activities.push({ title: 'Unpriced Kyoto stop', time: '16:00', description: 'No price recorded.', estimatedCost: 0, category: 'activity', icon: 'map' });
  const state = { trips: [savedTrip('budget-nav-a', budgetFixture()), savedTrip('budget-nav-b', second)], writes: [] as string[], generations: [] as string[], reads: [] as string[] };
  // Exercise the running Next app and real budget calculations with two isolated
  // saved records. No provider calls, generation, saves or database writes.
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/api/itinerary') state.generations.push(path);
    if (request.method() !== 'GET') {
      if (!path.endsWith('/photos') && path !== '/api/itinerary/images') state.writes.push(path);
      return route.fulfill({ status: 503, json: { error: 'Writes and photo lookups are unavailable in this navigation test.' } });
    }
    if (path === '/api/platform') return route.fulfill({ json: {
      user, trips: state.trips.map(trip => ({ ...trip, itinerary: null })), tripsPage: { total: 2, hasMore: false },
      notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [],
    } });
    const trip = state.trips.find(item => path === `/api/platform/trips/${item.id}`);
    if (trip) { state.reads.push(trip.id); return route.fulfill({ json: { trip } }); }
    if (path === '/api/platform/notifications') return route.fulfill({ json: { notifications: [] } });
    return route.fulfill({ status: 503, json: { error: 'Provider unavailable in isolated navigation test.' } });
  });
  return state;
}

const expected = [
  { id: 'budget-nav-a', destination: 'Dumaguete, Philippines', budget: 'PHP 6,000.00', cost: 'PHP 4,750.00', remaining: 'PHP 1,250.00', stay: 'Selected guesthouse', hotelCost: '2,400' },
  { id: 'budget-nav-b', destination: 'Kyoto, Japan', budget: 'JPY 3,000', cost: 'JPY 3,350', remaining: 'JPY 350', stay: 'Kyoto garden stay', hotelCost: '1,000' },
];

test('both saved trips keep their own budget, accommodation and expenses through review, refresh and history', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.goto('/dashboard?tab=bookings');
  for (const trip of expected) {
    const card = page.getByRole('region', { name: 'Saved plans' }).getByRole('article').filter({ has: page.getByRole('heading', { name: trip.destination, exact: true }) });
    await card.getByRole('button', { name: 'View itinerary', exact: true }).click();
    await expect(page).toHaveURL(`/dashboard?tab=planner&trip=${trip.id}&from=saved`);
    await expect(saveButton(page)).toBeEnabled();
    await reviewButton(page).click();
    await expect(page).toHaveURL(`/dashboard?tab=budget&trip=${trip.id}&from=saved`);
    await expect(amount(page, 'budget')).toHaveText(trip.budget);
    await expect(amount(page, 'cost')).toHaveText(trip.cost);
    await expect(amount(page, 'remaining')).toHaveText(trip.remaining);
    const accommodation = page.locator('[data-budget-category="accommodation"]');
    await expect(accommodation).toContainText(trip.stay);
    await expect(accommodation).toContainText(trip.hotelCost);
    await expect(nav(page).getByRole('button', { name: 'Budget review', exact: true })).toHaveAttribute('aria-current', 'page');
    if (trip.id === 'budget-nav-b') {
      await expect(page.getByRole('heading', { name: 'Amount over budget', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Budget summary', exact: true }).getByRole('heading', { name: 'Total estimated cost (partial)', exact: true })).toBeVisible();
      await expect(page.getByText('Additional estimates unavailable', { exact: true })).toBeVisible();
    }
    await page.goBack();
    await expect(reviewButton(page)).toBeVisible();
    await page.goForward();
    await expect(amount(page, 'budget')).toHaveText(trip.budget);
    await page.reload();
    await expect(amount(page, 'budget')).toHaveText(trip.budget);
    await expect(amount(page, 'cost')).toHaveText(trip.cost);
    await backButton(page).click();
    await expect(page).toHaveURL(`/dashboard?tab=planner&trip=${trip.id}&from=saved`);
    await expect(page.locator('[data-itinerary-workspace]')).toContainText(trip.destination);
    await page.reload();
    await expect(saveButton(page)).toBeEnabled();
    await nav(page).getByRole('button', { name: 'Budget review', exact: true }).click();
    await expect(amount(page, 'cost')).toHaveText(trip.cost);
    await backButton(page).click();
    await page.getByRole('button', { name: 'Back to saved trips', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Saved plans' })).toBeVisible();
  }
  expect(state.reads).toContain('budget-nav-a'); expect(state.reads).toContain('budget-nav-b');
  expect(state.writes).toEqual([]); expect(state.generations).toEqual([]);
});

test('review and return preserve unsaved activity edits and existing leave protection', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.goto('/dashboard?tab=bookings');
  await page.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await page.getByRole('button', { name: 'View day itinerary', exact: true }).first().click();
  await expect(reviewButton(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Recorded activity', exact: true }).first().click();
  const editor = page.getByRole('dialog', { name: 'Edit activity', exact: true });
  await editor.getByLabel('Activity title', { exact: true }).fill('Unsaved museum visit');
  await editor.locator('[name="estimatedCost"]').fill('300');
  await editor.getByRole('button', { name: 'Save activity', exact: true }).click();
  await backButton(page).click();
  await reviewButton(page).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(amount(page, 'cost')).toHaveText('PHP 4,950.00');
  await expect(amount(page, 'remaining')).toHaveText('PHP 1,050.00');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Unsaved museum visit', exact: true })).toBeVisible();
  await page.goForward();
  await expect(amount(page, 'cost')).toHaveText('PHP 4,950.00');
  await backButton(page).click();
  await expect(page.getByRole('heading', { name: 'Unsaved museum visit', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to saved trips', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Leave without saving?', exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Unsaved museum visit', exact: true })).toBeVisible();
  await reviewButton(page).click();
  await expect(amount(page, 'cost')).toHaveText('PHP 4,950.00');
  expect(state.reads.filter(id => id === 'budget-nav-a')).toHaveLength(1);
  expect(state.trips[0].itinerary).toEqual(budgetFixture());
  expect(state.writes).toEqual([]); expect(state.generations).toEqual([]);
});

test('overview actions match at desktop size and stack without overflow at narrow widths', async ({ page, context }, info) => {
  const state = await setup(page, context);
  await page.goto('/dashboard?tab=planner&trip=budget-nav-a&from=saved');
  await expect(saveButton(page)).toBeEnabled();
  for (const width of [1440, 1024, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const review = reviewButton(page), save = saveButton(page);
    const first = (await review.boundingBox())!, second = (await save.boundingBox())!;
    expect(first.height).toBe(second.height);
    if (width >= 480) {
      expect(first.y).toBe(second.y);
      expect(second.x - first.x - first.width).toBe(12);
    } else {
      expect(second.y - first.y - first.height).toBe(12);
      expect(first.width).toBe(second.width);
    }
    await expect(review).toHaveCSS('color', 'rgb(40, 89, 76)');
    await expect(review).toHaveCSS('border-color', 'rgb(40, 89, 76)');
    await expect(review).toHaveCSS('background-color', 'rgb(255, 254, 250)');
    await expect(review).toHaveCSS('border-radius', await save.evaluate(element => getComputedStyle(element).borderRadius));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await save.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(review).toBeFocused();
    await expect(review).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
    await expect(amount(page, 'budget')).toHaveText('PHP 6,000.00');
    await backButton(page).click();
    await expect(saveButton(page)).toBeEnabled();
    if (width === 1440 || width === 320) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: info.outputPath(`review-budget-${width}.png`), fullPage: true });
    }
  }
  expect(state.writes).toEqual([]); expect(state.generations).toEqual([]);
});

test('unsaved budget and accommodation choices survive the review round trip', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.goto('/dashboard?tab=planner&trip=budget-nav-a&from=saved');
  await expect(saveButton(page)).toBeEnabled();
  await page.getByText('Trip planning settings', { exact: true }).click();
  await page.locator('#trip-budget').fill('7000');
  await page.getByRole('button', { name: 'Choose accommodation later', exact: true }).click();
  await reviewButton(page).click();
  await expect(amount(page, 'budget')).toHaveText('PHP 7,000.00');
  await expect(amount(page, 'cost')).toHaveText('PHP 2,350.00');
  await expect(amount(page, 'remaining')).toHaveText('PHP 4,650.00');
  await expect(page.getByText('Trip detail preview.', { exact: true })).toBeVisible();
  await expect(page.locator('[data-budget-category="accommodation"]')).toContainText('Excluded');
  await backButton(page).click();
  await page.getByText('Trip planning settings', { exact: true }).click();
  await expect(page.locator('#trip-budget')).toHaveValue('7000');
  await expect(page.getByRole('button', { name: 'Choose accommodation later', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Back to saved trips', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Leave without saving?', exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.locator('#trip-budget')).toHaveValue('7000');
  expect(state.trips[0].budget).toBe(6000);
  expect(state.trips[0].itinerary).toEqual(budgetFixture());
  expect(state.writes).toEqual([]); expect(state.generations).toEqual([]);
});
