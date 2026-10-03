import { expect, test } from '@playwright/test';

const user = { id: 'logout-traveler', name: 'Test Traveler', email: 'traveler@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const workspace = { user, trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [], directory: [], moderation: [], audit: [] };

test('failed logout stays on the dashboard, then successful logout allows a fresh Google sign-in', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  await page.route('**/api/platform**', route => route.fulfill({ json: workspace }));
  let failLogout = true;
  let logoutRequests = 0;
  await page.route('**/api/auth', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ action: 'logout' });
      logoutRequests++;
      if (failLogout) await route.fulfill({ status: 503, json: { error: 'Sign-out temporarily unavailable.' } });
      else await route.fulfill({ json: { ok: true }, headers: { 'set-cookie': 'travelmate_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' } });
    } else await route.fulfill({ status: 401, json: { error: 'Unauthenticated.' } });
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Your travel home' })).toBeVisible();
  await page.getByRole('button', { name: /Open profile menu/ }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sign-out temporarily unavailable.' })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await context.cookies()).some(cookie => cookie.name === 'travelmate_session')).toBe(true);
  failLogout = false;
  await page.getByRole('button', { name: /Open profile menu/ }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:3000/');
  expect((await context.cookies()).some(cookie => cookie.name === 'travelmate_session')).toBe(false);
  expect(logoutRequests).toBe(2);
  await page.getByRole('banner').getByRole('button', { name: 'Sign in', exact: true }).click();
  let googleRequests = 0;
  await page.route('**/api/auth/oauth/google', route => {
    googleRequests++;
    return route.fulfill({ contentType: 'text/plain', body: 'Google account chooser' });
  });
  await page.getByRole('link', { name: 'Continue with Google', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:3000/api/auth/oauth/google');
  expect(googleRequests).toBe(1);
});
