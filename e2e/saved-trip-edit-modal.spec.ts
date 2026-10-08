import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

const user = { id: 'edit-modal-owner', name: 'Travel Tester', email: 'edit-modal@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const itinerary = {
  destination: 'Manila, Philippines', currency: 'PHP', totalBudget: 20000, source: 'mock', travelers: 1, partyType: 'solo',
  plannedAccommodation: { name: 'Conrad Manila', address: 'Seaside Boulevard, Manila', source: 'manual', nightlyEstimate: 0 },
  days: [
    { day: 1, date: '2040-10-08', theme: 'Explore Manila', imageUrl: '', totalCost: 600, activities: [
      { title: 'Museum visit', time: '09:00', description: 'Explore the exhibits.', category: 'activity', icon: 'map', estimatedCost: 400, durationMinutes: 60, travelMinutes: 15 },
      { title: 'Riverside walk', time: '11:00', description: 'Walk beside the river.', category: 'activity', icon: 'map', estimatedCost: 200, durationMinutes: 60, travelMinutes: 15 },
    ] },
    { day: 2, date: '2040-10-09', theme: 'A free day', imageUrl: '', totalCost: 0, activities: [] },
  ],
  budgetSummary: { accommodation: 0, food: 0, activities: 600, transport: 0, reserve: 19400, dailyAverage: 300, total: 20000, plannedSpend: 600 },
};
const baseTrip = { id: 'editable-manila', userId: user.id, destination: itinerary.destination, budget: 20000, currency: 'PHP', travelers: 1, partyType: 'solo', interests: ['culture'], startDate: '2040-10-08', endDate: '2040-10-09', status: 'active', createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z', itinerary, weather: null, selectedAccommodation: { name: 'Conrad Manila', address: 'Seaside Boulevard, Manila', selectionKind: 'planned' } };

async function setup(page: Page, context: BrowserContext) {
  await context.addCookies([{ name: 'travelmate_session', value: 'edit-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  const state = {
    trip: structuredClone(baseTrip), failLoad: false, malformedPlan: false, saveFailures: 0, failRefresh: false,
    pauseSave: false, release: () => {}, posts: [] as Array<{ action: string; id: string; itinerary: typeof itinerary }>,
  };
  await page.route('**/api/platform**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (path.endsWith(`/trips/${baseTrip.id}`)) {
      if (state.failLoad) return route.fulfill({ status: 503, json: { error: 'The saved trip is temporarily unavailable.' } });
      return route.fulfill({ json: { trip: state.malformedPlan ? { ...state.trip, itinerary: { ...state.trip.itinerary, currency: 'invalid' } } : state.trip } });
    }
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); state.posts.push(body);
      expect(body.action).toBe('update-trip-itinerary'); expect(body.id).toBe(baseTrip.id);
      if (state.saveFailures-- > 0) return route.fulfill({ status: 503, json: { error: 'Could not save your trip. Retry.' } });
      if (state.pauseSave) await new Promise<void>(resolve => { state.release = resolve; });
      state.trip = { ...state.trip, itinerary: body.itinerary, updatedAt: '2026-10-08T12:00:00Z' };
      return route.fulfill({ json: { result: state.trip } });
    }
    if (state.failRefresh && state.posts.length) return route.fulfill({ status: 503, json: { error: 'List refresh unavailable.' } });
    return route.fulfill({ json: {
      user, trips: [{ ...state.trip, itinerary: null }], tripsPage: { total: 1, hasMore: false, nextCursor: null },
      directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [],
    } });
  });
  await page.goto('/dashboard');
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  return state;
}

const openEditor = async (page: Page) => {
  await page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'Edit', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Edit saved trip', exact: true });
  await expect(modal.getByLabel('Day to edit')).toBeVisible();
  return modal;
};
const editMuseum = async (page: Page, title: string) => {
  await page.getByRole('dialog', { name: 'Edit saved trip', exact: true }).getByRole('button', { name: 'Edit Museum visit', exact: true }).click();
  const activity = page.getByRole('dialog', { name: 'Edit activity', exact: true });
  await expect(activity.getByLabel('Activity title')).toBeFocused();
  await activity.getByLabel('Activity title').fill(title);
  await activity.getByLabel('Estimated group cost (PHP)').fill('800');
  await activity.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(activity).toHaveCount(0);
};

test('saved-trip Edit opens a responsive modal with hotel details, nested edits and persistent saving', async ({ page, context }) => {
  const state = await setup(page, context);
  let modal = await openEditor(page);
  await expect(modal.getByRole('button', { name: 'Close trip editor' })).toBeFocused();
  await expect(modal.getByText('Conrad Manila', { exact: true })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '../audit/2026-10-08/saved-trip-edit-modal/edit-desktop.png' });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await modal.evaluate(element => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.right <= window.innerWidth; })).toBe(true);
    await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../audit/2026-10-08/saved-trip-edit-modal/edit-mobile.png' });
  await editMuseum(page, 'Updated museum visit');
  await expect(modal.getByRole('button', { name: 'Edit Updated museum visit', exact: true })).toBeFocused();
  expect(state.posts).toHaveLength(0);
  await modal.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0].itinerary.days[0].activities[0].estimatedCost).toBe(800);
  expect(state.posts[0].itinerary.plannedAccommodation.name).toBe('Conrad Manila');
  await expect(page.getByText('Trip changes saved.', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  modal = await openEditor(page);
  await expect(modal.getByText('Updated museum visit', { exact: true })).toBeVisible();
  await expect(modal.getByText('Conrad Manila', { exact: true })).toBeVisible();
});

test('cancel, Escape and focus trapping protect unsaved activity edits', async ({ page, context }) => {
  const state = await setup(page, context);
  const modal = await openEditor(page);
  await page.keyboard.press('Shift+Tab');
  await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(modal.getByRole('button', { name: 'Close trip editor' })).toBeFocused();
  await editMuseum(page, 'Unsaved museum visit');
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal.getByText('Unsaved museum visit', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await modal.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'Edit', exact: true })).toBeFocused();
  await openEditor(page);
  await expect(modal.getByText('Museum visit', { exact: true })).toBeVisible();
  expect(state.posts).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});

test('load and save errors remain recoverable, and a pending save cannot be submitted twice or dismissed', async ({ page, context }) => {
  const state = await setup(page, context);
  state.failLoad = true;
  await page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'Edit', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Edit saved trip', exact: true });
  await expect(modal.getByRole('alert')).toContainText('temporarily unavailable');
  state.failLoad = false;
  state.malformedPlan = true;
  await modal.getByRole('button', { name: 'Retry loading', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('does not contain an editable itinerary');
  state.malformedPlan = false;
  await modal.getByRole('button', { name: 'Retry loading', exact: true }).click();
  await expect(modal.getByLabel('Day to edit')).toBeVisible();
  await editMuseum(page, 'Recoverable museum visit');
  state.saveFailures = 1;
  await modal.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('Could not save your trip. Retry.');
  await expect(modal.getByText('Recoverable museum visit', { exact: true })).toBeVisible();
  state.pauseSave = true;
  await modal.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(() => state.posts.length).toBe(2);
  await expect(modal.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
  await expect(modal.getByRole('button', { name: 'Close trip editor' })).toBeDisabled();
  await page.keyboard.press('Escape'); await page.keyboard.press('Enter');
  await expect(modal).toBeVisible(); expect(state.posts).toHaveLength(2);
  state.release(); await expect(modal).toHaveCount(0);
});

test('activity changes stay saved when refreshing the list fails, and trip-detail changes retain the planner workflow', async ({ page, context }) => {
  const state = await setup(page, context);
  let modal = await openEditor(page);
  await modal.getByLabel('Day to edit').selectOption('1');
  await expect(modal.getByText('No activities for this day. Add one to start planning.', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Add activity', exact: true }).click();
  const activity = page.getByRole('dialog', { name: 'Add custom activity', exact: true });
  await activity.getByLabel('Activity title').fill('Sunset walk');
  await activity.getByRole('button', { name: 'Add activity', exact: true }).click();
  await expect(modal.getByText('Sunset walk', { exact: true })).toBeVisible();
  state.failRefresh = true;
  await modal.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByText('Trip changes saved. The list could not be refreshed; reload to update it.', { exact: true })).toBeVisible();
  state.failRefresh = false;
  modal = await openEditor(page);
  await modal.getByRole('button', { name: 'Change trip details', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Destination', exact: true })).toHaveValue(baseTrip.destination);
  await expect(page.getByLabel(/^Solo trip budget/)).toHaveValue('20000');
  expect(state.posts).toHaveLength(1);
});
