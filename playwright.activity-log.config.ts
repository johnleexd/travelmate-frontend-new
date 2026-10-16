import { defineConfig } from '@playwright/test';
import base from './playwright.plan.config';
export default defineConfig({ ...base, testMatch: ['admin-activity-log.spec.ts', 'admin-simplified.spec.ts'] });
