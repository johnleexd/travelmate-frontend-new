import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base, webServer: undefined, use: {...base.use, baseURL: 'http://localhost:3000'}, reporter: [['line'],['json',{outputFile:'../audit/2026-10-14/direct-optional-destination/browser-results.json'}]]});
