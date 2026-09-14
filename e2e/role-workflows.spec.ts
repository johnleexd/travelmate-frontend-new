import { expect, test, type Page } from '@playwright/test';

const DEMO_PASSWORD = 'Travel123!';
const DEMO_ACCOUNTS = {
  traveler: { email: 'traveler@travelmate.test', route: '/dashboard', heading: 'Dashboard' },
  owner: { email: 'owner@travelmate.test', route: '/owner/dashboard', heading: 'Overview' },
  admin: { email: 'admin@travelmate.test', route: '/admin/dashboard', heading: 'Overview' },
} as const;

type DemoRole = keyof typeof DEMO_ACCOUNTS;

async function loginAs(page: Page, role: DemoRole) {
  const account = DEMO_ACCOUNTS[role];
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  const submit = page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await submit.click();
    const navigated = await page.waitForURL(new RegExp(`${account.route}$`), { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (navigated) break;
  }
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

test('owner and admin routes reject unauthenticated and wrong-role sessions', async ({ page }) => {
  for (const route of ['/owner/dashboard', '/admin/dashboard']) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/\\?auth_error=unauthenticated$`));
  }

  await loginAs(page, 'traveler');
  for (const route of ['/owner/dashboard', '/admin/dashboard']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /AI Travel Planning Made Real/i })).toBeVisible();
  }
});

test('owner listing submission can be approved by an admin and removed by its owner', async ({ page }) => {
  const listingName = `E2E Owner Listing ${Date.now()}`;
  let listingId = '';

  try {
    await loginAs(page, 'owner');
    await page.getByRole('button', { name: 'Listings', exact: true }).click();
    await page.getByRole('button', { name: 'New listing', exact: true }).click();

    const listingDialog = page.locator('form').filter({ hasText: 'Listing editor' });
    await listingDialog.getByLabel('Name').fill(listingName);
    await listingDialog.getByLabel('Category').selectOption('stay');
    await listingDialog.getByLabel('City / municipality').selectOption('Cordova');
    await listingDialog.getByLabel('Price (PHP)').fill('2450');
    await listingDialog.getByLabel('Capacity').fill('4');
    await listingDialog.getByLabel('Address').fill('E2E Test Address, Cordova, Cebu');
    await listingDialog.getByLabel('Amenities (comma separated)').fill('Wi-Fi, Breakfast');
    await listingDialog.getByLabel('Description').fill('Temporary listing created by the browser workflow test.');
    await listingDialog.getByRole('button', { name: 'Submit listing', exact: true }).click();

    await expect(page.getByRole('status')).toContainText('Listing submitted for approval.');
    await page.getByPlaceholder('Search listings').fill(listingName);
    const ownerRow = page.getByRole('row').filter({ hasText: listingName });
    await expect(ownerRow).toContainText('pending');

    const ownerData = await page.request.get('/api/platform?scope=owner').then((response) => response.json()) as {
      listings?: Array<{ id: string; name: string }>;
    };
    listingId = ownerData.listings?.find((listing) => listing.name === listingName)?.id || '';
    expect(listingId).not.toBe('');

    await loginAs(page, 'admin');
    await page.getByRole('button', { name: /Moderation/ }).click();
    const moderationCard = page.locator('article').filter({ hasText: listingName });
    await expect(moderationCard).toHaveCount(1);
    await moderationCard.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Action persisted and added to the audit log.');
    await expect(moderationCard).toHaveCount(0);

    await loginAs(page, 'owner');
    await page.getByRole('button', { name: 'Listings', exact: true }).click();
    await page.getByPlaceholder('Search listings').fill(listingName);
    const approvedRow = page.getByRole('row').filter({ hasText: listingName });
    await expect(approvedRow).toContainText('approved');

    page.once('dialog', (dialog) => dialog.accept());
    await approvedRow.getByTitle('Delete listing').click();
    await expect(page.getByRole('status')).toContainText('Listing deleted.');
    await expect(approvedRow).toHaveCount(0);
    listingId = '';
  } finally {
    if (listingId) {
      await page.request.post('/api/auth', { data: { action: 'logout' } }).catch(() => undefined);
      await loginAs(page, 'owner').catch(() => undefined);
      await page.request.post('/api/platform', { data: { action: 'delete-listing', id: listingId } }).catch(() => undefined);
    }
  }
});

test('owner listing editor is labelled, focuses its first field, and closes with Escape', async ({ page }) => {
  await loginAs(page, 'owner');
  await page.getByRole('button', { name: 'Listings', exact: true }).click();
  const opener = page.getByRole('button', { name: 'New listing', exact: true });
  await opener.click();

  const dialog = page.getByRole('dialog', { name: 'New listing' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Name')).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await dialog.getByRole('button', { name: 'Close listing editor' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Submit listing' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close listing editor' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
  await expect(opener).toBeFocused();
});

test('owner and admin workspaces avoid page overflow at tablet and desktop widths', async ({ page }) => {
  const assertPageFits = async (label: string) => {
    const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
    expect(dimensions.document, `${label} exceeds the ${dimensions.viewport}px viewport`).toBeLessThanOrEqual(dimensions.viewport);
  };

  const workspaces = [
    { role: 'owner' as const, tabs: ['Overview', 'Listings', 'Bookings', 'Finance', 'Profile'] },
    { role: 'admin' as const, tabs: ['Overview', 'Moderation', 'Users', 'Listings', 'Payments', 'Audit & health'] },
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
