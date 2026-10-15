import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import type { SavedTrip, ItineraryResponse } from '../lib/contracts';
import { isDailyAllowance } from '../lib/itinerary-day-presentation';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';
const folder = '../audit/2026-10-15/tokyo-day-one';
const capture = JSON.parse(readFileSync(folder + '/saved-capture.json', 'utf8')).trip;
const recorded = capture.itinerary as ItineraryResponse;
async function open(page: Page, context: BrowserContext, plan = structuredClone(recorded)) {
  await context.addCookies([{ name: 'travelmate_session', value: 'tokyo-read-only-ui-check', domain: 'localhost', path: '/' }]);
  await mockPlanningLookups(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // A deliberately unavailable image provider tests visibility independently of photos.
  await page.route('**/*', route => route.request().resourceType() === 'image' ? route.abort() : route.fallback());
  const writes: unknown[] = [];
  const trip = { ...capture, id: capture.id, userId: 'read-only-ui', budget: Number(capture.budget), startDate: capture.start_date, endDate: capture.end_date, createdAt: capture.created_at, updatedAt: capture.updated_at, itinerary: plan } as SavedTrip;
  await page.route('**/api/platform**', route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint.endsWith('/photos')) return route.fulfill({ json: { day: plan.days.find(day => day.day === route.request().postDataJSON().day) } });
    if (route.request().method() === 'POST') { writes.push(route.request().postDataJSON()); return route.fulfill({ status: 409, json: { error: 'Read-only diagnosis: updates prohibited.' } }); }
    if (endpoint.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (endpoint.endsWith('/trips/' + trip.id)) return route.fulfill({ json: { trip } });
    return route.fulfill({ json: { user: { id: trip.userId, name: 'Read-only trip verification', email: 'verification@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true }, trips: [{ ...trip, itinerary: null }], tripsPage: { total: 1, hasMore: false }, directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.goto('/dashboard?tab=planner&trip=' + trip.id + '&from=saved');
  await expect(page.locator('[data-daily-card]')).toHaveCount(plan.days.length);
  return { writes, plan };
}
test('exact saved Tokyo records match every overview and day-detail activity; allowances are separate, photos cannot hide entries', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  const state = await open(page, context);
  const cards = page.locator('[data-daily-card]');
  const rendered = [];
  for (const [index, day] of recorded.days.entries()) {
    const actual = day.activities.filter(item => !isDailyAllowance(item));
    const card = cards.nth(index);
    const titles = card.locator('[data-overview-activity-index] figure h4');
    await expect(titles).toHaveText(actual.map(item => item.title));
    await expect(card.getByText(`${actual.length} ${actual.length === 1 ? 'activity' : 'activities'} · 2 budget entries`, { exact: true })).toBeVisible();
    rendered.push({ day: day.day, stored: actual.length, overview: await titles.allTextContents(), allowances: day.activities.filter(isDailyAllowance).map(item => item.title) });
  }
  await expect(cards.first().locator('[data-overview-activity-index]')).toHaveCount(1);
  await expect(cards.first().getByRole('heading', { name: 'Visit Shinjuku Central Park', exact: true })).toBeVisible();
  await page.screenshot({ path: folder + '/tokyo-overview-desktop.png' });
  await cards.first().screenshot({ path: folder + '/tokyo-day-one.png', style: 'header, nextjs-portal { visibility: hidden !important; }' });
  for (let index = 0; index < recorded.days.length; index++) {
    await cards.nth(index).getByRole('button', { name: 'View day itinerary', exact: true }).click();
    const detail = page.locator('[data-day-details]');
    await expect(detail.locator('[data-activity-index]')).toHaveCount(rendered[index].stored);
    await expect(detail.locator('[data-activity-index]').locator('h4').filter({ hasText: /^Visit / }).filter({ hasNotText: /— details$/ })).toHaveText(rendered[index].overview);
    await detail.getByText('Budget entries & controls', { exact: true }).click();
    await expect(detail.locator('[data-budget-index]')).toHaveCount(2);
    await detail.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
    await expect(cards.nth(index)).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await cards.first().screenshot({ path: folder + '/tokyo-day-one-mobile.png', style: 'header, nextjs-portal { visibility: hidden !important; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload(); await expect(cards).toHaveCount(7);
  expect(state.writes).toEqual([]); expect(state.plan).toEqual(recorded);
  writeFileSync(folder + '/rendered-comparison.json', JSON.stringify({ tripId: capture.id, note: 'Captured live DB data in the running app; isolated API responses; image provider deliberately unavailable.', days: rendered, mutationRequests: state.writes }, null, 2));
});
test('all Tokyo places remain visible when stored photo URLs are absent', async ({ page, context }) => {
  const plan = structuredClone(recorded);
  for (const day of plan.days) {
    day.imageUrl = ''; delete day.imageAttribution;
    for (const activity of day.activities) { delete activity.imageUrl; delete activity.imageAttribution; }
  }
  const state = await open(page, context, plan);
  await expect(page.locator('[data-overview-activity-index]')).toHaveCount(19);
  await expect(page.locator('[data-overview-activity-index] [data-photo-unavailable]')).toHaveCount(19);
  await page.locator('[data-daily-card]').first().screenshot({ path: folder + '/tokyo-day-one-no-photo.png', style: 'header, nextjs-portal { visibility: hidden !important; }' });
  expect(state.writes).toEqual([]);
});
