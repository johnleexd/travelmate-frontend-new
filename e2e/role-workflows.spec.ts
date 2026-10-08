import { expect, test, type Page } from '@playwright/test';
import { demoPassword } from './demo-credentials';

const DEMO_ACCOUNTS = {
  traveler: { email: 'traveler@travelmate.test', route: '/dashboard', heading: 'Your travel home' },
  admin: { email: 'admin@travelmate.test', route: '/admin/dashboard', heading: 'Overview' },
} as const;

type DemoRole = keyof typeof DEMO_ACCOUNTS;

async function loginAs(page: Page, role: DemoRole) {
  const account = DEMO_ACCOUNTS[role];
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Email address').click();
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password').fill(demoPassword(role));
  const submit = page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true });
  await submit.click();
  await expect(page).toHaveURL(new RegExp(`${account.route}$`));
  await expect(page.getByRole('heading', { name: account.heading, exact: true }).first()).toBeVisible();
}

async function expectNamedControls(page: Page, context: string) {
  const unnamed = await page.locator('button:visible, input:visible, select:visible, textarea:visible').evaluateAll((elements) => elements
    .filter((element) => {
      const control = element as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const labelledBy = (control.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent?.trim() || '').join(' ');
      const labels = 'labels' in control ? Array.from(control.labels || []).map((label) => label.textContent?.trim() || '').join(' ') : '';
      return ![control.getAttribute('aria-label'), labelledBy, labels, control.textContent, control.title, control.getAttribute('placeholder')]
        .some((value) => value?.trim());
    })
    .map((element) => element.outerHTML.slice(0, 180)));
  expect(unnamed, `${context} contains visible controls without accessible names`).toEqual([]);
}

test('shared login and signup have no role selector', async ({ page }) => {
  const submissions: Record<string, unknown>[] = [];
  await page.route('**/api/auth', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 401, json: { error: 'Unauthenticated.' } });
    submissions.push(route.request().postDataJSON());
    await route.fulfill({ status: 401, json: { error: 'Invalid email or password.' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Welcome.', exact: true })).toBeVisible();
  await expect(dialog.getByText('Sign in as', { exact: true })).toHaveCount(0);
  for (const role of ['traveler', 'admin'] as const) {
    await dialog.getByLabel('Email address').fill(DEMO_ACCOUNTS[role].email);
    await dialog.getByLabel('Password').fill('MockLoginPassword1!');
    await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect.poll(() => submissions.length).toBe(role === 'traveler' ? 1 : 2);
  }
  expect(submissions.every((body) => !('role' in body))).toBe(true);
  await dialog.getByRole('button', { name: 'Create an account', exact: true }).click();
  await expect(dialog.getByLabel('Full name')).toBeVisible();
  await expect(dialog.getByText('I am creating an account as', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /Owner|Traveler|Admin/i })).toHaveCount(0);
});

test('sign-in keeps Google visible when OAuth is not configured', async ({ page }) => {
  await page.route('**/api/auth/oauth/google/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ available: false }),
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  await expect(dialog.getByLabel('Email address')).toBeVisible();
});

test('admin routes reject unauthenticated and wrong-role sessions', async ({ page }) => {
  for (const route of ['/admin/dashboard']) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/\\?auth_error=unauthenticated$`));
  }

  await loginAs(page, 'traveler');
  for (const route of ['/admin/dashboard']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /AI Travel Planning Made Real/i })).toBeVisible();
  }
});

test('removed owner dashboard returns not found', async ({ page }) => {
  const response = await page.goto('/owner/dashboard');
  expect(response?.status()).toBe(404);
});

test('admin workspace avoid page overflow at tablet and desktop widths', async ({ page }) => {
  const assertPageFits = async (label: string) => {
    const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
    expect(dimensions.document, `${label} exceeds the ${dimensions.viewport}px viewport`).toBeLessThanOrEqual(dimensions.viewport);
  };

  const workspaces = [
    { role: 'admin' as const, tabs: ['Overview', 'Users', 'Reports', 'System Health'] },
  ];

  for (const workspace of workspaces) {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginAs(page, workspace.role);
    for (const width of [768, 1440]) {
      await page.setViewportSize({ width, height: width === 768 ? 1024 : 900 });
      for (const tab of workspace.tabs) {
        await page.getByRole('button', { name: tab, exact: tab !== 'Moderation' }).click();
        await expectNamedControls(page, `${workspace.role} ${tab}`);
        await assertPageFits(`${workspace.role} ${tab}`);
      }
    }
  }
});
