import { test, expect } from '@playwright/test';

test('planner generates and displays 1, 14, 21, 28 and 31 inclusive days; 32 is rejected', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'travelmate_session', value: 'duration-ui-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const user = { id: 'duration-traveler', name: 'Duration Test', email: 'duration@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
  await page.route('**/api/platform**', route => route.fulfill({ json: { user, directory: [user], trips: [], listings: [], bookings: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {}, integrations: {} } }));
  await page.route('**/api/locations?**', route => route.fulfill({ json: { locations: [{ id: 'paris', name: 'Paris', label: 'Paris, France', country: 'France', countryCode: 'FR', placeType: 'City', latitude: 48.8566, longitude: 2.3522, source: 'geonames' }] } }));
  await page.route('**/api/destination-context?**', route => route.fulfill({ json: { currency: 'EUR', currencySource: 'country-code', transportation: [], transportationMessage: '' } }));
  await page.route('**/api/destination-context/exchange-rate**', route => route.fulfill({ status: 503, json: { error: 'No rates in fixture' } }));
  const stayDates: URL[] = [];
  await page.route('**/api/accommodations?**', route => { stayDates.push(new URL(route.request().url())); return route.fulfill({ json: { configured: false, accommodations: [], nearbyAccommodations: [], message: 'Choose accommodation later.' } }); });
  await page.route('**/api/weather?**', route => route.fulfill({ status: 503, json: { error: 'Forecast unavailable' } }));
  const submitted: Record<string, unknown>[] = [];
  await page.route('**/api/itinerary', async route => {
    const body = route.request().postDataJSON(); submitted.push(body);
    const start = Date.parse(body.startDate); const count = (Date.parse(body.endDate) - start) / 86_400_000 + 1;
    await route.fulfill({ json: { destination: body.destination, totalBudget: body.budget, currency: 'EUR', travelers: 1, partyType: 'solo', source: 'openai', days: Array.from({ length: count }, (_, i) => ({ day: i + 1, date: new Date(start + i * 86_400_000).toISOString().slice(0, 10), theme: `Explore fixture day ${i + 1}`, imageUrl: '', totalCost: 30, activities: [{ time: '09:00 AM', title: `Fixture venue ${i + 1}`, description: 'Browser test fixture', estimatedCost: 30, category: 'activity', icon: 'map' }] })), budgetSummary: { accommodation: 34000, food: 22000, activities: 20000, transport: 14000, reserve: 10000, dailyAverage: body.budget / count, total: body.budget, plannedSpend: count * 30 } } });
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await page.getByRole('combobox', { name: 'Destination', exact: true }).fill('Paris');
  await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await page.getByLabel('Start date', { exact: true }).fill('2040-01-25');
  await page.getByLabel(/^Solo trip budget/).fill('100000');
  const endInput = page.getByLabel(/^End date/);
  await expect(endInput).toHaveAttribute('max', '2040-02-24');
  for (const count of [1, 14, 21, 28, 31]) {
    const end = new Date(Date.parse('2040-01-25') + (count - 1) * 86_400_000).toISOString().slice(0, 10);
    await endInput.fill(end);
    await expect(page.getByText(`${count} travel day${count === 1 ? '' : 's'} selected`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
    await expect(page.getByRole('heading', { name: `Explore fixture day ${count}`, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Explore fixture day / })).toHaveCount(count);
    await expect(page.getByText(`Forecast unavailable for ${end}.`, { exact: true })).toBeVisible();
    expect(submitted.at(-1)?.endDate).toBe(end);
  }
  await expect.poll(() => stayDates.at(-1)?.searchParams.get('checkOutDate')).toBe('2040-02-24');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Explore fixture day 31', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await endInput.fill('2040-02-25');
  await expect(page.getByText('Choose 1–31 days', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate my trip', exact: true })).toBeDisabled();
  expect(submitted.length).toBe(5);
});
