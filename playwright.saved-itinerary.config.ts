import { defineConfig } from '@playwright/test';
import base from './playwright.budget-navigation.config';

export default defineConfig({
  ...base,
  testMatch: ['saved-trip-itinerary-view.spec.ts', 'itinerary-budget-navigation.spec.ts'],
});
