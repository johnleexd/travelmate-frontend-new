import { expect, test } from '@playwright/test';
import path from 'node:path';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';
import type { ItineraryResponse, DayPlan } from '../lib/contracts';

// Deterministic UI/provider-outage coverage. Real provider/storage verification
// is recorded separately by verify-activity-photo-workflow.ts.
test('custom activities keep photos across notes edits, reject stale place responses, save without imagery and reopen', async ({ page, context }) => {
  test.setTimeout(90000);
  await mockPlanningLookups(page);
  await context.addCookies([{ name: 'travelmate_session', value: 'photo-lifecycle-fixture', domain: 'localhost', path: '/' }]);
  const photo = (id: string, illustrative = false) => ({ imageUrl: `https://images.unsplash.com/photo-${id}?ixid=recorded&w=1080`, imageAttribution: { provider: 'unsplash' as const, photoId: id, creator: 'Fixture photographer', photographerUrl: 'https://unsplash.com/@fixture?utm_source=travelmate&utm_medium=referral', sourceUrl: `https://unsplash.com/photos/${id}?utm_source=travelmate&utm_medium=referral`, license: 'Unsplash', licenseUrl: 'https://unsplash.com/license', downloadLocation: `https://api.unsplash.com/photos/${id}/download`, downloadTracked: true, illustrative, match: illustrative ? 'activity' as const : 'place' as const, photoType: illustrative ? 'illustrative' as const : 'place' as const } });
  let plan: ItineraryResponse = { destination: 'Paris, France', totalBudget: 1000, currency: 'EUR', travelers: 1, partyType: 'solo', source: 'catalog', days: [{ day: 1, date: '2040-01-01', theme: 'Paris visits', imageUrl: '', totalCost: 0, activities: [] }], budgetSummary: { accommodation: 0, food: 0, activities: 0, transport: 0, reserve: 1000, total: 1000, dailyAverage: 0 } };
  const trip = () => ({ id: 'photo-lifecycle', destination: plan.destination, itinerary: plan, budget: 1000, currency: 'EUR', travelers: 1, partyType: 'solo', interests: [], startDate: '2040-01-01', endDate: '2040-01-01', status: 'active', createdAt: '2026-10-13T00:00:00Z' });
  let searches = 0, saves = 0, delayOld = false, releaseOld: (() => void) | undefined;
  const enrich = (day: DayPlan) => ({ ...day, activities: day.activities.map(item => /Eiffel Tower/.test(item.title) ? { ...item, ...photo('eiffel') } : /Louvre Museum/.test(item.title) ? { ...item, ...photo('louvre') } : item.title === 'Lunch' ? { ...item, ...photo('lunch', true) } : item) });
  await page.route('https://images.unsplash.com/**', route => route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' }));
  await page.route('**/api/itinerary/images', async route => {
    searches++;
    const before = route.request().postDataJSON().day as DayPlan;
    if (delayOld && before.activities.some(item => item.title === 'Eiffel Tower')) await new Promise<void>(resolve => { releaseOld = resolve; });
    return route.fulfill({ json: { day: enrich(before), googlePhotos: {} } });
  });
  await page.route('**/api/platform**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/photos')) { searches++; plan.days = [enrich(plan.days[0])]; return route.fulfill({ json: { day: plan.days[0], persisted: true } }); }
    if (url.pathname.endsWith('/trips/photo-lifecycle')) return route.fulfill({ json: { trip: trip() } });
    if (route.request().method() === 'POST') {
      saves++; plan = route.request().postDataJSON().itinerary;
      // Provider-selected photos survive the server save. Empty lookups never
      // require a photo field or prevent the activity from being recorded.
      plan.days = [enrich(plan.days[0])];
      return route.fulfill({ json: { result: trip() } });
    }
    return route.fulfill({ json: { user: { id: 'photo-owner', name: 'UI Photo Tester', role: 'traveler', email: 'photo@example.test', accountStatus: 'active', emailVerified: true }, trips: [trip()], notifications: [], listings: [], bookings: [], directory: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [] } });
  });
  await page.goto('/dashboard'); await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  await page.locator('[data-daily-card]').getByRole('button', { name: 'View Itinerary', exact: true }).click();
  const details = page.locator('[data-day-details]');
  const add = async (title: string, category = 'activity') => {
    await details.getByRole('button', { name: 'Add activity', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Add custom activity', exact: true });
    await editor.getByLabel('Activity title').fill(title); await editor.getByLabel('Time', { exact: true }).fill('Flexible');
    await editor.getByLabel('Category').selectOption(category);
    await editor.getByRole('button', { name: 'Add activity', exact: true }).click();
    await expect(details.getByRole('heading', { name: title, exact: true })).toBeVisible();
  };
  delayOld = true; await add('Eiffel Tower');
  await expect.poll(() => !!releaseOld).toBe(true);
  await details.getByRole('button', { name: 'Edit Eiffel Tower', exact: true }).click();
  await page.getByLabel('Activity title').fill('Louvre Museum');
  await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  delayOld = false; releaseOld!();
  await expect(details.locator('img[data-photo-id="louvre"]').first()).toBeVisible();
  await expect(details.locator('img[data-photo-id="eiffel"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect.poll(() => saves).toBe(1);
  const beforeNotes = searches;
  await details.getByRole('button', { name: 'Edit Louvre Museum', exact: true }).click();
  await page.getByLabel('Description').fill('Bring a camera. Notes-only edit.');
  await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(details.locator('img[data-photo-id="louvre"]').first()).toBeVisible();
  expect(searches).toBe(beforeNotes);
  await add('Lunch', 'food'); await expect(details.locator('[data-activity-index="1"] [data-illustrative-photo]').first()).toBeVisible();
  await add('Unavailable private venue');
  expect(await details.locator('[data-activity-index="1"] img').getAttribute('data-photo-id')).toBe('lunch');
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click(); await expect.poll(() => saves).toBe(2);
  expect(plan.days[0].activities[2].imageUrl).toBeUndefined();
  await page.goto('/dashboard'); await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  await page.locator('[data-daily-card]').getByRole('button', { name: 'View Itinerary', exact: true }).click();
  await expect(details.locator('img[data-photo-id="louvre"]').first()).toBeVisible();
  await expect(details.getByRole('heading', { name: 'Unavailable private venue', exact: true })).toBeVisible();
  await expect(details.locator('[data-activity-index="2"]')).toContainText('Destination photo');
  await page.reload();
  await expect(details.locator('img[data-photo-id="louvre"]').first()).toBeVisible();
  await expect(details.getByRole('heading', { name: 'Unavailable private venue', exact: true })).toBeVisible();
  await details.locator('ol').screenshot({ path: '../audit/2026-10-13/activity-photo-workflow/fixture-reopened.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
