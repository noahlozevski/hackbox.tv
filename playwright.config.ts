import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  use: {
    baseURL: process.env.PW_BASE_URL || 'https://hackbox.tv.lozev.ski',
    viewport: { width: 1280, height: 720 },
  },
  timeout: 30_000,
});
