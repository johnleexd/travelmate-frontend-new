import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

const owner = 'back-button-owner';
const originalPlan = {
  destination: 'Manila, Philippines', currency: 'PHP', totalBudget: 10000, travelers: 1, partyType: 'solo', source: 'mock',
  preferences: { pace: 'balanced', travelStyle: 'balanced', accommodation: 'budget-friendly', activities: ['sightseeing'], transportation: '' },
  budgetSummary: { accommodation: 0, food: 0, activities: 200, transport: 0, reserve: 9800, total: 10000, plannedSpend: 200 },
  days: [{ day: 1, date: '2040-10-15', theme: 'Museum day', totalCost: 200, activities: [{
    title: 'Museum visit', time: '09:00', durationMinutes: 60, travelMinutes: 0, description: 'Explore exhibits.', estimatedCost: 200, category: 'activity', icon: 'map',
  }] }],
};

async function setup(page: Page, context: BrowserContext) {
  await context.addCookies([{ name: 'travelmate_session', value: 'back-button-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  await page.route('**/api/**', route => route.fulfill({ json: { photos: [], quotes: [], locations: [] } }));
  const state = { failSave: false, failRefresh: false, missingResult: false, saveGate: null as Promise<void> | null, writes: [] as Record<string, unknown>[], trips: Array.from({ length: 8 }, (_, index) => ({
    id: `back-trip-${index}`, userId: owner, destination: 'Manila, Philippines', currency: 'PHP', budget: 10000,
    travelers: 1, partyType: 'solo', interests: ['culture'], startDate: '2040-10-15', endDate: '2040-10-15',
    status: index < 4 ? 'active' : 'completed', createdAt: '2026-10-12T00:00:00Z',
    itinerary: structuredClone(originalPlan), weather: null,
  })) };
  await page.route('**/api/platform**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      if (url.pathname.endsWith('/photos')) {
        const trip = state.trips.find(trip => url.pathname === `/api/platform/trips/${trip.id}/photos`)!;
        return route.fulfill({ json: { day: trip.itinerary.days.find(day => day.day === body.day) } });
      }
      state.writes.push(body);
      if (state.saveGate) await state.saveGate;
      if (state.failSave) return route.fulfill({ status: 503, json: { error: 'Save unavailable.' } });
      if (state.missingResult) return route.fulfill({ json: {} });
      const trip = state.trips.find(trip => trip.id === body.id)!;
      if (body.itinerary) trip.itinerary = body.itinerary;
      if (body.budget) trip.budget = body.budget;
      return route.fulfill({ json: { result: trip } });
    }
    if (url.pathname.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (url.pathname.includes('/trips/')) return route.fulfill({ json: { trip: state.trips.find(trip => url.pathname.endsWith(trip.id)) } });
    if (state.failRefresh) return route.fulfill({ status: 503, json: { error: 'List unavailable.' } });
    return route.fulfill({ json: {
      user: { id: owner, name: 'Trip Tester', email: 'trips@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true },
      trips: state.trips.map(trip => ({ ...trip, itinerary: undefined, weather: undefined })), tripsPage: { total: state.trips.length, hasMore: false, nextCursor: null },
      directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [],
    } });
  });
  await page.goto('/dashboard');
  const nav = page.getByRole('navigation', { name: 'Traveler workspace' });
  await nav.getByRole('button', { name: 'Saved trips', exact: true }).click();
  return { state, nav, list: page.getByRole('region', { name: 'Saved plans' }) };
}

const backButton = (page: Page) => page.getByRole('button', { name: 'Back to saved trips', exact: true });
const editedCard = (page: Page) => page.locator('[data-daily-card]').first();
async function expectEditedDraft(page: Page) {
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').itinerary?.days[0].activities[0].title, `travelmate-itinerary-draft:${owner}`)).toBe('Unsaved museum visit');
}
async function showOverview(page: Page) {
  const dayBack = page.getByRole('button', { name: 'Back to itinerary', exact: true });
  if (await dayBack.isVisible()) await dayBack.click();
  await expect(page.getByRole('heading', { name: 'Your trip itinerary', exact: true })).toBeVisible();
}
async function confirmBack(page: Page, discard: boolean) {
  await showOverview(page);
  await backButton(page).click();
  const modal = page.getByRole('dialog', { name: 'Leave without saving?' });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: discard ? 'Discard changes' : 'Keep editing', exact: true }).click();
  await expect(modal).toHaveCount(0);
}
async function editActivity(page: Page) {
  await page.getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Museum visit', exact: true }).click();
  await page.getByLabel('Activity title').fill('Unsaved museum visit');
  await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Update saved trip', exact: true })).toBeVisible();
  await showOverview(page);
}

test('returns directly, preserving completed filter, scroll and opener focus without a prompt', async ({ page, context }) => {
  const { list, state, nav } = await setup(page, context);
  await list.getByRole('button', { name: 'Completed 4', exact: true }).click();
  const open = list.getByRole('button', { name: 'View itinerary', exact: true }).nth(2);
  await open.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  await open.click();
  await expect(backButton(page)).toBeVisible();
  const dialogs: string[] = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await backButton(page).focus(); await page.keyboard.press('Enter');
  await expect(list).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Saved trips', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(list.getByRole('button', { name: 'Completed 4', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(open).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 0);
  expect(dialogs).toEqual([]); expect(state.writes).toEqual([]);
});

test('cancel retains manual edits; discard clears the browser draft and reopens the saved version', async ({ page, context }) => {
  const { list, state } = await setup(page, context);
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await editActivity(page);
  await expect.poll(() => page.evaluate(key => !!localStorage.getItem(key), `travelmate-itinerary-draft:${owner}`)).toBe(true);
  await confirmBack(page, false);
  await expectEditedDraft(page);
  await expect(backButton(page)).toBeFocused();
  await confirmBack(page, true);
  await expect(list).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), `travelmate-itinerary-draft:${owner}`)).toBeNull();
  expect(state.writes).toEqual([]);
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await page.getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Museum visit', exact: true })).toBeVisible();
});

test('account dropdown navigation preserves the unsaved draft and existing leave protection', async ({ page, context }) => {
  const { list, state } = await setup(page, context);
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await editActivity(page);
  await page.getByRole('button', { name: 'Open profile menu for Trip Tester', exact: true }).click();
  await page.getByRole('button', { name: 'Account settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible();
  await expectEditedDraft(page);
  await page.goBack();
  await expect(backButton(page)).toBeVisible();
  await expectEditedDraft(page);
  await confirmBack(page, false);
  await expectEditedDraft(page);
  expect(state.writes).toEqual([]);
});

test('planning fields prompt only while changed, and Update saved trip clears the navigation guard', async ({ page, context }) => {
  const { list, state } = await setup(page, context);
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await page.getByText('Trip planning settings', { exact: true }).click();
  const budget = page.locator('#trip-budget');
  await budget.fill('12000');
  await confirmBack(page, false);
  await expect(budget).toHaveValue('12000');
  await budget.fill('10000');
  const dialogs: string[] = [];
  const dismiss = async (dialog: import('@playwright/test').Dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); };
  page.on('dialog', dismiss);
  await backButton(page).click(); await expect(list).toBeVisible(); expect(dialogs).toEqual([]);
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await page.getByText('Trip planning settings', { exact: true }).click();
  await budget.fill('12000');
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Trip updated successfully' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Updated', exact: true })).toBeVisible();
  await expect(page.getByText('Saved trip updated.', { exact: true })).toHaveCount(0);
  await backButton(page).click(); await expect(list).toBeVisible();
  expect(dialogs).toEqual([]); expect(state.writes).toHaveLength(1); expect(state.writes[0].action).toBe('update-trip');
});

test('manual save returns immediately; form discard restores the saved values', async ({ page, context }) => {
  const { list } = await setup(page, context);
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await editActivity(page);
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Trip updated successfully' })).toBeVisible();
  const dialogs: string[] = [];
  const dismiss = async (dialog: import('@playwright/test').Dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); };
  page.on('dialog', dismiss);
  await backButton(page).click(); await expect(list).toBeVisible(); expect(dialogs).toEqual([]);
  page.off('dialog', dismiss);
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await page.getByText('Trip planning settings', { exact: true }).click();
  await page.locator('#trip-budget').fill('15000');
  await confirmBack(page, true);
  await expect(list).toBeVisible();
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with this plan', exact: true }).click();
  await page.getByText('Trip planning settings', { exact: true }).click();
  await expect(page.locator('#trip-budget')).toHaveValue('10000');
});

test('matches placement, keyboard focus and mobile widths; stays hidden for trips opened from Home', async ({ page, context }) => {
  const { list, nav } = await setup(page, context);
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await backButton(page).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Update saved trip', exact: true })).toBeVisible();
    const button = (await backButton(page).boundingBox())!, heading = (await page.getByRole('heading', { name: 'Your trip itinerary', exact: true }).boundingBox())!;
    const notice = (await page.getByRole('status').filter({ hasText: 'Saved trip loaded.' }).boundingBox())!;
    expect(button.x).toBeCloseTo(heading.x, 0);
    expect(notice.y).toBeGreaterThan(heading.y + heading.height);
    expect(button.y + button.height).toBeLessThan(heading.y);
    expect(button.height).toBeGreaterThanOrEqual(width < 640 ? 44 : 40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await backButton(page).focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    await expect(backButton(page)).toBeFocused();
    expect(await backButton(page).evaluate(el => getComputedStyle(el).outlineWidth)).toBe('2px');
    await page.screenshot({ path: `../audit/2026-10-12/saved-itinerary-back/itinerary-${width}.png` });
  }
  await backButton(page).click();
  await nav.getByRole('button', { name: 'Home', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your trip itinerary', exact: true })).toBeVisible();
  await expect(backButton(page)).toHaveCount(0);
});

test('custom leave modal traps focus; Keep editing, X and Escape preserve edits on desktop and mobile', async ({ page, context }) => {
  const { list, state } = await setup(page, context);
  const nativeDialogs: string[] = [];
  page.on('dialog', async dialog => { nativeDialogs.push(dialog.message()); await dialog.dismiss(); });
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await editActivity(page);
  const modal = page.getByRole('dialog', { name: 'Leave without saving?' });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await backButton(page).click();
    await expect(modal.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
    await expect(modal).toContainText('You have unsaved changes to this trip. Leaving now will discard them.');
    for (let index = 0; index < 5; index++) {
      await page.keyboard.press('Tab');
      expect(await modal.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await modal.evaluate(el => el.contains(document.activeElement))).toBe(true);
    const bounds = (await modal.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(15); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 15);
    expect(bounds.y + bounds.height / 2).toBeCloseTo(450, 0);
    expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `../audit/2026-10-12/trip-update-feedback/modal-${width}.png` });
    if (width === 1440) await modal.getByRole('button', { name: 'Keep editing', exact: true }).click();
    else if (width === 390) await modal.getByRole('button', { name: 'Close unsaved changes confirmation' }).click();
    else await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0); await expect(backButton(page)).toBeFocused();
    await expectEditedDraft(page);
  }
  expect(nativeDialogs).toEqual([]); expect(state.writes).toEqual([]);
  await confirmBack(page, true); await expect(list).toBeVisible();
});

test('reverting an activity edit returns directly without a warning or a recovery draft', async ({ page, context }) => {
  const { list, state } = await setup(page, context);
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await editActivity(page);
  await editedCard(page).getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Unsaved museum visit', exact: true }).click();
  await page.getByLabel('Activity title').fill('Museum visit');
  await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  await showOverview(page);
  await backButton(page).click(); await expect(list).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), `travelmate-itinerary-draft:${owner}`)).toBeNull();
  expect(state.writes).toEqual([]);
});

test('update waits for backend confirmation, blocks repeated submissions, and shows responsive dismissible feedback', async ({ page, context }) => {
  const { list, state } = await setup(page, context);
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await page.getByText('Trip planning settings', { exact: true }).click();
  await page.locator('#trip-budget').fill('12000');
  let release!: () => void;
  state.saveGate = new Promise<void>(resolve => { release = resolve; });
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  const updating = page.getByRole('button', { name: 'Updating…', exact: true });
  await expect(updating).toBeDisabled(); await expect(updating).toHaveAttribute('aria-busy', 'true');
  await expect(updating.locator('svg')).toBeVisible();
  await expect(page.locator('[data-trip-save-toast]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Updated', exact: true })).toHaveCount(0);
  await updating.evaluate(el => (el as HTMLButtonElement).click());
  await expect.poll(() => state.writes.length).toBe(1);
  release(); state.saveGate = null;
  await expect(page.getByRole('button', { name: 'Updated', exact: true })).toBeEnabled();
  const toast = page.locator('[data-trip-save-toast]');
  await expect(toast.getByRole('status')).toContainText('Trip updated successfully');
  await expect(toast).toContainText('Your changes have been saved.');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await toast.hover();
    const bounds = (await toast.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(15); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 15);
    expect(bounds.y).toBeGreaterThanOrEqual(15); expect(bounds.y + bounds.height).toBeLessThan(900);
    expect(await toast.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `../audit/2026-10-12/trip-update-feedback/success-${width}.png` });
  }
  await toast.getByRole('button', { name: 'Dismiss success notification' }).click();
  await expect(toast).toHaveCount(0);
  await backButton(page).click(); await expect(list).toBeVisible();
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await page.getByText('Trip planning settings', { exact: true }).click();
  await expect(page.locator('#trip-budget')).toHaveValue('12000');
});

test('failed updates preserve activity edits and browser draft; retry saves and later edits restore the warning', async ({ page, context }) => {
  const { list, state } = await setup(page, context);
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await editActivity(page);
  state.failSave = true;
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  const toast = page.locator('[data-trip-save-toast]');
  await expect(toast.getByRole('alert')).toHaveText('Couldn’t update trip. Please try again.');
  await expect(page.getByRole('button', { name: 'Update saved trip', exact: true })).toBeEnabled();
  await expectEditedDraft(page);
  expect(state.trips[0].itinerary.days[0].activities[0].title).toBe('Museum visit');
  expect(await page.evaluate(key => !!localStorage.getItem(key), `travelmate-itinerary-draft:${owner}`)).toBe(true);
  await toast.getByRole('button', { name: 'Dismiss error notification' }).click();
  await expect(toast).toHaveCount(0);
  await confirmBack(page, false);
  state.failSave = false; state.failRefresh = true;
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Updated', exact: true })).toBeVisible();
  await expect(toast.getByRole('status')).toContainText('Trip updated successfully');
  expect(state.trips[0].itinerary.days[0].activities[0].title).toBe('Unsaved museum visit');
  expect(await page.evaluate(key => localStorage.getItem(key), `travelmate-itinerary-draft:${owner}`)).toBeNull();
  await expect(toast).toHaveCount(0, { timeout: 6500 });
  await backButton(page).click(); await expect(list).toBeVisible();
  state.failRefresh = false;
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await page.getByText('Trip planning settings', { exact: true }).click();
  await page.locator('#trip-budget').fill('13000');
  await expect(page.getByRole('button', { name: 'Update saved trip', exact: true })).toBeVisible();
  await confirmBack(page, false);
});

test('changes made while saving stay unsaved; an unconfirmed result never clears the guard', async ({ page, context }) => {
  const { list, state } = await setup(page, context);
  await list.getByRole('button', { name: 'View itinerary', exact: true }).first().click();
  await page.getByText('Trip planning settings', { exact: true }).click();
  const budget = page.locator('#trip-budget');
  await budget.fill('12000');
  state.missingResult = true;
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t update trip. Please try again.' })).toBeVisible();
  await confirmBack(page, false);
  state.missingResult = false;
  let release!: () => void;
  state.saveGate = new Promise<void>(resolve => { release = resolve; });
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Updating…', exact: true })).toBeDisabled();
  await budget.fill('14000');
  release(); state.saveGate = null;
  await expect(page.getByRole('button', { name: 'Update saved trip', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Updated', exact: true })).toHaveCount(0);
  await expect(budget).toHaveValue('14000');
  expect(state.trips[0].budget).toBe(12000);
  await confirmBack(page, false);
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Updated', exact: true })).toBeVisible();
  await budget.fill('16000');
  await expect(page.getByRole('button', { name: 'Update saved trip', exact: true })).toBeVisible();
  await confirmBack(page, true); await expect(list).toBeVisible();
});
