import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import base from './playwright.budget-review.config';

process.env.GLOBAL_LOCATION_CATALOGUE_PATH = fileURLToPath(new URL('../travelmate-backend-api/tests/fixtures/not-installed.sqlite', import.meta.url));

export default defineConfig({ ...base, testMatch: 'country-browsing-fallback.spec.ts' });
