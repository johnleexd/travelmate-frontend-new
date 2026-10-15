import { expect, test } from '@playwright/test';
import { setupSavedNavigation } from './helpers/saved-navigation-fixture';

for (const url of ['/dashboard?tab=gps', '/gps', '/dashboard/gps']) {
  test(`old URL ${url} opens Saved trips with guidance`, async ({ page, context }) => {
    const { state } = await setupSavedNavigation(page, context, { initialUrl: url, openMap: false });
    await expect(page).toHaveURL(/tab=bookings/);
    await expect(page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'GPS navigation', exact: true })).toHaveCount(0);
    await expect(page.getByText('Navigation is available in Saved trips.', { exact: false })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Saved plans' }).getByRole('button', { name: 'View map / Navigate', exact: true })).toHaveCount(2);
    expect(state.maps).toHaveLength(0);
    expect(await page.evaluate(() => (window as unknown as { dailyGps: { fixes: unknown[] } }).dailyGps.fixes.length)).toBe(0);
  });
}

test('legacy trip/day bookmark opens the matching map and closing stays closed after refresh', async ({ page, context }) => {
  const { state, dialog } = await setupSavedNavigation(page, context, { initialUrl: '/dashboard?tab=gps&trip=trip-a&day=2', openMap: false });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Activity 1: National Museum', exact: true })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Selected activity details' }).getByRole('heading', { name: 'National Museum', exact: true })).toBeVisible();
  expect(state.maps).toEqual(['trip-a']);
  expect(state.activities[0]).toMatchObject({ tripId: 'trip-a', dayIndex: 1 });
  await dialog.screenshot({ path: '../audit/2026-10-14/saved-navigation-only/legacy-trip-map-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => { const b = el.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth; })).toBe(true);
  await dialog.screenshot({ path: '../audit/2026-10-14/saved-navigation-only/legacy-trip-map-mobile.png' });
  await dialog.getByRole('button', { name: 'Close trip map' }).click();
  await expect(page).not.toHaveURL(/map=|day=/);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Saved plans' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.maps).toEqual(['trip-a']);
  expect(state.writes).toHaveLength(0);
});

test('missing or inaccessible saved trip gives a recoverable message', async ({ page, context }) => {
  const { state } = await setupSavedNavigation(page, context, { initialUrl: '/gps?trip=not-owned', openMap: false });
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Saved trip not found.');
  expect(state.maps).toEqual(['not-owned']);
  await page.getByRole('button', { name: 'Close trip map' }).click();
  await expect(page.getByRole('region', { name: 'Saved plans' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('no saved trips explains navigation requirement and still allows planning', async ({ page, context }) => {
  const { state } = await setupSavedNavigation(page, context, { initialUrl: '/dashboard?tab=gps', openMap: false, empty: true });
  await expect(page.getByText('Navigation is available in Saved trips.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View map / Navigate', exact: true })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await expect(page.getByPlaceholder('Where do you want to go?')).toBeVisible();
  expect(state.maps).toHaveLength(0);
});

test('native browser history canonicalizes an old GPS entry', async ({ page, context }) => {
  await setupSavedNavigation(page, context, { openMap: false });
  await page.evaluate(() => {
    history.pushState({}, '', '/dashboard?tab=gps');
    history.pushState({}, '', '/dashboard?tab=bookings');
  });
  await page.goBack();
  await expect(page).toHaveURL(/tab=bookings.*navigation=moved/);
  await expect(page.getByText('Navigation is available in Saved trips.', { exact: false })).toBeVisible();
});
