import {defineConfig} from '@playwright/test';
import base from './playwright.destination-selector.config';
export default defineConfig({...base,timeout:60000,reporter:[['line'],['json',{outputFile:'../audit/2026-10-14/balanced-default/browser-results.json'}]]});
