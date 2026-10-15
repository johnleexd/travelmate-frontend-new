import { expect, test, type Page } from '@playwright/test';

async function openRegistration(page: Page) {
  await page.route('**/api/auth', route => route.request().method() === 'GET' ? route.fulfill({ status: 401, json: { error: 'Unauthenticated.' } }) : route.fulfill({ json: { emailAccepted: true, message: 'Fixture response.' } }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
}

test('registration has separate names and contact, independent password visibility and mobile fit', async ({ page }) => {
  await openRegistration(page);
  const dialog = page.getByRole('dialog');
  const password = dialog.getByLabel('Password', { exact: true });
  const confirm = dialog.getByLabel('Confirm password', { exact: true });
  await expect(dialog.getByLabel('Full name', { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('First name', { exact: true })).toHaveAttribute('autocomplete', 'given-name');
  await expect(dialog.getByLabel('Last name', { exact: true })).toHaveAttribute('autocomplete', 'family-name');
  await expect(dialog.getByLabel('Contact number (optional)')).toHaveAttribute('type', 'tel');
  await expect(dialog.getByLabel('Contact number (optional)')).toHaveAttribute('inputmode', 'numeric');
  await expect(dialog.getByText('+63', { exact: true })).toBeVisible();
  const phone = dialog.getByLabel('Contact number (optional)');
  await phone.fill('9171234567');
  await expect(phone).toHaveValue('917 123 4567');
  await phone.press('Home');
  for (let step = 0; step < 4; step += 1) await phone.press('ArrowRight');
  await phone.press('Backspace');
  await expect(phone).toHaveValue('911 234 567');
  await phone.press('7');
  await expect(phone).toHaveValue('917 123 4567');
  await phone.press('Home');
  for (let step = 0; step < 3; step += 1) await phone.press('ArrowRight');
  await phone.press('Delete');
  await expect(phone).toHaveValue('917 234 567');
  await phone.press('1');
  await expect(phone).toHaveValue('917 123 4567');
  await phone.fill('');
  await password.fill('FixturePassword123!');
  await confirm.fill('FixturePassword123!');
  await dialog.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('FixturePassword123!');
  await expect(confirm).toHaveAttribute('type', 'password');
  await dialog.getByRole('button', { name: 'Show confirm password', exact: true }).press('Enter');
  await expect(confirm).toHaveAttribute('type', 'text');
  await expect(dialog.getByText('Passwords match.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Close account dialog' })).toBeInViewport();
  }
  await page.setViewportSize({ width: 1440, height: 1080 });
  // Proof contains empty password fields, never visible credential text.
  await password.fill(''); await confirm.fill('');
  await dialog.getByRole('button', { name: 'Hide confirm password', exact: true }).click();
  await dialog.getByLabel('First name', { exact: true }).click();
  await dialog.getByRole('heading', { name: 'Make room for the trip.' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../audit/2026-10-13/account-fields/registration-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.getByRole('heading', { name: 'Make room for the trip.' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../audit/2026-10-13/account-fields/registration-mobile.png' });
  await dialog.getByRole('button', { name: 'Back to sign in' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveValue('');
  await dialog.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await dialog.getByRole('button', { name: 'Forgot password?' }).click();
  await dialog.getByLabel('Email address').fill('reset@example.test');
  await dialog.getByRole('button', { name: 'Send reset code', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Choose a new password.' })).toBeVisible();
  await expect(password).toHaveAttribute('type', 'password');
  await dialog.getByRole('button', { name: 'Show password', exact: true }).click();
  await dialog.getByRole('button', { name: 'Show confirm password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(confirm).toHaveAttribute('type', 'text');
});

test('registration submits contact and name parts, and contact remains editable after sign-in and refresh', async ({ page, context }) => {
  await openRegistration(page);
  let request: Record<string, unknown> | undefined;
  let user = { id: 'account-fixture', name: '', email: 'account@example.test', phone: '', role: 'traveler', emailVerified: true, accountStatus: 'active' };
  await page.route('**/api/auth', route => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 401, json: { error: 'Unauthenticated.' } });
    const body = route.request().postDataJSON();
    if (body.action === 'register') { request = body; user = { ...user, name: `${body.firstName} ${body.lastName}`, phone: body.phone }; }
    return route.fulfill({ json: body.action === 'login' ? { user, redirect: '/dashboard' } : { user, emailAccepted: true, message: 'Fixture response.' } });
  });
  const workspace = () => ({ user, trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [], directory: [], moderation: [], audit: [] });
  await page.route('**/api/platform**', route => route.fulfill({ json: workspace() }));
  await page.route('**/api/profile', route => { user = { ...user, phone: route.request().postDataJSON().phone }; return route.fulfill({ json: { profile: user } }); });
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('First name', { exact: true }).fill(' Mary Jane ');
  await dialog.getByLabel('Last name', { exact: true }).fill(' Santos ');
  await dialog.getByLabel('Email address').fill(user.email);
  await dialog.getByLabel('Contact number (optional)').fill('call me');
  await dialog.getByLabel('Password', { exact: true }).fill('FixturePassword123!');
  await dialog.getByLabel('Confirm password', { exact: true }).fill('FixturePassword123!');
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  expect(request).toBeUndefined();
  await expect(dialog.getByLabel('Contact number (optional)')).toHaveAttribute('aria-invalid', 'true');
  const phone = dialog.getByLabel('Contact number (optional)');
  for (const pasted of ['09123456789', '+63 (912) 345-6789']) {
    await phone.fill('');
    await phone.evaluate((element, text) => {
      const data = new DataTransfer(); data.setData('text/plain', text);
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, pasted);
    await expect(phone).toHaveValue('912 345 6789');
  }
  await phone.fill('');
  await phone.evaluate(element => {
    const data = new DataTransfer(); data.setData('text/plain', '917123456789012345');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(phone).toHaveValue('917 123 456789012345');
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  expect(request).toBeUndefined();
  await dialog.getByLabel('Contact number (optional)').fill('9123456789');
  await expect(dialog.getByLabel('Contact number (optional)')).toHaveValue('912 345 6789');
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Verify your email.' })).toBeVisible();
  expect(request).toMatchObject({ firstName: 'Mary Jane', lastName: 'Santos', phone: '+639123456789' });
  await dialog.getByLabel('Verification code').fill('A1B2C3D4');
  await dialog.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Welcome.' })).toBeVisible();
  await context.addCookies([{ name: 'travelmate_session', value: 'account-fixture', domain: 'localhost', path: '/' }]);
  await dialog.getByLabel('Password', { exact: true }).fill('FixturePassword123!');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Open profile menu for Mary Jane Santos' }).click();
  await page.getByRole('button', { name: 'Account settings' }).click();
  await expect(page.getByLabel('Contact number', { exact: true })).toHaveValue('+639123456789');
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Mary Jane Santos');
  await page.getByLabel('Contact number', { exact: true }).fill('+63 900 000 0000');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Contact number', { exact: true })).toHaveValue('+63 900 000 0000');
});
