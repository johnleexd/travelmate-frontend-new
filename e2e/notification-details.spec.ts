import { expect, test } from '@playwright/test';

test('travelers can open, scroll, and mark a full notification as read', async ({ page, context }) => {
  const notification = { id: 'warning', title: 'Account warning from TravelMate', body: `${'Please review your recent activity.\n'.repeat(45)}Final message detail.`, createdAt: new Date().toISOString(), readAt: null as string | null };
  await context.addCookies([{ name: 'travelmate_session', value: 'notification-test', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/platform**', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      expect(body).toEqual(body.action === 'mark-all-notifications-read' ? { action: 'mark-all-notifications-read' } : { action: 'mark-notification-read', id: notification.id });
      notification.readAt = new Date().toISOString();
      return route.fulfill({ json: { result: { id: notification.id } } });
    }
    return route.fulfill({ json: { user: { id: 'traveler', name: 'Test Traveler', email: 'traveler@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true }, notifications: [notification], trips: [], directory: [], moderation: [], audit: [], listings: [], bookings: [], itineraryGenerations: [], itineraryVersions: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {} } });
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /^Notifications/ }).click();
  const opener = page.getByRole('button', { name: 'View details', exact: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 650 });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: notification.title });
    await expect(dialog.getByRole('button', { name: 'Close notification details' })).toBeFocused();
    await expect(dialog.getByText(notification.body, { exact: true })).toBeVisible();
    expect(await dialog.getByText(notification.body, { exact: true }).evaluate(element => {
      const container = element.parentElement!;
      container.scrollTop = container.scrollHeight;
      return container.scrollHeight > container.clientHeight && Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 2;
    })).toBe(true);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  }
  await page.getByRole('button', { name: notification.title, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: notification.title });
  await dialog.getByRole('button', { name: 'Mark read', exact: true }).click();
  await expect(dialog.getByText('Read', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close notification details' }).click();
  await expect(page.getByText('0 unread', { exact: true })).toBeVisible();
  await opener.click();
  await expect(dialog.getByText(notification.body, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close notification details' }).click();
  await page.getByRole('button', { name: 'Mark all read', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('All notifications marked as read.');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByText('All notifications marked as read.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await expect(page.getByText('All notifications marked as read.', { exact: true })).toHaveCount(0);
});
