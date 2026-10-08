import { expect, test } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

test('maps remain separate from visits, visited history retries work, and preferences are accessible', async ({ page, context }) => {
  await mockPlanningLookups(page);
  await context.addCookies([{ name: 'travelmate_session', value: 'visited-fixture', domain: 'localhost', path: '/' }]);
  const activity = { title: 'Visit Eiffel Tower', time: '09:00', durationMinutes: 60, travelMinutes: 0, description: 'Visit the tower.', category: 'activity', icon: 'map', estimatedCost: 10,
    place: { provider: 'wikidata', placeId: 'Q243', name: 'Eiffel Tower', city: 'Paris', country: 'France', countryCode: 'FR', latitude: 48.8584, longitude: 2.2945, address: 'Champ de Mars' } };
  const plan = { destination: 'Paris, France', totalBudget: 1000, currency: 'EUR', source: 'openai', days: [{ day: 1, date: '2040-01-01', theme: 'Paris sights', imageUrl: '', totalCost: 10, activities: [activity] }], budgetSummary: { accommodation: 0, food: 0, activities: 10, transport: 0, reserve: 990, dailyAverage: 10, total: 1000 } };
  const trip = { id: 'visit-trip', userId: 'visited-fixture', destination: plan.destination, budget: 1000, currency: 'EUR', startDate: '2040-01-01', endDate: '2040-01-01', travelers: 1, partyType: 'solo', interests: ['culture'], status: 'completed', itinerary: plan };
  const user = { id: 'visited-fixture', name: 'Visited Tester', email: 'visited@example.test', role: 'traveler', emailVerified: true, accountStatus: 'active' };
  let records = 0, failRecord = true, failHistory = true;
  const visits: Array<Record<string, unknown>> = [];
  await page.route('**/api/platform**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.endsWith('/visited-places')) {
      if (failHistory) return route.fulfill({ status: 503, json: { error: 'History is temporarily unavailable.' } });
      return route.fulfill({ json: { visits, page: { total: visits.length, hasMore: false } } });
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      if (body.action === 'record-visit') {
        records++; expect(body.tripId).toBe(trip.id); expect(body.activityTitle).toBe(activity.title); expect(body.placeId).toBe('Q243');
        if (failRecord) return route.fulfill({ status: 503, json: { error: 'Visit could not be saved. Try again.' } });
        const visit = { id: 'visit-1', tripId: trip.id, name: 'Eiffel Tower', placeKey: 'wikidata:Q243', destination: plan.destination, visitDate: body.visitDate, latitude: 48.8584, longitude: 2.2945, createdAt: new Date().toISOString() };
        visits.push(visit); return route.fulfill({ json: { result: { visit, alreadyRecorded: false } } });
      }
      if (body.action === 'remove-visit') { visits.splice(0); return route.fulfill({ json: { result: { removed: true } } }); }
      throw new Error(`Unexpected action ${body.action}`);
    }
    return route.fulfill({ json: { user, trips: [trip], directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await context.route('https://www.google.com/maps/**', route => route.fulfill({ body: '<p>Map destination</p>', contentType: 'text/html' }));
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
  await page.getByRole('button', { name: 'Completed 1', exact: true }).click();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByText('60 min', { exact: true })).toBeVisible();
  const map = page.getByRole('link', { name: 'Visit Eiffel Tower on Google Maps (opens a new tab)', exact: true });
  await expect(map).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=48.8584%2C2.2945');
  const popupWait = page.waitForEvent('popup'); await map.click(); const popup = await popupWait;
  await popup.waitForLoadState(); expect(new URL(popup.url()).searchParams.get('query')).toBe('48.8584,2.2945'); await popup.close();
  expect(records).toBe(0); expect(visits.length).toBe(0);
  await page.getByRole('button', { name: 'Mark as visited', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record a visit', exact: true });
  await expect(dialog.getByLabel('Visit date', { exact: true })).toBeFocused();
  await dialog.getByLabel('Visit date', { exact: true }).fill('2020-01-01');
  await dialog.getByRole('button', { name: 'Mark as visited', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Try again');
  failRecord = false;
  await dialog.getByRole('button', { name: 'Mark as visited', exact: true }).click();
  await expect(dialog).toHaveCount(0); expect(visits.length).toBe(1);
  await page.getByRole('button', { name: 'Full details', exact: true }).click();
  const detail = page.getByRole('dialog').first();
  await detail.getByRole('button', { name: 'Mark as visited', exact: true }).click();
  await expect(dialog).toBeVisible(); await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(detail).toBeVisible(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Visited places', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'History is temporarily unavailable' })).toContainText('History is temporarily unavailable');
  failHistory = false; await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Eiffel Tower', exact: true })).toBeVisible();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: '../audit/2026-10-08/planning-visited/visited-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Remove visit to Eiffel Tower', exact: true }).click();
  await page.getByRole('button', { name: 'Remove visit', exact: true }).click();
  await expect(page.getByText('No visits yet.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
  await page.getByRole('button', { name: 'Completed 1', exact: true }).click();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'Add activity', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add custom activity', exact: true });
  await editor.getByLabel('Activity title', { exact: true }).fill('Custom museum visit');
  await editor.getByLabel('Time', { exact: true }).fill('09:30');
  await editor.getByLabel('Duration (minutes)', { exact: true }).fill('45');
  await editor.getByRole('button', { name: 'Add activity', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'overlaps the previous visit' })).toBeVisible();
  await expect(editor).toBeVisible();
  await editor.getByLabel('Time', { exact: true }).fill('11:00');
  await editor.getByLabel('Location (optional, entered by you)', { exact: true }).fill('Paris, France');
  await editor.getByRole('button', { name: 'Add activity', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole('button', { name: 'Move Visit Eiffel Tower later', exact: true }).click();
  const ordered = page.getByRole('list', { name: 'Day 1 activities', exact: true }).getByRole('listitem');
  await expect(ordered.first()).toContainText('Custom museum visit');
  await expect(ordered.last()).toContainText('10:00');
  await expect(ordered.last().getByRole('button', { name: 'Mark as visited', exact: true })).toBeDisabled();
  await expect(ordered.last().getByRole('link', { name: 'Visit Eiffel Tower on Google Maps (opens a new tab)', exact: true })).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=48.8584%2C2.2945');
  await page.setViewportSize({ width: 390, height: 844 });
  await ordered.first().scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '../audit/2026-10-08/planning-visited/itinerary-mobile.png' });
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByLabel('Travel pace', { exact: true }).selectOption('relaxed');
  await page.getByRole('button', { name: 'Continue planning', exact: true }).click();
  await expect(page.getByLabel('Travel pace', { exact: true })).toHaveValue('relaxed');
  await expect(page.getByRole('combobox', { name: 'Starting location (optional)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Feedback', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Feedback about a trip', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Book as lead|Book now|Subscribe|Checkout/i })).toHaveCount(0);
});
