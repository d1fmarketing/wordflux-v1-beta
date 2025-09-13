import { test as setup } from '@playwright/test'

const authFile = 'tests/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // Go to login page
  await page.goto('/login')
  
  // Fill in credentials
  await page.fill('input[name="email"]', 'admin@wordflux.local')
  await page.fill('input[name="password"]', 'wordflux2025')
  
  // Submit form
  await page.click('button[type="submit"]')
  
  // Wait for redirect to workspace
  await page.waitForURL('/workspace', { timeout: 10000 })
  
  // Save authentication state
  await page.context().storageState({ path: authFile })
})