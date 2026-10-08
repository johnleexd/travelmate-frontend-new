import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { searchDestinationIndex } from '../../travelmate-backend-api/src/services/destination/destination-index.ts';
import { resolveDestinationContext } from '../../travelmate-backend-api/src/services/destination/destination-context-service.ts';
import { destinationAreas } from '../../travelmate-backend-api/src/services/destination/location-resolution.ts';

function rate(base: string, quote: string, ttl = 6 * 60 * 60_000) {
  const now = Date.now(); const fetchedAt = new Date(now).toISOString(); const refreshAfter = new Date(now + ttl).toISOString();
  return { base, quote, rate: quote === 'PHP' ? 0.4 : 0.006, asOf: '2026-10-06', fetchedAt, refreshAfter, source: 'frankfurter', sourceUrl: 'https://frankfurter.dev/', disclaimer: 'Reference only.', freshness: { source: 'exchange-rates', status: 'live', isStale: false, fetchedAt, expiresAt: refreshAfter, staleUntil: new Date(now + 24 * 60 * 60_000).toISOString(), policy: 'Reference rate.' } };
}

async function setup(page: Page, context: BrowserContext) {
  await context.addCookies([{ name: 'travelmate_session', value: 'rates-test', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const user = { id: 'rates-test', name: 'Exchange Test', email: 'rates@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
  await page.route('**/api/platform**', route => route.fulfill({ json: { user, directory: [user], trips: [], listings: [], bookings: [], moderation: [], audit: [], itineraryGenerations: [], itineraryVersions: [], notifications: [], reviews: [], promotions: [], blockedDates: [], transactions: [], ownerDocuments: [], metrics: {}, integrations: {} } }));
  await page.route('**/api/locations?**', route => route.fulfill({ json: { locations: searchDestinationIndex(new URL(route.request().url()).searchParams.get('q') || '') } }));
  await page.route('**/api/locations/resolve?**', route => { const location = searchDestinationIndex(new URL(route.request().url()).searchParams.get('q') || '')[0]; return route.fulfill({ json: { location, candidates: [location], areas: destinationAreas(location), message: '' } }); });
  await page.route('**/api/destination-context?**', route => { const params = new URL(route.request().url()).searchParams; return route.fulfill({ json: resolveDestinationContext(params.get('countryCode') || '', params.get('city') || '') }); });
  const stays: string[] = [];
  await page.route('**/api/accommodations?**', route => { stays.push(route.request().url()); return route.fulfill({ json: { accommodations: [], nearbyAccommodations: [], status: 'no-results', message: 'No stays in this fixture.' } }); });
  await page.goto('/dashboard'); await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  return stays;
}

async function selectShikoku(page: Page, manual = false) {
  await page.getByRole('combobox', { name: 'Destination', exact: true }).fill('Shikoku, Japan');
  if (manual) await page.getByRole('button', { name: /^Use .* manually$/ }).click();
  else await page.locator('#destination-suggestions').getByRole('option').first().getByRole('button').click();
  await expect(page.locator('#destination-status')).toContainText('Confirmed: Shikoku');
  await expect(page.getByRole('combobox', { name: /^Destination currency/ })).toHaveValue('JPY');
}

async function editBudget(page: Page) {
  const budget = page.getByRole('spinbutton', { name: /^Solo trip budget/ });
  for (const amount of ['60000', '65000', '70000', '60000']) await budget.fill(amount);
  await expect(budget).toHaveValue('60000');
}

for (const manual of [false, true]) {
  test(`${manual ? 'manual' : 'suggestion'} Shikoku: idle and budget edits do not refetch; pair changes use separate cached rates`, async ({ page, context }) => {
    const calls: string[] = [];
    await page.route('**/api/destination-context/exchange-rate?**', route => { const params = new URL(route.request().url()).searchParams; const base = params.get('base')!; const quote = params.get('quote')!; calls.push(`${base}:${quote}`); return route.fulfill({ json: rate(base, quote) }); });
    const stays = await setup(page, context); await selectShikoku(page, manual);
    await expect(page.getByText(/1 JPY ≈ PHP/)).toBeVisible();
    await page.waitForTimeout(4_000); expect(calls).toEqual(['JPY:PHP']); expect(stays).toHaveLength(0);
    await editBudget(page); await page.waitForTimeout(2_000); expect(calls).toEqual(['JPY:PHP']);
    await page.getByRole('combobox', { name: 'Show equivalents in', exact: true }).selectOption('EUR');
    await expect(page.getByText(/1 JPY ≈ EUR/)).toBeVisible();
    expect(calls.sort()).toEqual(['JPY:EUR', 'JPY:PHP', 'PHP:EUR']);
    await page.getByRole('combobox', { name: 'Show equivalents in', exact: true }).selectOption('PHP');
    await expect(page.getByText(/1 JPY ≈ PHP/)).toBeVisible(); await page.waitForTimeout(1_000); expect(calls).toHaveLength(3);
  });
}

test('short Retry-After is respected and three failed attempts stop at a clear unavailable state', async ({ page, context }) => {
  const times: number[] = [];
  await page.route('**/api/destination-context/exchange-rate?**', route => { times.push(Date.now()); return route.fulfill({ status: 429, headers: { 'Retry-After': '2', 'X-Rate-Limit-Source': 'upstream' }, json: { error: 'Fixture provider limit.' } }); });
  await setup(page, context); await selectShikoku(page);
  await expect(page.getByText('Reference conversion is temporarily unavailable. Destination prices remain unchanged.')).toBeVisible({ timeout: 12_000 });
  expect(times).toHaveLength(3); expect(times[1] - times[0]).toBeGreaterThanOrEqual(1_950); expect(times[2] - times[1]).toBeGreaterThanOrEqual(1_950);
  await editBudget(page); await page.waitForTimeout(4_000); expect(times).toHaveLength(3);
  await page.screenshot({ path: '../audit/2026-10-06/exchange-rate-unavailable.png', fullPage: true });
});

test('backend Retry-After 60 stops after one request, including idle and budget edits', async ({ page, context }) => {
  let calls = 0;
  await page.route('**/api/destination-context/exchange-rate?**', route => { calls++; return route.fulfill({ status: 429, headers: { 'Retry-After': '60', 'X-Rate-Limit-Source': 'backend' }, json: { error: 'Too many exchange-rate requests.' } }); });
  await setup(page, context); await selectShikoku(page);
  await expect(page.getByText('Reference conversion is temporarily unavailable. Destination prices remain unchanged.')).toBeVisible();
  await editBudget(page); await page.waitForTimeout(4_000); expect(calls).toBe(1);
});

test('successful cache expiry refreshes once; an old pair response cannot overwrite the selected pair', async ({ page, context }) => {
  let phpCalls = 0; let release!: () => void;
  await page.route('**/api/destination-context/exchange-rate?**', async route => {
    const params = new URL(route.request().url()).searchParams; const base = params.get('base')!; const quote = params.get('quote')!;
    if (base === 'JPY' && quote === 'PHP') {
      phpCalls++;
      if (phpCalls === 2) await new Promise<void>(resolve => { release = resolve; });
    }
    await route.fulfill({ json: rate(base, quote, phpCalls === 1 && base === 'JPY' && quote === 'PHP' ? 1_500 : undefined) });
  });
  await setup(page, context); await selectShikoku(page);
  await expect(page.getByText(/1 JPY ≈ PHP/)).toBeVisible();
  await expect.poll(() => phpCalls).toBe(2);
  await page.getByRole('combobox', { name: 'Show equivalents in', exact: true }).selectOption('EUR');
  await expect(page.getByText(/1 JPY ≈ EUR/)).toBeVisible(); release();
  await page.waitForTimeout(2_000); await expect(page.getByText(/1 JPY ≈ EUR/)).toBeVisible(); expect(phpCalls).toBe(2);
});
