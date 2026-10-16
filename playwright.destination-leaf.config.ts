import { defineConfig } from '@playwright/test';
import base from './playwright.plan.config';
export default defineConfig({ ...base, timeout: 90000, expect: { timeout: 15000 }, webServer: process.env.PLAYWRIGHT_USE_EXISTING_SERVER === '1' ? undefined : base.webServer, testMatch: ['direct-optional-destination.spec.ts','country-aware-destination.spec.ts'] });
