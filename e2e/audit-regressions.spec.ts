import { expect, test } from '@playwright/test';

const user = { id: 'audit-storage', name: 'Storage Test', email: 'storage@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const workspace = { user, trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [], directory: [], moderation: [], audit: [] };

test('a Google callback error stays visible after the landing page mounts', async ({ page }) => {
  await page.route('**/api/auth', route => route.fulfill({ status: 401, json: { error: 'Unauthenticated.' } }));
  await page.goto('/?auth_error=oauth_unavailable');
  await expect(page.getByRole('dialog')).toContainText('Google sign-in is temporarily unavailable.');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'Continue with Google', exact: true })).toBeVisible();
});

test('storage being blocked or full never replaces the traveler workspace with an error page', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'audit-browser-fixture', domain: 'localhost', path: '/' }]);
  await page.route('**/api/platform**', route => route.fulfill({ json: workspace }));
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Storage blocked.', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Storage full.', 'QuotaExceededError'); };
    Storage.prototype.removeItem = () => { throw new DOMException('Storage blocked.', 'SecurityError'); };
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Your travel home' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Plan a trip' }).click();
  await expect(page.getByRole('heading', { name: 'Start a new trip' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'TravelMate could not open this page.' })).toHaveCount(0);
});

test('local-only logout gives an explicit warning when server revocation is unavailable', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'audit-browser-fixture', domain: 'localhost', path: '/' }]);
  await page.route('**/api/platform**', route => route.fulfill({ json: workspace }));
  await page.route('**/api/auth', route => route.request().method() === 'POST'
    ? route.fulfill({ json: { ok: true, sessionRevoked: false }, headers: { 'set-cookie': 'travelmate_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' } })
    : route.fulfill({ status: 401, json: { error: 'Unauthenticated.' } }));
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Open profile menu/ }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('You are signed out on this browser.');
  await expect(page.getByRole('dialog')).toContainText('could not confirm');
  expect((await context.cookies()).some(cookie => cookie.name === 'travelmate_session')).toBe(false);
});
