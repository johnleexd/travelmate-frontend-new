import { createHash } from 'node:crypto';
import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';
async function setup(page: Page, context: BrowserContext, count = 3) {
  await context.addCookies([{ name: 'travelmate_session', value: 'trip-visits-ui-fixture', domain: 'localhost', path: '/' }]);
  await mockPlanningLookups(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  const trip = { id: 'visits-ui-trip', userId: 'visits-ui-owner', destination: 'Paris, France', budget: 1000, currency: 'EUR', travelers: 1, partyType: 'solo', interests: [], startDate: '2040-01-01', endDate: '2040-01-02', status: 'active', createdAt: '2026-10-14T00:00:00Z', updatedAt: '2026-10-14T00:00:00Z', itinerary: null, weather: null };
  const places = Array.from({ length: count }, (_, index) => ({ key: 'manual:fixture-' + index, fingerprint: createHash('sha256').update(String(index)).digest('hex'), dayIndex: 0, activityIndex: index, name: 'Saved place ' + (index + 1), destination: 'Paris, France', alreadyRecorded: index === count - 1 }));
  const state = { places, attempts: 0, writes: 0, failSave: false, failLoad: false, hold: false, release: () => {} };
  await page.route('**/api/platform**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path.endsWith('/visit-candidates')) return state.failLoad ? route.fulfill({ status: 503, json: { error: 'Saved places are temporarily unavailable.' } }) : route.fulfill({ json: { tripId: trip.id, destination: trip.destination, places } });
    if (path.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (request.method() === 'POST') {
      const body = request.postDataJSON(); expect(body.action).toBe('record-trip-visits'); state.attempts++;
      expect(body.visitDate).toBe('2020-01-01'); expect(body.tripId).toBe(trip.id);
      if (state.failSave) return route.fulfill({ status: 503, json: { error: 'Visit save failed. Try again.' } });
      if (state.hold) await new Promise<void>(resolve => { state.release = resolve; });
      state.writes += body.places.length;
      return route.fulfill({ json: { result: { recorded: body.places.length, alreadyRecorded: 0 } } });
    }
    return route.fulfill({ json: { user: { id: trip.userId, name: 'Visit UI fixture', email: 'visit-ui@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true }, trips: [trip], tripsPage: { total: 1, hasMore: false }, directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.goto('/dashboard?tab=bookings');
  const open = async () => { await page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'Record visited places', exact: true }).click(); };
  return { state, open, dialog: page.getByRole('dialog', { name: 'Record visited places', exact: true }) };
}

test('save errors keep choices; retry is acknowledged before closing; concurrent clicks and Escape cannot duplicate a pending save', async ({ page, context }) => {
  const { state, open, dialog } = await setup(page, context); state.failSave = true; await open();
  await dialog.getByRole('checkbox', { name: /^Saved place 1/ }).check();
  await dialog.getByLabel('Visit date', { exact: true }).fill('2020-01-01');
  await dialog.getByRole('button', { name: 'Save visited places', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Visit save failed');
  await expect(dialog.getByRole('checkbox', { name: /^Saved place 1/ })).toBeChecked();
  expect(state.writes).toBe(0); state.failSave = false; state.hold = true;
  await dialog.getByRole('button', { name: 'Save visited places', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Saving visited places…', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
  expect(state.attempts).toBe(2); state.release();
  await expect(dialog).toHaveCount(0); expect(state.writes).toBe(1);
  await expect(page.getByText('1 visited place saved. Your trip status is unchanged.', { exact: true })).toBeVisible();
});
test('mobile long lists scroll inside the modal, select all skips existing records, focus is trapped and close/cancel save nothing', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const { state, open, dialog } = await setup(page, context, 40); await open();
  await dialog.getByRole('checkbox', { name: 'Select all', exact: true }).check();
  await expect(dialog.getByRole('status')).toContainText('39 places selected');
  await expect(dialog.getByRole('checkbox', { name: /^Saved place 40 / })).toBeDisabled();
  const bounds = await dialog.evaluate(el => { const b = el.getBoundingClientRect(); return { fits: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight, overflow: el.scrollWidth > el.clientWidth }; });
  expect(bounds).toEqual({ fits: true, overflow: false });
  await dialog.getByRole('checkbox', { name: /^Saved place 39 / }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).focus();
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Close record visited places', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); expect(state.writes).toBe(0);
  await expect(page.getByRole('button', { name: 'Record visited places', exact: true })).toBeFocused();
  await open(); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(state.attempts).toBe(0);
  await open(); await dialog.getByRole('button', { name: 'Close record visited places', exact: true }).click(); expect(state.attempts).toBe(0);
});
test('loading failure has an explicit retry and no save; retry reads current saved places', async ({ page, context }) => {
  const { state, open, dialog } = await setup(page, context); state.failLoad = true; await open();
  await expect(dialog.getByRole('alert')).toContainText('Saved places are temporarily unavailable');
  await expect(dialog.getByRole('button', { name: 'Save visited places', exact: true })).toBeDisabled();
  state.failLoad = false; await dialog.getByRole('button', { name: 'Retry loading places', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: /^Saved place 1/ })).not.toBeChecked();
  expect(state.writes).toBe(0);
});
test('an existing thumbnail renders with its saved credit and selecting it requires no image search or save', async ({ page, context }) => {
  const { state, open, dialog } = await setup(page, context);
  await page.route('**/_next/image?*', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4uoAAAAASUVORK5CYII=', 'base64') }));
  await page.route('**/api/platform/trips/*/visit-candidates', route => route.fulfill({ json: { tripId: 'visits-ui-trip', destination: 'Paris, France', places: state.places.map((place, index) => index ? place : { ...place,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/The_Manila_Cathedral.jpg',
    imageAttribution: { creator: 'Kuranges', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Manila_Cathedral.jpg', photoType: 'place' } }) } }));
  await open(); await expect(dialog.getByRole('img', { name: 'Saved place 1', exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Photo: Kuranges', exact: true })).toBeVisible();
  await dialog.getByRole('checkbox', { name: /^Saved place 1/ }).check(); expect(state.attempts).toBe(0);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(state.writes).toBe(0);
});
