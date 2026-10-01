import { expect, test } from '@playwright/test';

test('the desktop lifecycle rail has two equal copies for a seamless loop', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  await page.route('**/api/platform**', route => route.fulfill({ json: {
    user: { id: 'traveler', name: 'Test Traveler', email: 'traveler@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true },
    trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [],
  } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Your travel home' })).toBeVisible();

  const copies = page.locator('[data-lifecycle-rail] > div');
  await expect(copies).toHaveCount(2);
  const widths = await copies.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
  expect(Math.abs(widths[0] - widths[1])).toBeLessThan(1);
  await expect(copies.nth(1)).toHaveAttribute('aria-hidden', 'true');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(copies.nth(1)).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('saving a profile keeps desktop navigation in place', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  const user = { id: 'traveler', name: 'Test Traveler', email: 'traveler@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
  await page.route('**/api/platform**', route => route.fulfill({ json: {
    user, trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [],
  } }));
  await page.route('**/api/profile', async route => {
    expect(route.request().method()).toBe('PATCH');
    user.name = route.request().postDataJSON().name;
    await route.fulfill({ json: { user } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard');
  const navigation = page.getByRole('navigation', { name: 'Traveler workspace' });
  await expect(navigation).toBeVisible();
  expect((await navigation.boundingBox())!.y).toBeLessThan(260);

  await page.getByRole('button', { name: 'Open profile menu for Test Traveler' }).click();
  await page.getByRole('button', { name: 'Account settings' }).click();
  await page.getByLabel('Full name').fill('Updated Traveler');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile updated.')).toBeVisible();

  const navBox = await navigation.boundingBox();
  expect(navBox).not.toBeNull();
  expect(navBox!.y).toBeGreaterThanOrEqual(0);
  expect(navBox!.y).toBeLessThan(260);
  await navigation.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Your travel home' })).toBeVisible();
  expect((await navigation.boundingBox())!.y).toBeLessThan(260);
});
