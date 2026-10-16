import { defineConfig } from '@playwright/test';
import base from './playwright.plan.config';

export default defineConfig({ ...base, testMatch: ['draft-recovery-modal.spec.ts', 'generation-progress.spec.ts', 'my-plan.spec.ts'] });
