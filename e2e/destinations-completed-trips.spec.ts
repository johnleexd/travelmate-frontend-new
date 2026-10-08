import { expect, test, type Page } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

const user = { id: 'completion-fixture', name: 'Travel Tester', email: 'completion@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const workspace = (trips: unknown[]) => ({ user, trips, tripsPage: { total: trips.length, nextCursor: null }, directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] });
const baseTrip = { id: 'completed-travel', userId: user.id, destination: 'Paris, France', destinationCity: 'Paris', destinationCountry: 'France', destinationCountryCode: 'FR', latitude: 48.8566, longitude: 2.3522,
  startDate: '2040-01-01', endDate: '2040-01-03', budget: 1200, currency: 'EUR', travelers: 1, partyType: 'solo', interests: [], status: 'active', completedAt: undefined as string | undefined,
  createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z', itinerary: null, weather: null,
  selectedAccommodation: { name: 'Fixture Paris Hotel', address: 'Paris, France', selectionKind: 'planned' } };
const openSaved = (page: Page) => page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();

test('destination carousel previews the country, supports keyboard and mobile, and confirms the right city for planning', async ({ page, context }) => {
  test.setTimeout(90000);
  await context.addCookies([{ name: 'travelmate_session', value: 'destination-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  await page.route('**/api/platform**', route => route.fulfill({ json: workspace([]) }));
  let failSearch = true; let searches = 0;
  await page.route('**/api/locations?**', route => {
    searches++;
    if (failSearch) return route.fulfill({ status: 503, json: { error: 'Location lookup unavailable. Try again.' } });
    return route.fulfill({ json: { locations: [
      { id: 2, name: 'Paris', label: 'Paris, Texas, United States', country: 'United States', countryCode: 'US', placeType: 'City', latitude: 33.66, longitude: -95.55 },
      { id: 1, name: 'Paris', label: 'Paris, France', country: 'France', countryCode: 'FR', placeType: 'City', latitude: 48.8566, longitude: 2.3522, source: 'geonames' },
    ] } });
  });
  await page.route('**/api/destination-context?**', route => route.fulfill({ json: { currency: 'EUR', currencySource: 'country-code', transportation: [], transportationMessage: '' } }));
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Optional trip expenses' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add pre-trip expenses (optional)' })).toBeHidden();
  await page.getByText('Budget details (optional)', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add pre-trip expenses (optional)' })).toBeVisible();
  await page.getByText('Budget details (optional)', { exact: true }).click();
  const carousel = page.getByRole('region', { name: 'Famous destinations carousel' });
  const previous = page.getByRole('button', { name: 'Previous destination', exact: true });
  const next = page.getByRole('button', { name: 'Next destination', exact: true });
  await expect(previous).toBeEnabled();
  await previous.click(); await expect(page.getByRole('button', { name: 'Show Machu Picchu', exact: true })).toHaveAttribute('aria-current', 'true');
  await next.click(); await expect(page.getByRole('button', { name: 'Show Eiffel Tower', exact: true })).toHaveAttribute('aria-current', 'true');
  await next.click(); await expect(page.getByRole('button', { name: 'Show Fushimi Inari Taisha', exact: true })).toHaveAttribute('aria-current', 'true');
  await carousel.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Show Colosseum', exact: true })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Show Machu Picchu', exact: true }).click();
  await expect(next).toBeEnabled();
  await next.click(); await expect(page.getByRole('button', { name: 'Show Eiffel Tower', exact: true })).toHaveAttribute('aria-current', 'true');
  await previous.click(); await expect(page.getByRole('button', { name: 'Show Machu Picchu', exact: true })).toHaveAttribute('aria-current', 'true');
  await previous.click(); await expect(page.getByRole('button', { name: 'Show Taj Mahal', exact: true })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Show Eiffel Tower', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await carousel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../audit/2026-10-08/infinite-carousel/carousel-desktop.png' });
  const card = carousel.getByRole('button', { name: 'View Eiffel Tower in France', exact: true });
  await card.click();
  const modal = page.getByRole('dialog', { name: 'Eiffel Tower', exact: true });
  await expect(modal.getByRole('button', { name: 'Close destination preview' })).toBeFocused();
  await expect(modal.getByText('Paris, France', { exact: true })).toBeVisible();
  await expect(modal.getByRole('link', { name: 'Official visitor guide' })).toHaveAttribute('href', 'https://www.toureiffel.paris/en');
  expect(searches).toBe(0);
  await expect(page.getByRole('combobox', { name: 'Destination', exact: true })).toHaveValue('');
  await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); await expect(card).toBeFocused();
  await page.getByLabel('Preferred activities', { exact: true }).fill('museums');
  await page.getByLabel(/^Solo trip budget/).fill('1200');
  await card.click();
  await expect(modal.getByRole('button', { name: 'Close destination preview' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(modal.getByRole('link', { name: 'CC BY 2.0', exact: true })).toBeFocused();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.locator('section[aria-labelledby="destination-inspiration-heading"]').evaluate(element => {
      const box = element.getBoundingClientRect();
      return box.left >= 0 && box.right <= window.innerWidth;
    })).toBe(true);
    expect(await next.evaluate(element => element.getBoundingClientRect().right <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: '../audit/2026-10-08/infinite-carousel/preview-mobile.png' });
  await modal.getByRole('button', { name: 'Plan a visit', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('Location lookup unavailable.');
  failSearch = false;
  await modal.getByRole('button', { name: 'Plan a visit', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Destination', exact: true })).toHaveValue('Paris, France');
  await expect(page.getByRole('combobox', { name: 'Destination', exact: true })).toBeFocused();
  await expect(page.getByLabel('Preferred activities', { exact: true })).toHaveValue('museums, Eiffel Tower');
  await expect(page.getByLabel(/^Solo trip budget/)).toHaveValue('1200');
  await expect(page.getByRole('combobox', { name: 'Destination currency', exact: true })).toHaveValue('EUR');
  await expect(page.getByRole('region', { name: 'Trip generation' })).toContainText('Paris, France');
  expect(searches).toBe(2);
});

test('marking travel done preserves its hotel, persists on reload, and supports archive, restore and undo', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'completion-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  let trip = { ...baseTrip }; let failComplete = true;
  let release = () => {};
  const writes: Record<string, unknown>[] = [];
  await page.route('**/api/platform**', async route => {
    if (new URL(route.request().url()).pathname.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); writes.push(body);
      if (body.action === 'complete-trip') {
        if (failComplete) return route.fulfill({ status: 503, json: { error: 'Could not save completion. Retry.' } });
        await new Promise<void>(resolve => { release = resolve; });
        trip = { ...trip, status: 'completed', completedAt: '2026-10-08T12:00:00Z' };
      } else if (body.action === 'archive-trip') trip = { ...trip, status: 'archived' };
      else if (body.action === 'restore-trip') trip = { ...trip, status: trip.completedAt ? 'completed' : 'active' };
      else if (body.action === 'reopen-trip') trip = { ...trip, status: 'active', completedAt: undefined };
      return route.fulfill({ json: { result: trip } });
    }
    return route.fulfill({ json: workspace([trip]) });
  });
  await page.goto('/dashboard'); await openSaved(page);
  const saved = page.getByRole('region', { name: 'Saved plans' });
  await expect(saved.getByRole('button', { name: 'Duplicate', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await saved.screenshot({ path: '../audit/2026-10-08/remove-trip-duplication/saved-trips-desktop.png' });
  await saved.getByRole('button', { name: 'Mark as done', exact: true }).click();
  await expect(page.getByText('Could not save completion. Retry.', { exact: true })).toBeVisible();
  await expect(saved.getByRole('button', { name: 'Active 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  failComplete = false;
  await saved.getByRole('button', { name: 'Mark as done', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  await expect(saved.getByRole('button', { name: 'Mark as done', exact: true })).toBeDisabled();
  await page.keyboard.press('Enter'); expect(writes).toHaveLength(2); release();
  await expect(saved.getByRole('button', { name: 'Completed 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(saved.getByText(baseTrip.selectedAccommodation.name, { exact: true })).toBeVisible();
  await expect(saved.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(saved.getByRole('button', { name: 'Duplicate', exact: true })).toHaveCount(0);
  await expect(saved.getByRole('button', { name: 'View', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '../audit/2026-10-08/infinite-carousel/completed-desktop.png' });
  await page.reload(); await openSaved(page);
  await saved.getByRole('button', { name: 'Completed 1', exact: true }).click();
  await expect(saved.getByText('Completed trip', { exact: true })).toBeVisible();
  await saved.getByRole('button', { name: 'Archive', exact: true }).click();
  await saved.getByRole('button', { name: 'Archived 1', exact: true }).click();
  await expect(saved.getByText(/Travel completed/)).toBeVisible();
  await saved.getByRole('button', { name: 'Restore trip', exact: true }).click();
  await saved.getByRole('button', { name: 'Completed 1', exact: true }).click();
  await expect(saved.getByText(baseTrip.selectedAccommodation.name, { exact: true })).toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await saved.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../audit/2026-10-08/infinite-carousel/completed-mobile.png' });
  await saved.getByRole('button', { name: 'Mark as not done', exact: true }).click();
  await expect(saved.getByRole('button', { name: 'Active 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(saved.getByRole('button', { name: 'Mark as done', exact: true })).toBeVisible();
  expect(writes.map(body => body.action)).toEqual(['complete-trip', 'complete-trip', 'archive-trip', 'restore-trip', 'reopen-trip']);
});

test('successful completion is retained even when refreshing the workspace fails', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'completion-fixture', domain: 'localhost', path: '/' }]);
  await mockPlanningLookups(page);
  let completed = false;
  await page.route('**/api/platform**', route => {
    if (new URL(route.request().url()).pathname.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (route.request().method() === 'POST') { completed = true; return route.fulfill({ json: { result: { ...baseTrip, status: 'completed', completedAt: '2026-10-08T12:00:00Z' } } }); }
    return completed ? route.fulfill({ status: 503, json: { error: 'Refresh unavailable.' } }) : route.fulfill({ json: workspace([baseTrip]) });
  });
  await page.goto('/dashboard'); await openSaved(page);
  await page.getByRole('button', { name: 'Mark as done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Completed 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(baseTrip.selectedAccommodation.name, { exact: true })).toBeVisible();
  await expect(page.getByText(/Your itinerary and selected hotel are saved in Completed. The list could not be refreshed/)).toBeVisible();
});
