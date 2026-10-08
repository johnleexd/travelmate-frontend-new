import { expect, test } from '@playwright/test';

test('admin reports and badges update live while dialogs and sections stay open', async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'browser-test', domain: 'localhost', path: '/' }]);
  const admin = { id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin', accountStatus: 'active', emailVerified: true };
  const reporter = { ...admin, id: 'traveler', name: 'Live Traveler', role: 'traveler' };
  const report = { id: 'report-live', kind: 'report', subjectId: 'traveler', title: 'New realtime report', details: 'A report submitted from a separate browser.', status: 'pending', createdAt: new Date().toISOString() };
  await page.addInitScript(() => {
    class TestEventSource extends EventTarget {
      static instances: TestEventSource[] = [];
      onerror: (() => void) | null = null;
      closed = false;
      constructor(public url: string) { super(); TestEventSource.instances.push(this); }
      close() { this.closed = true; }
    }
    Object.assign(window, { EventSource: TestEventSource, liveReportStreams: TestEventSource.instances });
  });
  let workspaceReads = 0;
  await page.route('**/api/platform**', route => {
    workspaceReads++;
    return route.fulfill({ json: { user: admin, directory: [admin], moderation: [], audit: [], itineraryGenerations: [], integrations: {} } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/admin/dashboard');
  const navigation = page.getByRole('navigation', { name: 'Admin workspace' });
  await navigation.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(page.getByText('No traveler reports yet.', { exact: false })).toBeVisible();
  const send = async (status: string) => page.evaluate(({ report, reporter, status }) => {
    const streams = (window as unknown as { liveReportStreams: EventTarget[] }).liveReportStreams;
    streams.at(-1)!.dispatchEvent(new MessageEvent('reports', { data: JSON.stringify({ moderation: [{ ...report, status }], reporters: [reporter] }) }));
  }, { report, reporter, status });
  await send('pending');
  await expect(navigation.getByRole('button', { name: /^Reports\s*1$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: report.title, exact: true })).toBeVisible();
  await expect(page.getByText('Live reports connected')).toBeVisible();
  await page.getByRole('button', { name: 'View full report' }).click();
  const dialog = page.getByRole('dialog', { name: 'Full report' });
  await expect(dialog.getByText(reporter.name, { exact: false })).toBeVisible();
  await send('resolved');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Resolved', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Mark resolved' })).toHaveCount(0);
  await expect(navigation.getByRole('button', { name: 'Reports', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await navigation.getByRole('button', { name: 'Users', exact: true }).click();
  await page.getByLabel('Search users').fill('Live Traveler');
  await send('pending');
  await expect(page.getByLabel('Search users')).toHaveValue('Live Traveler');
  await expect(navigation.getByRole('button', { name: /^Reports\s*1$/ })).toBeVisible();
  const before = await page.evaluate(() => (window as unknown as { liveReportStreams: unknown[] }).liveReportStreams.length);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => page.evaluate(() => (window as unknown as { liveReportStreams: unknown[] }).liveReportStreams.length)).toBeGreaterThan(before);
  await send('resolved');
  await expect(navigation.getByRole('button', { name: 'Reports', exact: true })).toBeVisible();
  expect(workspaceReads).toBeLessThanOrEqual(2); // React dev Strict Mode may repeat the initial read.
});
