import { expect, test } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

test.beforeEach(async ({ page }) => { await mockPlanningLookups(page); });

const admin = { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', accountStatus: 'active', emailVerified: true };
const traveler = { ...admin, id: 'traveler', name: 'Test Traveler', email: 'traveler@example.test', role: 'traveler' };
const itinerary = { destination: 'Tokyo', totalBudget: 1000, currency: 'JPY', source: 'mock', days: [{ day: 1, date: '2026-10-10', theme: 'Explore Tokyo', imageUrl: '', totalCost: 100, activities: [{ time: '09:00', title: 'Museum visit', description: 'Visit a local museum.', estimatedCost: 100, category: 'activity', icon: 'map' }] }], budgetSummary: { accommodation: 0, food: 0, activities: 100, transport: 0, reserve: 100, dailyAverage: 100, total: 200 } };
const trip = { id: 'trip-1', userId: traveler.id, destination: 'Tokyo', budget: 1000, currency: 'JPY', startDate: '2026-10-10', endDate: '2026-10-10', travelers: 1, partyType: 'solo', interests: [], itinerary, weather: null, status: 'active', createdAt: '2026-10-05T12:00:00Z', updatedAt: '2026-10-05T12:00:00Z' };
const platform = (user = admin) => ({ user, directory: [admin, traveler], trips: [trip], listings: [], bookings: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {}, integrations: {} });

test('admin feedback filters, paginates and opens read-only itinerary details in the current responsive layout', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/platform**', route => route.fulfill({ json: platform() }));
  const entries = Array.from({ length: 12 }, (_, index) => ({ id: `feedback-${index + 1}`, userId: traveler.id, itineraryId: trip.id, user: index === 1 ? null : traveler, itinerary: index === 1 ? null : { id: trip.id, destination: trip.destination }, rating: index === 0 ? 2 : 5, sentiment: index === 0 ? 'negative' : 'positive', category: 'budget_accuracy', comment: index === 0 ? 'The budget estimate was too high.\n'.repeat(30) : `Helpful itinerary feedback ${index + 1}.`, createdAt: '2026-10-05T12:00:00Z' }));
  const queries: URLSearchParams[] = [];
  let rejectList = false;
  let rejectTrip = true;
  await page.route('**/api/feedback**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/itinerary')) {
      if (rejectTrip) return route.fulfill({ status: 503, json: { error: 'Itinerary temporarily unavailable.' } });
      return route.fulfill({ json: { itinerary: trip } });
    }
    const params = url.searchParams;
    queries.push(params);
    if (rejectList) return route.fulfill({ status: 503, json: { error: 'Feedback temporarily unavailable.' } });
    const filtered = entries.filter(entry => (!params.get('rating') || String(entry.rating) === params.get('rating')) && (!params.get('sentiment') || entry.sentiment === params.get('sentiment')) && (!params.get('from') || entry.createdAt.slice(0, 10) >= params.get('from')!) && (!params.get('to') || entry.createdAt.slice(0, 10) <= params.get('to')!));
    const currentPage = Number(params.get('page') || 1);
    return route.fulfill({ json: { entries: filtered.slice((currentPage - 1) * 10, currentPage * 10), total: filtered.length, page: currentPage, pageSize: 10 } });
  });
  await page.goto('/admin/dashboard');
  await page.getByRole('navigation', { name: 'Admin workspace' }).getByRole('button', { name: 'User Feedback', exact: true }).click();
  await expect(page.getByText('Showing 1–10 of 12 feedback entries', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: '2 out of 5 stars' })).toBeVisible();
  await expect(page.getByText('Deleted user', { exact: true })).toBeVisible();
  await expect(page.getByText('Itinerary unavailable', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Showing 11–12 of 12 feedback entries', { exact: true })).toBeVisible();
  await page.getByLabel('Rating', { exact: true }).selectOption('2');
  await expect(page.getByText('Showing 1–1 of 1 feedback entries', { exact: true })).toBeVisible();
  expect(queries.at(-1)!.get('page')).toBe('1');
  await page.getByLabel('Search feedback', { exact: true }).fill('budget');
  await expect.poll(() => queries.at(-1)?.get('q')).toBe('budget');
  await page.getByLabel('Search feedback', { exact: true }).fill('');
  await page.getByLabel('Sentiment', { exact: true }).selectOption('positive');
  await expect(page.getByText('Showing 0–0 of 0 feedback entries', { exact: true })).toBeVisible();
  await page.getByLabel('Sentiment', { exact: true }).selectOption('negative');
  await page.getByRole('button', { name: 'Date filters', exact: true }).click();
  await page.getByLabel('From date').fill('2026-10-05');
  await page.getByLabel('To date').fill('2026-10-05');
  await expect(page.getByText('Showing 1–1 of 1 feedback entries', { exact: true })).toBeVisible();
  expect(queries.at(-1)!.get('from')).toBe('2026-10-05');
  expect(queries.at(-1)!.get('to')).toBe('2026-10-05');
  await page.getByLabel('From date').fill('2026-10-06');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Start date cannot be after end date.');
  await page.getByLabel('From date').fill('2026-10-05');
  await expect(page.getByText('Showing 1–1 of 1 feedback entries', { exact: true })).toBeVisible();
  rejectList = true;
  await page.getByRole('button', { name: 'Refresh feedback' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Feedback temporarily unavailable.');
  rejectList = false;
  await page.getByRole('button', { name: 'Retry feedback' }).click();
  await expect(page.getByText('Showing 1–1 of 1 feedback entries', { exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/feedback-admin-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 850 });
  await page.screenshot({ path: 'test-results/feedback-table-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 850 });
  await page.getByRole('button', { name: 'View details for feedback from Test Traveler' }).click();
  const dialog = page.getByRole('dialog', { name: 'Feedback details' });
  await expect(dialog.getByRole('button', { name: 'Close feedback details' })).toBeFocused();
  await expect(dialog.getByRole('alert')).toContainText('Itinerary temporarily unavailable.');
  rejectTrip = false;
  await dialog.getByRole('button', { name: 'Retry itinerary' }).click();
  await expect(dialog.getByText('Museum visit', { exact: true })).toBeVisible();
  await expect(dialog.getByText(entries[0].comment, { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Save|Edit|Remove|Add activity|Move|Book/ })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 700 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/feedback-admin-mobile.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View details for feedback from Test Traveler' })).toBeFocused();
});

test('traveler submits feedback for a saved itinerary and can retry a failed submission', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/platform**', route => route.fulfill({ json: platform(traveler) }));
  let reject = true;
  let submissions = 0;
  let saved: Record<string, unknown> | null = null;
  await page.route('**/api/feedback/itinerary/*', route => route.fulfill({ json: { result: saved } }));
  await page.route('**/api/feedback', route => {
    submissions++;
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ itineraryId: trip.id, rating: 3, category: 'weather_info', comment: 'Weather explanations could be clearer.' });
    if (reject) return route.fulfill({ status: 503, json: { error: 'Feedback service unavailable.' } });
    saved = { ...route.request().postDataJSON(), id: 'feedback-1', sentiment: 'not_analyzed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return route.fulfill({ status: 201, json: { result: saved } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
  await page.getByRole('button', { name: 'Rate this trip', exact: true }).click();
  const form = page.getByRole('form', { name: 'Feedback for Tokyo' });
  await form.getByRole('radio', { name: '3 stars', exact: true }).check();
  await form.getByLabel('Category', { exact: true }).selectOption('weather_info');
  await form.getByLabel('Feedback comment').fill('Weather explanations could be clearer.');
  await form.getByRole('button', { name: 'Submit Feedback', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('Feedback service unavailable.');
  await expect(form.getByLabel('Feedback comment')).toHaveValue('Weather explanations could be clearer.');
  reject = false;
  await form.getByRole('button', { name: 'Submit Feedback', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Your feedback is saved and available to the admin.');
  await expect(form.getByLabel('Feedback comment')).toHaveValue('Weather explanations could be clearer.');
  expect(submissions).toBe(2);
  await page.getByRole('button', { name: 'Rate this trip', exact: true }).click();
  await page.getByRole('button', { name: 'Rate this trip', exact: true }).click();
  await expect(form.getByRole('radio', { name: '3 stars', exact: true })).toBeChecked();
  await expect(form.getByRole('button', { name: 'Update Feedback', exact: true })).toBeVisible();
  await form.getByRole('button', { name: 'Update Feedback', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Your feedback is saved');
  expect(submissions).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/feedback-traveler-mobile.png', fullPage: true });
});

test('feedback HTTP routes enforce authentication', async ({ request }) => {
  for (const path of ['/api/feedback', '/api/feedback/missing', '/api/feedback/missing/itinerary', '/api/feedback/itinerary/missing']) expect((await request.get(path, { headers: { 'x-request-id': 'e2e-expected-auth-denial-get' } })).status()).toBe(401);
  expect((await request.post('/api/feedback', { headers: { 'x-request-id': 'e2e-expected-auth-denial-post' }, data: { itineraryId: 'missing', rating: 5, category: 'weather_info', comment: 'Test feedback comment.' } })).status()).toBe(401);
});

test('feedback list stays readable on desktop and mobile with server search', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/platform**', route => route.fulfill({ json: platform() }));
  const entries = [
    { id: 'clean-1', user: { ...traveler, name: 'Avery Kim' }, itinerary: { id: trip.id, destination: 'Tokyo, Japan' }, rating: 5, sentiment: 'positive', category: 'budget_accuracy', comment: 'The budget view made every estimate easy to understand. I felt confident refining our itinerary.' },
    { id: 'clean-2', user: { ...traveler, name: 'Noah Williams' }, itinerary: { id: trip.id, destination: 'Kyoto, Japan' }, rating: 3, sentiment: 'neutral', category: 'weather_info', comment: 'Great starting point, but I wanted more activity alternatives for rainy days.' },
    { id: 'clean-3', user: { ...traveler, name: 'Mia Chen' }, itinerary: { id: trip.id, destination: 'Bali, Indonesia' }, rating: 2, sentiment: 'not_analyzed', category: 'route_efficiency', comment: 'One day felt too packed for our family, though the accommodation suggestions were useful.' },
  ].map(row => ({ ...row, userId: traveler.id, itineraryId: trip.id, createdAt: '2026-10-07T10:00:00Z' }));
  await page.route('**/api/feedback**', route => {
    const q = new URL(route.request().url()).searchParams.get('q')?.toLowerCase() || '';
    const filtered = entries.filter(row => [row.comment, row.user.name, row.itinerary.destination].some(value => value.toLowerCase().includes(q)));
    return route.fulfill({ json: { entries: filtered, total: filtered.length, page: 1, pageSize: 10 } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin/dashboard?tab=feedback');
  const records = page.getByRole('region', { name: 'User feedback records' });
  await expect(records.getByRole('listitem')).toHaveCount(3);
  await expect(records.getByRole('table')).toHaveCount(0);
  await expect(records.getByRole('button', { name: /View details/ })).toHaveCount(3);
  await page.screenshot({ path: '../audit/2026-10-07/feedback-list-desktop.png', fullPage: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await records.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../audit/2026-10-07/feedback-list-mobile.png', fullPage: true });
  await page.getByLabel('Search feedback', { exact: true }).fill('Noah');
  await expect(records.getByRole('listitem')).toHaveCount(1);
  await expect(records).toContainText('Noah Williams');
  await page.getByLabel('Search feedback', { exact: true }).fill('nothing matches');
  await expect(page.getByRole('heading', { name: 'No feedback found' })).toBeVisible();
});
