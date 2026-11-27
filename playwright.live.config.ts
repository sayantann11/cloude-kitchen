import { defineConfig, devices } from '@playwright/test';

// Smoke tests against the LIVE site and real database (customer side only, no logins).
// Run: npx playwright test -c playwright.live.config.ts
// Test orders are marked "TEST" and cancelled at the end of each test.
const channel = process.env.PW_CHANNEL || 'msedge';
export default defineConfig({
  testDir: 'e2e-live',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.LIVE_URL || 'https://night-kitchen-4d444.web.app',
    channel,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['geolocation'],
    geolocation: { latitude: 21.4815, longitude: 83.987 },
    timezoneId: 'Asia/Kolkata',
  },
  projects: [{ name: 'live-phone', use: { ...devices['Pixel 7'], channel } }],
});
