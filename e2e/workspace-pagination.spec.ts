import { expect, test } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

const user = { id: 'paged-owner', name: 'Test Traveler', email: 'test@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const summary = { id: 'trip-one', userId: user.id, destination: 'Tokyo', budget: 1000, currency: 'PHP', startDate: '2040-01-01', endDate: '2040-01-01', travelers: 1, partyType: 'solo', interests: [], status: 'active', createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z', itinerary: null, weather: null };
const itinerary = { destination: 'Tokyo', totalBudget: 1000, currency: 'PHP', source: 'mock', partyType: 'solo', travelers: 1,
  days: [{ day: 1, date: '2040-01-01', theme: 'Museum day', imageUrl: '', totalCost: 100, activities: [{ time: '09:00', title: 'Museum', description: 'Visit', estimatedCost: 100, category: 'activity', icon: 'map' }] }],
  budgetSummary: { total: 1000, accommodation: 340, food: 220, activities: 200, transport: 140, reserve: 100, dailyAverage: 1000, plannedSpend: 100, remainingBudget: 900, shortfall: 0 } };
const workspace = { user, trips: [summary], tripsPage: { total: 2, nextCursor: 'trip-one' }, notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [], directory: [], moderation: [], audit: [] };

test('focus polling stays small, saved trip pages append, and a plan loads only when opened', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-fixture', domain: 'localhost', path: '/' }]);
  await mockPlanningLookups(page);
  let workspaceRequests = 0; let notifications = 0; let details = 0;
  await page.route('**/api/platform**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/notifications')) { notifications++; return route.fulfill({ json: { notifications: [] } }); }
    if (url.pathname.endsWith('/trips/trip-one')) { details++; return route.fulfill({ json: { trip: { ...summary, itinerary } } }); }
    workspaceRequests++;
    return route.fulfill({ json: url.searchParams.has('cursor') ? { ...workspace, trips: [{ ...summary, id: 'trip-two', destination: 'Paris' }], tripsPage: { total: 2, nextCursor: null } } : workspace });
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Your travel home' })).toBeVisible();
  await expect.poll(() => notifications).toBeGreaterThan(0);
  const beforeWorkspace = workspaceRequests; const beforeNotifications = notifications;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => notifications).toBeGreaterThan(beforeNotifications);
  expect(workspaceRequests).toBe(beforeWorkspace); expect(details).toBe(0);
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  await expect(page.getByText('1 of 2 trips loaded.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Load more trips', exact: true }).click();
  await expect(page.getByText('2 of 2 trips loaded.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Paris', exact: true })).toBeVisible();
  expect(details).toBe(0);
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Tokyo', exact: true }) }).getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByText('Saved trip loaded.', { exact: false })).toBeVisible();
  expect(details).toBe(1);
});

test('version history loads on expansion and appends older metadata', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-fixture', domain: 'localhost', path: '/' }]);
  await mockPlanningLookups(page);
  let histories = 0;
  const version = (number: number) => ({ id: `version-${number}`, tripId: summary.id, version: number, kind: 'saved', createdAt: '2026-10-06T00:00:00Z', itinerary: null, weather: null });
  await page.route('**/api/platform**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (url.pathname.endsWith('/versions')) {
      histories++;
      return route.fulfill({ json: url.searchParams.has('cursor') ? { versions: [version(1)], page: { total: 3, nextCursor: null } } : { versions: [version(3), version(2)], page: { total: 3, nextCursor: 'version-2' } } });
    }
    return route.fulfill({ json: workspace });
  });
  await page.goto('/dashboard');
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Saved trips', exact: true }).click();
  expect(histories).toBe(0);
  await page.getByRole('button', { name: 'Version history', exact: true }).click();
  await expect(page.getByText('Version 3 · Initial save', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load older versions', exact: true }).click();
  await expect(page.getByText('Version 1 · Initial save', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load older versions', exact: true })).toHaveCount(0);
  expect(histories).toBe(2);
});
