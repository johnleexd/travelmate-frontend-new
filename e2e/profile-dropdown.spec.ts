import { expect, test, type Page, type BrowserContext } from '@playwright/test';

const user = { id: 'dropdown-traveler', name: 'Alexandra Montgomery Longname', email: 'traveler@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };

async function openWorkspace(page: Page, context: BrowserContext) {
  await context.addCookies([{ name: 'travelmate_session', value: 'dropdown-fixture', domain: 'localhost', path: '/' }]);
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Unavailable in isolated fixture.' } }));
  await page.route('**/api/platform**', route => route.fulfill({ json: { user, trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [] } }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Your travel home', exact: true })).toBeVisible();
  return { profile: page.getByRole('button', { name: `Open profile menu for ${user.name}`, exact: true }), popup: page.getByRole('dialog', { name: 'Profile menu', exact: true }) };
}

test('profile popup toggles, dismisses outside, and stays anchored within phone and desktop viewports', async ({ page, context }) => {
  const { profile, popup } = await openWorkspace(page, context);
  const heading = page.getByRole('heading', { name: 'Your travel home', exact: true });
  const originalHeading = await heading.boundingBox();
  await profile.click();
  await expect(popup).toBeVisible();
  await expect(popup.getByRole('button')).toHaveCount(2);
  await expect(popup).toHaveCSS('background-color', 'rgb(255, 254, 250)');
  await expect(popup).toHaveCSS('color', 'rgb(32, 53, 45)');
  await expect(popup).toHaveCSS('border-radius', '12px');
  expect(await heading.boundingBox()).toEqual(originalHeading);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await expect(page.locator('.traveler-profile-backdrop, .traveler-profile-drawer')).toHaveCount(0);
  await profile.click();
  await expect(popup).toHaveCount(0);
  await profile.click();
  await heading.click();
  await expect(popup).toHaveCount(0);
  for (const size of [{ width: 320, height: 320 }, { width: 390, height: 844 }, { width: 667, height: 375 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await profile.click();
    await expect(popup).toBeVisible();
    await expect.poll(async () => {
      const anchor = await profile.boundingBox();
      const bounds = await popup.boundingBox();
      return Boolean(anchor && bounds && bounds.x >= 12 && bounds.y >= anchor.y + anchor.height && bounds.x + bounds.width <= size.width - 12 && bounds.y + bounds.height <= size.height - 12 && Math.abs(bounds.x + bounds.width - anchor.x - anchor.width) < 1);
    }).toBe(true);
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    await expect(profile).toBeFocused();
  }
});

test('both profile actions have keyboard focus and Account settings keeps its navigation', async ({ page, context }) => {
  const { profile, popup } = await openWorkspace(page, context);
  await profile.focus();
  await page.keyboard.press('Enter');
  const settings = popup.getByRole('button', { name: 'Account settings', exact: true });
  const signOut = popup.getByRole('button', { name: 'Sign out', exact: true });
  await expect(settings).toBeFocused();
  await expect(settings).toHaveCSS('outline-style', 'solid');
  await expect(settings).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('Tab');
  await expect(signOut).toBeFocused();
  await expect(signOut).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('Shift+Tab');
  await expect(settings).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(popup).toHaveCount(0);
  await expect(page).toHaveURL(/tab=profile/);
  await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue(user.name);
});
