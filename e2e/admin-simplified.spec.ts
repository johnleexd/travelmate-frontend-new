import { expect, test } from '@playwright/test';

test('travelers can report problems without profile approval', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  const user = { id: 'traveler', name: 'Test Traveler', email: 'traveler@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true, profileStatus: 'unverified', trustScore: 50 };
  await page.route('**/api/platform**', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ action: 'submit-report', title: 'Cannot open my trip', details: 'Opening the saved trip shows a blank page.' });
      return route.fulfill({ json: { result: { id: 'report-1', status: 'pending' } } });
    }
    return route.fulfill({ json: { user, trips: [], listings: [], bookings: [], directory: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {} } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open profile menu for Test Traveler' }).click();
  await page.getByRole('button', { name: 'Account settings' }).click();
  await expect(page.getByText('Limited Mode', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Submit for verification' })).toHaveCount(0);
  await page.getByLabel('Subject', { exact: true }).fill('Cannot open my trip');
  await page.getByLabel('Details', { exact: true }).fill('Opening the saved trip shows a blank page.');
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('Your report was sent to the admin.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Subject', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('admin has four responsive sections and can resolve traveler reports', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  const user = { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', accountStatus: 'active', emailVerified: true };
  const report = { id: 'report-1', kind: 'report', subjectId: 'traveler', title: 'Saved trip does not open', details: `${'Opening my saved trip displays a blank page.\n'.repeat(30)}Final report detail.`, status: 'pending', createdAt: new Date().toISOString() };
  await page.route('**/api/platform**', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ action: 'resolve-report', id: report.id });
      report.status = 'resolved';
      return route.fulfill({ json: { result: { id: report.id, status: report.status } } });
    }
    return route.fulfill({ json: { user, directory: [user], moderation: [report], audit: [], itineraryGenerations: [], integrations: { database: true, openAI: false, gemini: true, weather: true, amadeus: false } } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/admin/dashboard');
  const navigation = page.getByRole('navigation', { name: 'Admin workspace' });
  await expect(navigation.getByRole('button')).toHaveText(['Overview', 'Users', 'Reports1', 'System Health']);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const title of ['Overview', 'Users', 'Reports', 'System Health']) {
      await navigation.getByRole('button', { name: new RegExp(`^${title}`) }).click();
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await navigation.getByRole('button', { name: /^Reports/ }).click();
  const openReport = page.getByRole('button', { name: 'View full report' });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 650 });
    await openReport.click();
    const dialog = page.getByRole('dialog', { name: 'Full report' });
    await expect(dialog.getByText(report.details, { exact: true })).toBeVisible();
    await expect(dialog.getByText(report.id, { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close full report' })).toBeFocused();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const details = dialog.getByText(report.details, { exact: true });
    expect(await details.evaluate(element => {
      const body = element.parentElement!;
      body.scrollTop = body.scrollHeight;
      return body.scrollHeight > body.clientHeight && Math.abs(body.scrollHeight - body.clientHeight - body.scrollTop) < 2;
    })).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(openReport).toBeFocused();
  }
  await page.getByRole('button', { name: report.title, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Full report' });
  await dialog.getByRole('button', { name: 'Mark resolved' }).click();
  await expect(dialog.getByText('Resolved', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close full report' }).click();
  await expect(page.getByRole('button', { name: 'Mark resolved' })).toHaveCount(0);
});
