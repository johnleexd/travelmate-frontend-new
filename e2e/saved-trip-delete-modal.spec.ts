import { expect, test } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

const user = { id: 'saved-stay-owner', name: 'Stay Traveler', email: 'stay@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const baseTrip = { userId: user.id, budget: 100000, currency: 'JPY', startDate: '2040-01-01', endDate: '2040-01-03', travelers: 1, partyType: 'solo', interests: [], createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z', itinerary: null, weather: null };
const archived = { ...baseTrip, id: 'archived-trip', destination: 'Hiroshima, Japan', status: 'archived', selectedAccommodation: { name: 'Sotetsu Fresa Inn Hiroshima', address: 'Minami-ku, Enkobashicho, 5-2', selectionKind: 'planned' } };
const active = { ...baseTrip, id: 'active-trip', destination: 'Tokyo, Japan', status: 'active', selectedAccommodation: { name: 'JR Kyushu Hotel Blossom Shinjuku', address: 'Shibuya-ku, Yoyogi 2-6-2', selectionKind: 'quoted' } };
const workspace = (trips: unknown[]) => ({ user, trips, tripsPage: { total: trips.length, nextCursor: null }, notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [], directory: [], moderation: [], audit: [] });

test('saved cards show the exact stay and a styled delete modal handles cancel, keyboard, failure and one confirmed request', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'saved-stay-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  let trips = [archived, active];
  let failDelete = true;
  let releaseDelete = () => {};
  const deletes: Record<string, unknown>[] = [];
  let nativePrompts = 0;
  page.on('dialog', dialog => { nativePrompts++; void dialog.dismiss(); });
  await page.route('**/api/platform**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); deletes.push(body);
      if (failDelete) return route.fulfill({ status: 502, json: { error: 'The trip could not be deleted. Please try again.' } });
      await new Promise<void>(resolve => { releaseDelete = resolve; });
      trips = trips.filter(trip => trip.id !== body.id);
      return route.fulfill({ json: { result: { id: body.id } } });
    }
    expect(url.pathname).toBe('/api/platform'); // Cards never fetch full trip details.
    return route.fulfill({ json: workspace(trips) });
  });
  await page.goto('/dashboard');
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  const savedPlans = page.getByRole('region', { name: 'Saved plans' });
  await expect(savedPlans.getByText(active.selectedAccommodation.name, { exact: true })).toBeVisible();
  await expect(savedPlans.getByText(active.selectedAccommodation.address, { exact: true })).toBeVisible();
  await expect(savedPlans.getByText('Saved room quote · Recheck price and availability before booking.', { exact: true })).toBeVisible();
  await savedPlans.getByRole('button', { name: 'Archived 1', exact: true }).click();
  await expect(savedPlans.getByText(archived.selectedAccommodation.name, { exact: true })).toBeVisible();
  const deleteButton = savedPlans.getByRole('button', { name: 'Delete permanently', exact: true });
  const modal = page.getByRole('alertdialog', { name: 'Delete this trip permanently?' });
  await deleteButton.click();
  await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await expect(modal).toContainText('This action cannot be undone.');
  await expect(modal.getByText(archived.selectedAccommodation.name, { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(deleteButton).toBeFocused();
  expect(deletes).toHaveLength(0);
  await deleteButton.click();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  expect(deletes).toHaveLength(0);
  await deleteButton.click();
  await page.keyboard.press('Shift+Tab');
  await expect(modal.getByRole('button', { name: 'Close delete confirmation' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(modal.getByRole('button', { name: 'Delete permanently', exact: true })).toBeFocused();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  }
  await page.screenshot({ path: '../audit/2026-10-08/saved-trip-modal/desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../audit/2026-10-08/saved-trip-modal/mobile.png' });
  await modal.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('The trip could not be deleted.');
  await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
  expect(deletes).toEqual([{ action: 'delete-trip', id: archived.id }]);
  failDelete = false;
  await modal.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect.poll(() => deletes.length).toBe(2);
  await expect(modal.getByRole('button', { name: 'Deleting…', exact: true })).toBeDisabled();
  await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await expect(modal.getByRole('button', { name: 'Close delete confirmation' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();
  await page.keyboard.press('Enter');
  expect(deletes).toHaveLength(2);
  releaseDelete();
  await expect(modal).toHaveCount(0);
  await expect(savedPlans.getByText('No archived trips.', { exact: true })).toBeVisible();
  await savedPlans.getByRole('button', { name: 'Active 1', exact: true }).click();
  await expect(savedPlans.getByText(active.selectedAccommodation.name, { exact: true })).toBeVisible();
  expect(nativePrompts).toBe(0);
});

test('a successful deletion closes the modal even if refreshing the remaining trips fails', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'saved-stay-fixture', domain: 'localhost', path: '/' }]);
  await mockPlanningLookups(page);
  let deleted = false;
  let deletes = 0;
  await page.route('**/api/platform**', route => {
    if (new URL(route.request().url()).pathname.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (route.request().method() === 'POST') { deleted = true; deletes++; return route.fulfill({ json: { result: { id: archived.id } } }); }
    return deleted ? route.fulfill({ status: 503, json: { error: 'Refresh unavailable.' } }) : route.fulfill({ json: workspace([archived]) });
  });
  await page.goto('/dashboard');
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  await page.getByRole('button', { name: 'Archived 1', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  const modal = page.getByRole('alertdialog', { name: 'Delete this trip permanently?' });
  await modal.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByText(/Archived trip permanently deleted. The remaining trips could not be refreshed/)).toBeVisible();
  await expect(page.getByText('No archived trips.', { exact: true })).toBeVisible();
  expect(deletes).toBe(1);
});
