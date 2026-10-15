import { expect, test, type Page } from '@playwright/test';

const background = '[data-cinematic-background]';
async function openScene(page: Page) {
  await page.goto('/');
  await page.locator('#discovery').scrollIntoViewIfNeeded();
  await expect(page.locator(background)).toHaveAttribute('data-scene', 'ready');
  await expect(page.locator('#discovery canvas')).toHaveAttribute('data-ready', 'true');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-atmosphere] img')].every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0));
}
async function capableDevice(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 8 });
    Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined });
  });
}

test('loads one responsive scenery image near the viewport without shifting or intercepting controls', async ({ page }) => {
  await capableDevice(page);
  const sceneryRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/discovery/cinematic/') && request.url().includes('/tropical-sunset-') && request.url().endsWith('.webp')) sceneryRequests.push(request.url()); });
  await page.goto('/');
  expect(sceneryRequests).toHaveLength(0);
  await page.locator('#discovery').scrollIntoViewIfNeeded();
  await expect(page.locator(background)).toHaveAttribute('data-scene', 'ready');
  expect(sceneryRequests).toHaveLength(1);
  expect(sceneryRequests[0]).toContain('desktop.webp');
  await expect(page.locator('#discovery canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Pause rotation', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const before = await page.locator('#discovery').boundingBox();
  await page.locator(background).evaluate(element => { (element as HTMLElement).style.display = 'none'; });
  const withoutScenery = await page.locator('#discovery').boundingBox();
  expect(withoutScenery).toEqual(before);
  await page.locator(background).evaluate(element => { (element as HTMLElement).style.removeProperty('display'); });
  await expect(page.locator(background)).toHaveCSS('pointer-events', 'none');
  expect(await page.locator(background + ' button, ' + background + ' a, ' + background + ' canvas').count()).toBe(0);
  await page.getByRole('combobox', { name: 'Discover a country or territory' }).selectOption('JPN');
  await expect(page.getByRole('combobox', {name: 'Discover a country or territory'})).toHaveValue('JPN');
  await expect(page.locator('#discovery canvas')).toHaveAttribute('data-selected-country', 'JPN');
  await expect(page.locator('#discovery canvas')).toHaveAttribute('data-selected-country', 'JPN');
});

test('clouds and mist move gently, then freeze offscreen and while the page is hidden', async ({ page }) => {
  await capableDevice(page);
  await openScene(page);
  await expect(page.locator(background)).toHaveAttribute('data-motion', 'running');
  const mist = page.locator('[data-atmosphere="mist"]');
  const clouds = page.locator('[data-atmosphere="clouds"]');
  const readX = (element: Element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41;
  const before = { cloud: await clouds.evaluate(readX), mist: await mist.evaluate(readX) };
  const screenshotStyle = '#discovery > div:last-child, nextjs-portal, [data-atmosphere="sunlight"] { visibility:hidden!important }';
  await page.locator(background).screenshot({path:'../audit/2026-10-10/globe-animation-fix/test-t0.png',style:screenshotStyle,animations:'allow'});
  await page.waitForTimeout(10000);
  await page.locator(background).screenshot({path:'../audit/2026-10-10/globe-animation-fix/test-t10.png',style:screenshotStyle,animations:'allow'});
  expect(Math.abs(await clouds.evaluate(readX) - before.cloud)).toBeGreaterThan(20);
  expect(Math.abs(await mist.evaluate(readX) - before.mist)).toBeGreaterThan(30);
  for (const layer of ['mist', 'clouds', 'sunlight']) await expect(page.locator('[data-atmosphere="' + layer + '"]')).toHaveCSS('animation-play-state', 'running');
  await page.locator('#top').scrollIntoViewIfNeeded();
  await expect(page.locator(background)).toHaveAttribute('data-motion', 'paused');
  await expect(mist).toHaveCSS('animation-play-state', 'paused');
  await page.waitForTimeout(100);
  const paused = await mist.evaluate(element => element.getAnimations()[0]?.currentTime);
  await page.waitForTimeout(350);
  expect(await mist.evaluate(element => element.getAnimations()[0]?.currentTime)).toBe(paused);
  await page.locator('#discovery').scrollIntoViewIfNeeded();
  await expect(page.locator(background)).toHaveAttribute('data-motion', 'running');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator(background)).toHaveAttribute('data-motion', 'paused');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator(background)).toHaveAttribute('data-motion', 'running');
});

test('reduced motion and constrained devices keep scenery static and country discovery usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openScene(page);
  await expect(page.locator(background)).toHaveAttribute('data-motion', 'static');
  expect(await page.locator(background).evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 2 });
  });
  await openScene(page);
  await expect(page.locator(background)).toHaveAttribute('data-motion', 'static');
  expect(await page.locator(background).evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.getByRole('combobox', { name: 'Discover a country or territory' }).selectOption('CAN');
  await expect(page.getByRole('combobox', {name: 'Discover a country or territory'})).toHaveValue('CAN');
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 4 });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 4 });
  });
  await openScene(page);
  await expect(page.locator(background)).toHaveAttribute('data-motion', 'running');
});

test('mobile and tablet load their own crop, retain the layout, and avoid overflow', async ({ page }) => {
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await openScene(page);
    expect(await page.locator(background + ' > picture img').evaluate(image => (image as HTMLImageElement).currentSrc)).toContain(width === 390 ? 'mobile.webp' : 'tablet.webp');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    for (const kind of ['clouds', 'mist']) expect(await page.locator('[data-atmosphere="' + kind + '"] img').evaluate(image => (image as HTMLImageElement).currentSrc)).toContain(width === 390 ? '-layer-mobile-v1.webp' : '-layer-v1.webp');
    await page.getByRole('combobox', { name: 'Discover a country or territory' }).selectOption('CAN');
    await expect(page.getByRole('combobox', {name: 'Discover a country or territory'})).toHaveValue('CAN');
  }
});

test('failed scenery keeps the emerald fallback and does not affect globe selection', async ({ page }) => {
  await page.route('**/discovery/cinematic/*.webp', route => route.abort());
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#discovery').scrollIntoViewIfNeeded();
  await expect(page.locator(background)).toHaveAttribute('data-scene', 'unavailable');
  await expect(page.locator(background + ' img')).toHaveCount(0);
  await expect(page.locator('#discovery canvas')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('combobox', { name: 'Discover a country or territory' }).selectOption('FRA');
  await expect(page.locator('#discovery canvas')).toHaveAttribute('data-selected-country', 'FRA');
  expect(errors).toEqual([]);
});

test('only the visible measured LCP image gets urgency, without initial scenery downloads', async ({ page }) => {
  const warnings: string[] = [];
  const requested: string[] = [];
  page.on('console', message => {
    if (message.text().includes('Largest Contentful Paint') && /tropical-sunset|mist-layer/.test(message.text())) warnings.push(message.text());
  });
  page.on('request', request => { if (request.url().includes('/discovery/cinematic/')) requested.push(request.url()); });
  for (const width of [1440, 390]) {
    await page.goto('about:blank');
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    requested.length = 0;
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.locator(background + ' img').count()).toBe(0);
    expect(requested).toHaveLength(0);
    await page.locator('#discovery').scrollIntoViewIfNeeded();
    await expect(page.locator(background)).toHaveAttribute('data-scene', 'ready');
    const cover = page.locator(background + ' > picture img');
    const mistImage = page.locator('[data-atmosphere="mist"] img');
    const cloudsImage = page.locator('[data-atmosphere="clouds"] img');
    await expect(cover).toHaveAttribute('loading', width === 390 ? 'lazy' : 'eager');
    await expect(cover).toHaveAttribute('fetchpriority', width === 390 ? 'auto' : 'high');
    await expect(mistImage).toHaveAttribute('loading', width === 390 ? 'eager' : 'lazy');
    await expect(mistImage).toHaveAttribute('fetchpriority', width === 390 ? 'high' : 'auto');
    await expect(cloudsImage).toHaveAttribute('loading', 'lazy');
    await expect(cloudsImage).toHaveAttribute('fetchpriority', 'auto');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-cinematic-background] img')].every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0));
    await page.waitForTimeout(200);
    expect(warnings).toEqual([]);
    const paths = requested.map(url => new URL(url).pathname);
    expect(new Set(paths).size).toBe(3);
    expect(paths).toHaveLength(3);
    expect(await page.locator('link[rel="preload"][as="image"]').evaluateAll(links => links.some(link => (link as HTMLLinkElement).href.includes('/discovery/cinematic/')))).toBe(false);
    if (width === 390) {
      await page.locator('#discovery').evaluate(section => window.scrollTo({ top: section.getBoundingClientRect().top + scrollY - innerHeight + 80, behavior: 'instant' }));
      await expect(mistImage).toHaveAttribute('loading', 'lazy');
      await expect(mistImage).toHaveAttribute('fetchpriority', 'auto');
    }
  }
});

test('restored globe scroll prioritizes the visible LCP candidate before paint', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', message => {
    if (message.text().includes('Largest Contentful Paint') && /tropical-sunset|mist-layer/.test(message.text())) warnings.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openScene(page);
  warnings.length = 0;
  await page.reload();
  await expect(page.locator(background)).toHaveAttribute('data-scene', 'ready');
  await expect(page.locator(background + ' > picture img')).toHaveAttribute('loading', 'eager');
  await expect(page.locator('[data-atmosphere="clouds"] img')).toHaveAttribute('loading', 'lazy');
  await expect(page.locator('[data-atmosphere="mist"] img')).toHaveAttribute('loading', 'lazy');
  await page.waitForTimeout(300);
  expect(warnings).toEqual([]);
});
