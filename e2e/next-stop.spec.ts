import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import type { DayActivity, ItineraryResponse } from '../lib/contracts';

const points = [
  { latitude: 35.6801, longitude: 139.7601 },
  { latitude: 35.6811, longitude: 139.7611 },
  { latitude: 35.6821, longitude: 139.7621 },
];
const user = { id: 'next-stop-browser', name: 'Route Test', email: 'route@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const activity = (index: number): DayActivity => ({
  title: `Visit ${String.fromCharCode(65 + index)}`, time: ['09:00 AM', '11:00 AM', '02:00 PM'][index],
  category: 'activity', icon: 'map-pin', description: 'Recorded stop for controlled route verification.', estimatedCost: (index + 1) * 10,
  durationMinutes: 60, travelMinutes: 15,
  place: { provider: 'wikidata', placeId: `Q${100 + index}`, name: `Place ${String.fromCharCode(65 + index)}`,
    sourceUrl: `https://www.wikidata.org/wiki/Q${100 + index}`, ...points[index], city: 'Tokyo', country: 'Japan', countryCode: 'JP',
    fetchedAt: '2026-10-15T00:00:00Z', address: 'Recorded address', openingHours: 'Confirm opening hours' },
});

async function setup(page: Page, context: BrowserContext, kind: 'supported' | 'failure' | 'unconfigured' | 'invalid-transit' | 'missing' = 'supported') {
  await context.addCookies([{ name: 'travelmate_session', value: 'next-stop-browser', domain: 'localhost', path: '/' }]);
  const plan: ItineraryResponse = { destination: 'Tokyo, Japan', totalBudget: 1000, currency: 'JPY', travelers: 1, partyType: 'solo',
    preferences: { travelStyle: 'comfort', transportation: 'legacy jeepney choice', accommodation: 'no preference', interests: ['food'], activities: ['museum'] },
    days: [
      { day: 1, date: '2040-01-25', theme: 'Recorded stops', imageUrl: '', totalCost: 130, activities: [activity(0), activity(1), activity(2), { title: 'Daily transport allowance', time: 'Daily allowance', category: 'transport', icon: 'bus', description: 'Historical budget, counted once.', estimatedCost: 70 }] },
      { day: 2, date: '2040-01-26', theme: 'One stop', imageUrl: '', totalCost: 10, activities: [activity(0)] },
    ], budgetSummary: { accommodation: 0, food: 0, activities: 70, transport: 70, reserve: 860, dailyAverage: 70, total: 140 },
  };
  if (kind === 'missing') delete plan.days[0].activities[1].place;
  const trip = { id: 'next-stop-trip', userId: user.id, destination: plan.destination, destinationCity: 'Tokyo', destinationCountry: 'Japan', destinationCountryCode: 'JP', latitude: points[0].latitude, longitude: points[0].longitude, startDate: '2040-01-25', endDate: '2040-01-26', budget: 1000, currency: 'JPY', travelers: 1, partyType: 'solo', interests: ['historical'], status: 'active', createdAt: '2026-10-15T00:00:00Z', itinerary: plan };
  const state = { requests: [] as Array<{ origin: typeof points[number]; destination: typeof points[number] }>, writes: 0, generations: 0 };
  await page.route('**/api/platform**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/photos')) return route.fulfill({ status: 503, json: { error: 'Photos isolated.' } });
    if (route.request().method() !== 'GET') state.writes++;
    return route.fulfill({ json: path === '/api/platform/trips/next-stop-trip' ? { trip } : { user, trips: [trip], listings: [], bookings: [], notifications: [], itineraryVersions: [], itineraryGenerations: [], directory: [], moderation: [], audit: [] } });
  });
  await page.route('**/api/itinerary', route => { state.generations++; return route.fulfill({ status: 500, json: { error: 'Saved trips must not regenerate.' } }); });
  await page.route('**/api/weather**', route => route.fulfill({ status: 503, json: { error: 'Weather isolated.' } }));
  await page.route('**/api/destination-context?**', route => route.fulfill({ status: 503, json: { error: 'Context isolated.' } }));
  await page.route('**/api/navigation/next-stop', route => {
    const body = route.request().postDataJSON(); state.requests.push(body);
    if (kind === 'failure') return route.fulfill({ status: 502, json: { error: 'Routing provider unavailable.' } });
    const walking = body.origin.latitude === points[0].latitude;
    const option = (mode: string, distanceMeters: number, durationSeconds: number) => ({ mode, distanceMeters, durationSeconds, provider: 'osrm', fetchedAt: '2026-10-16T00:00:00Z', fare: { amount: 999, currency: 'JPY' } });
    return route.fulfill({ json: { ...body, options: kind === 'unconfigured' ? [] : kind === 'invalid-transit' ? [option('transit', 500, 120)] : walking ? [option('walking', 600, 480)] : [option('walking', 5000, 3600), option('driving', 900, 240)] } });
  });
  return { state, trip };
}

const url = '/dashboard?tab=planner&trip=next-stop-trip&day=1&from=saved';
const cards = (page: Page) => page.locator('[data-day-details] [data-next-stop]');
function endpoint(href: string) { const query = new URL(href).searchParams; return [query.get('origin'), query.get('destination'), query.get('travelmode')]; }

test('detailed days use supported routes, exact directions endpoints, no final/allowance card and unchanged expenses', async ({ page, context }) => {
  const { state, trip } = await setup(page, context);
  const original = structuredClone(trip);
  await page.goto(url);
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).nth(0)).toContainText('Walking may suit this leg');
  await expect(cards(page).nth(0)).toContainText('600 m · 8 min estimated');
  await expect(cards(page).nth(1)).toContainText('Driving route available. Taxi availability needs local confirmation.');
  await expect(cards(page).nth(1)).toContainText('900 m · 4 min estimated');
  await expect(cards(page).nth(1)).toContainText('Long walk; consider local transport');
  for (const card of await cards(page).all()) {
    await expect(card).toContainText('Fare unavailable; confirm locally.');
    await expect(card).not.toContainText('999');
    await expect(card.getByRole('link', { name: '© OpenStreetMap contributors' })).toBeVisible();
  }
  expect(endpoint((await cards(page).nth(0).getByRole('link', { name: /View directions/ }).getAttribute('href'))!)).toEqual(['35.6801,139.7601', '35.6811,139.7611', 'walking']);
  expect(endpoint((await cards(page).nth(1).getByRole('link', { name: /View directions/ }).getAttribute('href'))!)).toEqual(['35.6811,139.7611', '35.6821,139.7621', 'driving']);
  const budget = page.getByRole('region', { name: 'Day 1 daily budget' });
  await expect(budget.locator('dl')).toContainText(/transportJPY\s*70/);
  await expect(budget.locator('dl')).toContainText(/TotalJPY\s*130/);
  await expect(page.locator('[data-next-stop][aria-label*="Daily transport"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Full details', exact: true }).click();
  await expect(page.getByRole('dialog').locator('[data-next-stop]')).toHaveCount(2);
  await expect(page.getByRole('dialog').locator('[data-next-stop]').first()).toContainText('Walking may suit this leg');
  expect(state.requests).toHaveLength(2);
  await page.getByRole('button', { name: 'Close day details', exact: true }).click();
  const direct = cards(page).first().getByRole('link', { name: /View directions/ });
  await direct.focus(); await expect(direct).toBeFocused();
  await context.route('https://www.google.com/maps/dir/**', route => route.fulfill({ body: 'Google Maps endpoint reached.' }));
  const popupPromise = context.waitForEvent('page');
  await direct.press('Enter');
  const popup = await popupPromise; await popup.waitForLoadState();
  expect(popup.url()).toContain('https://www.google.com/maps/dir/');
  expect(endpoint(popup.url())).toEqual(['35.6801,139.7601', '35.6811,139.7611', 'walking']);
  await popup.close();
  await page.reload();
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first()).toContainText('Walking may suit this leg');
  expect(trip).toEqual(original); expect(state.writes).toBe(0); expect(state.generations).toBe(0);
  await page.setViewportSize({ width: 390, height: 1000 });
  await cards(page).first().scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await cards(page).first().screenshot({ path: 'test-results/next-stop-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.locator('[data-day-details]').screenshot({ path: 'test-results/next-stop-desktop.png' });
});

for (const kind of ['failure', 'unconfigured', 'invalid-transit', 'missing'] as const) test(`${kind} routing keeps saved days usable with honest direct-map fallback`, async ({ page, context }) => {
  const { state } = await setup(page, context, kind);
  await page.goto(url);
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first()).toContainText('Check route and local transport options.');
  for (const card of await cards(page).all()) {
    await expect(card).not.toContainText(/min estimated|Walking may suit|Driving route available|999/);
    const href = (await card.getByRole('link', { name: /View directions/ }).getAttribute('href'))!;
    expect(new URL(href).searchParams.get('travelmode')).toBeNull();
    if (kind === 'missing') { expect(href).toBe('https://www.google.com/maps/dir/?api=1'); await expect(card).toContainText('Exact location missing.'); }
    else expect(new URL(href).searchParams.get('origin')).toBeTruthy();
  }
  if (kind === 'missing') expect(state.requests).toHaveLength(0);
  expect(state.writes).toBe(0); expect(state.generations).toBe(0);
  await page.goto(url.replace('day=1', 'day=2'));
  await expect(page.locator('[data-day-details]')).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
});

test('activity reordering, edits, removal and addition update only affected route guidance', async ({ page, context }) => {
  const { state, trip } = await setup(page, context);
  await page.goto(url);
  await expect(cards(page).first()).toContainText('Walking may suit this leg');
  await expect.poll(() => state.requests.length).toBe(2);
  await page.getByRole('button', { name: 'Move Visit B earlier', exact: true }).click();
  await expect(cards(page).first()).toHaveAttribute('aria-label', 'Travel from Visit B to Visit A');
  await expect.poll(() => state.requests.length).toBe(4);
  expect(state.requests.slice(2)).toEqual(expect.arrayContaining([{ origin: points[1], destination: points[0] }, { origin: points[0], destination: points[2] }]));
  await expect(page.getByRole('region', { name: 'Day 1 daily budget' }).locator('dl')).toContainText(/TotalJPY\s*130/);
  await page.getByRole('button', { name: 'Edit Visit A', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Activity title', { exact: true }).fill('Custom changed stop');
  await page.getByRole('dialog').getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first()).toContainText('Exact location missing.');
  await expect(cards(page).nth(1)).toContainText('Exact location missing.');
  expect(state.requests).toHaveLength(4);
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Remove Custom changed stop', exact: true }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toHaveAttribute('aria-label', 'Travel from Visit B to Visit C');
  expect(state.requests).toHaveLength(4); // B→C was already fetched; reuse its cached evidence.
  await page.getByRole('button', { name: 'Add activity', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Activity title', { exact: true }).fill('New manual stop');
  await editor.getByLabel('Time', { exact: true }).fill('05:00 PM');
  await editor.getByLabel('Estimated group cost (JPY)', { exact: true }).fill('0');
  await editor.getByRole('button', { name: 'Add activity', exact: true }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).nth(1)).toHaveAttribute('aria-label', 'Travel from Visit C to New manual stop');
  await expect(cards(page).nth(1)).toContainText('Exact location missing.');
  expect(state.writes).toBe(0); expect(state.generations).toBe(0);
  expect(trip.itinerary.preferences?.transportation).toBe('legacy jeepney choice');
});
