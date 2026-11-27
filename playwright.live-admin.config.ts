import { defineConfig, devices } from '@playwright/test';

// Admin-side tests against the LIVE site. Runs only in GitHub Actions (.github/workflows/live-qa.yml),
// which creates a temporary password-less QA admin, then deletes it and all test data afterwards.
const channel = process.env.PW_CHANNEL || 'msedge';
export default defineConfig({
  testDir: 'e2e-live-admin',
  timeout: 300_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
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
  projects: [{ name: 'live-admin', use: { ...devices['Pixel 7'], channel } }],
});
