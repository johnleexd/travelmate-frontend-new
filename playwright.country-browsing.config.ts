import {defineConfig} from '@playwright/test';
import base from './playwright.config';
// Source-backed browser tests intercept the API and execute the real catalogue
// services in their worker. A production UI avoids development watcher teardown
// and does not need a private database or external hotel/AI accounts.
export default defineConfig({...base,use:{...base.use,baseURL:'http://localhost:3007',extraHTTPHeaders:{'x-forwarded-proto':'https'}},webServer:undefined,reporter:[['line'],['json',{outputFile:'../audit/2026-10-14/country-browsing/browser-results.json'}]]});
