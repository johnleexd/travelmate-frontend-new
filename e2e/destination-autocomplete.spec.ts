import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../travelmate-backend-api/src/lib/prisma.ts';
import { createSessionToken } from '../../travelmate-backend-api/src/middlewares/auth-middleware.ts';

test.afterAll(() => prisma.$disconnect());

test('worldwide country browsing, direct landmark search and selection reach the actual locations API', async ({ page, context }) => {
  test.setTimeout(120_000);
  const user = await prisma.user.create({ data: { name: 'Destination Test', email: `destination-${randomUUID()}@example.test`, role: 'traveler', emailVerified: true } });
  try {
    await context.addCookies([{ name: 'travelmate_session', value: createSessionToken(user.id, user.role), domain: 'localhost', path: '/' }]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Only hotel availability is isolated; location search, authentication,
    // dashboard data and destination/currency context use the running API.
    const hotelRequests: URL[] = [];
    await page.route('**/api/accommodations**', route => {
      hotelRequests.push(new URL(route.request().url()));
      return route.fulfill({ json: { configured: false, accommodations: [], message: 'No hotel offers in this isolated test.' } });
    });
    await page.route('**/api/destination-context/exchange-rate**', route => route.fulfill({ status: 503, json: { error: 'Exchange rates isolated in this test.' } }));
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
    const input = page.getByRole('combobox', { name: 'Destination', exact: true });
    const options = page.locator('#destination-suggestions').getByRole('option');
    for (const country of ['Japan', 'France', 'Brazil', 'South Africa']) {
      const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/locations' && new URL(response.url()).searchParams.get('q') === country);
      await input.fill(country);
      expect((await response).status()).toBe(200);
      await expect(options).toHaveCount(10);
      for (const option of await options.all()) await expect(option).toContainText(country);
      await expect(page.getByRole('button', { name: 'Show more destinations' })).toBeVisible();
      await page.getByRole('button', { name: 'Show more destinations' }).click();
      await expect(options).toHaveCount(20);
      expect(await page.locator('#destination-suggestions').evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    }
    await input.fill('Mount Fuji');
    await expect(options.first()).toContainText('Japan');
    await expect(options.first()).toContainText('Mountain');
    await input.fill('Barcelona, Spain');
    await expect(options.first()).toContainText('Barcelona');
    for (const option of await options.all()) await expect(option).toContainText('Spain');
    await page.setViewportSize({ width: 390, height: 844 });
    await input.fill('Kyoto');
    await expect(options.first()).toContainText('Kyoto');
    await expect(options.first()).toContainText('Japan');
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(options).toHaveCount(0);
    await expect(input).toHaveValue(/Kyoto.*Japan/);
    await expect(page.locator('#destination-status')).toContainText('Confirmed: Kyoto');
    await expect.poll(() => hotelRequests.length).toBeGreaterThan(0);
    const hotel = hotelRequests.at(-1)!;
    expect(hotel.searchParams.get('destination')).toMatch(/Kyoto.*Japan/);
    expect(hotel.searchParams.get('currency')).toBe('JPY');
    expect(Number(hotel.searchParams.get('latitude'))).toBeGreaterThan(34);
    expect(Number(hotel.searchParams.get('longitude'))).toBeGreaterThan(135);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await input.fill('France');
    await expect(options).toHaveCount(10);
    for (const option of await options.all()) await expect(option).toContainText('France');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/destination-autocomplete-mobile.png', fullPage: true });
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});
