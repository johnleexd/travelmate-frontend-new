import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base, webServer: undefined, reporter: 'line',
  testMatch: ['trip-preferences.spec.ts', 'next-stop.spec.ts', 'expense-estimates.spec.ts', 'itinerary-presentation.spec.ts', 'worldwide-currency.spec.ts', 'exchange-rate-lifecycle.spec.ts'],
});
