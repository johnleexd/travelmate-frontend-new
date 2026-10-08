import { expect, test, type Page } from '@playwright/test';
import { mockPlanningLookups } from './helpers/mock-planning-lookups';

const destinations = ['Eiffel Tower', 'Fushimi Inari Taisha', 'Colosseum', 'Sydney Opera House', 'Taj Mahal', 'Machu Picchu'];
const carouselFor = (page: Page) => page.getByRole('region', { name: 'Famous destinations carousel' });

async function openPlanner(page: Page) {
  await page.context().addCookies([{ name: 'travelmate_session', value: 'infinite-carousel-fixture', domain: 'localhost', path: '/' }]);
  await mockPlanningLookups(page);
  await page.route('**/api/platform**', route => route.fulfill({ json: {
    user: { id: 'carousel-fixture', name: 'Carousel Tester', email: 'carousel@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true },
    trips: [], tripsPage: { total: 0, nextCursor: null }, directory: [], notifications: [], listings: [], bookings: [], moderation: [], audit: [], itineraryVersions: [], itineraryGenerations: [],
  } }));
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Use my current location', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Starting location (optional)', exact: true })).toHaveAttribute('placeholder', 'Enter your starting city.');
  await carouselFor(page).scrollIntoViewIfNeeded();
}

async function expectLeadingDestination(page: Page, name: string) {
  await expect(page.getByRole('button', { name: `Show ${name}`, exact: true })).toHaveAttribute('aria-current', 'true');
  await expect.poll(() => carouselFor(page).evaluate((viewport, name) => {
    const slide = Array.from(viewport.querySelectorAll('article')).find(element => element.getAttribute('aria-label')?.endsWith(`: ${name}`));
    return slide ? Math.abs(slide.getBoundingClientRect().left - viewport.getBoundingClientRect().left) : Infinity;
  }, name)).toBeLessThan(2);
}

async function expectWrappedSpacing(page: Page) {
  const gap = await carouselFor(page).evaluate(viewport => {
    const slides = viewport.querySelectorAll('article');
    return slides[0].getBoundingClientRect().left - slides[5].getBoundingClientRect().right;
  });
  expect(gap).toBeGreaterThan(15);
  expect(gap).toBeLessThan(17);
}

test('arrows loop repeatedly in both directions, preserve visible neighbours, and work after resizing', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openPlanner(page);
  const previous = page.getByRole('button', { name: 'Previous destination', exact: true });
  const next = page.getByRole('button', { name: 'Next destination', exact: true });
  await expectLeadingDestination(page, destinations[0]);
  await previous.click();
  await expectLeadingDestination(page, destinations[5]);
  await expectWrappedSpacing(page);
  // The first destination immediately follows the last, filling the same strip.
  const neighbours = await carouselFor(page).evaluate(viewport => {
    const left = viewport.getBoundingClientRect().left;
    const width = viewport.clientWidth;
    return Array.from(viewport.querySelectorAll('article')).filter(slide => {
      const box = slide.getBoundingClientRect();
      return box.left >= left - 2 && box.right <= left + width + 2;
    }).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(slide => slide.querySelector('strong')?.textContent);
  });
  expect(neighbours).toEqual(['Machu Picchu', 'Eiffel Tower', 'Fushimi Inari Taisha']);
  await page.screenshot({ path: '../audit/2026-10-08/infinite-carousel/wrapped-desktop.png' });
  await next.click(); await expectLeadingDestination(page, destinations[0]);
  for (let step = 1; step <= 12; step++) {
    await next.click(); await expectLeadingDestination(page, destinations[step % 6]);
    await expect(previous).toBeEnabled(); await expect(next).toBeEnabled();
  }
  for (let step = 1; step <= 7; step++) {
    await previous.click(); await expectLeadingDestination(page, destinations[(12 - step) % 6]);
  }
  await carouselFor(page).focus(); await page.keyboard.press('ArrowRight');
  await expectLeadingDestination(page, destinations[0]);
  // A burst of clicks must not lose steps while a previous transition is running.
  for (let step = 0; step < 7; step++) await next.click();
  await expectLeadingDestination(page, destinations[1]);
  await page.getByRole('button', { name: 'Show Machu Picchu', exact: true }).click();
  await expectLeadingDestination(page, destinations[5]);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectLeadingDestination(page, destinations[5]);
    await next.click(); await expectLeadingDestination(page, destinations[0]);
    await previous.click(); await expectLeadingDestination(page, destinations[5]);
  }
  await expect(carouselFor(page).getByRole('button', { name: /^View / })).toHaveCount(6);
  const wrappedCard = carouselFor(page).getByRole('button', { name: 'View Machu Picchu in Peru', exact: true });
  await wrappedCard.click();
  const modal = page.getByRole('dialog', { name: 'Machu Picchu', exact: true });
  await expect(modal.getByText('Cusco, Peru · Trip base', { exact: true })).toBeVisible();
  await expect(modal.getByRole('link', { name: 'Official visitor guide' })).toHaveAttribute('href', 'https://machupicchu.gob.pe/');
  await page.keyboard.press('Escape'); await expect(wrappedCard).toBeFocused();
});

test('mobile touch swipes across both ends without opening a preview during a drag', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  try {
    await openPlanner(page);
    await expectLeadingDestination(page, destinations[0]);
    const session = await context.newCDPSession(page);
    async function swipe(direction: 'left' | 'right') {
      const box = (await carouselFor(page).boundingBox())!;
      const start = box.x + box.width * (direction === 'left' ? 0.8 : 0.2);
      const end = box.x + box.width * (direction === 'left' ? 0.2 : 0.8);
      const y = box.y + 100;
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
      for (let step = 1; step <= 12; step++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * step / 12, y }] });
        await page.waitForTimeout(20);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await swipe('right'); await expectLeadingDestination(page, destinations[5]);
    await expectWrappedSpacing(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.screenshot({ path: '../audit/2026-10-08/infinite-carousel/wrapped-mobile.png' });
    await swipe('left'); await expectLeadingDestination(page, destinations[0]);
    await swipe('left'); await expectLeadingDestination(page, destinations[1]);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await carouselFor(page).getByRole('button', { name: 'View Fushimi Inari Taisha in Japan', exact: true }).tap();
    await expect(page.getByRole('dialog', { name: 'Fushimi Inari Taisha', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close destination preview', exact: true }).tap();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectLeadingDestination(page, destinations[1]);
  } finally { await context.close(); }
});
