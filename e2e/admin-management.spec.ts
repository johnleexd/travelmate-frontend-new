import { expect, test } from '@playwright/test';

test('user management uses persisted metadata, combines search/filter, and saves only the admin profile', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  const user = { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', accountStatus: 'active', emailVerified: true };
  const traveler = { ...user, id: 'traveler', name: 'Ada Traveler', email: 'ada@example.test', role: 'traveler', avatarUrl: 'https://example.test/photo.jpg', createdAt: '2026-02-03T12:00:00.000Z' };
  const suspended = { ...traveler, id: 'suspended', name: 'Suspended Traveler', email: 'suspended@example.test', accountStatus: 'suspended', avatarUrl: undefined, createdAt: undefined };
  await page.route('https://example.test/photo.jpg', route => route.abort());
  await page.route('**/api/platform**', route => route.fulfill({ json: { user, directory: [user, traveler, suspended], moderation: [], audit: [], itineraryGenerations: [], integrations: { database: true } } }));
  let saved = false;
  await page.route('**/api/profile', route => {
    expect(route.request().method()).toBe('PATCH');
    expect(route.request().postDataJSON()).toEqual({ name: 'Updated Admin', phone: '+63 123', bio: 'Admin profile', avatarUrl: 'https://example.test/admin.jpg' });
    saved = true;
    return route.fulfill({ json: { profile: { ...user, name: 'Updated Admin' } } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/admin/dashboard');
  const nav = page.getByRole('navigation', { name: 'Admin workspace' });
  await nav.getByRole('button', { name: 'Users', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toBeVisible();
  await expect(page.getByText('Active users: 2', { exact: true })).toBeVisible();
  const table = page.getByRole('table');
  await expect(table.getByRole('columnheader')).toHaveText(['Avatar', 'Name', 'Email', 'Join Date', 'Role', 'Account', 'Email status', 'Actions']);
  await expect(page.getByRole('img', { name: 'Default avatar for Ada Traveler' })).toBeVisible();
  await expect(table.getByText('Feb 3, 2026')).toBeVisible();
  const adminRow = table.getByRole('row').filter({ hasText: 'admin@example.test' });
  await expect(adminRow.getByRole('button')).toHaveCount(0);
  await page.getByLabel('Search users').fill('SUSPENDED');
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(page.getByText('Active users: 2', { exact: true })).toBeVisible();
  await page.getByLabel('Filter users').selectOption('active');
  await expect(page.getByText('No users match your search.')).toBeVisible();
  await page.getByLabel('Filter users').selectOption('all');
  await page.getByLabel('Search users').fill('ada@example');
  await expect(table.getByRole('row')).toHaveCount(2);
  await page.getByLabel('Search users').fill('');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const logout = page.getByRole('button', { name: 'Logout', exact: true });
    await expect(logout).toBeVisible();
    const box = await logout.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await nav.getByRole('button', { name: 'System Health' }).click();
  await expect(page.getByRole('heading', { name: 'API Monitoring' })).toBeVisible();
  await nav.getByRole('button', { name: 'Account Settings' }).click();
  await page.getByLabel('Full name').fill('Updated Admin');
  await page.getByLabel('Phone number').fill('+63 123');
  await page.getByLabel('Bio', { exact: true }).fill('Admin profile');
  await page.getByLabel('Profile photo URL').fill('https://example.test/admin.jpg');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible();
  expect(saved).toBe(true);
});


test('header Logout uses the existing session sign-out', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  await page.route('**/api/platform**', route => route.fulfill({ json: { user: { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', accountStatus: 'active' }, directory: [], moderation: [], audit: [], itineraryGenerations: [] } }));
  let signedOut = false;
  await page.route('**/api/auth', route => {
    if (route.request().method() === 'POST') { expect(route.request().postDataJSON().action).toBe('logout'); signedOut = true; }
    return route.fulfill({ json: { ok: true, sessionRevoked: true } });
  });
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/localhost:3000\/?$/);
  expect(signedOut).toBe(true);
});
