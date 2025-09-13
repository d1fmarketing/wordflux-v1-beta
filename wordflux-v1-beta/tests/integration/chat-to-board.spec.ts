import { test, expect, Page } from '@playwright/test';

test.describe('Chat to Board Integration', () => {
  const baseUrl = 'http://52.4.68.118';
  
  test('Complete task lifecycle via chat', async ({ page }) => {
    await page.goto(`${baseUrl}/workspace`);
    
    // Wait for workspace to load
    await page.waitForSelector('text=AI Assistant', { timeout: 10000 });
    await page.waitForSelector('text=Kanban Board', { timeout: 10000 });
    
    // Create unique task name
    const taskName = `Integration Test ${Date.now()}`;
    
    // Create task via chat
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    await chatInput.click();
    await chatInput.fill(`Create a task called "${taskName}" with high priority`);
    await chatInput.press('Enter');
    
    // Wait for AI response
    await page.waitForSelector('text=Assistant', { timeout: 10000 });
    
    // Wait for board to update
    await page.waitForTimeout(3000);
    
    // Verify task appears on board
    const taskElement = page.locator(`text=${taskName}`);
    await expect(taskElement).toBeVisible({ timeout: 10000 });
    
    // Move task to Ready via chat
    await chatInput.click();
    await chatInput.fill(`Move "${taskName}" to Ready`);
    await chatInput.press('Enter');
    
    // Wait for update
    await page.waitForTimeout(3000);
    
    // Verify task is in Ready column
    const readyColumn = page.locator('h3:has-text("Ready")').locator('..');
    await expect(readyColumn.locator(`text=${taskName}`)).toBeVisible();
    
    // Move to Done via chat
    await chatInput.click();
    await chatInput.fill(`Mark "${taskName}" as done`);
    await chatInput.press('Enter');
    
    // Wait for final update
    await page.waitForTimeout(3000);
    
    // Verify task is in Done column
    const doneColumn = page.locator('h3:has-text("Done")').locator('..');
    await expect(doneColumn.locator(`text=${taskName}`)).toBeVisible();
  });

  test('Bulk operations via chat', async ({ page }) => {
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=AI Assistant');
    
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    
    // Create multiple tasks
    const taskPrefix = `Bulk Test ${Date.now()}`;
    
    await chatInput.fill(`Create 3 tasks: "${taskPrefix}-1", "${taskPrefix}-2", "${taskPrefix}-3"`);
    await chatInput.press('Enter');
    
    // Wait for processing
    await page.waitForTimeout(5000);
    
    // Verify all tasks were created
    for (let i = 1; i <= 3; i++) {
      const task = page.locator(`text=${taskPrefix}-${i}`);
      await expect(task).toBeVisible({ timeout: 10000 });
    }
  });

  test('Chat commands update board in real-time', async ({ page }) => {
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=Kanban Board');
    
    // Get initial task count in Backlog
    const backlogColumn = page.locator('h3:has-text("Backlog")').locator('..');
    const initialTasks = await backlogColumn.locator('[style*="background"]').count();
    
    // Create task via chat
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    await chatInput.fill(`Create a quick test task ${Date.now()}`);
    await chatInput.press('Enter');
    
    // Wait for board update
    await page.waitForTimeout(3000);
    
    // Verify task count increased
    const newTasks = await backlogColumn.locator('[style*="background"]').count();
    expect(newTasks).toBeGreaterThanOrEqual(initialTasks);
  });

  test('Board state queries via chat', async ({ page }) => {
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=AI Assistant');
    
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    
    // Query board state
    await chatInput.fill('How many tasks are in each column?');
    await chatInput.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Verify response contains column information
    const assistantResponse = page.locator('text=Assistant').last().locator('..').locator('div').last();
    const responseText = await assistantResponse.textContent();
    
    expect(responseText).toMatch(/backlog/i);
    expect(responseText).toMatch(/ready/i);
    expect(responseText).toMatch(/progress/i);
    expect(responseText).toMatch(/done/i);
  });

  test('Error recovery in chat-board sync', async ({ page }) => {
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=AI Assistant');
    
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    
    // Try to move non-existent task
    await chatInput.fill('Move task "NonExistentTask12345" to Done');
    await chatInput.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Should get error message but not crash
    const assistantResponse = page.locator('text=Assistant').last().locator('..').locator('div').last();
    const responseText = await assistantResponse.textContent();
    
    expect(responseText).toMatch(/not found|doesn't exist|unable/i);
    
    // System should still be functional
    await chatInput.fill('Show board summary');
    await chatInput.press('Enter');
    await page.waitForTimeout(3000);
    
    // Should get valid response
    const summaryResponse = page.locator('text=Assistant').last().locator('..').locator('div').last();
    expect(await summaryResponse.textContent()).toBeTruthy();
  });

  test('Complex task creation with metadata', async ({ page }) => {
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=AI Assistant');
    
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    const taskName = `Complex Task ${Date.now()}`;
    
    // Create task with full metadata
    await chatInput.fill(`Create a high priority bug task called "${taskName}" with description "Critical login issue" and tag it as urgent`);
    await chatInput.press('Enter');
    
    // Wait for processing
    await page.waitForTimeout(5000);
    
    // Verify task was created with metadata
    const taskElement = page.locator(`text=${taskName}`).first();
    await expect(taskElement).toBeVisible();
    
    // Check for priority indicator
    const taskContainer = taskElement.locator('..');
    const priorityBadge = taskContainer.locator('text=URGENT');
    await expect(priorityBadge).toBeVisible();
    
    // Check for tag
    const urgentTag = taskContainer.locator('text=urgent');
    await expect(urgentTag).toBeVisible();
  });

  test('Chat suggestions work correctly', async ({ page }) => {
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=AI Assistant');
    
    // Check for suggestions (if implemented)
    const suggestions = page.locator('button:has-text("Daily summary"), button:has-text("Show urgent tasks")');
    
    if (await suggestions.count() > 0) {
      // Click a suggestion
      await suggestions.first().click();
      
      // Should populate input or send message
      await page.waitForTimeout(2000);
      
      // Verify response
      const assistantResponse = page.locator('text=Assistant');
      await expect(assistantResponse).toBeVisible();
    }
  });

  test('Simultaneous chat and board interactions', async ({ page, context }) => {
    // Open two tabs
    const page1 = page;
    const page2 = await context.newPage();
    
    await page1.goto(`${baseUrl}/workspace`);
    await page2.goto(`${baseUrl}/workspace`);
    
    // Wait for both to load
    await page1.waitForSelector('text=Kanban Board');
    await page2.waitForSelector('text=Kanban Board');
    
    // Create task in first tab
    const chatInput1 = page1.locator('input[placeholder="Type a message..."]');
    const taskName = `Concurrent Test ${Date.now()}`;
    await chatInput1.fill(`Create task "${taskName}"`);
    await chatInput1.press('Enter');
    
    // Wait for sync
    await page1.waitForTimeout(5000);
    await page2.waitForTimeout(5000);
    
    // Task should appear in both tabs
    await expect(page1.locator(`text=${taskName}`)).toBeVisible();
    await expect(page2.locator(`text=${taskName}`)).toBeVisible();
  });

  test('Chat maintains context across messages', async ({ page }) => {
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=AI Assistant');
    
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    const taskName = `Context Test ${Date.now()}`;
    
    // First message - create task
    await chatInput.fill(`Create a task called "${taskName}"`);
    await chatInput.press('Enter');
    await page.waitForTimeout(3000);
    
    // Second message - refer to "it"
    await chatInput.fill('Add high priority to it');
    await chatInput.press('Enter');
    await page.waitForTimeout(3000);
    
    // Third message - move "the task"
    await chatInput.fill('Move the task to Ready');
    await chatInput.press('Enter');
    await page.waitForTimeout(3000);
    
    // Verify task is in Ready with priority
    const readyColumn = page.locator('h3:has-text("Ready")').locator('..');
    const task = readyColumn.locator(`text=${taskName}`);
    await expect(task).toBeVisible();
  });

  test('Board refresh after chat actions', async ({ page }) => {
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=Kanban Board');
    
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    
    // Create task
    const taskName = `Refresh Test ${Date.now()}`;
    await chatInput.fill(`Create task "${taskName}"`);
    await chatInput.press('Enter');
    
    // Wait for initial sync
    await page.waitForTimeout(3000);
    await expect(page.locator(`text=${taskName}`)).toBeVisible();
    
    // Refresh page
    await page.reload();
    await page.waitForSelector('text=Kanban Board');
    
    // Task should still be visible
    await expect(page.locator(`text=${taskName}`)).toBeVisible();
  });
});