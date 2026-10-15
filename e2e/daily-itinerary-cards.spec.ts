import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

const photo = 'https://upload.wikimedia.org/wikipedia/commons/6/6e/The_Hachiko_statue_at_Shibuya%2C_Tokyo%2C_Japan.jpg';
const attribution = { creator: 'Fixture photographer', license: 'CC BY-SA 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fixture.jpg' };
const allowance = (category: string, amount: number) => ({ title: `Daily ${category === 'food' ? 'meals' : 'transport'} in Manila`, time: 'Daily allowance', category, icon: category, description: 'Planning allowance; confirm actual costs.', estimatedCost: amount });
const place = { provider: 'wikidata', placeId: 'Q1', name: 'Museum', city: 'Manila', country: 'Philippines', countryCode: 'PH', latitude: 14.6, longitude: 120.98, address: 'Museum address', openingHours: 'Not available', sourceUrl: 'https://www.wikidata.org/wiki/Q1', fetchedAt: '2040-10-08T00:00:00Z' };
const plan = {
  destination: 'Manila, Philippines', currency: 'PHP', totalBudget: 10000, travelers: 1, partyType: 'solo', source: 'mock',
  accommodation: { listingId: 'fixture-stay', name: 'Recorded stay', address: 'Manila', nights: 2, nightlyRate: 1500, total: 3000, currency: 'PHP' },
  budgetSummary: { accommodation: 3000, food: 500, activities: 200, transport: 800, reserve: 5500, total: 10000, dailyAverage: 1125, plannedSpend: 4500 },
  days: [
    { day: 1, date: '2040-10-08', theme: 'Recorded places', imageUrl: photo, imageAttribution: attribution, totalCost: 2350, rideFare: 400, travelNote: 'Coordinate checks and calculation methods need confirmation.', crowdLevel: 'low', crowdNote: 'Calendar estimate, not live foot traffic.', crowdFetchedAt: '2040-10-08T00:00:00Z', activities: [
      allowance('food', 250),
      { title: 'Museum visit', time: '11:00', durationMinutes: 60, description: 'Explore the recorded exhibits. Confirm venue access and opening hours before travelling.', estimatedCost: 200, category: 'activity', icon: 'map', place, imageUrl: photo, imageAttribution: attribution, priceEvidence: { status: 'estimate', source: 'budget-allowance', unit: 'per-person', quantity: 1, participants: 1, unitAmount: 200, currency: 'PHP', basis: 'Recorded allowance, admission needs confirmation.', needsConfirmation: true, fetchedAt: '2040-10-08T00:00:00Z', sourceUrl: 'https://example.test/price-source' } },
      { title: 'Heritage walk', time: '09:00 AM – 09:30 AM', description: 'Walk around the historic district.', estimatedCost: 0, category: 'activity', icon: 'map' },
      allowance('transport', 400),
    ] },
    { day: 2, date: '2040-10-09', theme: 'Details need confirmation', imageUrl: '', totalCost: 2150, travelNote: 'No additional supported attraction data is available.', activities: [allowance('food', 250), allowance('transport', 400)] },
    { day: 3, date: '2040-10-10', theme: 'Unscheduled visit', imageUrl: '', totalCost: 0, activities: [{ title: 'Visit without a time', time: 'Flexible', description: 'An actual saved visit.', estimatedCost: 0, category: 'activity', icon: 'map' }, { title: 'Start only visit', time: '14:00', description: '', estimatedCost: 0, category: 'activity', icon: 'map' }] },
    { day: 4, date: '2040-10-11', theme: 'Unscheduled day', imageUrl: '', totalCost: 0, activities: [] },
  ],
};

async function setup(page: Page, context: BrowserContext, inputPlan = plan) {
  await context.addCookies([{ name: 'travelmate_session', value: 'daily-card-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPlanningLookups(page);
  await page.route('**/_next/image?**', route => route.fulfill({ path: path.resolve('public/cordova-nalusuan.png'), contentType: 'image/png' }));
  const itinerary = structuredClone(inputPlan);
  const weather = { source: 'mock', city: 'Manila', country: 'PH', temperature: 28, feelsLike: 29, humidity: 70, windSpeed: 2, description: 'Cloudy', alerts: [], forecastAvailable: true, forecast: [{ date: '2040-10-08', tempMin: 26, tempMax: 30, description: 'Thunderstorm', icon: '', iconUrl: '', precipitationProbability: 100, weatherAlert: 'Thunderstorm risk: consider indoor alternatives.' }], fetchedAt: '2040-10-08T00:00:00Z', refreshAfter: '2040-10-08T01:00:00Z', freshness: { status: 'fresh', isStale: false }, crowd: [] };
  const state = { writes: [] as Record<string, unknown>[], itinerary };
  const trip = () => ({ id: 'daily-card-trip', destination: itinerary.destination, currency: 'PHP', budget: 10000, travelers: 1, partyType: 'solo', interests: [], startDate: '2040-10-08', endDate: '2040-10-11', status: 'active', createdAt: '2040-10-08T00:00:00Z', itinerary: state.itinerary, weather });
  await page.route('**/api/platform**', route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); state.writes.push(body);
      if (body.action === 'record-visit') return route.fulfill({ json: { result: { alreadyRecorded: false } } });
      if (body.itinerary) state.itinerary = body.itinerary;
      return route.fulfill({ json: { result: trip() } });
    }
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint.endsWith('/notifications')) return route.fulfill({ json: { notifications: [] } });
    if (endpoint.endsWith('/trips/daily-card-trip')) return route.fulfill({ json: { trip: trip() } });
    return route.fulfill({ json: { user: { id: 'daily-card-owner', name: 'Card Tester', email: 'cards@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true }, trips: [trip()], directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open the saved plan', exact: true }).click();
  await expect(page.locator('[data-daily-card]')).toHaveCount(inputPlan.days.length);
  return state;
}


test('overview and selected day are separate responsive views with recorded accommodation and sources', async ({ page, context }) => {
  await setup(page, context);
  const cards = page.locator('[data-daily-card]');
  const first = cards.first();
  const details = page.locator('[data-day-details]');
  await expect(page.getByRole('heading', { name: 'Your trip itinerary', exact: true })).toBeVisible();
  await expect(page.locator('[data-itinerary-workspace]')).toContainText('Manila, Philippines');
  await expect(first.locator('[data-activity-index]')).toHaveCount(0);
  await expect(first.getByRole('heading', { name: 'Day 1', exact: true })).toBeVisible();
  await expect(first.getByText('Thunderstorm risk: consider indoor alternatives.', { exact: true })).toBeVisible();
  await expect(first.getByRole('link', { name: 'Photo: Fixture photographer', exact: true }).first()).toBeVisible();
  const stay = page.getByText('Your accommodation', { exact: true }).locator('..').locator('..');
  const stayDetails = stay.locator('details');
  await stayDetails.locator('summary').focus(); await page.keyboard.press('Enter');
  await expect(stayDetails).toContainText('PHP 3,000.00');
  const stayMap = stayDetails.getByRole('link', { name: 'View on map', exact: true }).first();
  await expect(stayMap).toHaveAttribute('href', /google[.]com[/]maps/);
  await context.route('https://www.google.com/maps/**', route => route.fulfill({ body: 'Fixture accommodation map' }));
  const stayPopupPromise = page.waitForEvent('popup'); await stayMap.click();
  const stayPopup = await stayPopupPromise; expect(new URL(stayPopup.url()).searchParams.get('query')).toContain('Recorded stay'); await stayPopup.close();
  await stayDetails.locator('summary').click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await first.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await Promise.all((await cards.all()).map(card => card.boundingBox()));
    for (let index = 1; index < bounds.length; index++) {
      expect(bounds[index]!.x).toBeCloseTo(bounds[0]!.x, 0);
      expect(bounds[index]!.width).toBeCloseTo(bounds[0]!.width, 0);
      expect(bounds[index]!.y).toBeGreaterThan(bounds[index - 1]!.y + bounds[index - 1]!.height);
    }
    await page.screenshot({ path: '../audit/2026-10-11/itinerary-two-views/overview-page-' + width + '.png' });
    await page.locator('[data-itinerary-workspace]').screenshot({ path: '../audit/2026-10-11/itinerary-two-views/overview-' + width + '.png', style: 'header, nextjs-portal { display: none !important; }' });
  }
  const view = first.getByRole('button', { name: 'View day itinerary', exact: true });
  await view.focus(); await page.keyboard.press('Enter');
  await expect(details.getByRole('heading', { name: 'Day 1: Recorded places', exact: true })).toBeFocused();
  await expect(first).toBeHidden();
  await expect(details.locator('ol > [data-activity-index] h4').filter({ hasText: /^(Museum visit|Heritage walk)$/ })).toHaveText(['Museum visit', 'Heritage walk']);
  await expect(details.locator('ol')).toContainText('11:00 AM');
  await expect(details.locator('ol')).toContainText('9:00 AM');
  const budget = details.getByRole('region', { name: 'Day 1 daily budget' });
  await expect(budget).toContainText('PHP 250.00'); await expect(budget).toContainText('PHP 400.00'); await expect(budget).toContainText('PHP 1,500.00');
  await expect(budget.locator('[data-photo-unavailable]')).toHaveCount(0);
  const source = details.locator('[data-activity-index="1"] details');
  await source.locator('summary').focus(); await page.keyboard.press('Enter');
  await expect(source).toContainText('Recorded allowance, admission needs confirmation.');
  await expect(source.getByRole('link', { name: 'Price source' })).toHaveAttribute('href', 'https://example.test/price-source');
  await source.locator('summary').click();
  const daySources = details.locator(':scope > details');
  await daySources.locator('summary').click();
  await expect(daySources).toContainText('PHP 850.00 + Accommodation allocation: PHP 1,500.00 = PHP 2,350.00');
  await daySources.locator('summary').click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await details.locator('h2').evaluate(element => element.scrollIntoView({ block: 'start' }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await details.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: '../audit/2026-10-11/itinerary-two-views/details-page-' + width + '.png' });
    await details.screenshot({ path: '../audit/2026-10-11/itinerary-two-views/details-' + width + '.png', style: 'header, nextjs-portal { display: none !important; }' });
  }
  await details.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  await expect(view).toBeFocused(); await expect(first).toBeVisible(); await expect(details).toHaveCount(0);
  await cards.nth(1).getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await expect(details.getByText('No activities scheduled', { exact: true })).toBeVisible();
  await expect(details).not.toContainText('Free day');
  await details.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  await cards.nth(2).getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await expect(details).toContainText('Time not set'); await expect(details).toContainText('End time not set');
});

test('day map, visit, budget edit, activity edit, reorder, remove, add, save and reopen retain original handlers', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.locator('[data-daily-card]').first().getByRole('button', { name: 'View day itinerary', exact: true }).click();
  const first = page.locator('[data-day-details]');
  const map = first.getByRole('link', { name: 'Visit Museum on Google Maps (opens a new tab)' });
  await expect(map).toHaveAttribute('href', /query=14.6%2C120.98/);
  await context.route('https://www.google.com/maps/**', route => route.fulfill({ body: 'Fixture map' }));
  const popupPromise = page.waitForEvent('popup'); await map.click(); const popup = await popupPromise; await popup.close();
  await first.locator('[data-activity-index="1"]').getByRole('button', { name: 'Mark as visited' }).click();
  await page.getByRole('dialog', { name: 'Record a visit' }).getByRole('button', { name: 'Mark as visited', exact: true }).click();
  await expect(first.getByText('Visit saved to your personal history.', { exact: true })).toBeVisible();
  expect(state.writes.find(row => row.action === 'record-visit')).toMatchObject({ action: 'record-visit', dayIndex: 0, activityIndex: 1, activityTitle: 'Museum visit' });
  await first.getByText('Budget entries & controls', { exact: true }).click();
  await first.getByRole('button', { name: 'Edit Daily meals in Manila', exact: true }).click();
  await expect(page.getByLabel('Activity title')).toHaveValue('Daily meals in Manila');
  await page.getByRole('button', { name: 'Close activity editor' }).click();
  await first.getByRole('button', { name: 'Edit Museum visit', exact: true }).click();
  await expect(page.getByLabel('Activity title')).toHaveValue('Museum visit');
  await page.getByRole('button', { name: 'Close activity editor' }).click();
  await first.getByRole('button', { name: 'Move Museum visit earlier', exact: true }).click();
  await expect(first.locator('[data-activity-index="0"] h4').first()).toHaveText('Museum visit');
  await expect(first.getByRole('button', { name: 'Move Museum visit earlier', exact: true })).toBeDisabled();
  await first.getByRole('button', { name: 'Move Museum visit later', exact: true }).click();
  await expect(first.locator('[data-activity-index="1"] h4').first()).toHaveText('Museum visit');
  page.once('dialog', dialog => dialog.accept());
  await first.getByRole('button', { name: 'Remove Heritage walk', exact: true }).click();
  await expect(first.getByRole('heading', { name: 'Heritage walk', exact: true })).toHaveCount(0);
  await first.getByRole('button', { name: 'Edit Museum visit', exact: true }).click();
  await page.getByLabel('Activity title').fill('Updated museum visit');
  await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(first.getByRole('heading', { name: 'Updated museum visit', exact: true })).toBeVisible();
  await first.getByRole('button', { name: 'Add activity', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add custom activity' })).toBeVisible();
  await page.getByRole('button', { name: 'Close activity editor' }).click();
  await first.getByRole('button', { name: 'Full details', exact: true }).click();
  const photoDialog = page.getByRole('dialog', { name: /Day 1:/ });
  await expect(photoDialog).toBeVisible();
  await expect(photoDialog).toContainText('Activity 1 of 1');
  await expect(photoDialog.getByRole('region', { name: 'Budget allowances' })).toContainText('Daily meals in Manila');
  await expect(photoDialog.getByRole('region', { name: 'Budget allowances' }).locator('[data-photo-unavailable]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close day details' }).click();
  await page.getByRole('button', { name: 'Update saved trip', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Trip updated successfully' })).toBeVisible();
  expect(state.writes.filter(row => row.action).at(-1)?.action).toBe('update-trip-itinerary');
  await page.reload();
  await expect(first).toBeVisible(); // The explicit trip/day route survives refresh.
  await expect(first.getByRole('heading', { name: 'Updated museum visit', exact: true })).toBeVisible();
  expect(state.writes.filter(row => row.action)).toHaveLength(2);
});

test('overview keeps all activity cards and details keep every activity with honest missing prices', async ({ page, context }) => {
  const recorded = plan.days[0];
  const visits = [1, 2, 3, 4].map(number => ({ ...recorded.activities[1], title: 'Recorded visit ' + number, place: { ...place, name: 'Recorded place ' + number }, imageUrl: photo + '?recorded=' + number }));
  const input = { ...plan, days: [{ ...recorded, activities: [visits[0], visits[0], { ...visits[3], estimatedCost: 0, imageUrl: 'https://example.test/unverified.jpg', priceEvidence: { status: 'unavailable', source: 'budget-allowance', unit: 'per-person', quantity: 1, participants: 1, unitAmount: 0, currency: 'PHP', basis: 'No provider price was available.', needsConfirmation: true, fetchedAt: '2040-10-08T00:00:00Z' } }, ...visits.slice(1)] }] };
  await setup(page, context, input);
  const card = page.locator('[data-daily-card]');
  await expect(card.locator('[data-overview-activity-index]')).toHaveCount(6);
  await expect(card.locator('[data-overview-activity-index] figure h4')).toHaveText(input.days[0].activities.map(item => item.title));
  await expect(card.locator('figure').getByRole('link', { name: /^Photo:/ })).toHaveCount(6);
  await expect(card.locator('figure').getByRole('link', { name: 'CC BY-SA 4.0', exact: true })).toHaveCount(6);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await card.screenshot({ path: '../audit/2026-10-11/itinerary-two-views/gallery-' + width + '.png', style: 'header, nextjs-portal { display: none !important; }' });
  }
  await card.getByRole('button', { name: 'View day itinerary', exact: true }).click();
  const details = page.locator('[data-day-details]');
  await expect(details.locator('[data-activity-index]')).toHaveCount(6);
  await expect(details.getByRole('button', { name: 'Edit Recorded visit 4', exact: true })).toHaveCount(2);
  const unavailable = details.locator('[data-activity-index="2"]');
  await expect(unavailable).toContainText('Price unavailable');
  await expect(unavailable).not.toContainText('PHP 0.00');
  await details.getByRole('button', { name: 'Full details', exact: true }).click();
  const photoDialog = page.getByRole('dialog', { name: /Day 1:/ });
  await expect(photoDialog).toContainText('Price unavailable');
  await expect(photoDialog).not.toContainText('PHP 0.00');
  await expect(photoDialog).toContainText('Ride/boat fare PHP 400.00');
  await page.getByRole('button', { name: 'Close day details' }).click();
  await details.getByRole('button', { name: 'Back to itinerary', exact: true }).click();
  await expect(card).toBeVisible(); await expect(details).toHaveCount(0);
});

test('all 31 days appear chronologically without changing underlying day edit indexes', async ({ page, context }) => {
  const days = Array.from({ length: 31 }, (_, index) => ({ ...plan.days[0], day: index + 1, date: '2040-10-' + String(index + 1).padStart(2, '0'), theme: 'Recorded day ' + (index + 1) })).reverse();
  await setup(page, context, { ...plan, days });
  const cards = page.locator('[data-daily-card]');
  for (let index = 0; index < 31; index++) await expect(cards.nth(index).locator('time').first()).toHaveAttribute('dateTime', [...days].reverse()[index].date);
  await cards.first().getByRole('button', { name: 'View day itinerary', exact: true }).click();
  await page.locator('[data-day-details]').getByRole('button', { name: 'Edit Museum visit', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Edit activity' })).toContainText('Day 1');
  await expect(page.getByLabel('Activity title')).toHaveValue('Museum visit');
  await page.getByRole('button', { name: 'Close activity editor', exact: true }).click();
});
