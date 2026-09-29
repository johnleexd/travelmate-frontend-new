import { expect, test } from '@playwright/test';

test('compact user rows send a warning that the traveler can read', async ({ page, context }) => {
  const admin = { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', emailVerified: true, accountStatus: 'active' };
  const traveler = { ...admin, id: 'traveler', name: 'Test Traveler', email: 'traveler@example.test', role: 'traveler' };
  let user = admin;
  let rejectWarning = true;
  const notifications: Array<{ id: string; title: string; body: string; createdAt: string; readAt: null }> = [];
  await context.addCookies([{ name: 'travelmate_session', value: 'warning-test', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/platform**', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      expect(body).toEqual({ action: 'admin-user-warning', id: traveler.id, message: 'Please avoid submitting duplicate reports.' });
      if (rejectWarning) return route.fulfill({ status: 500, json: { error: 'Warning service unavailable.' } });
      notifications.push({ id: 'warning', title: 'Account warning from TravelMate', body: body.message, createdAt: new Date().toISOString(), readAt: null });
      return route.fulfill({ json: { result: { id: 'warning' } } });
    }
    return route.fulfill({ json: { user, directory: [admin, traveler], notifications: user.role === 'traveler' ? notifications : [], trips: [], listings: [], bookings: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {}, integrations: {} } });
  });
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    const row = page.getByRole('row').filter({ hasText: traveler.email });
    expect(await row.evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(90);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await row.getByRole('button', { name: 'Send warning' }).click();
    await expect(page.getByRole('dialog').getByLabel('Warning message')).toBeFocused();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(notifications).toHaveLength(0);
  }
  await expect(page.getByRole('row').filter({ hasText: admin.email }).getByRole('button', { name: 'Send warning' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Send warning' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Warning message').fill('Please avoid submitting duplicate reports.');
  await dialog.getByRole('button', { name: 'Send warning' }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be sent');
  await expect(dialog.getByLabel('Warning message')).toHaveValue('Please avoid submitting duplicate reports.');
  rejectWarning = false;
  await dialog.getByRole('button', { name: 'Send warning' }).click();
  await expect(dialog).toHaveCount(0);
  expect(notifications).toHaveLength(1);
  await expect(page.getByRole('status')).toContainText('Warning sent to Test Traveler.');
  user = traveler;
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await expect(page.getByText('Account warning from TravelMate', { exact: true })).toBeVisible();
  await expect(page.getByText('Please avoid submitting duplicate reports.', { exact: true })).toBeVisible();
});
