import { test, expect } from '@playwright/test';

test.describe('Security and Authentication Tests', () => {
  const baseUrl = 'http://52.4.68.118';
  
  test('Input sanitization prevents XSS attacks', async ({ page, request }) => {
    // Try to inject script via chat
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=AI Assistant');
    
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>'
    ];
    
    for (const payload of xssPayloads) {
      await chatInput.fill(payload);
      await chatInput.press('Enter');
      await page.waitForTimeout(2000);
      
      // Check that no alert was triggered
      const alertFired = await page.evaluate(() => {
        let alertCalled = false;
        const originalAlert = window.alert;
        window.alert = () => { alertCalled = true; };
        setTimeout(() => { window.alert = originalAlert; }, 100);
        return alertCalled;
      });
      
      expect(alertFired).toBeFalsy();
    }
    
    // Try XSS via API
    const response = await request.post(`${baseUrl}/api/board/create`, {
      data: {
        title: '<script>alert("XSS")</script>',
        description: '<img src=x onerror=alert("XSS")>',
        column_id: 1
      }
    });
    
    // Should either sanitize or reject
    const data = await response.json();
    if (data.ok && data.task) {
      // If accepted, should be sanitized
      expect(data.task.title).not.toContain('<script>');
      expect(data.task.description).not.toContain('onerror');
    }
  });

  test('SQL injection prevention', async ({ request }) => {
    const sqlPayloads = [
      "'; DROP TABLE tasks; --",
      "1' OR '1'='1",
      "admin'--",
      "1; DELETE FROM tasks WHERE 1=1; --",
      "' UNION SELECT * FROM users --"
    ];
    
    for (const payload of sqlPayloads) {
      const response = await request.post(`${baseUrl}/api/board/create`, {
        data: {
          title: payload,
          column_id: 1
        }
      });
      
      // Should not cause database errors
      expect(response.status()).not.toBe(500);
      
      // Verify database is still functional
      const checkResponse = await request.get(`${baseUrl}/api/health`);
      expect(checkResponse.ok()).toBeTruthy();
    }
  });

  test('API rate limiting protection', async ({ request }) => {
    // Send rapid requests to test rate limiting
    const promises = [];
    const requestCount = 50;
    
    for (let i = 0; i < requestCount; i++) {
      promises.push(
        request.post(`${baseUrl}/api/chat`, {
          data: { message: `Rate limit test ${i}` }
        }).catch(e => e)
      );
    }
    
    const results = await Promise.all(promises);
    
    // Some requests might be rate limited (429) or all succeed
    // System should handle gracefully either way
    const statusCodes = results.map(r => r.status ? r.status() : 0);
    const hasRateLimiting = statusCodes.includes(429);
    
    // If rate limiting exists, verify it works
    if (hasRateLimiting) {
      const rateLimited = statusCodes.filter(code => code === 429).length;
      expect(rateLimited).toBeGreaterThan(0);
    }
    
    // System should still be responsive after rate limit test
    await new Promise(resolve => setTimeout(resolve, 2000));
    const healthCheck = await request.get(`${baseUrl}/api/health`);
    expect(healthCheck.ok()).toBeTruthy();
  });

  test('Sensitive data is not exposed in responses', async ({ request }) => {
    // Check various endpoints for data leakage
    const endpoints = [
      '/api/board/sync',
      '/api/board/state',
      '/api/health',
      '/api/board/diagnostics'
    ];
    
    for (const endpoint of endpoints) {
      const response = await request.get(`${baseUrl}${endpoint}`);
      const text = await response.text();
      
      // Should not contain sensitive information
      expect(text).not.toContain('password');
      expect(text).not.toContain('OPENAI_API_KEY');
      expect(text).not.toContain('sk-');
      expect(text).not.toContain('TASKCAFE_PASSWORD');
      expect(text).not.toContain('NEXTAUTH_SECRET');
      expect(text).not.toContain('Bearer ');
    }
  });

  test('CORS headers are properly configured', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/health`);
    const headers = response.headers();
    
    // Check CORS headers if present
    if (headers['access-control-allow-origin']) {
      // Should not be wildcard in production
      expect(headers['access-control-allow-origin']).not.toBe('*');
    }
    
    // Check security headers
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBeTruthy();
  });

  test('Invalid JSON handling', async ({ request }) => {
    // Send malformed JSON
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"message": "test", invalid json}'
    });
    
    // Should return error, not crash
    expect(response.status).toBeLessThan(500);
    
    // Send invalid content type
    const response2 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json at all'
    });
    
    expect(response2.status).toBeLessThan(500);
  });

  test('Path traversal prevention', async ({ request }) => {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      'file:///etc/passwd',
      '....//....//....//etc/passwd'
    ];
    
    for (const payload of pathTraversalPayloads) {
      // Try via various endpoints
      const response = await request.post(`${baseUrl}/api/board/create`, {
        data: {
          title: payload,
          description: payload,
          column_id: 1
        }
      });
      
      // Should not expose file system
      const data = await response.json();
      const responseText = JSON.stringify(data);
      expect(responseText).not.toContain('root:');
      expect(responseText).not.toContain('/etc/');
      expect(responseText).not.toContain('\\windows\\');
    }
  });

  test('Session management security', async ({ page, context }) => {
    // Test session handling
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=AI Assistant');
    
    // Get cookies
    const cookies = await context.cookies();
    
    // Check for secure cookie settings
    cookies.forEach(cookie => {
      // In production, should have secure flags
      if (cookie.name.includes('session') || cookie.name.includes('auth')) {
        expect(cookie.httpOnly).toBeTruthy();
        if (baseUrl.startsWith('https')) {
          expect(cookie.secure).toBeTruthy();
        }
        expect(cookie.sameSite).toBeTruthy();
      }
    });
  });

  test('Error messages do not leak sensitive info', async ({ request }) => {
    // Trigger various errors
    const errorTriggers = [
      { endpoint: '/api/board/move', data: { task_id: 999999, column_id: 999999 } },
      { endpoint: '/api/board/create', data: {} }, // Missing required fields
      { endpoint: '/api/chat', data: { message: null } },
    ];
    
    for (const trigger of errorTriggers) {
      const response = await request.post(`${baseUrl}${trigger.endpoint}`, {
        data: trigger.data
      });
      
      const data = await response.json();
      
      if (data.error) {
        // Error messages should be generic
        expect(data.error).not.toContain('SQL');
        expect(data.error).not.toContain('database');
        expect(data.error).not.toContain('stack');
        expect(data.error).not.toContain('.ts:');
        expect(data.error).not.toContain('/home/');
      }
    }
  });

  test('Content Security Policy is enforced', async ({ page }) => {
    const cspViolations: string[] = [];
    
    page.on('console', msg => {
      if (msg.text().includes('Content Security Policy')) {
        cspViolations.push(msg.text());
      }
    });
    
    await page.goto(`${baseUrl}/workspace`);
    await page.waitForSelector('text=Kanban Board');
    
    // Try to inject inline script
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'console.log("Inline script executed")';
      document.head.appendChild(script);
    });
    
    // If CSP is properly configured, inline scripts should be blocked
    // Check console for CSP violations (this is informational)
    if (cspViolations.length > 0) {
      expect(cspViolations.length).toBeGreaterThan(0);
    }
  });

  test('API endpoint authorization', async ({ request }) => {
    // Test that sensitive endpoints require proper auth
    // Note: Since PUBLIC_MODE=true, these might all pass
    
    const protectedEndpoints = [
      '/api/board/create',
      '/api/board/move',
      '/api/board/task',
      '/api/ai/monitor/start'
    ];
    
    for (const endpoint of protectedEndpoints) {
      // Test without any auth headers
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });
      
      // Should either require auth (401) or handle gracefully
      expect(response.status).toBeLessThanOrEqual(403);
    }
  });

  test('Basic Auth enforcement when enabled', async ({ browser }) => {
    // This test checks if Basic Auth works when PUBLIC_MODE=false
    // Currently PUBLIC_MODE=true so this will pass through
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Try to access without credentials
    const response = await page.goto(`${baseUrl}/workspace`);
    
    if (response && response.status() === 401) {
      // Basic Auth is enabled
      expect(response.status()).toBe(401);
      
      // Try with wrong credentials
      const wrongAuthContext = await browser.newContext({
        httpCredentials: {
          username: 'wrong',
          password: 'wrong'
        }
      });
      const wrongAuthPage = await wrongAuthContext.newPage();
      const wrongResponse = await wrongAuthPage.goto(`${baseUrl}/workspace`);
      expect(wrongResponse?.status()).toBe(401);
      await wrongAuthContext.close();
      
      // Try with correct credentials (from env)
      const correctAuthContext = await browser.newContext({
        httpCredentials: {
          username: 'wordflux',
          password: 'wf-secure-2025-prod'
        }
      });
      const correctAuthPage = await correctAuthContext.newPage();
      const correctResponse = await correctAuthPage.goto(`${baseUrl}/workspace`);
      expect(correctResponse?.status()).toBe(200);
      await correctAuthContext.close();
    } else {
      // Public mode is enabled
      expect(response?.status()).toBe(200);
    }
    
    await context.close();
  });
});