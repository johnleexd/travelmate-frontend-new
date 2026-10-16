import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'my-plan.spec.ts', workers: 1, reporter: 'line', timeout: 45000,
  use: { baseURL: 'http://localhost:3000', channel: process.env.CI ? undefined : 'chrome', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1050 } } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
  webServer: { command: 'node node_modules/next/dist/bin/next dev --port 3000', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120000 },
});
