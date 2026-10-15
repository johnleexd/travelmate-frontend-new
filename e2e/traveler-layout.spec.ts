import { expect, test } from '@playwright/test';

test('long account names and home content fit phones, tablets and desktops through reload', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  const user = { id: 'traveler', name: 'Alexandra Montgomery Longname', email: 'traveler@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
  let release!: () => void;
  let pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/platform**', async route => {
    await pending;
    await route.fulfill({ json: { user, trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [] } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/dashboard');
  const skeleton = page.locator('[data-workspace-skeleton="traveler"]');
  await expect(skeleton).toBeVisible();
  const loadingFrame = await skeleton.locator('header > div').boundingBox();
  release();
  await expect(page.getByRole('heading', { name: 'Your travel home', exact: true })).toBeVisible();
  const header = page.locator('.traveler-dashboard header');
  const profile = header.getByRole('button', { name: `Open profile menu for ${user.name}` });
  expect(await header.locator(':scope > div').boundingBox()).toEqual(loadingFrame);
  for (const size of [{ width: 320, height: 740 }, { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 414, height: 896 }, { width: 667, height: 375 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    const frame = (await header.locator(':scope > div').boundingBox())!;
    const brand = (await header.getByRole('link', { name: 'TravelMate home' }).boundingBox())!;
    const account = (await profile.boundingBox())!;
    expect(brand.x).toBeGreaterThanOrEqual(frame.x);
    expect(brand.x + brand.width).toBeLessThan(account.x);
    expect(account.x + account.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(account.width).toBeGreaterThanOrEqual(44);
    expect(account.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('#travel-home-title').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const nav = (await page.getByRole('navigation', { name: 'Traveler workspace' }).boundingBox())!;
    expect(nav.y).toBeGreaterThanOrEqual(frame.y + frame.height);
  }
  await page.setViewportSize({ width: 667, height: 320 });
  await profile.click();
  const menu = page.getByRole('dialog', { name: 'Profile menu', exact: true });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Account settings', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(menu.getByRole('button', { name: 'Sign out', exact: true })).toBeFocused();
  await expect(menu.getByRole('button', { name: 'Sign out', exact: true })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(profile).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  pending = new Promise<void>(resolve => { release = resolve; });
  await page.reload();
  await expect(skeleton).toBeVisible();
  const reloadFrame = await skeleton.locator('header > div').boundingBox();
  release();
  await expect(profile).toBeVisible();
  expect(await header.locator(':scope > div').boundingBox()).toEqual(reloadFrame);
  await profile.click();
  await page.getByRole('button', { name: 'Account settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible();
});

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
