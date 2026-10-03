import { expect, test } from '@playwright/test';

const user = { id: 'session-recovery', name: 'Recovery Test', email: 'recovery@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };

test('a temporary session error recovers without offering sign-in', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/auth', route => ++requests === 1
    ? route.fulfill({ status: 503, json: { error: 'Temporarily unavailable.' } })
    : route.fulfill({ json: { user } }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeEnabled();
  await expect(page.getByRole('banner').getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
  expect(requests).toBe(2);
});

test('an unavailable session can be retried and does not replace a known session', async ({ page }) => {
  let unavailable = true;
  let requests = 0;
  await page.route('**/api/auth', route => {
    requests++;
    return unavailable ? route.fulfill({ status: 503, json: { error: 'Temporarily unavailable.' } }) : route.fulfill({ json: { user } });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Retry connection', exact: true })).toBeEnabled();
  expect(requests).toBe(2);
  await expect(page.getByRole('banner').getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeEnabled();
  unavailable = true;
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await expect.poll(() => requests).toBe(5);
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toHaveAttribute('title', 'Your session could not be checked. Try again.');
  await expect(page.getByRole('banner').getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
});

test('a real expired session shows sign-in and both visible images load eagerly', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/auth', route => { requests++; return route.fulfill({ status: 401, json: { error: 'Unauthenticated.' } }); });
  await page.goto('/');
  await expect(page.getByRole('banner').getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  expect(requests).toBe(1);
  await expect(page.getByAltText('Clear water around Nalusuan Island in Cebu')).toHaveAttribute('loading', 'eager');
  await page.getByRole('banner').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByAltText('Mountain landscape at dusk')).toHaveAttribute('loading', 'eager');
  await expect(page.getByRole('link', { name: 'Continue with Google', exact: true })).toBeVisible();
});
