import { expect, test, type Page, type BrowserContext } from '@playwright/test';

async function setup({ page, context }: { page: Page; context: BrowserContext }) {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  const admin = { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', accountStatus: 'active', emailVerified: true };
  const traveler = { ...admin, id: 'traveler', name: 'Avery Kim', role: 'traveler' };
  const actions: Record<string, unknown>[] = [];
  let fail = false;
  let release: (() => void) | undefined;
  let delayed = false;
  await page.route('**/api/platform**', async route => {
    if (route.request().url().includes('/reports/stream')) return route.abort();
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); actions.push(body);
      if (delayed) await new Promise<void>(resolve => { release = resolve; });
      if (fail) return route.fulfill({ status: 503, json: { error: 'Account service temporarily unavailable.' } });
      traveler.accountStatus = body.status;
      return route.fulfill({ json: { result: { id: traveler.id, status: body.status } } });
    }
    return route.fulfill({ json: { user: admin, directory: [admin, traveler], moderation: [], audit: [], itineraryGenerations: [] } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/dashboard');
  await page.getByRole('navigation', { name: 'Admin workspace' }).getByRole('button', { name: 'Users', exact: true }).click();
  const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Avery Kim' }) });
  return { row, actions, setFail: (value: boolean) => { fail = value; }, delay: () => { delayed = true; }, release: () => release?.() };
}

test('suspend and restore use styled confirmations, cancel safely and preserve keyboard focus', async ({ page, context }) => {
  const state = await setup({ page, context });
  let nativeDialogs = 0;
  page.on('dialog', async dialog => { nativeDialogs++; await dialog.dismiss(); });
  const suspendButton = state.row.getByRole('button', { name: 'Suspend account', exact: true });
  await suspendButton.click();
  let dialog = page.getByRole('dialog', { name: 'Suspend traveler account?' });
  await expect(dialog.getByText(/Avery Kim will lose access/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.screenshot({ path: '../audit/2026-10-07/suspend-account-dialog.png' });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(suspendButton).toBeFocused();
  expect(state.actions).toHaveLength(0);
  await suspendButton.click(); await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); expect(state.actions).toHaveLength(0);
  await suspendButton.click(); await dialog.getByRole('button', { name: 'Suspend account', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.actions).toEqual([{ action: 'admin-user-status', id: 'traveler', status: 'suspended' }]);
  const restoreButton = state.row.getByRole('button', { name: 'Restore access', exact: true });
  await restoreButton.click();
  dialog = page.getByRole('dialog', { name: 'Restore traveler access?' });
  await expect(dialog.getByText('Avery Kim will regain access immediately.')).toBeVisible();
  await page.screenshot({ path: '../audit/2026-10-07/restore-access-dialog.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: '../audit/2026-10-07/restore-access-dialog-mobile.png' });
  await dialog.getByRole('button', { name: 'Close confirmation' }).click();
  await expect(dialog).toHaveCount(0); expect(state.actions).toHaveLength(1);
  await restoreButton.click();
  await dialog.getByRole('button', { name: 'Restore access', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(state.row.getByRole('button', { name: 'Suspend account', exact: true })).toBeVisible();
  expect(state.actions[1]).toEqual({ action: 'admin-user-status', id: 'traveler', status: 'active' });
  expect(nativeDialogs).toBe(0);
});

test('account confirmation retains errors for retry and blocks dismissal during save', async ({ page, context }) => {
  const state = await setup({ page, context });
  state.setFail(true);
  await state.row.getByRole('button', { name: 'Suspend account', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Suspend traveler account?' });
  await dialog.getByRole('button', { name: 'Suspend account', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Account service temporarily unavailable.');
  expect(state.actions).toHaveLength(1);
  state.setFail(false); state.delay();
  await dialog.getByRole('button', { name: 'Suspend account', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Suspending…', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
  await expect.poll(() => state.actions.length).toBe(2);
  state.release();
  await expect(dialog).toHaveCount(0);
  await expect(state.row.getByRole('button', { name: 'Restore access', exact: true })).toBeVisible();
});
