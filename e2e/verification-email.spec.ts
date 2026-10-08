import { expect, test } from '@playwright/test';

for (const failure of ['email-configuration', 'network'] as const) {
  test(`registration ${failure} failure preserves name and email without reporting success`, async ({ page }) => {
    await page.route('**/api/auth', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 401, json: { error: 'Unauthenticated.' } });
      } else if (failure === 'network') {
        await route.abort('connectionrefused');
      } else {
        await route.fulfill({ status: 503, json: { error: 'Email delivery is not configured. Set EMAIL_PROVIDER, RESEND_API_KEY, and EMAIL_FROM in the backend .env. No verification email was sent.', code: 'PROVIDER_UNAVAILABLE', retryable: false, details: { reason: 'configuration_required', dependency: 'email' } } });
      }
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Create an account', exact: true }).click();
    await dialog.getByLabel('Full name').fill('Preserved Name');
    await dialog.getByLabel('Email address').fill('preserved@example.test');
    await dialog.getByLabel('Password', { exact: true }).fill('StrongPass123!');
    await dialog.getByLabel('Confirm password').fill('StrongPass123!');
    await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(dialog).toContainText(failure === 'network' ? 'Your request was not confirmed' : 'No verification email was sent');
    await expect(dialog.getByLabel('Full name')).toHaveValue('Preserved Name');
    await expect(dialog.getByLabel('Email address')).toHaveValue('preserved@example.test');
    await expect(dialog.getByLabel('Password', { exact: true })).toHaveValue('');
    await expect(dialog.getByLabel('Confirm password')).toHaveValue('');
    await expect(dialog.getByLabel('Verification code')).toHaveCount(0);
    await expect(dialog.getByRole('heading', { name: 'Make room for the trip.' })).toBeVisible();
  });
}

test('verification requires a code from email and ignores legacy code fields', async ({ page }) => {
  let submitted = '';
  let registrations = 0;
  await page.route('**/api/auth', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 401, json: { error: 'Unauthenticated.' } });
      return;
    }
    const body = route.request().postDataJSON();
    if (body.action === 'verify-email') {
      expect(body).not.toHaveProperty('password');
      expect(body).not.toHaveProperty('confirmPassword');
      submitted = body.code;
      await route.fulfill({ json: { message: 'Email verified. You can now sign in.' } });
    } else if (body.action === 'resend-verification') {
      await route.fulfill({ status: 429, json: { error: 'Wait 60 seconds before requesting another verification email.' } });
    } else {
      expect(body.password).toBe('StrongPass123!');
      expect(body.confirmPassword).toBe(body.password);
      registrations++;
      // A stale API must never cause the browser to display a supplied code.
      await route.fulfill({ status: 201, json: { emailAccepted: true, verificationCode: 'FEDC4321', message: 'Check your email for the verification code.' } });
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Create an account', exact: true }).click();
  await dialog.getByLabel('Full name').fill('Email Test');
  await dialog.getByLabel('Email address').fill('email-test@example.test');
  await dialog.getByLabel('Password', { exact: true }).fill('StrongPass123!');
  await dialog.getByLabel('Confirm password').fill('StrongPass124!');
  await expect(dialog.getByText('Confirm password does not match Password.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(dialog.getByText('Confirm password does not match Password. Enter the same value in both fields.')).toBeVisible();
  expect(registrations).toBe(0);
  await dialog.getByLabel('Confirm password').fill('StrongPass123!');
  await expect(dialog.getByText('Passwords match.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Verify your email.' })).toBeVisible();
  await expect(dialog.getByText('We sent a verification code to email-test@example.test', { exact: true })).toBeVisible();
  expect(registrations).toBe(1);
  await expect(dialog.getByLabel('Password', { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('Confirm password')).toHaveCount(0);
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(storage).not.toContain('StrongPass123!');
  await expect(dialog.getByLabel('Verification code')).toHaveValue('');
  await expect(dialog).not.toContainText('FEDC4321');
  await dialog.getByRole('button', { name: 'Resend verification code' }).click();
  await expect(dialog).toContainText('Wait 60 seconds');
  await expect(dialog.getByText('We sent a verification code to email-test@example.test', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Verification code')).toHaveValue('');
  await dialog.getByLabel('Verification code').fill('ABCD1234');
  await dialog.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Welcome.' })).toBeVisible();
  await expect(dialog).toContainText('Registration is complete and your email is verified. You are now signing in.');
  await expect(dialog.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(dialog.getByLabel('Confirm password')).toHaveCount(0);
  expect(submitted).toBe('ABCD1234');
});

test('resend keeps the email visible and does not claim sending for an ineligible account', async ({ page }) => {
  await page.route('**/api/auth', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 401, json: { error: 'Unauthenticated.' } });
      return;
    }
    const body = route.request().postDataJSON();
    await route.fulfill(body.action === 'register'
      ? { status: 201, json: { emailAccepted: true, message: 'Account created. Check your email.' } }
      : { json: { emailAccepted: false, message: 'No new verification email was sent. If your email is already verified, sign in.' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Create an account', exact: true }).click();
  await dialog.getByLabel('Full name').fill('Resend Test');
  await dialog.getByLabel('Email address').fill('resend-test@example.test');
  await dialog.getByLabel('Password', { exact: true }).fill('StrongPass123!');
  await dialog.getByLabel('Confirm password').fill('StrongPass123!');
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(dialog.getByText('We sent a verification code to resend-test@example.test', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Resend verification code' }).click();
  await expect(dialog).toContainText('No new verification email was sent');
  await expect(dialog.getByText('Verification email address: resend-test@example.test', { exact: true })).toBeVisible();
  await expect(dialog.getByText('We sent a verification code to resend-test@example.test', { exact: true })).toHaveCount(0);
});

test('failed verification delivery offers resend without a code or a sent claim', async ({ page }) => {
  await page.route('**/api/auth', async route => {
    await route.fulfill(route.request().method() === 'GET'
      ? { status: 401, json: { error: 'Unauthenticated.' } }
      : { status: 502, json: { error: 'Account created, but the verification email was not sent. Wait 60 seconds, then use resend verification to try again.' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Create an account', exact: true }).click();
  await dialog.getByLabel('Full name').fill('Delivery Test');
  await dialog.getByLabel('Email address').fill('delivery-test@example.test');
  await dialog.getByLabel('Password', { exact: true }).fill('StrongPass123!');
  await dialog.getByLabel('Confirm password').fill('StrongPass123!');
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Verify your email.' })).toBeVisible();
  await expect(dialog).toContainText('email was not sent');
  await expect(dialog.getByText('Verification email address: delivery-test@example.test', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Verification code')).toHaveValue('');
  await expect(dialog.getByRole('button', { name: 'Resend verification code' })).toBeVisible();
});
