import { test, expect } from '@playwright/test';

test.describe('Workspace Regression Tests', () => {
  test('workspace renders board & chat without errors', async ({ page }) => {
    // Navigate to workspace
    await page.goto('http://52.4.68.118/workspace');
    
    // Wait for initial loading to complete
    await expect(page.getByText('Loading workspace...')).toBeVisible({ timeout: 5000 });
    
    // Verify board loads (check for column headers)
    await expect(page.getByText(/Backlog|Ready|Work in progress|Done/).first()).toBeVisible({ timeout: 10000 });
    
    // Ensure no application errors
    await expect(page.getByText('Application error')).toHaveCount(0);
    
    // Verify chat panel is visible
    await expect(page.getByText('AI Assistant')).toBeVisible();
    
    // Verify Kanban Board header is visible
    await expect(page.getByText('Kanban Board')).toBeVisible();
  });

  test('board displays tasks correctly', async ({ page }) => {
    await page.goto('http://52.4.68.118/workspace');
    
    // Wait for board to load
    await page.waitForTimeout(3000);
    
    // Check that at least one column has the expected structure
    const backlogColumn = page.locator('text=Backlog').first();
    await expect(backlogColumn).toBeVisible();
    
    // Verify no React errors in console
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Check for specific React errors
    const reactErrors = consoleErrors.filter(err => 
      err.includes('React error') || 
      err.includes('Minified React error')
    );
    
    expect(reactErrors.length).toBe(0);
  });

  test('chat input is functional', async ({ page }) => {
    await page.goto('http://52.4.68.118/workspace');
    
    // Wait for chat to load
    await page.waitForTimeout(3000);
    
    // Find and interact with chat input
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    await expect(chatInput).toBeVisible();
    
    // Type a test message
    await chatInput.click();
    await chatInput.fill('Test message');
    await expect(chatInput).toHaveValue('Test message');
    
    // Clear the input
    await chatInput.clear();
    await expect(chatInput).toHaveValue('');
  });

  test('board updates are reflected after refresh', async ({ page }) => {
    await page.goto('http://52.4.68.118/workspace');
    
    // Wait for initial load
    await page.waitForTimeout(3000);
    
    // Check initial board state
    const columnsBeforeRefresh = await page.locator('h3').filter({ hasText: /Backlog|Ready|Work in progress|Done/ }).count();
    expect(columnsBeforeRefresh).toBeGreaterThan(0);
    
    // Refresh the page
    await page.reload();
    
    // Wait for board to reload
    await page.waitForTimeout(3000);
    
    // Verify board still loads correctly after refresh
    const columnsAfterRefresh = await page.locator('h3').filter({ hasText: /Backlog|Ready|Work in progress|Done/ }).count();
    expect(columnsAfterRefresh).toBe(columnsBeforeRefresh);
    
    // Ensure no errors after refresh
    await expect(page.getByText('Application error')).toHaveCount(0);
  });
});

// Run with: npx playwright test tests/workspace-regression.spec.ts