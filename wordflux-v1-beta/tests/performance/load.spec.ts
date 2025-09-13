import { test, expect } from '@playwright/test';

test.describe('Performance and Load Tests', () => {
  const baseUrl = 'http://52.4.68.118';
  
  test('Page load time is acceptable', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=Kanban Board');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Measure time to interactive
    await page.waitForLoadState('networkidle');
    const fullyLoadedTime = Date.now() - startTime;
    
    // Fully interactive in under 5 seconds
    expect(fullyLoadedTime).toBeLessThan(5000);
  });

  test('Board handles large number of tasks', async ({ page, request }) => {
    // Create many tasks via API
    const taskPromises = [];
    const batchSize = 20;
    
    for (let i = 0; i < batchSize; i++) {
      taskPromises.push(
        request.post(`${baseUrl}/api/board/create`, {
          data: {
            title: `Load Test Task ${i} - ${Date.now()}`,
            description: `Performance test task with some description text to simulate real content`,
            column_id: 1,
            tags: ['performance', 'test', `batch-${i}`]
          }
        })
      );
    }
    
    // Create all tasks
    await Promise.all(taskPromises);
    
    // Now load the page with many tasks
    const startTime = Date.now();
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=Kanban Board');
    
    const loadTime = Date.now() - startTime;
    
    // Should still load reasonably fast with many tasks
    expect(loadTime).toBeLessThan(5000);
    
    // Verify scrolling performance
    const boardContainer = page.locator('div:has(> h2:text("Kanban Board"))');
    await boardContainer.evaluate(el => {
      el.scrollTop = 500;
    });
    
    // Should scroll smoothly without errors
    await page.waitForTimeout(100);
    
    // Check that tasks are rendered
    const tasks = page.locator('div[style*="background"][style*="padding"]');
    const taskCount = await tasks.count();
    expect(taskCount).toBeGreaterThanOrEqual(batchSize);
  });

  test('API response times under load', async ({ request }) => {
    const endpoints = [
      '/api/board/sync',
      '/api/board/state',
      '/api/health',
      '/api/deploy'
    ];
    
    const responseTimes: number[] = [];
    
    // Test each endpoint multiple times
    for (const endpoint of endpoints) {
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        const response = await request.get(`${baseUrl}${endpoint}`);
        const responseTime = Date.now() - startTime;
        
        expect(response.ok()).toBeTruthy();
        responseTimes.push(responseTime);
      }
    }
    
    // Calculate average response time
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    // Average should be under 500ms
    expect(avgResponseTime).toBeLessThan(500);
    
    // No single request should take over 2 seconds
    responseTimes.forEach(time => {
      expect(time).toBeLessThan(2000);
    });
  });

  test('Concurrent user simulation', async ({ browser }) => {
    const userCount = 5;
    const contexts = [];
    const pages = [];
    
    // Create multiple browser contexts (simulating different users)
    for (let i = 0; i < userCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }
    
    // All users navigate simultaneously
    const navigationPromises = pages.map(page => 
      page.goto(`${baseUrl}/workspace`)
    );
    
    await Promise.all(navigationPromises);
    
    // All users wait for board to load
    const loadPromises = pages.map(page => 
      page.waitForSelector('text=Kanban Board', { timeout: 10000 })
    );
    
    await Promise.all(loadPromises);
    
    // Each user creates a task
    const taskPromises = pages.map(async (page, index) => {
      const chatInput = page.locator('input[placeholder="Type a message..."]');
      await chatInput.fill(`User ${index} task ${Date.now()}`);
      await chatInput.press('Enter');
    });
    
    await Promise.all(taskPromises);
    
    // Wait for all updates
    await Promise.all(pages.map(page => page.waitForTimeout(3000)));
    
    // Verify all pages are still responsive
    for (const page of pages) {
      const boardVisible = await page.locator('text=Kanban Board').isVisible();
      expect(boardVisible).toBeTruthy();
    }
    
    // Clean up
    await Promise.all(contexts.map(context => context.close()));
  });

  test('Memory usage stability', async ({ page }) => {
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=Kanban Board');
    
    // Perform multiple operations
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    
    for (let i = 0; i < 10; i++) {
      // Create task
      await chatInput.fill(`Memory test task ${i}`);
      await chatInput.press('Enter');
      await page.waitForTimeout(1000);
      
      // Query board
      await chatInput.fill('Show board summary');
      await chatInput.press('Enter');
      await page.waitForTimeout(1000);
    }
    
    // Check that page is still responsive
    const performanceMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
      return null;
    });
    
    if (performanceMetrics) {
      // Check that memory usage is reasonable
      const usedJSHeapSize = performanceMetrics.usedJSHeapSize;
      const totalJSHeapSize = performanceMetrics.totalJSHeapSize;
      
      // Used memory should be less than 100MB
      expect(usedJSHeapSize).toBeLessThan(100 * 1024 * 1024);
      
      // Should not be using more than 80% of allocated heap
      const heapUsageRatio = usedJSHeapSize / totalJSHeapSize;
      expect(heapUsageRatio).toBeLessThan(0.8);
    }
  });

  test('Board polling performance', async ({ page }) => {
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=Kanban Board');
    
    // Monitor network requests for 30 seconds
    const requests: any[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/board')) {
        requests.push({
          url: request.url(),
          timestamp: Date.now()
        });
      }
    });
    
    // Wait for polling to occur
    await page.waitForTimeout(30000);
    
    // Should have regular polling (every 5 seconds)
    expect(requests.length).toBeGreaterThan(4);
    expect(requests.length).toBeLessThan(10);
    
    // Check polling interval consistency
    for (let i = 1; i < requests.length; i++) {
      const interval = requests[i].timestamp - requests[i-1].timestamp;
      // Should be roughly 5 seconds (allow 4-6 seconds)
      expect(interval).toBeGreaterThan(4000);
      expect(interval).toBeLessThan(6000);
    }
  });

  test('Chat response time under load', async ({ page }) => {
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=AI Assistant');
    
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    const responseTimes: number[] = [];
    
    // Send multiple messages
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      
      await chatInput.fill(`Performance test message ${i}`);
      await chatInput.press('Enter');
      
      // Wait for assistant response
      await page.waitForSelector(`text=Assistant >> nth=${i+1}`, { timeout: 10000 });
      
      const responseTime = Date.now() - startTime;
      responseTimes.push(responseTime);
      
      await page.waitForTimeout(1000); // Brief pause between messages
    }
    
    // Calculate average chat response time
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    // Average should be under 3 seconds
    expect(avgResponseTime).toBeLessThan(3000);
    
    // No single response should take over 5 seconds
    responseTimes.forEach(time => {
      expect(time).toBeLessThan(5000);
    });
  });

  test('Render performance with complex tasks', async ({ page, request }) => {
    // Create tasks with lots of metadata
    const complexTasks = [];
    for (let i = 0; i < 10; i++) {
      complexTasks.push(
        request.post(`${baseUrl}/api/board/create`, {
          data: {
            title: `Complex Task ${i} with a very long title that might wrap to multiple lines`,
            description: `This is a detailed description that contains multiple sentences. It should test how well the UI handles longer text content. We want to ensure that performance doesn't degrade with complex task data.`,
            column_id: 1,
            tags: ['urgent', 'bug', 'performance', 'test', `tag-${i}`],
            priority: 3,
            assignees: ['user1', 'user2', 'user3']
          }
        })
      );
    }
    
    await Promise.all(complexTasks);
    
    // Load page with complex tasks
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=Kanban Board');
    
    // Measure interaction performance
    const startTime = Date.now();
    
    // Scroll through board
    const boardArea = page.locator('div:has(> h2:text("Kanban Board"))');
    await boardArea.evaluate(el => {
      el.scrollLeft = 200;
    });
    
    const interactionTime = Date.now() - startTime;
    
    // Interaction should be instant (under 100ms)
    expect(interactionTime).toBeLessThan(100);
    
    // Verify all task elements render correctly
    const urgentBadges = page.locator('text=URGENT');
    const badgeCount = await urgentBadges.count();
    expect(badgeCount).toBeGreaterThanOrEqual(10);
  });

  test('Database query optimization', async ({ request }) => {
    // Test that repeated queries are optimized
    const iterations = 10;
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const response = await request.get(`${baseUrl}/api/board/sync`);
      const responseTime = Date.now() - startTime;
      
      expect(response.ok()).toBeTruthy();
      times.push(responseTime);
    }
    
    // Later queries should be faster (caching/optimization)
    const firstHalf = times.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const secondHalf = times.slice(5).reduce((a, b) => a + b, 0) / 5;
    
    // Second half should be same or faster
    expect(secondHalf).toBeLessThanOrEqual(firstHalf * 1.2);
  });
});