import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, webServer: undefined, timeout: 60000,
  use: { ...base.use, baseURL: 'http://localhost:3000' },
  reporter: [['line'], ['json', { outputFile: '../audit/2026-10-15/itinerary-overview/browser-results.json' }]],
});
