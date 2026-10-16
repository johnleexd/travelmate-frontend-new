import { defineConfig } from '@playwright/test';
import base from './playwright.plan.config';
export default defineConfig({ ...base, webServer: process.env.PLAYWRIGHT_USE_EXISTING_SERVER === '1' ? undefined : base.webServer, testMatch: ['party-budget.spec.ts', 'budget-review.spec.ts', 'draft-recovery-modal.spec.ts'] });
