import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: 'budget-review.spec.ts', workers: 1,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:3010', channel: process.env.CI ? undefined : 'chrome', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3010',
    url: 'http://127.0.0.1:3010', reuseExistingServer: true, timeout: 120_000,
    env: { TRAVELMATE_ISOLATED_BUILD: 'true' },
  },
});
