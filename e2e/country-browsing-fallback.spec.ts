import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { searchAvailableCountries } from '../../travelmate-backend-api/src/services/destination/destination-index.ts';
import { globalCatalogueAvailable } from '../../travelmate-backend-api/src/services/destination/global-catalogue.ts';
import { searchGlobalLocationsPage } from '../../travelmate-backend-api/src/services/destination/global-location-search.ts';
import { searchDestinationAreas, selectedAreaParent } from '../../travelmate-backend-api/src/services/destination/destination-areas.ts';
import { resolveDestinationContext } from '../../travelmate-backend-api/src/services/destination/destination-context-service.ts';

const offline: typeof fetch = async () => { throw new Error('External providers are offline for this source-backed browser check.'); };
async function setup(page: Page, context: BrowserContext) {
  expect(globalCatalogueAvailable()).toBe(false);
  await context.addCookies([{ name: 'travelmate_session', value: 'country-browse-fixture', domain: new URL(test.info().project.use.baseURL!).hostname, path: '/' }]);
  await page.route('**/_next/image?*', route => route.abort());
  const writes: string[] = [];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), params = url.searchParams;
    if (route.request().method() === 'POST') writes.push(url.pathname);
    if (url.pathname.startsWith('/api/platform')) return route.fulfill({ json: { user: { id: 'country-browse-fixture', name: 'Country browser', email: 'browse@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true }, trips: [], tripsPage: { total: 0, hasMore: false }, notifications: [], directory: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [] } });
    if (url.pathname === '/api/locations') return route.fulfill({ json: params.get('kind') === 'countries' ? searchAvailableCountries(params.get('q') || '', Number(params.get('offset') || 0)) : await searchGlobalLocationsPage(params.get('q') || '', Number(params.get('offset') || 0), offline, params.get('countryCode') || undefined) });
    if (url.pathname === '/api/locations/areas') return route.fulfill({ json: await searchDestinationAreas(selectedAreaParent(Number(params.get('parentId')), params.get('countryCode')!), params.get('query') || '', Number(params.get('offset') || 0), offline, params.get('hierarchy') === 'true') });
    if (url.pathname === '/api/destination-context') return route.fulfill({ json: resolveDestinationContext(params.get('countryCode') || '', params.get('city') || '') });
    return route.fulfill({ status: 503, json: { error: 'Provider unavailable in isolated browser check.' } });
  });
  await page.goto('/dashboard?tab=planner');
  await page.getByRole('button', { name: 'Browse by country', exact: true }).click();
  return writes;
}

test('missing-cache country browsing uses real bundled records and selects a city', async ({ page, context }, info) => {
  const writes = await setup(page, context);
  const dialog = page.getByRole('dialog', { name: 'Browse destinations by country' });
  await expect(dialog.getByRole('listbox', { name: 'Countries', exact: true }).getByRole('button')).toHaveCount(20);
  await expect(dialog.getByText(/Place coverage is limited while the full catalogue is unavailable/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Load more countries', exact: true }).click();
  await expect(dialog.getByRole('listbox', { name: 'Countries', exact: true }).getByRole('button')).toHaveCount(40);
  await dialog.getByRole('combobox', { name: 'Country', exact: true }).fill('Japan');
  await dialog.getByRole('listbox', { name: 'Countries', exact: true }).getByRole('button').click();
  await expect(dialog.locator('#destination-area-options').getByRole('button').first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('country-browser-desktop.png') });
  await dialog.locator('#destination-area-search').fill('Tokyo');
  await dialog.locator('#destination-area-options').getByRole('button').filter({ hasText: 'Tokyo' }).first().click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#destination-search')).toHaveValue(/Tokyo/);
  await expect(page.locator('#destination-status')).toContainText('Confirmed:');
  await expect(page.locator('[data-country-filter="JP"]')).toBeVisible();
  expect(writes).toHaveLength(0);
});

test('country aliases work on mobile and closing the browser returns focus', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, context);
  const dialog = page.getByRole('dialog', { name: 'Browse destinations by country' });
  await dialog.getByRole('combobox', { name: 'Country', exact: true }).fill('日本');
  await expect(dialog.getByRole('listbox', { name: 'Countries', exact: true }).getByRole('button')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('country-browser-mobile.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#destination-search')).toBeFocused();
});
