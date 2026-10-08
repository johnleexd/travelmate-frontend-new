import { expect, test } from '@playwright/test';

test('admin overview shows persisted metrics, chart, account health and actionable reports', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  const admin = { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', accountStatus: 'active', emailVerified: true, profileStatus: 'verified' };
  const traveler = { ...admin, id: 'traveler', name: 'Test Traveler', role: 'traveler' };
  const date = '2026-10-07T12:00:00Z';
  const payload = { user: admin, directory: [admin, traveler, { ...traveler, id: 'suspended', accountStatus: 'suspended', emailVerified: false, profileStatus: 'unverified' }], moderation: [{ id: 'r1', subjectId: 'traveler', kind: 'report', title: 'My saved trip will not open', details: 'A saved trip is showing a blank screen.', status: 'pending', createdAt: date }, { id: 'a1', subjectId: 'suspended', kind: 'appeal', title: 'Account suspension appeal', details: 'Please review the suspension on my account.', status: 'pending', createdAt: date }], audit: [{ id: 'audit1', actorId: 'admin', action: 'resolve-report', targetId: 'r0', createdAt: date }], itineraryGenerations: [], integrations: { database: true }, adminOverview: { generatedPlans: 124, averageRating: 4.5, feedbackCount: 8, recentCompleted: 21, recentFailed: 0, timeZone: 'Asia/Shanghai', generationDays: [2, 3, 1, 5, 3, 4, 3].map((completed, index) => ({ date: '2026-10-0' + (index + 1), completed })) } };
  await page.route('**/api/platform**', route => route.request().url().includes('/reports/stream') ? route.fulfill({ contentType: 'text/event-stream', body: 'event: reports\ndata: ' + JSON.stringify({ moderation: payload.moderation, reporters: payload.directory }) + '\n\n' }) : route.fulfill({ json: payload }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/admin/dashboard');
  await expect(page.getByRole('button', { name: /Generated plans 124/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Average traveler rating 4.5/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Itinerary generation activity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account health' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Active travelers/ })).toContainText('50%');
  await expect(page.getByText('Report marked resolved', { exact: true })).toBeVisible();
  await page.screenshot({ path: '../audit/2026-10-07/admin-overview-desktop.png', fullPage: true });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../audit/2026-10-07/admin-overview-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'View all', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'My saved trip will not open', exact: true })).toBeVisible();
});

test('overview handles empty accounts, reports and ratings honestly', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  const user = { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', accountStatus: 'active', emailVerified: true };
  await page.route('**/api/platform**', route => route.fulfill({ json: { user, directory: [user], moderation: [], audit: [], itineraryGenerations: [], adminOverview: { generatedPlans: 0, averageRating: null, feedbackCount: 0, recentCompleted: 0, recentFailed: 0, timeZone: 'Asia/Shanghai', generationDays: Array.from({ length: 7 }, (_, i) => ({ date: '2026-10-0' + (i + 1), completed: 0 })) } } }));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/admin/dashboard');
  await expect(page.getByText('No ratings yet', { exact: true })).toBeVisible();
  await expect(page.getByText('You’re all caught up.', { exact: true })).toBeVisible();
  await expect(page.getByText('No activity yet', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Active travelers/ })).toContainText('0 of 0 travelers');
});
