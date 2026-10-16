import { test, expect } from '@playwright/test';
import { setup, user } from './fixtures/planner-fixture';
import type { PlanUsage } from '../services/plan.service';
import { budgetFixture } from '../tests/fixtures/budget-review-plan';
import type { ItineraryResponse as BackendItinerary } from '../../travelmate-backend-api/src/controllers/itinerary-controller';
import { buildGroundedPlan } from '../../travelmate-backend-api/src/services/itinerary/grounded-plan';

const usage = (): PlanUsage => ({ plan: 'Free', status: 'free', source: null, expiresAt: null, used: 1, reserved: 1, remaining: 1, allowance: 3,
  periodStart: '2026-09-30T16:00:00Z', resetsAt: '2026-10-31T16:00:00Z', timezone: 'Asia/Manila', trackingStartedAt: '2026-10-16T00:00:00Z', plans: { free: 3, plus: 30 }, provisional: true, checkoutAvailable: false, pricing: 'Pricing not configured', inProgress: null, recentOperations: [] });

test('test checkout uses a server order; the redirect stays Free until provider verification confirms payment', async ({ page, context }) => {
  await setup(page, context);
  const plan: PlanUsage = { ...usage(), reserved: 0, remaining: 2, checkoutAvailable: true, pricing: 'PHP 100.00 · test only', testCheckout: { amount: 10000, currency: 'PHP', durationDays: 30 } };
  const order = { id: 'aa00aa00-aa00-4a00-8a00-aa00aa00aa00', status: 'pending', amount: 10000, currency: 'PHP', durationDays: 30, checkoutUrl: 'https://checkout.paymongo.com/cs_fixture', lastError: null, fulfilledAt: null as string | null, mode: 'test' };
  let confirmed = false, creates = 0, verifies = 0;
  await page.route('**/api/plan', route => route.fulfill({ json: plan }));
  await page.route('**/api/plan/checkout', route => {
    if (route.request().method() === 'POST') { creates++; expect(route.request().postDataJSON()).toEqual({}); expect(route.request().headers()['idempotency-key']).toBeTruthy(); }
    return route.fulfill({ json: { order } });
  });
  await page.route('**/api/plan/checkouts/*/verify', route => {
    verifies++;
    if (confirmed) { order.status = 'paid'; order.fulfilledAt = '2026-10-16T11:00:00Z'; Object.assign(plan, { plan: 'Plus', source: 'paymongo_test', status: 'active', allowance: 30, remaining: 29, checkoutAvailable: false, expiresAt: '2026-11-15T11:00:00Z' }); }
    return route.fulfill({ json: { order } });
  });
  await page.route('https://checkout.paymongo.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>PayMongo sandbox fixture</h1>' }));
  await page.goto('/dashboard?tab=plan');
  await page.getByRole('button', { name: 'View upgrade details', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Demo Plus — test checkout' });
  await expect(modal).toContainText('Test payment — no real money charged.'); await expect(modal).toContainText('100.00'); await expect(modal).toContainText('30 days');
  await modal.getByRole('button', { name: 'Resume test checkout', exact: true }).click();
  await expect(page).toHaveURL('https://checkout.paymongo.com/cs_fixture'); expect(creates).toBe(1);
  await page.goto('/dashboard?tab=plan&checkout=success&order=' + order.id);
  await expect(page.getByRole('region', { name: 'PayMongo test checkout' })).toContainText('awaiting payment');
  await expect(page.getByText('Demo Plus', { exact: true })).toHaveCount(0);
  confirmed = true;
  await page.getByRole('button', { name: 'Check payment status', exact: true }).click();
  await expect(page.getByText('Demo Plus', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1 used, 0 reserved, 29 remaining');
  await page.reload(); await expect(page.getByText('Demo Plus', { exact: true })).toBeVisible(); expect(verifies).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('failed and cancelled test checkout remains Free and can be resumed or cancelled', async ({ page, context }) => {
  await setup(page, context);
  const plan = { ...usage(), checkoutAvailable: true, pricing: 'PHP 100.00 · test only', testCheckout: { amount: 10000, currency: 'PHP', durationDays: 30 } };
  const order = { id: 'bb00bb00-bb00-4b00-8b00-bb00bb00bb00', status: 'pending', amount: 10000, currency: 'PHP', durationDays: 30, checkoutUrl: 'https://checkout.paymongo.com/cs_fixture', lastError: 'PAYMENT_FAILED', fulfilledAt: null, mode: 'test' };
  await page.route('**/api/plan', route => route.fulfill({ json: plan }));
  await page.route('**/api/plan/checkout', route => route.fulfill({ json: { order } }));
  await page.route('**/api/plan/checkouts/*/cancel', route => { order.status = 'cancelled'; return route.fulfill({ json: { order } }); });
  await page.goto('/dashboard?tab=plan');
  await expect(page.getByRole('region', { name: 'PayMongo test checkout' })).toContainText('Payment attempt failed');
  await expect(page.getByRole('button', { name: 'Resume test checkout', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel test checkout', exact: true }).click();
  await expect(page.getByRole('region', { name: 'PayMongo test checkout' })).toContainText('Test checkout cancelled');
  await expect(page.getByText('Demo Plus', { exact: true })).toHaveCount(0);
  await page.goto('/dashboard?tab=plan&checkout=cancelled&order=' + order.id);
  await expect(page.getByRole('region', { name: 'PayMongo test checkout' })).toContainText('Test checkout cancelled');
});

test('My Plan reads server values, exposes no checkout and supports keyboard, mobile and history', async ({ page, context }) => {
  const state = await setup(page, context), plan = usage();
  await page.route('**/api/plan', route => route.fulfill({ json: plan }));
  await page.goto('/dashboard?tab=plan');
  await expect(page.getByRole('heading', { name: 'My Plan', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Traveler workspace' });
  await expect(nav.getByRole('button', { name: 'My Plan', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1 used, 1 reserved, 1 remaining');
  await expect(page.getByRole('region', { name: 'AI generation allowance' })).toContainText('November 1, 2026');
  await expect(page.getByText('Pricing not configured', { exact: true })).toBeVisible();
  await expect(page.getByText('Design concept', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'View upgrade details', exact: true }).focus(); await page.keyboard.press('Enter');
  const details = page.getByRole('dialog', { name: 'Plus plan details' }); await expect(details).toBeVisible();
  await expect(details.getByRole('button', { name: 'Checkout unavailable', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(details).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View upgrade details', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Need help? Read the User Guide' }).click();
  await expect(page).toHaveURL(/tab=help/); await page.goBack(); await expect(page).toHaveURL(/tab=plan/);
  await page.reload(); await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/my-plan-${test.info().project.name}.png`, fullPage: true });
  expect(state.generations).toHaveLength(0); expect(state.writes).toHaveLength(0);
});

test('actual monthly-limit response preserves form and leaves saved trips accessible', async ({ page, context }) => {
  const state = await setup(page, context), plan = { ...usage(), used: 3, reserved: 0, remaining: 0 };
  const savedPlan = budgetFixture() as unknown as BackendItinerary;
  state.saved = { id: 'preferences-trip', userId: user.id, status: 'active', destination: savedPlan.destination, budget: savedPlan.totalBudget, currency: savedPlan.currency, travelers: savedPlan.travelers!, partyType: savedPlan.partyType!, startDate: savedPlan.days[0].date, endDate: savedPlan.days.at(-1)!.date, interests: [], createdAt: '2026-10-16T00:00:00Z', itinerary: savedPlan };
  await page.route('**/api/plan', route => route.fulfill({ json: plan }));
  let requests = 0;
  await page.route('**/api/itinerary', route => { requests++; return route.fulfill({ status: 429, json: { error: 'Monthly AI limit reached', code: 'MONTHLY_AI_LIMIT', retryable: false, details: plan } }); });
  await page.goto('/dashboard?tab=planner');
  await page.locator('#destination-search').fill('Tokyo');
  await page.locator('#destination-suggestions').getByRole('button').filter({ hasText: 'Japan' }).first().click();
  await page.locator('#trip-budget').fill('300000');
  await page.locator('#trip-end-date').fill(await page.locator('#trip-start-date').inputValue());
  await page.getByRole('button', { name: 'Generate my trip', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Monthly AI limit reached', exact: true });
  await expect(modal).toContainText('3 of 3 used'); await expect(modal).toContainText('November 1, 2026');
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#trip-budget')).toHaveValue('300000'); await expect(page.locator('#destination-search')).toHaveValue(/Tokyo/);
  await page.getByRole('button', { name: 'Retry generation', exact: true }).click();
  await modal.getByRole('button', { name: 'View plans', exact: true }).click(); await expect(page).toHaveURL(/tab=plan/);
  await page.goBack(); await expect(page.locator('#trip-budget')).toHaveValue('300000');
  await page.getByRole('button', { name: 'Retry generation', exact: true }).click();
  await modal.getByRole('button', { name: 'Open saved trips', exact: true }).click(); await expect(page).toHaveURL(/tab=bookings/);
  await expect(page.getByRole('button', { name: 'View itinerary', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View itinerary', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your trip itinerary', exact: true })).toBeVisible();
  expect(requests).toBe(3); expect(state.writes).toHaveLength(0);
});

test('recovering a durable result after refresh makes a draft without generating or saving again', async ({ page, context }) => {
  const state = await setup(page, context), plan = usage(), result = budgetFixture();
  plan.recentOperations = [{ id: 'operation', idempotencyKey: 'recovery-operation', destination: result.destination, allowanceState: 'succeeded', charged: true, createdAt: '2026-10-16T00:00:00Z', operationKind: 'itinerary', relatedTripId: null }];
  await page.route('**/api/plan', route => route.fulfill({ json: plan }));
  await page.route('**/api/plan/operations/recovery-operation', route => route.fulfill({ json: { id: 'operation', key: 'recovery-operation', state: 'succeeded', kind: 'itinerary', tripId: null, status: 'completed', charged: true, result, errorCode: null } }));
  await page.goto('/dashboard?tab=plan'); await page.reload();
  await page.getByRole('button', { name: 'Open result', exact: true }).click();
  await expect(page).toHaveURL(/tab=planner/); await expect(page.getByRole('heading', { name: 'Your trip itinerary', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem(`travelmate-itinerary-draft:${id}`) || 'null')?.itinerary?.destination, user.id)).toBe(result.destination);
  expect(state.generations).toHaveLength(0); expect(state.writes).toHaveLength(0);
});

test('two browser tabs share a durable generation key and reconnect to one existing operation', async ({ page, context }) => {
  const second = await context.newPage();
  await setup(page, context); await setup(second, context);
  const keys: string[] = []; let result: ReturnType<typeof buildGroundedPlan> | undefined;
  let release!: () => void; const bothRequested = new Promise<void>(resolve => { release = resolve; });
  for (const tab of [page, second]) {
    await tab.route('**/api/itinerary', async route => {
      const body = route.request().postDataJSON();
      result ??= buildGroundedPlan({ destination: body.destination, anchor: body.destinationDetails, startingLocation: '', startDate: body.startDate, endDate: body.endDate, budget: body.budget, currency: body.currency, travelers: body.travelers, partyType: body.partyType, rooms: 1, places: [], placeDataStatus: 'unavailable', source: 'catalog', transportation: '', schedule: [{ day: 1, date: body.startDate, theme: 'Controlled browser result', visits: [], planningStatus: 'incomplete' }] });
      keys.push(route.request().headers()['idempotency-key']); if (keys.length === 2) release();
      await bothRequested;
      // First response is lost; both tabs recover the same durable server result.
      return route.fulfill({ status: 409, json: { error: 'Generation in progress', code: 'GENERATION_IN_PROGRESS', retryable: true, details: { idempotencyKey: keys[0] } } });
    });
    await tab.route('**/api/plan/operations/**', route => route.fulfill({ json: { id: 'shared-operation', key: keys[0], state: 'succeeded', kind: 'itinerary', tripId: null, status: 'completed', charged: true, result, errorCode: null } }));
    await tab.goto('/dashboard?tab=planner');
    await tab.locator('#destination-search').fill('Tokyo');
    await tab.locator('#destination-suggestions').getByRole('button').filter({ hasText: 'Japan' }).first().click();
    await tab.locator('#trip-budget').fill('300000');
    await tab.locator('#trip-end-date').fill(await tab.locator('#trip-start-date').inputValue());
  }
  await Promise.all([page, second].map(tab => tab.getByRole('button', { name: 'Generate my trip', exact: true }).click()));
  await expect.poll(() => keys.length).toBe(2); expect(keys[0]).toBeTruthy(); expect(keys[0]).toBe(keys[1]);
  for (const tab of [page, second]) await expect(tab.getByRole('heading', { name: 'Your trip itinerary', exact: true })).toBeVisible();
  await second.close();
});
