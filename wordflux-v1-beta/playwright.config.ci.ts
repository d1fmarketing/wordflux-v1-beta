import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: true, // Fail if test.only is left in code
  retries: 2,
  workers: 1, // Serial execution for SQLite safety
  reporter: [['html'], ['json', { outputFile: 'test-results.json' }]],
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'api-serial',
      testMatch: /tests\/api\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: false,
    },
    {
      name: 'ui',
      testMatch: /tests\/ui\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'TASKCAFE_MOCK=1 npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: {
      TASKCAFE_MOCK: '1',
      USE_DETERMINISTIC_PARSER: 'true',
    },
  },
});