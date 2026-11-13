import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1') {
  throw new Error('E2E_BASE_URL deve apontar para o servidor local em 127.0.0.1.');
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
