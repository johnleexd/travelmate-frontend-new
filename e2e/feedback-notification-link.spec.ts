import { expect, test } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

test.beforeEach(async ({ page }) => { await mockPlanningLookups(page); });

const admin = { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', accountStatus: 'active', emailVerified: true };
const traveler = { ...admin, id: 'traveler', name: 'Test Traveler', email: 'traveler@example.test', role: 'traveler' };
const itinerary = { destination: 'Tokyo', totalBudget: 1000, currency: 'JPY', source: 'mock', days: [{ day: 1, date: '2026-10-10', theme: 'Explore Tokyo', imageUrl: '', totalCost: 100, activities: [{ time: '09:00', title: 'Museum visit', description: 'Visit a local museum.', estimatedCost: 100, category: 'activity', icon: 'map' }] }], budgetSummary: { accommodation: 0, food: 0, activities: 100, transport: 0, reserve: 100, dailyAverage: 100, total: 200 } };
const trip = { id: 'trip-1', userId: traveler.id, destination: 'Tokyo', budget: 1000, currency: 'JPY', startDate: '2026-10-10', endDate: '2026-10-10', travelers: 1, partyType: 'solo', interests: [], itinerary, weather: null, status: 'active', createdAt: '2026-10-05T12:00:00Z', updatedAt: '2026-10-05T12:00:00Z' };
const platform = (user = admin) => ({ user, directory: [admin, traveler], trips: [trip], listings: [], bookings: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {}, integrations: {} });

test('traveler feedback reaches admin history and exact notification details with read persistence', async ({ page, context, browser }) => {
  const travelerContext = await browser.newContext({ baseURL: 'http://localhost:3000', reducedMotion: 'reduce' });
  const travelerPage = await travelerContext.newPage();
  await mockPlanningLookups(travelerPage);
  let saved: Record<string, unknown> | null = null;
  let hideHistory = false;
  let notices: Array<Record<string, unknown>> = [];
  const posts: Record<string, unknown>[] = [];
  for (const [ctx, user] of [[context, admin], [travelerContext, traveler]] as const) {
    await ctx.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
    await ctx.addInitScript(() => {
      class Stream extends EventTarget { static streams: Stream[] = []; onerror = null; constructor() { super(); Stream.streams.push(this); } close() {} }
      Object.assign(window, { EventSource: Stream, feedbackStreams: Stream.streams });
    });
    await ctx.route('**/api/platform**', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON(); posts.push(body);
        notices = notices.map(n => body.action === 'mark-all-notifications-read' || n.id === body.id ? { ...n, readAt: new Date().toISOString() } : n);
        return route.fulfill({ json: { result: { id: body.id } } });
      }
      const unread = notices.filter(n => !n.readAt).length;
      if (route.request().url().includes('/notifications')) return route.fulfill({ json: { notifications: notices, unreadCount: unread } });
      return route.fulfill({ json: { ...platform(user), notifications: user.role === 'admin' ? notices : [], notificationsUnreadCount: unread } });
    });
    await ctx.route('**/api/feedback**', async route => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'POST') {
        const input = route.request().postDataJSON();
        expect(input.itineraryId).toBe(trip.id);
        saved = { ...input, id: 'feedback-exact', userId: traveler.id, user: traveler, itinerary: { id: trip.id, destination: trip.destination }, sentiment: 'not_analyzed', createdAt: new Date().toISOString() };
        notices = [{ id: 'notice-exact', userId: admin.id, title: 'New feedback received', body: traveler.name + ' rated their itinerary ' + input.rating + ' out of 5.', href: '/admin/dashboard?tab=feedback&category=feedback&feedbackId=feedback-exact', createdAt: new Date().toISOString() }];
        return route.fulfill({ status: 201, json: { result: saved } });
      }
      if (url.pathname.includes('/itinerary/')) return route.fulfill({ json: { result: saved } });
      if (url.pathname.endsWith('/itinerary')) return route.fulfill({ json: { itinerary: trip } });
      if (url.pathname.endsWith('/feedback-exact')) return route.fulfill({ json: { entry: saved } });
      if (url.pathname.endsWith('/missing')) return route.fulfill({ status: 404, json: { error: 'Feedback not found.' } });
      // A filtered history can exclude the clicked record; the detail lookup must still work.
      const entries = !hideHistory && saved && (!url.searchParams.get('rating') || url.searchParams.get('rating') === String(saved.rating)) ? [saved] : [];
      return route.fulfill({ json: { entries, total: entries.length, page: 1, pageSize: 10 } });
    });
  }
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/admin/dashboard');
    await travelerPage.goto('/dashboard');
    await travelerPage.getByRole('button', { name: 'Saved trips', exact: true }).click();
    await travelerPage.getByRole('button', { name: 'Rate this trip', exact: true }).click();
    const form = travelerPage.getByRole('form', { name: 'Feedback for Tokyo' });
    await form.getByRole('radio', { name: '4 stars', exact: true }).check();
    await form.getByLabel('Category', { exact: true }).selectOption('weather_info');
    const comment = 'The weather explanation helped us plan our museum visit.';
    await form.getByLabel('Feedback comment').fill(comment);
    await form.getByRole('button', { name: 'Submit Feedback', exact: true }).click();
    await expect(form.getByRole('status')).toContainText('Your feedback is saved');
    await page.evaluate(notifications => {
      const streams = (window as unknown as { feedbackStreams: EventTarget[] }).feedbackStreams;
      streams.at(-1)!.dispatchEvent(new MessageEvent('reports', { data: JSON.stringify({ moderation: [], reporters: [], notifications, unreadCount: 1 }) }));
    }, notices);
    await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Admin workspace' });
    await nav.getByRole('button', { name: 'User Feedback', exact: true }).click();
    await expect(page.getByRole('region', { name: 'User feedback records' })).toContainText(comment);
    await page.getByLabel('Rating', { exact: true }).selectOption('1');
    await expect(page.getByText('No feedback matches these filters. Travelers can submit feedback from their saved trips.')).toBeVisible();
    await page.getByRole('button', { name: 'Notifications, 1 unread', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Administration notifications' });
    await expect(panel.getByText('New feedback received', { exact: true })).toBeVisible();
    await page.getByRole('group', { name: 'Filter notifications' }).getByRole('button', { name: 'Feedback', exact: true }).click();
    await expect(panel.getByText('New feedback received', { exact: true })).toBeVisible();
    hideHistory = true;
    await panel.getByRole('button', { name: /New feedback received/ }).click();
    const modal = page.getByRole('dialog', { name: 'Feedback details' });
    await expect(modal).toContainText('Feedback ID: feedback-exact');
    await expect(page.getByText('No feedback matches these filters. Travelers can submit feedback from their saved trips.')).toBeVisible();
    await expect(modal).toContainText(traveler.name); await expect(modal).toContainText(traveler.email);
    await expect(modal).toContainText('4/5'); await expect(modal).toContainText('Weather');
    await expect(modal).toContainText(comment); await expect(modal).toContainText('Itinerary ID: trip-1');
    expect(posts[0]).toEqual({ action: 'mark-notification-read', id: 'notice-exact' });
    await expect(page).toHaveURL(/feedbackId=feedback-exact/);
    await page.reload(); await expect(modal).toContainText(comment);
    await page.getByRole('button', { name: 'Close feedback details' }).click();
    await expect(page).not.toHaveURL(/feedbackId=/);
    hideHistory = false;
    await page.getByRole('button', { name: 'Refresh feedback', exact: true }).click();
    await expect(page.getByRole('region', { name: 'User feedback records' })).toContainText(comment);
    await nav.getByRole('button', { name: 'Notifications', exact: true }).click();
    await expect(page.getByText('You’re all caught up. No unread updates.', { exact: true })).toBeVisible();
    await page.goto('/admin/dashboard?tab=feedback&feedbackId=missing');
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Feedback not found.');
    await expect(page.getByRole('region', { name: 'User feedback records' })).toContainText(comment);
  } finally { await travelerContext.close(); }
});
