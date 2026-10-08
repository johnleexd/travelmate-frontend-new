import { expect, test } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

test.beforeEach(async ({ page }) => { await mockPlanningLookups(page); });

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

test('report errors stay beside the form and successful retries do not reload the workspace', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  const user = { id: 'traveler', name: 'Test Traveler', email: 'traveler@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true, profileStatus: 'unverified', trustScore: 50 };
  let attempts = 0;
  let workspaceReads = 0;
  let readsBeforeSubmission = 0;
  await page.route('**/api/platform**', async route => {
    if (route.request().method() === 'POST') {
      if (attempts === 0) readsBeforeSubmission = workspaceReads;
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 503, json: { error: 'Report service temporarily unavailable.' } });
      return route.fulfill({ json: { result: { id: 'report-retry', status: 'pending' } } });
    }
    workspaceReads++;
    if (attempts > 0) return route.fulfill({ status: 503, json: { error: 'Workspace unavailable.' } });
    return route.fulfill({ json: { user, trips: [], listings: [], bookings: [], directory: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {} } });
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open profile menu for Test Traveler' }).click();
  await page.getByRole('button', { name: 'Account settings' }).click();
  const form = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Report a problem' }) });
  await form.getByLabel('Subject', { exact: true }).fill('Cannot open my trip');
  await form.getByLabel('Details', { exact: true }).fill('Opening the saved trip shows a blank page.');
  await form.getByRole('button', { name: 'Send report' }).click();
  await expect(form.getByRole('alert')).toHaveText('Report service temporarily unavailable.');
  await expect(form.getByLabel('Subject', { exact: true })).toHaveValue('Cannot open my trip');
  await form.getByRole('button', { name: 'Send report' }).click();
  await expect(form.getByRole('status')).toHaveText('Your report was sent to the admin.');
  await expect(form.getByLabel('Details', { exact: true })).toHaveValue('');
  expect(attempts).toBe(2);
  expect(workspaceReads).toBe(readsBeforeSubmission);
});

test('admin has responsive sections and can resolve traveler reports', async ({ page, context }) => {
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
  await expect(navigation.getByRole('button')).toHaveText(['Overview', 'Users', 'Reports1', 'System Health', 'Account Settings', 'User Feedback', 'Notifications']);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const title of ['Overview', 'Users', 'Reports', 'System Health', 'Account Settings']) {
      await navigation.getByRole('button', { name: new RegExp(`^${title}`) }).click();
      await expect(page.getByRole('heading', { name: title === 'Users' ? 'User Management' : title, exact: true })).toBeVisible();
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
