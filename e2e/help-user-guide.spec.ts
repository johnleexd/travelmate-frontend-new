import { expect, test, type Page } from '@playwright/test';

const topics = [
  { title: 'Create a trip', steps: 7, action: 'Go to Plan a trip', tab: 'planner', heading: 'Start a new trip' },
  { title: 'Manage saved trips', steps: 6, action: 'Go to Saved trips', tab: 'bookings', heading: 'Saved trips' },
  { title: 'Maps & directions', steps: 4, action: 'Find maps in Saved trips', tab: 'bookings', heading: 'Saved trips' },
  { title: 'Visited places', steps: 5, action: 'Go to Visited places', tab: 'visited', heading: 'Visited places' },
  { title: 'Budget review', steps: 5, action: 'Go to Budget review', tab: 'budget', heading: 'Budget review begins after itinerary generation.' },
  { title: 'Account settings', steps: 4, action: 'Open Account settings', tab: 'profile', heading: 'Your account' },
];
const selector = (page: Page) => page.getByRole('region', { name: 'Choose a guide', exact: true });
const helpNav = (page: Page) => page.getByRole('navigation', { name: 'Traveler workspace' }).getByRole('button', { name: 'Help / User Guide', exact: true });
const detail = (page: Page) => page.locator('#help-guide-detail');

test.beforeEach(async ({ page, context }) => {
  await context.addCookies([{ name: 'travelmate_session', value: 'isolated-help-fixture', domain: 'localhost', path: '/' }]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/_next/image?*', route => route.abort());
  // Run the real Next application with isolated API responses, no database writes
  // and no external providers. Unexpected mutations/generation are asserted below.
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/platform') return route.fulfill({ json: {
      user: { id: 'help-owner', name: 'Guide reader', email: 'guide@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true },
      trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [],
    } });
    if (path === '/api/platform/notifications') return route.fulfill({ json: { notifications: [] } });
    if (path === '/api/platform/visited-places') return route.fulfill({ json: { visits: [], page: { total: 0, hasMore: false, nextCursor: null } } });
    return route.fulfill({ status: 503, json: { error: 'Unavailable in isolated Help UI test.' } });
  });
});

test('all six topics update one shared detail panel without leaving Help or calling generation', async ({ page }, info) => {
  const writes: string[] = [], generation: string[] = [], errors: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/') && request.method() !== 'GET') writes.push(request.url());
    if (/gemini|generate|itinerary\/plan/i.test(request.url())) generation.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dashboard?tab=help');
  await expect(page.getByRole('heading', { name: 'How can we help you?', level: 1 })).toBeVisible();
  await expect(selector(page).getByRole('button')).toHaveCount(6);
  await expect(selector(page).getByRole('button', { name: 'Create a trip', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Design reference', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Current trip context', { exact: true })).toHaveCount(0);
  const historyLength = await page.evaluate(() => history.length);
  for (const topic of topics) {
    await selector(page).getByRole('button', { name: topic.title, exact: true }).click();
    await expect(page).toHaveURL('/dashboard?tab=help');
    await expect(helpNav(page)).toHaveAttribute('aria-current', 'page');
    await expect(selector(page).locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(selector(page).getByRole('button', { name: topic.title, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(detail(page)).toHaveCount(1);
    await expect(detail(page).getByRole('heading', { level: 2 })).toHaveText(topic.title);
    await expect(detail(page).getByRole('list', { name: `${topic.title} steps`, exact: true })).toBeVisible();
    await expect(detail(page).getByRole('listitem')).toHaveCount(topic.steps);
    await expect(detail(page).getByRole('button')).toHaveCount(1);
    await expect(detail(page).getByRole('button', { name: topic.action, exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const numbers = detail(page).getByRole('listitem').locator(':scope > span');
    await expect(numbers).toHaveText(Array.from({ length: topic.steps }, (_, i) => String(i + 1)));
    await expect(numbers.first()).toHaveCSS('border-radius', '50%');
    await expect(numbers.first()).toHaveCSS('background-color', 'rgb(217, 182, 111)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(page.getByRole('banner')).toBeVisible();
  expect(writes).toEqual([]);
  expect(generation).toEqual([]);
  expect(errors).toEqual([]);
  await selector(page).getByRole('button', { name: 'Create a trip', exact: true }).click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.mouse.move(0, 0);
  await page.screenshot({ path: info.outputPath('help-create-trip.png'), fullPage: true });
});

test('each guide action opens the existing feature and browser Back restores its selection', async ({ page }) => {
  await page.goto('/dashboard?tab=help');
  for (const topic of topics) {
    await selector(page).getByRole('button', { name: topic.title, exact: true }).click();
    await detail(page).getByRole('button', { name: topic.action, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`tab=${topic.tab}(?:&|$)`));
    await expect(page.getByRole('heading', { name: topic.heading, exact: true })).toBeVisible();
    if (topic.tab === 'profile') await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Guide reader');
    await page.goBack();
    await expect(page).toHaveURL('/dashboard?tab=help');
    await expect(detail(page).getByRole('heading', { level: 2 })).toHaveText(topic.title);
    await expect(helpNav(page)).toHaveAttribute('aria-current', 'page');
  }
});

test('Send feedback opens the existing page without submitting; topic changes add no history entries', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/') && request.method() !== 'GET') writes.push(request.url()); });
  await page.goto('/dashboard');
  await helpNav(page).click();
  await selector(page).getByRole('button', { name: 'Budget review', exact: true }).click();
  await selector(page).getByRole('button', { name: 'Maps & directions', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Your travel home', exact: true })).toBeVisible();
  await page.goForward();
  await expect(detail(page).getByRole('heading', { level: 2 })).toHaveText('Maps & directions');
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click();
  await expect(page).toHaveURL('/dashboard?tab=feedback');
  await expect(page.getByRole('heading', { name: 'Feedback and support', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Report a problem', exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  await page.goBack();
  await expect(detail(page).getByRole('heading', { level: 2 })).toHaveText('Maps & directions');
  await page.reload();
  await expect(detail(page).getByRole('heading', { level: 2 })).toHaveText('Create a trip');
  await expect(helpNav(page)).toHaveAttribute('aria-current', 'page');
});

test('topic buttons support Tab, Shift+Tab, Enter and Space with visible focus', async ({ page }) => {
  await page.goto('/dashboard?tab=help');
  const buttons = selector(page).getByRole('button');
  await buttons.first().focus();
  for (let index = 0; index < topics.length; index++) {
    await expect(buttons.nth(index)).toBeFocused();
    expect(await buttons.nth(index).evaluate(element => parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2);
    await expect(buttons.nth(index)).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press(index % 2 ? 'Space' : 'Enter');
    await expect(buttons.nth(index)).toHaveAttribute('aria-pressed', 'true');
    await expect(buttons.nth(index)).toBeFocused();
    await expect(detail(page).getByRole('heading', { level: 2 })).toHaveText(topics[index].title);
    if (index < topics.length - 1) await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Shift+Tab');
  await expect(buttons.nth(4)).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(detail(page).getByRole('button')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/dashboard?tab=profile');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'How can we help you?', level: 1 })).toBeFocused();
});

test('responsive cards stack on phones and long guides scroll to the action and support', async ({ page }, info) => {
  await page.goto('/dashboard?tab=help');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const topicsBox = await selector(page).boundingBox();
    const detailBox = await detail(page).boundingBox();
    expect(topicsBox).not.toBeNull(); expect(detailBox).not.toBeNull();
    if (width < 768) expect(detailBox!.y).toBeGreaterThanOrEqual(topicsBox!.y + topicsBox!.height);
    else expect(detailBox!.x).toBeGreaterThan(topicsBox!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const topic of topics) {
      await selector(page).getByRole('button', { name: topic.title, exact: true }).click();
      const action = detail(page).getByRole('button', { name: topic.action, exact: true });
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await selector(page).getByRole('button', { name: 'Create a trip', exact: true }).click();
    const support = page.getByRole('region', { name: 'Still need help?', exact: true });
    await support.scrollIntoViewIfNeeded();
    await expect(support.getByRole('button', { name: 'Send feedback' })).toBeInViewport();
    await expect(detail(page)).toHaveCSS('overflow-y', 'visible');
    if (width === 320) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: info.outputPath('help-small-phone.png'), fullPage: true });
    }
  }
});
