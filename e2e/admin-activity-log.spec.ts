import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { ActivityLogEntry } from '../lib/contracts';

const actor = { id: 'performing-admin', name: 'Morgan Lee', role: 'admin' as const };
const traveler = { id: 'performing-traveler', name: 'Riley Tan', role: 'traveler' as const };
const affected = { id: 'affected-account', name: 'Affected Alice', role: 'traveler', email: 'affected@example.test' };
const entries: ActivityLogEntry[] = Array.from({ length: 26 }, (_, index) => ({
  id: `activity-${index}`, createdAt: '2026-10-16T12:00:00Z', actor: index === 0 ? actor : traveler,
  actorUnavailableReason: null, actionLabel: index === 0 ? 'Appeal approved' : index === 1 ? 'Google login' : 'Trip saved',
  targetId: index === 0 ? affected.id : `trip-record-${index}-${'long-'.repeat(7)}`, targetType: index === 0 ? 'Appeal' : 'Trip', tone: 'success',
}));
entries[2] = { ...entries[2], actor: null, actorUnavailableReason: 'account-unavailable', targetId: affected.id };
entries[3] = { ...entries[3], actor: null, actorUnavailableReason: 'not-recorded' };

async function setup(page: Page, context: BrowserContext) {
  const state = { calls: [] as Array<{ page: number; q: string }>, failNext: false, hold: '' as string, release: () => {} };
  await context.addCookies([{ name: 'travelmate_session', value: 'activity-ui-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/platform**', route => {
    if (route.request().url().includes('/reports/stream')) return route.fulfill({ contentType: 'text/event-stream', body: ': fixture\n\n' });
    if (route.request().url().includes('/notifications')) return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    return route.fulfill({ json: { user: { ...actor, email: 'admin@example.test', accountStatus: 'active', emailVerified: true }, directory: [affected], audit: [], trips: [], listings: [], bookings: [], moderation: [], itineraryVersions: [], itineraryGenerations: [], notifications: [], integrations: { database: true, openAI: true, weather: true }, metrics: {} } });
  });
  await page.route('**/api/platform/activity?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    const pageNumber = Number(params.get('page') || 1), q = params.get('q') || '';
    state.calls.push({ page: pageNumber, q });
    if (state.failNext) { state.failNext = false; return route.fulfill({ status: 503, json: { error: 'Activity temporarily unavailable.' } }); }
    if (q && state.hold === q) await new Promise<void>(resolve => { state.release = resolve; });
    const filtered = entries.filter(entry => `${entry.actor?.name || ''} ${entry.actionLabel} ${entry.targetId} ${entry.id}`.toLowerCase().includes(q.toLowerCase()));
    return route.fulfill({ json: { entries: filtered.slice((pageNumber - 1) * 10, pageNumber * 10), page: pageNumber, pageSize: 10, total: filtered.length } }).catch(() => {});
  });
  const errors: string[] = []; page.on('pageerror', failure => errors.push(failure.message));
  await page.goto('/admin/dashboard?tab=health');
  await expect(page.getByRole('table', { name: 'Activity log entries' })).toBeVisible();
  return { state, errors, panel: page.getByRole('region', { name: 'Activity Log', exact: true }) };
}

test('System Health shows labeled actor identities separately from targets and honest unavailable accounts', async ({ page, context }, info) => {
  const { panel, errors } = await setup(page, context);
  await expect(panel.getByRole('columnheader')).toHaveText(['Date & Time', 'Performed By', 'Action', 'Target / Record ID']);
  const approval = panel.getByRole('row').filter({ hasText: 'Appeal approved' });
  await expect(approval.locator('[data-label="Performed By"]')).toContainText('Morgan Lee');
  await expect(approval.locator('[data-label="Performed By"]')).toContainText('Admin');
  await expect(approval.locator('[data-label="Target / Record ID"]')).toContainText(affected.id);
  await expect(panel.locator('[data-label="Performed By"]').filter({ hasText: 'Riley Tan' }).first()).toContainText('Traveler');
  await expect(panel.getByText('Account unavailable', { exact: true })).toBeVisible();
  await expect(panel.getByText('Actor not recorded', { exact: true })).toBeVisible();
  await expect(panel).not.toContainText('Affected Alice');
  await expect(panel).not.toContainText('appeal-approved');
  await expect(page.getByRole('heading', { name: 'System Health', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activity Log', exact: true })).toHaveCount(0);
  await expect(panel.getByRole('status').filter({ hasText: 'Showing 1–10 of 26' })).toBeVisible();
  await panel.screenshot({ path: info.outputPath('activity-log.png') });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(approval.locator('[data-label="Performed By"]')).toContainText('Morgan Lee');
  }
  await panel.screenshot({ path: info.outputPath('activity-log-narrow.png') });
  expect(errors).toEqual([]);
});

test('pagination and search across actors, readable actions and record IDs remain connected', async ({ page, context }) => {
  const { panel, state, errors } = await setup(page, context);
  await expect(panel.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await panel.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(panel.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  expect(state.calls.at(-1)).toEqual({ page: 2, q: '' });
  const search = panel.getByRole('searchbox', { name: 'Search activity' });
  await search.fill('Morgan');
  await expect(panel.getByText('Page 1 of 1', { exact: true })).toBeVisible();
  await expect(panel).toContainText('Morgan Lee');
  expect(state.calls.at(-1)).toEqual({ page: 1, q: 'Morgan' });
  await search.fill('Google login');
  await expect(panel.getByRole('row').filter({ hasText: 'Google login' })).toBeVisible();
  await expect(panel.getByRole('row').filter({ hasText: 'Appeal approved' })).toHaveCount(0);
  await search.fill('trip-record-25-');
  await expect(panel).toContainText(entries[25].targetId);
  await expect(panel.getByRole('status').filter({ hasText: 'Showing 1–1 of 1' })).toBeVisible();
  await search.fill('not-found');
  await expect(panel.getByRole('status').filter({ hasText: 'No matching activity.' })).toBeVisible();
  await search.fill('');
  await expect(panel.getByText('Page 1 of 3', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('load failures can retry without losing search and stale search responses cannot replace new results', async ({ page, context }) => {
  const { panel, state, errors } = await setup(page, context);
  const search = panel.getByRole('searchbox', { name: 'Search activity' });
  await search.fill('Morgan');
  await expect(panel.getByText('Morgan Lee', { exact: true })).toBeVisible();
  state.failNext = true;
  await panel.getByRole('button', { name: 'Refresh activity log', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Activity temporarily unavailable.');
  await expect(search).toHaveValue('Morgan');
  await panel.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(panel.getByText('Morgan Lee', { exact: true })).toBeVisible();
  state.hold = 'Trip';
  await search.fill('Trip');
  await expect.poll(() => state.calls.at(-1)?.q).toBe('Trip');
  await search.fill('Google');
  await expect(panel.getByText('Google login', { exact: true })).toBeVisible();
  state.release();
  await expect(panel.getByText('Trip saved', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
