import { expect, test } from '@playwright/test';

const user = { id: 'theme-traveler', name: 'Theme Traveler', email: 'theme@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const workspace = { user, trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [], directory: [], moderation: [], audit: [] };
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'theme-fixture', domain: 'localhost', path: '/' }]);
});

test('feedback reload and retry keep the traveler theme and responsive workspace shell', async ({ page }) => {
  let pending = gate();
  let fail = false;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/platform**', async route => {
    await pending.promise;
    await route.fulfill(fail ? { status: 503, json: { error: 'Temporary workspace failure.' } } : { json: workspace });
  });
  await page.goto('/dashboard?tab=feedback');
  const skeleton = page.locator('[data-workspace-skeleton="traveler"]');
  await expect(skeleton).toHaveCount(1);
  await expect(skeleton).toBeVisible();
  await expect(skeleton).toHaveCSS('background-color', 'rgb(247, 245, 239)');
  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(skeleton.locator('header > div')).toHaveCSS('background-color', 'rgb(255, 254, 250)');
  }
  const loadingHeader = await skeleton.locator('header > div').boundingBox();
  await expect(skeleton.locator('[style]').first()).toHaveCSS('background-color', 'rgb(216, 225, 215)');
  await expect(skeleton.locator('[style]').first()).toHaveCSS('animation-name', 'none');
  pending.release();
  await expect(page.getByRole('heading', { name: 'Feedback and support', exact: true })).toBeVisible();
  const loadedHeader = await page.locator('.traveler-dashboard header > div').boundingBox();
  expect(loadedHeader?.x).toBe(loadingHeader?.x);
  expect(loadedHeader?.width).toBe(loadingHeader?.width);

  pending = gate();
  fail = true;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(skeleton).toHaveCount(1);
  await expect(skeleton).toBeVisible();
  await expect(skeleton).toHaveCSS('background-color', 'rgb(247, 245, 239)');
  pending.release();
  const alert = page.getByRole('alert', { name: 'Workspace unavailable' });
  await expect(alert).toBeVisible();
  await expect(alert).toHaveCSS('background-color', 'rgb(255, 254, 250)');
  await expect(alert.locator('..')).toHaveCSS('background-color', 'rgb(247, 245, 239)');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Feedback and support', exact: true })).toBeVisible();
});

test('accommodation portal fits small and landscape viewports during loading and selection', async ({ page }) => {
  const pending = gate();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/platform**', route => route.fulfill({ json: workspace }));
  await page.route('**/api/locations?**', route => route.fulfill({ json: { locations: [{ id: 1, name: 'Berlin', contextLabel: 'Germany', country: 'Germany', countryCode: 'DE', latitude: 52.52, longitude: 13.405, label: 'Berlin, Germany' }] } }));
  await page.route('**/api/destination-context?**', route => route.fulfill({ json: { currency: 'EUR', currencySource: 'country-code', transportation: [], transportationMessage: '' } }));
  await page.route('**/api/weather**', route => route.fulfill({ status: 503, json: { error: 'Fixture unavailable.' } }));
  await page.route('**/api/accommodations?**', async route => {
    await pending.promise;
    await route.fulfill({ json: { configured: true, accommodations: [], nearbyAccommodations: [], providerAccommodations: Array.from({ length: 7 }, (_, index) => ({ id: 'liteapi:theme-' + index, propertyId: 'theme-' + index, name: 'Berlin fixture hotel ' + index, nameSource: 'provider-english', address: 'Berlin, Germany', type: 'Hotel', latitude: 52.52, longitude: 13.405, distanceKm: 1, rating: 3, amenities: [], photos: [], availability: 'price-unavailable' })), status: 'ready', providerStatus: 'ready' } });
  });
  await page.goto('/dashboard?tab=planner');
  await page.getByRole('combobox', { name: 'Destination', exact: true }).fill('Berlin');
  await page.getByRole('option', { name: /Berlin/ }).getByRole('button').click();
  await page.getByRole('button', { name: 'Browse accommodations', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Browse accommodations', exact: true });
  const search = dialog.getByLabel('Search accommodations by name');
  await expect(dialog.getByText('Loading relevant accommodation…', { exact: true })).toBeVisible();
  await expect(dialog).toHaveCSS('background-color', 'rgb(255, 254, 250)');
  await expect(search).toHaveCSS('background-color', 'rgb(255, 254, 250)');
  await expect(dialog.locator('[style]').first()).toHaveCSS('background-color', 'rgb(216, 225, 215)');
  for (const size of [{ width: 320, height: 320 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    // Chromium updates dynamic viewport units after the resize acknowledgement.
    // Check the settled dialog rather than reading the previous viewport's height.
    await expect.poll(async () => {
      const box = await dialog.boundingBox();
      return Boolean(box && box.x >= 12 && box.y >= 12 && box.x + box.width <= size.width - 12 && box.y + box.height <= size.height - 12);
    }).toBe(true);
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(12);
    expect(bounds!.y).toBeGreaterThanOrEqual(12);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width - 12);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height - 12);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Filling scrolls the search into view even on very short screens.
    await search.fill('');
    await expect(dialog.getByRole('button', { name: 'Close accommodations' })).toBeInViewport();
  }
  pending.release();
  await expect(dialog.getByRole('button', { name: /^Select accommodation:/ })).toHaveCount(6);
  await page.setViewportSize({ width: 320, height: 320 });
  await expect(dialog.getByRole('button', { name: 'Next accommodation page' })).toBeInViewport();
  await dialog.getByRole('button', { name: 'Next accommodation page' }).click();
  await expect(dialog.getByText('Showing 7–7 of 7 accommodations')).toBeVisible();
  await dialog.getByRole('button', { name: 'Select accommodation: Berlin fixture hotel 6', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Accommodation preference' }).getByText('Berlin fixture hotel 6', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Browse accommodations', exact: true })).toBeFocused();
});
