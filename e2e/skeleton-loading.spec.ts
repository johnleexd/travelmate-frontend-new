import { expect, test, type Page } from '@playwright/test';

const user = { id: 'skeleton-traveler', name: 'Test Traveler', email: 'traveler@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const workspace = { user, trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [], directory: [], moderation: [], audit: [] };

function requestGate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
});

test('workspace skeleton resolves to real content and retry recovers from a failed request', async ({ page }) => {
  const first = requestGate();
  const retry = requestGate();
  let fail = true;
  await page.route('**/api/platform**', async route => {
    if (fail) {
      await first.promise;
      await route.fulfill({ status: 503, json: { error: 'Workspace temporarily unavailable.' } });
    } else {
      await retry.promise;
      await route.fulfill({ json: workspace });
    }
  });
  await page.goto('/dashboard');
  const loading = page.getByRole('status', { name: 'Loading your TravelMate workspace...' });
  await expect(loading).toBeVisible();
  await expect(loading.locator('button, input')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/skeleton-desktop.png' });
  first.release();
  await expect(page.getByRole('alert', { name: 'Workspace unavailable' })).toContainText('Workspace temporarily unavailable.');
  await expect(loading).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(loading).toBeVisible();
  retry.release();
  await expect(page.getByRole('heading', { name: 'Your travel home' })).toBeVisible();
  await expect(loading).toHaveCount(0);
  await page.getByRole('button', { name: 'Saved trips', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved trips', exact: true })).toBeVisible();
  await expect(loading).toHaveCount(0);
});

test('mobile planner skeleton fits the viewport and respects reduced motion', async ({ page }) => {
  const gate = requestGate();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/platform**', async route => { await gate.promise; await route.fulfill({ json: workspace }); });
  await page.goto('/dashboard?tab=planner');
  const loading = page.getByRole('status', { name: 'Loading your TravelMate workspace...' });
  await expect(loading).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const animations = await loading.locator('[aria-hidden="true"]').evaluateAll(elements => elements.map(element => getComputedStyle(element).animationName));
  expect(animations.every(name => name === 'none')).toBe(true);
  await page.screenshot({ path: 'test-results/skeleton-mobile.png' });
  gate.release();
  await expect(page.getByRole('heading', { name: 'Start a new trip', exact: true })).toBeVisible();
  await expect(loading).toHaveCount(0);
});

test('admin uses its dashboard skeleton until the overview is ready', async ({ page }) => {
  const gate = requestGate();
  await page.route('**/api/platform**', async route => { await gate.promise; await route.fulfill({ json: { ...workspace, user: { ...user, role: 'admin' } } }); });
  await page.goto('/admin/dashboard');
  const loading = page.getByRole('status', { name: 'Loading the admin control room...' });
  await expect(loading).toBeVisible();
  gate.release();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(loading).toHaveCount(0);
});

async function preparePlanner(page: Page) {
  await page.route('**/api/platform**', route => route.fulfill({ json: workspace }));
  await page.route('**/api/locations?**', route => route.fulfill({ json: { locations: [{ id: 1, name: 'Cebu City', region: 'Cebu', country: 'Philippines', countryCode: 'PH', latitude: 10.3157, longitude: 123.8854, label: 'Cebu City, Cebu, Philippines' }] } }));
  await page.route('**/api/destination-context?**', route => route.fulfill({ json: { currency: 'PHP', currencySource: 'country-code', transportation: [], transportationMessage: 'No verified options available.' } }));
  await page.route('**/api/weather?**', route => route.fulfill({ status: 503, json: { error: 'Weather temporarily unavailable.' } }));
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await page.getByRole('combobox', { name: 'Destination', exact: true }).fill('Cebu');
  await page.getByRole('option', { name: /Cebu City/ }).getByRole('button').click();
  await expect(page.getByText('Confirmed: Cebu City, Cebu, Philippines')).toBeVisible();
}

test('search skeletons clear after empty accommodation results and a provider error', async ({ page }) => {
  const stays = requestGate();
  const offers = requestGate();
  await page.route('**/api/accommodations?**', async route => { await stays.promise; await route.fulfill({ json: { accommodations: [], message: 'No available stays.' } }); });
  await page.route('**/api/travel-options?**', async route => {
    await offers.promise;
    await route.fulfill({ status: 503, json: { error: 'Travel providers temporarily unavailable.' } });
  });
  await preparePlanner(page);
  await expect(page.getByRole('status').filter({ hasText: 'Loading relevant accommodation...' })).toBeVisible();
  stays.release();
  await expect(page.getByText('No available stays.')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Loading relevant accommodation...' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Travel options', exact: true }).click();
  await page.getByLabel('Starting location or departure airport').fill('Manila');
  await page.getByRole('button', { name: 'Compare prices', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Loading flight offers...' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading activity options...' })).toBeVisible();
  await expect(page.getByText('Run a comparison to retrieve flight offers.')).toHaveCount(0);
  offers.release();
  await expect(page.getByText('Travel providers temporarily unavailable.')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading flight offers...' })).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Loading activity options...' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Compare prices', exact: true })).toBeEnabled();
});

test('itinerary generation skeleton stops after a provider failure and permits retry', async ({ page }) => {
  const generation = requestGate();
  await page.route('**/api/accommodations?**', route => route.fulfill({ json: { accommodations: [], message: '' } }));
  await page.route('**/api/itinerary', async route => { await generation.promise; await route.fulfill({ status: 503, json: { error: 'Itinerary provider temporarily unavailable.' } }); });
  await preparePlanner(page);
  await page.getByRole('spinbutton', { name: /Solo trip budget/ }).fill('10000');
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Generating your itinerary...' })).toBeVisible();
  generation.release();
  await expect(page.getByRole('alert').filter({ hasText: 'Itinerary provider temporarily unavailable.' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Generating your itinerary...' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry generation', exact: true })).toBeEnabled();
});

test('profile inputs stay visible while a save is pending', async ({ page }) => {
  const save = requestGate();
  await page.route('**/api/platform**', route => route.fulfill({ json: workspace }));
  await page.route('**/api/profile', async route => { await save.promise; await route.fulfill({ json: { user: { ...user, name: 'Updated Traveler' } } }); });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open profile menu for Test Traveler' }).click();
  await page.getByRole('button', { name: 'Account settings' }).click();
  await page.getByLabel('Full name').fill('Updated Traveler');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('button', { name: 'Saving changes...' })).toBeDisabled();
  await expect(page.getByLabel('Full name')).toHaveValue('Updated Traveler');
  await expect(page.getByRole('navigation', { name: 'Traveler workspace' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading your TravelMate workspace...' })).toHaveCount(0);
  save.release();
  await expect(page.getByText('Profile updated.')).toBeVisible();
});

test('account detail skeleton gives way to a retryable error', async ({ page }) => {
  const gate = requestGate();
  await page.route('**/api/account/appeal', async route => { await gate.promise; await route.fulfill({ status: 503, json: { error: 'Account details temporarily unavailable.' } }); });
  await page.goto('/account/appeal');
  await expect(page.getByRole('status', { name: 'Loading account details...' })).toBeVisible();
  gate.release();
  await expect(page.getByRole('alert').filter({ hasText: 'Account details temporarily unavailable.' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading account details...' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
});
