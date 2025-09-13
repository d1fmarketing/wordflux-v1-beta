import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Setup project - runs first to authenticate
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // API tests - run serially to avoid SQLite locks
    {
      name: 'api',
      testMatch: /tests\/api\/.*\.spec\.ts/,
      workers: 1,
      retries: 1,
      fullyParallel: false,  // No cross-file parallelism
      use: { 
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        // Note: To use mock, set KANBOARD_MOCK=1 when running tests
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use authenticated state from setup
        storageState: 'tests/.auth/user.json',
      },
      testIgnore: /tests\/api\/.*\.spec\.ts/,  // API tests handled separately
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

