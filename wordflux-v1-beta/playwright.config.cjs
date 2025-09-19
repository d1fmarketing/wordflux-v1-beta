const { defineConfig, devices } = require('@playwright/test');
const path = require('node:path');

const globalSetup = path.join(__dirname, 'tests', 'global-setup.ts');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  reporter: [
    ['line'],
    ['json', { outputFile: 'artifacts/report.json' }],
    ['html', { outputFolder: 'artifacts/html', open: 'never' }],
  ],
  globalSetup,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'api',
      testMatch: /tests\/api\/.*\.spec\.ts/,
      workers: 1,
      retries: 1,
      fullyParallel: false,
      use: {
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
      },
      testIgnore: /tests\/api\/.*\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
