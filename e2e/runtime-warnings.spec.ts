import { expect, test } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

test.beforeEach(async ({ page }) => { await mockPlanningLookups(page); });

test('currency lookups wait for an authenticated active traveler workspace', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  await page.addInitScript(() => localStorage.setItem('travelmate-reference-currency', 'USD'));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let platformReady = false;
  let exchangeRequests = 0;
  await page.route('**/api/platform**', async route => {
    await gate;
    platformReady = true;
    await route.fulfill({ json: { user: { id: 'traveler', name: 'Test Traveler', email: 'traveler@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true }, trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.route('**/api/destination-context/exchange-rate**', route => {
    expect(platformReady).toBe(true);
    exchangeRequests++;
    return route.fulfill({ status: 503, json: { error: 'Conversion temporarily unavailable.' } });
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('status', { name: 'Loading your TravelMate workspace...' })).toBeVisible();
  // Let both the stored preference and initial effects settle while auth is pending.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(exchangeRequests).toBe(0);
  release();
  await expect(page.getByRole('heading', { name: 'Your travel home' })).toBeVisible();
  await expect.poll(() => exchangeRequests).toBeGreaterThan(0);
});

test('dashboard hero loads eagerly and admin tabs with no cards do not emit GSAP warnings', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const warnings: string[] = [];
  page.on('console', message => {
    if (/GSAP target|Largest Contentful Paint/.test(message.text())) warnings.push(message.text());
  });
  const admin = { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', accountStatus: 'active', emailVerified: true };
  let user = { ...admin, role: 'traveler' };
  await page.route('**/api/platform**', route => route.fulfill({ json: { user, directory: [admin], trips: [], listings: [], bookings: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {}, integrations: {} } }));
  await page.route('**/api/feedback**', route => route.fulfill({ json: { entries: [], total: 0, page: 1, pageSize: 10 } }));
  await page.goto('/dashboard');
  const hero = page.getByAltText('Island coastline near Cebu', { exact: true });
  await expect(hero).toHaveAttribute('loading', 'eager');
  await expect(hero).toHaveAttribute('fetchpriority', 'high');
  await expect.poll(() => hero.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  user = admin;
  await page.goto('/admin/dashboard');
  const nav = page.getByRole('navigation', { name: 'Admin workspace' });
  for (const title of ['Users', 'Reports', 'System Health', 'Account Settings', 'User Feedback', 'Overview']) {
    await nav.getByRole('button', { name: title, exact: true }).click();
    await expect(page.getByRole('heading', { name: title === 'Users' ? 'User Management' : title, exact: true })).toBeVisible();
  }
  expect(warnings).toEqual([]);
});
