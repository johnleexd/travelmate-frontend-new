import { defineConfig } from '@playwright/test';
import base from './playwright.destination-selector.config';
export default defineConfig({...base,reporter:[['line'],['json',{outputFile:'../audit/2026-10-14/country-aware-destination/browser-results.json'}]]});
