import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';
import type { ItineraryResponse } from '../lib/contracts';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/generated-daily-schedules.json', import.meta.url), 'utf8')) as Record<string, ItineraryResponse>;

async function openPlan(page: Page, context: BrowserContext, fixture: ItineraryResponse) {
  await context.addCookies([{ name: 'travelmate_session', value: 'generated-schedule-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await mockPlanningLookups(page);
  let itinerary = structuredClone(fixture);
  const writes: Record<string, unknown>[] = [];
  const trip = () => ({ id: 'schedule-trip', destination: itinerary.destination, budget: itinerary.totalBudget, currency: itinerary.currency, travelers: 2, partyType: 'couple', interests: [], startDate: '2040-01-25', endDate: '2040-01-27', createdAt: '2026-10-11T00:00:00Z', status: 'active', itinerary });
  await page.route('**/api/platform**', route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); writes.push(body); if (body.itinerary) itinerary = body.itinerary;
      return route.fulfill({ json: { result: trip() } });
    }
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (path.endsWith('/trips/schedule-trip')) return route.fulfill({ json: { trip: trip() } });
    return route.fulfill({ json: { user: { id: 'schedule-owner', name: 'Schedule tester', email: 'schedules@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true }, trips: [trip()], directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.goto('/dashboard'); await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  await expect(page.locator('[data-daily-card]')).toHaveCount(3);
  return { writes, current: () => itinerary };
}
test('actual scheduler output shows useful suggested schedules, break blocks and budgets on desktop/mobile', async ({ page, context }) => {
  const state = await openPlan(page, context, fixtures.sufficient);
  const cards = page.locator('[data-daily-card]');
  await page.getByText('Trip budget & sources', { exact: true }).click();
  await expect(page.getByText('Verified place catalog — AI scheduling unavailable', { exact: true })).toBeVisible();
  await page.getByText('Trip budget & sources', { exact: true }).click();
  for (const card of await cards.all()) {
    await card.getByRole('button', { name: 'View Itinerary', exact: true }).click();
    const detail = page.locator('[data-day-details]');
    await expect(detail.locator('[data-activity-index]')).toHaveCount(3);
    await expect(detail.locator('[data-budget-index]')).toHaveCount(2);
    await expect(detail.locator('ol')).toContainText('Suggested ·');
    await expect(detail.locator('ol')).toContainText('Meal break'); await expect(detail.locator('ol')).toContainText('Free time / rest');
    await expect(detail).toContainText('Europe/Paris'); await expect(detail).not.toContainText('End time not set');
    await expect(detail.locator('ol')).not.toContainText('Daily meals');
    for (const source of await detail.locator('[data-activity-index] details').all()) await expect(source).not.toHaveAttribute('open');
    await detail.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await cards.first().scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const card of await cards.all()) expect(await card.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await cards.locator('..').screenshot({ path: `../audit/2026-10-11/itinerary-two-views/schedules-${width}.png`, style: 'header { visibility: hidden; }' });
    await page.screenshot({ path: `../audit/2026-10-11/generation-fix/viewport-${width}.png`, style: 'header { visibility: hidden; }' });
  }
  const original = structuredClone(state.current().days[0].activities[0]);
  await cards.first().getByRole('button', { name: 'View Itinerary', exact: true }).click();
  const selected = page.locator('[data-day-details]');
  await selected.getByRole('button', { name: `Edit ${original.title}`, exact: true }).click();
  await page.getByLabel('Activity title').fill('User edited museum'); await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(selected.getByRole('heading', { name: 'User edited museum', exact: true })).toBeVisible();
  await expect(selected.locator('[data-schedule-block]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  const saved = state.writes.at(-1)?.itinerary as ItineraryResponse;
  expect(saved.days[0].activities[0]).toMatchObject({ id: original.id, title: 'User edited museum', durationMinutes: original.durationMinutes });
  // The saved trip/day URL now restores this selected day directly on refresh.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'User edited museum', exact: true })).toBeVisible();
  expect(state.writes.filter(write => write.action)).toHaveLength(1); // Photo refreshes do not save or regenerate an itinerary.
});
test('insufficient places stay incomplete and do not show empty days as intentionally free', async ({ page, context }) => {
  await openPlan(page, context, fixtures.limited);
  const cards = page.locator('[data-daily-card]');
  for (const card of await cards.all()) await expect(card.getByText('Incomplete itinerary — more places needed', { exact: true })).toBeVisible();
  const empty = cards.last();
  await empty.getByRole('button', { name: 'View Itinerary', exact: true }).click();
  await expect(page.locator('[data-day-details]').getByText('No activities scheduled', { exact: true })).toHaveCount(1);
  await expect(empty).not.toContainText('Free day'); await expect(empty).not.toContainText('Rest day selected');
  await page.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  expect((await empty.locator('[data-photo-unavailable]').locator('..').boundingBox())!.height).toBeLessThan(90);
});
test('explicit rest and travel buffers are distinct from provider coverage failures', async ({ page, context }) => {
  await openPlan(page, context, fixtures.bounded);
  const cards = page.locator('[data-daily-card]');
  await expect(cards.nth(1).getByText('Rest day selected by you', { exact: true })).toBeVisible();
  await cards.nth(1).getByRole('button', { name: 'View Itinerary', exact: true }).click();
  await expect(page.locator('[data-day-details]').getByText('No activities scheduled', { exact: true })).toHaveCount(1);
  await expect(cards.nth(1)).not.toContainText('Incomplete itinerary');
  await page.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  await cards.first().getByRole('button', { name: 'View Itinerary', exact: true }).click();
  await expect(page.locator('[data-day-details] ol')).toContainText('3:30 PM');
  await page.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  await cards.last().getByRole('button', { name: 'View Itinerary', exact: true }).click();
  await expect(page.locator('[data-day-details] ol')).toContainText('9:00 AM');
});
