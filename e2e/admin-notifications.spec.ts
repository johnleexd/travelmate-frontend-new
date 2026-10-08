import { expect, test } from '@playwright/test';

test('admin notifications filter, persist read states and receive live updates', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  await page.addInitScript(() => {
    class Stream extends EventTarget { static streams: Stream[] = []; onerror: (() => void) | null = null; constructor() { super(); Stream.streams.push(this); } close() {} }
    Object.assign(window, { EventSource: Stream, notificationStreams: Stream.streams });
  });
  const admin = { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', accountStatus: 'active', emailVerified: true };
  const today = new Date().toISOString(); const yesterday = new Date(Date.now() - 86400000).toISOString();
  let notifications = [
    { id: 'appeal', userId: admin.id, title: 'Suspension appeal received', body: 'A traveler submitted an account suspension appeal.', href: '/admin/dashboard', createdAt: today, readAt: today },
    { id: 'report', userId: admin.id, title: 'Traveler report submitted', body: 'Avery Kim reported an itinerary issue.', href: '/admin/dashboard?tab=reports&category=reports', createdAt: today, readAt: undefined as string | undefined },
    { id: 'system', userId: admin.id, title: 'Itinerary generation failed', body: 'Generation for Tokyo could not complete.', href: '/admin/dashboard?tab=health&category=system', createdAt: yesterday, readAt: undefined as string | undefined },
    { id: 'feedback', userId: admin.id, title: 'New traveler feedback', body: 'A traveler rated their itinerary 5 out of 5.', href: '/admin/dashboard?tab=feedback&category=feedback', createdAt: yesterday, readAt: yesterday },
  ];
  const unread = () => notifications.filter(item => !item.readAt).length;
  let fail = false; const posts: Record<string, unknown>[] = [];
  await page.route('**/api/platform**', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); posts.push(body);
      if (fail) return route.fulfill({ status: 503, json: { error: 'Notifications temporarily unavailable.' } });
      notifications = notifications.map(item => body.action === 'mark-all-notifications-read' || item.id === body.id ? { ...item, readAt: new Date().toISOString() } : item);
      return route.fulfill({ json: { result: body.id ? { id: body.id } : { all: true } } });
    }
    if (route.request().url().includes('/notifications')) return route.fulfill({ json: { notifications, unreadCount: unread() } });
    return route.fulfill({ json: { user: admin, directory: [admin], moderation: [], audit: [], itineraryGenerations: [], notifications, notificationsUnreadCount: unread() } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Notifications, 2 unread', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Administration notifications' });
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
  await expect(page.getByText('2 unread administration updates', { exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Yesterday', exact: true })).toBeVisible();
  await page.screenshot({ path: '../audit/2026-10-07/admin-notifications-desktop.png', fullPage: true });
  const filters = page.getByRole('group', { name: 'Filter notifications' });
  await filters.getByRole('button', { name: 'Feedback', exact: true }).click();
  await expect(panel.getByText('New traveler feedback', { exact: true })).toBeVisible();
  await expect(panel.getByText('Traveler report submitted', { exact: true })).toHaveCount(0);
  for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.setViewportSize({ width: 390, height: 844 }); await filters.getByRole('button', { name: 'All', exact: true }).click();
  await page.screenshot({ path: '../audit/2026-10-07/admin-notifications-mobile.png', fullPage: true });
  await panel.getByRole('button', { name: /Traveler report submitted/ }).click();
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  expect(posts[0]).toEqual({ action: 'mark-notification-read', id: 'report' });
  await page.getByRole('button', { name: 'Notifications, 1 unread', exact: true }).click();
  fail = true; await page.getByRole('button', { name: 'Mark all read', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Notifications temporarily unavailable.');
  await expect(page.getByText('1 unread administration update', { exact: true })).toBeVisible();
  fail = false; await page.getByRole('button', { name: 'Mark all read', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark all read', exact: true })).toBeDisabled();
  await page.reload(); await page.getByRole('navigation', { name: 'Admin workspace' }).getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page.getByText('You’re all caught up. No unread updates.', { exact: true })).toBeVisible();
  notifications.push({ ...notifications[1], id: 'live', title: 'New live report', readAt: undefined });
  await page.evaluate(snapshot => {
    const streams = (window as unknown as { notificationStreams: EventTarget[] }).notificationStreams;
    streams.at(-1)!.dispatchEvent(new MessageEvent('reports', { data: JSON.stringify({ moderation: [], reporters: [], notifications: snapshot, unreadCount: 1 }) }));
  }, notifications);
  await expect(panel.getByText('New live report', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
});

test('empty admin notifications explain where new updates will appear', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  await page.route('**/api/platform**', route => route.fulfill({ json: { user: { id: 'admin', name: 'Admin', role: 'admin', accountStatus: 'active' }, directory: [], moderation: [], audit: [], itineraryGenerations: [], notifications: [], notificationsUnreadCount: 0 } }));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/admin/dashboard');
  await page.getByRole('navigation', { name: 'Admin workspace' }).getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No notifications yet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark all read' })).toBeDisabled();
});
