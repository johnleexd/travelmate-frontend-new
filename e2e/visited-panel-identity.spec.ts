import { expect, test } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

test('cached Saved trips and Visited places keep separate identities through navigation and visit refresh', async ({ page, context }) => {
  await mockPlanningLookups(page);
  await context.addCookies([{ name: 'travelmate_session', value: 'visited-panel-fixture', domain: 'localhost', path: '/' }]);
  const user = { id: '49d6876b-b0ea-4327-bb42-75d3b43aa10e', name: 'Visited panel tester', email: 'visited-panel@example.test', role: 'traveler', emailVerified: true, accountStatus: 'active' };
  const visit = { id: 'visit-unique-1', name: 'tokyo', destination: 'Tokyo, Japan', placeKey: 'manual:tokyo', visitDate: '2026-10-09', createdAt: '2026-10-09T00:00:00Z' };
  const duplicateKeys: string[] = [];
  page.on('console', message => { if (/same key|non-unique keys/i.test(message.text())) duplicateKeys.push(message.text()); });
  await page.route('**/api/platform**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path.endsWith('/visited-places')) return route.fulfill({ json: { visits: [visit], page: { total: 1, hasMore: false } } });
    if (request.method() === 'POST') {
      expect(request.postDataJSON().action).toBe('record-visit');
      return route.fulfill({ json: { result: { visit, alreadyRecorded: true } } });
    }
    return route.fulfill({ json: { user, trips: [], tripsPage: { total: 0, nextCursor: null }, directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.goto('/dashboard?tab=bookings');
  await expect(page.getByRole('region', { name: 'Saved plans' })).toBeVisible();
  for (let index = 0; index < 3; index++) {
    await page.getByRole('button', { name: 'Visited places', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'tokyo', exact: true })).toHaveCount(1);
    await expect(page.getByText('1 visit recorded', { exact: true })).toBeVisible();
    if (index < 2) {
      await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Saved plans' })).toBeVisible();
    }
  }
  expect(duplicateKeys).toEqual([]);
  const search = page.getByLabel('Search place or destination', { exact: true });
  await expect(search).toHaveAttribute('id', /\S+/);
  await expect(search).toHaveAttribute('name', /\S+/);
  await page.getByRole('button', { name: 'Record a visit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record a visit', exact: true });
  await dialog.getByLabel('Place name', { exact: true }).fill('tokyo');
  await dialog.getByLabel('Destination', { exact: true }).fill('Tokyo, Japan');
  await dialog.getByLabel('Visit date', { exact: true }).fill('2026-10-09');
  await dialog.getByRole('button', { name: 'Mark as visited', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('This place and date are already recorded.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'tokyo', exact: true })).toHaveCount(1);
  expect(duplicateKeys).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'tokyo', exact: true })).toHaveCount(1);
  expect(duplicateKeys).toEqual([]);
});
