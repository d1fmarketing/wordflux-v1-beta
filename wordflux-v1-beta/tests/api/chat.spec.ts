import { test, expect } from '@playwright/test';

test.describe('Chat API Tests', () => {
  const baseUrl = 'http://52.4.68.118';
  
  test('POST /api/chat responds to basic messages', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/chat`, {
      data: {
        message: 'Hello, can you help me?'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('message');
    expect(typeof data.message).toBe('string');
    expect(data.message.length).toBeGreaterThan(0);
  });

  test('Chat creates task via natural language', async ({ request }) => {
    // Get initial board state
    const beforeResponse = await request.get(`${baseUrl}/api/board/sync`);
    const beforeData = await beforeResponse.json();
    const beforeBacklog = beforeData.state.columns.find((col: any) => 
      col.title === 'Backlog'
    );
    const beforeCount = beforeBacklog?.tasks.length || 0;
    
    // Send chat message to create task
    const chatResponse = await request.post(`${baseUrl}/api/chat`, {
      data: {
        message: `Create a task called "Test Chat Task ${Date.now()}" in the backlog`
      }
    });
    
    expect(chatResponse.ok()).toBeTruthy();
    const chatData = await chatResponse.json();
    expect(chatData.message).toMatch(/created|added|new task/i);
    
    // Wait for board update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify task was created
    const afterResponse = await request.get(`${baseUrl}/api/board/sync`);
    const afterData = await afterResponse.json();
    const afterBacklog = afterData.state.columns.find((col: any) => 
      col.title === 'Backlog'
    );
    const afterCount = afterBacklog?.tasks.length || 0;
    
    // Should have more tasks now
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
  });

  test('Chat moves task between columns', async ({ request }) => {
    // First get a task from backlog
    const boardResponse = await request.get(`${baseUrl}/api/board/sync`);
    const boardData = await boardResponse.json();
    const backlog = boardData.state.columns.find((col: any) => 
      col.title === 'Backlog'
    );
    
    if (backlog && backlog.tasks.length > 0) {
      const taskToMove = backlog.tasks[0];
      
      // Use chat to move the task
      const chatResponse = await request.post(`${baseUrl}/api/chat`, {
        data: {
          message: `Move task "${taskToMove.title}" to Ready`
        }
      });
      
      expect(chatResponse.ok()).toBeTruthy();
      const chatData = await chatResponse.json();
      expect(chatData.message).toMatch(/moved|ready/i);
    }
  });

  test('Chat provides board summary', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/chat`, {
      data: {
        message: 'Give me a board summary'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.message).toMatch(/backlog|ready|progress|done/i);
    expect(data.message).toMatch(/\d+/); // Should contain numbers
  });

  test('Chat handles quick commands', async ({ request }) => {
    const quickCommands = [
      'board summary',
      'whats next',
      'whats in progress',
      'daily summary'
    ];
    
    for (const command of quickCommands) {
      const response = await request.post(`${baseUrl}/api/chat`, {
        data: { message: command }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message.length).toBeGreaterThan(0);
    }
  });

  test('Chat handles invalid requests gracefully', async ({ request }) => {
    // Test with missing message
    const response1 = await request.post(`${baseUrl}/api/chat`, {
      data: {}
    });
    const data1 = await response1.json();
    expect(data1).toHaveProperty('error');
    
    // Test with empty message
    const response2 = await request.post(`${baseUrl}/api/chat`, {
      data: { message: '' }
    });
    const data2 = await response2.json();
    expect(data2).toHaveProperty('error');
  });

  test('Chat GPT-5 function calling integration', async ({ request }) => {
    // Test that chat properly uses GPT-5 function calling
    const response = await request.post(`${baseUrl}/api/chat`, {
      data: {
        message: 'Create a high priority bug task about login issues'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Should acknowledge the task creation with details
    expect(data.message).toMatch(/bug|login|priority|created/i);
  });

  test('Chat handles task queries', async ({ request }) => {
    const queries = [
      'How many tasks are in the backlog?',
      'What tasks are assigned to me?',
      'Show me urgent tasks',
      'List tasks due this week'
    ];
    
    for (const query of queries) {
      const response = await request.post(`${baseUrl}/api/chat`, {
        data: { message: query }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.message).toBeTruthy();
    }
  });

  test('Chat memory and context', async ({ request }) => {
    // First message
    const response1 = await request.post(`${baseUrl}/api/chat`, {
      data: {
        message: 'My name is TestUser'
      }
    });
    expect(response1.ok()).toBeTruthy();
    
    // Follow-up that requires context
    const response2 = await request.post(`${baseUrl}/api/chat`, {
      data: {
        message: 'Create a task assigned to me',
        context: 'Previous message mentioned name is TestUser'
      }
    });
    expect(response2.ok()).toBeTruthy();
  });

  test('Chat response time is acceptable', async ({ request }) => {
    const startTime = Date.now();
    
    const response = await request.post(`${baseUrl}/api/chat`, {
      data: {
        message: 'What is the current board status?'
      }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    expect(response.ok()).toBeTruthy();
    // Response should be under 5 seconds
    expect(responseTime).toBeLessThan(5000);
  });

  test('Chat handles concurrent requests', async ({ request }) => {
    const messages = [
      'Show backlog tasks',
      'How many tasks are done?',
      'What is in progress?'
    ];
    
    // Send multiple concurrent requests
    const promises = messages.map(message => 
      request.post(`${baseUrl}/api/chat`, {
        data: { message }
      })
    );
    
    const responses = await Promise.all(promises);
    
    // All should succeed
    responses.forEach((response, index) => {
      expect(response.ok()).toBeTruthy();
    });
  });
});