import { expect, test } from '@playwright/test';

test('suspended traveler submits an appeal and reads the admin decision', async ({ page, context }) => {
  const user = { id: 'traveler', name: 'Appeal Traveler', email: 'appeal@example.test', role: 'traveler', accountStatus: 'suspended', emailVerified: true };
  const appeals: Array<{ id: string; kind: string; subjectId: string; title: string; details: string; status: string; createdAt: string }> = [];
  await context.addCookies([{ name: 'travelmate_session', value: 'appeal-test', domain: 'localhost', path: '/' }]);
  await page.route('**/api/account/appeal', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ message: 'Please review my suspension. I understand the warning.' });
      appeals.push({ id: 'appeal', kind: 'appeal', subjectId: user.id, title: 'Account suspension appeal', details: route.request().postDataJSON().message, status: 'pending', createdAt: new Date().toISOString() });
      return route.fulfill({ json: { result: appeals[0] } });
    }
    return route.fulfill({ json: { user, appeals, notifications: [{ id: 'notice', title: 'Account suspended — you can appeal', body: 'Your trip planning access is paused. Submit an appeal for review.', createdAt: new Date().toISOString() }] } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/account/appeal');
  await page.getByLabel('Your appeal').fill('Please review my suspension. I understand the warning.');
  await page.getByRole('button', { name: 'Send appeal' }).click();
  await expect(page.getByRole('heading', { name: 'Appeal awaiting review' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send appeal' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  appeals[0].status = 'approved'; user.accountStatus = 'active';
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your account access is restored' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to dashboard' })).toBeVisible();
});

test('admin reviews a suspension appeal and sends a decision', async ({ page, context }) => {
  const admin = { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', accountStatus: 'active', emailVerified: true };
  const traveler = { ...admin, id: 'traveler', role: 'traveler', name: 'Appeal Traveler', accountStatus: 'suspended' };
  const appeal = { id: 'appeal', kind: 'appeal', subjectId: traveler.id, title: 'Account suspension appeal', details: 'Please review my suspension. I understand the warning.', status: 'pending', createdAt: new Date().toISOString() };
  await context.addCookies([{ name: 'travelmate_session', value: 'appeal-test', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/platform**', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ action: 'review-appeal', id: appeal.id, decision: 'approved', message: 'Your appeal was accepted. Please follow the account guidance.' });
      appeal.status = 'approved'; traveler.accountStatus = 'active';
      return route.fulfill({ json: { result: { id: appeal.id, status: appeal.status } } });
    }
    return route.fulfill({ json: { user: admin, directory: [admin, traveler], moderation: [appeal], audit: [], itineraryGenerations: [], integrations: {} } });
  });
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: /^Reports/ }).click();
  await page.getByRole('button', { name: 'Review appeal' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(appeal.details, { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Mark resolved' })).toHaveCount(0);
  await dialog.getByLabel('Decision message to traveler').fill('Your appeal was accepted. Please follow the account guidance.');
  await dialog.getByRole('button', { name: 'Approve & restore access' }).click();
  await expect(dialog.getByText('Approved', { exact: true })).toBeVisible();
});
