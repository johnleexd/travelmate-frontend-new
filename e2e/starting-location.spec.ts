import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { searchDestinationIndex } from '../../travelmate-backend-api/src/services/destination/destination-index.ts';

async function setup(page: Page, context: BrowserContext) {
  await context.addCookies([{ name: 'travelmate_session', value: 'origin-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let user = { id: 'origin-user-a', name: 'Origin User A', email: 'a@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true, profileStatus: 'verified', trustScore: 0 };
  const workspace = () => ({ user, trips: [], listings: [], bookings: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], directory: [user], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {}, integrations: {} });
  await page.route('**/api/platform**', route => route.fulfill({ json: workspace() }));
  await page.route('**/api/profile', route => { user = { ...user, id: 'origin-user-b', name: 'Origin User B', email: 'b@example.test' }; return route.fulfill({ json: { user } }); });
  await page.route('**/api/locations?**', route => route.fulfill({ json: { locations: searchDestinationIndex(new URL(route.request().url()).searchParams.get('q')!) } }));
  await page.route('**/api/destination-context?**', route => route.fulfill({ json: { currency: 'EUR', currencySource: 'country-code', transportation: [], transportationMessage: '' } }));
  for (const path of ['**/api/accommodations?**', '**/api/destination-context/exchange-rate**']) await page.route(path, route => route.fulfill({ status: 503, json: { error: 'Provider isolated in browser test.' } }));
  const comparisons: URL[] = [];
  await page.route('**/api/travel-options?**', route => {
    comparisons.push(new URL(route.request().url()));
    const now = new Date().toISOString();
    const freshness = (source: string) => ({ source, status: 'unavailable', isStale: false, fetchedAt: now, expiresAt: now, staleUntil: now, policy: 'Fixture' });
    return route.fulfill({ json: { fetchedAt: now, provider: { name: 'amadeus', configured: false, isLive: false }, flights: [], activities: [], flightMessage: 'Fixture: no live flight offers', activityMessage: 'Fixture: no activity offers', freshness: { flights: freshness('flights'), activities: freshness('activities') } } });
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Starting location (optional)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use my current location', exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Destination', exact: true }).fill('Berlin');
  await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await page.getByRole('button', { name: 'Travel options', exact: true }).click();
  return { comparisons };
}

test('permissioned browser location populates the origin; worldwide manual changes send new coordinates', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']); await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 });
  const reverseRequests: URL[] = [];
  await page.route('**/api/locations/current?**', route => {
    const url = new URL(route.request().url()); reverseRequests.push(url);
    return route.fulfill({ json: { location: { id: -1, name: 'Paris', region: 'Ile-de-France', country: 'France', countryCode: 'FR', latitude: 48.8566, longitude: 2.3522, label: 'Paris, Ile-de-France, France', placeType: 'Current location', contextLabel: 'Current location' } } });
  });
  const { comparisons } = await setup(page, context);
  const origin = page.getByRole('combobox', { name: 'Starting location or departure airport', exact: true });
  await expect(origin).toHaveValue(''); await expect(origin).toHaveAttribute('placeholder', 'Enter your starting city or use your current location.');
  expect(reverseRequests.length).toBe(0);
  await page.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await expect(origin).toHaveValue('Paris, Ile-de-France, France');
  expect(reverseRequests[0].searchParams.get('latitude')).toBe('48.8566'); expect(reverseRequests[0].searchParams.get('longitude')).toBe('2.3522');
  await page.getByRole('button', { name: 'Compare prices', exact: true }).click();
  await expect.poll(() => comparisons.length).toBe(1);
  expect(comparisons[0].searchParams.get('originLatitude')).toBe('48.8566'); expect(comparisons[0].searchParams.get('originCountryCode')).toBe('FR');
  const compareOrigin = page.getByRole('combobox', { name: 'Starting location or departure airport', exact: true });
  for (const [city, countryCode] of [['Tokyo', 'JP'], ['Cape Town', 'ZA'], ['Toronto, Canada', 'CA']]) {
    await compareOrigin.fill(city);
    const option = page.locator('#comparison-origin-suggestions').getByRole('option').first();
    await expect(option).toContainText(city.split(',')[0]);
    await option.getByRole('button').click();
    await page.getByRole('button', { name: 'Compare prices', exact: true }).click();
    await expect.poll(() => comparisons.at(-1)?.searchParams.get('originCountryCode')).toBe(countryCode);
    expect(comparisons.at(-1)?.searchParams.get('originLatitude')).not.toBe('48.8566');
  }
  // Editing the selected name must discard its old coordinates.
  await compareOrigin.fill('My manually entered city');
  await page.getByRole('button', { name: 'Compare prices', exact: true }).click();
  await expect.poll(() => comparisons.at(-1)?.searchParams.get('origin')).toBe('My manually entered city');
  expect(comparisons.at(-1)?.searchParams.has('originLatitude')).toBe(false);
  expect(comparisons.at(-1)?.searchParams.has('originCountryCode')).toBe(false);
});

test('denied permission and reverse lookup failure preserve manual entry; late detection cannot overwrite edits', async ({ page, context }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_success: unknown, error: (value: unknown) => void) => error({ code: 1 }) } }));
  let reverseRequests = 0;
  await page.route('**/api/locations/current?**', route => { reverseRequests++; return route.fulfill({ status: 503, json: { error: 'Reverse lookup unavailable.' } }); });
  await setup(page, context);
  const origin = page.getByRole('combobox', { name: 'Starting location or departure airport', exact: true });
  await origin.fill('My starting city');
  await page.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await expect(page.getByText(/Location permission was denied/)).toBeVisible(); await expect(origin).toHaveValue('My starting city');
  expect(reverseRequests).toBe(0);
  await page.evaluate(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success: (value: unknown) => void) => success({ coords: { latitude: 35.68, longitude: 139.69 } }) } }));
  await page.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await expect(page.getByText(/Reverse lookup unavailable.*enter your starting city manually/)).toBeVisible(); await expect(origin).toHaveValue('My starting city');
  await page.evaluate(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success: unknown) => { (window as unknown as { originSuccess: unknown }).originSuccess = success; } } }));
  await page.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await origin.fill('Paris');
  await page.locator('#comparison-origin-suggestions').getByRole('option').first().getByRole('button').click();
  const selected = await origin.inputValue();
  await page.evaluate(() => (window as unknown as { originSuccess: (value: unknown) => void }).originSuccess({ coords: { latitude: 1, longitude: 2 } }));
  await expect(origin).toHaveValue(selected); expect(reverseRequests).toBe(1);
});

test('an account change clears the previous origin and discards a pending geolocation result', async ({ page, context }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success: unknown) => { (window as unknown as { originSuccess: unknown }).originSuccess = success; } } }));
  let reverseRequests = 0;
  await page.route('**/api/locations/current?**', route => { reverseRequests++; return route.fulfill({ status: 503, json: { error: 'Unexpected old-account location request' } }); });
  await setup(page, context);
  await page.getByRole('combobox', { name: 'Starting location or departure airport', exact: true }).fill('Toronto, Canada');
  await page.locator('#comparison-origin-suggestions').getByRole('option').first().getByRole('button').click();
  await page.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await page.getByRole('button', { name: /Open profile menu/ }).click();
  await page.getByRole('button', { name: 'Account settings', exact: true }).click();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('button', { name: /Open profile menu.*Origin User B/ })).toBeVisible();
  await page.getByRole('button', { name: 'Travel options', exact: true }).click();
  const origin = page.getByRole('combobox', { name: 'Starting location or departure airport', exact: true });
  await expect(origin).toHaveValue('');
  await page.evaluate(() => (window as unknown as { originSuccess: (value: unknown) => void }).originSuccess({ coords: { latitude: 43.65, longitude: -79.38 } }));
  await expect(origin).toHaveValue(''); expect(reverseRequests).toBe(0);
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(storage).not.toContain('Toronto'); expect(storage).not.toContain('-79.38');
});
