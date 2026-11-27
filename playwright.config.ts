import { defineConfig, devices } from '@playwright/test';

// Uses the Edge/Chrome already installed on this PC (no browser download). Override with PW_CHANNEL=chrome.
const channel = process.env.PW_CHANNEL || 'msedge';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    channel,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['geolocation'],
    geolocation: { latitude: 21.4815, longitude: 83.987 },
    timezoneId: 'Asia/Kolkata',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], channel } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
