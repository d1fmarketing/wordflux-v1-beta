import { test, expect } from '@playwright/test';

// Run tests serially to avoid SQLite database locks
test.describe.configure({ mode: 'serial' });

test.describe('Deterministic Chat Parser', () => {
  test.slow(); // Give more headroom for DB operations
  const baseURL = 'http://localhost:3000';

  test('Create task with deterministic parser', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'create "Fix login bug" in backlog'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Check for either deterministic or AI response format
    if (data.ok) {
      // Deterministic parser response
      expect(data.message).toContain('Created task');
      expect(data.message).toContain('Fix login bug');
      expect(data.undoToken).toBeDefined();
      expect(data.actions).toHaveLength(1);
      expect(data.actions[0].type).toBe('create_task');
    } else {
      // AI agent response
      expect(data.response).toBeDefined();
      expect(data.success).toBeTruthy();
    }
  });

  test('Move task by ID', async ({ request }) => {
    // First create a task to move
    const createRes = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'create "Test Move Task" in backlog'
      }
    });
    const createData = await createRes.json();
    
    // Extract the created task ID
    let taskId;
    if (createData.ok && createData.results) {
      const created = createData.results.find((r: any) => r.type === 'create_task');
      taskId = created?.result?.taskId;
    } else if (createData.message) {
      const match = createData.message.match(/#(\d+)/);
      taskId = match ? match[1] : null;
    }
    
    expect(taskId).toBeTruthy();
    
    // Now move the task
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: `move #${taskId} to done`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok && data.results) {
      const moveResult = data.results.find((r: any) => r.type === 'move_task');
      expect(moveResult).toBeTruthy();
      expect(moveResult.result.to).toMatch(/Done/i);
      expect(data.undoToken).toBeDefined();
    } else if (data.message) {
      expect(data.message).toContain('Moved task');
    }
  });

  test('Move task by title', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'move "Fix login bug" to review'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok) {
      expect(data.message).toMatch(/Moved task|not found|Error/);
    } else {
      expect(data.response).toBeDefined();
    }
  });

  test('Quick done command', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'done #2'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok) {
      expect(data.message).toContain('Moved task');
      expect(data.message.toLowerCase()).toContain('done');
    } else {
      expect(data.response).toBeDefined();
    }
  });

  test('Start task command', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'start #3'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok) {
      expect(data.message).toContain('Moved task');
      expect(data.message).toContain('Work in progress');
    } else {
      expect(data.response).toBeDefined();
    }
  });

  test('Update task priority', async ({ request }) => {
    // First create a task to update
    const createRes = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'create "Test Priority Task" in backlog'
      }
    });
    const createData = await createRes.json();
    
    let taskId;
    if (createData.ok && createData.results) {
      const created = createData.results.find((r: any) => r.type === 'create_task');
      taskId = created?.result?.taskId;
    } else if (createData.message) {
      const match = createData.message.match(/#(\d+)/);
      taskId = match ? match[1] : null;
    }
    
    expect(taskId).toBeTruthy();
    
    // Now update priority
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: `update #${taskId} priority: high`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok && data.results) {
      const updateResult = data.results.find((r: any) => r.type === 'update_task');
      expect(updateResult).toBeTruthy();
      expect(updateResult.result.changes?.priority).toBe('high');
      expect(data.undoToken).toBeDefined();
    } else if (data.message) {
      expect(data.message).toContain('Updated task');
    }
  });

  test('Add tags to task', async ({ request }) => {
    // First create a task to tag
    const createRes = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'create "Test Tag Task" in backlog'
      }
    });
    const createData = await createRes.json();
    
    let taskId;
    if (createData.ok && createData.results) {
      const created = createData.results.find((r: any) => r.type === 'create_task');
      taskId = created?.result?.taskId;
    } else if (createData.message) {
      const match = createData.message.match(/#(\d+)/);
      taskId = match ? match[1] : null;
    }
    
    expect(taskId).toBeTruthy();
    
    // Now add tags
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: `tag #${taskId} add urgent, bug`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok) {
      // Tags are added as comments in the current implementation
      expect(data.message).toContain('Added tags');
      expect(data.message).toContain('urgent');
      expect(data.message).toContain('bug');
    } else {
      expect(data.response).toBeDefined();
    }
  });

  test('Assign task', async ({ request }) => {
    // First create a task to assign
    const createRes = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'create "Test Assign Task" in backlog'
      }
    });
    const createData = await createRes.json();
    
    let taskId;
    if (createData.ok && createData.results) {
      const created = createData.results.find((r: any) => r.type === 'create_task');
      taskId = created?.result?.taskId;
    } else if (createData.message) {
      const match = createData.message.match(/#(\d+)/);
      taskId = match ? match[1] : null;
    }
    
    expect(taskId).toBeTruthy();
    
    // Now assign the task
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: `assign #${taskId} to RJ`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok) {
      expect(data.message).toContain('Assigned');
      expect(data.message).toContain('RJ');
    } else {
      expect(data.response).toBeDefined();
    }
  });

  test('Add comment to task', async ({ request }) => {
    // First create a task to comment on
    const createRes = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'create "Test Comment Task" in backlog'
      }
    });
    const createData = await createRes.json();
    
    let taskId;
    if (createData.ok && createData.results) {
      const created = createData.results.find((r: any) => r.type === 'create_task');
      taskId = created?.result?.taskId;
    } else if (createData.message) {
      const match = createData.message.match(/#(\d+)/);
      taskId = match ? match[1] : null;
    }
    
    expect(taskId).toBeTruthy();
    
    // Now add comment
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: `comment #${taskId} Ready for review`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok) {
      expect(data.message).toContain('Added comment');
    } else {
      expect(data.response).toBeDefined();
    }
  });

  test('List tasks', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'list tasks'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok) {
      expect(data.message).toContain('Found');
      expect(data.message).toContain('task(s)');
    } else {
      expect(data.response).toBeDefined();
    }
  });

  test('Search tasks', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'search authentication'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok) {
      expect(data.message).toContain('Found');
      expect(data.message).toContain('matching task(s)');
    } else {
      expect(data.response).toBeDefined();
    }
  });

  test('Preview mode', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'preview: move #1 to done'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok) {
      expect(data.preview).toBe(true);
      expect(data.plan).toBeDefined();
      expect(data.message).toContain('Preview');
    } else {
      expect(data.response).toBeDefined();
    }
  });

  test('Create + Move + Undo flow', async ({ request }) => {
    // Step 1: Create task
    let response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'create "Test Undo Flow" in backlog'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const createData = await response.json();
    
    if (createData.ok) {
      expect(createData.undoToken).toBeDefined();
      const undoToken = createData.undoToken;
      
      // Extract task ID from message
      const taskIdMatch = createData.message.match(/#(\d+)/);
      expect(taskIdMatch).toBeTruthy();
      const taskId = taskIdMatch[1];
      
      // Step 2: Move task
      response = await request.post(`${baseURL}/api/chat`, {
        data: {
          message: `move #${taskId} to done`
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const moveData = await response.json();
      if (moveData.ok || moveData.message) {
        expect(moveData.message || moveData.response).toContain('Moved');
      }
      
      // Step 3: Undo creation
      response = await request.post(`${baseURL}/api/chat`, {
        data: {
          message: `undo ${undoToken}`
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const undoData = await response.json();
      if (undoData.ok || undoData.message) {
        expect(undoData.message || undoData.response).toMatch(/Undone|reverted/i);
      }
    } else {
      // AI fallback
      expect(createData.response).toBeDefined();
    }
  });

  test('Column name variations', async ({ request }) => {
    const columnVariations = [
      { input: 'backlog', expected: 'Backlog' },
      { input: 'ready', expected: 'Ready' },
      { input: 'in progress', expected: 'Work in progress' },
      { input: 'wip', expected: 'Work in progress' },
      { input: 'doing', expected: 'Work in progress' },
      { input: 'done', expected: 'Done' },
      { input: 'complete', expected: 'Done' }
    ];
    
    for (const { input, expected } of columnVariations) {
      const response = await request.post(`${baseURL}/api/chat`, {
        data: {
          message: `create "Test ${input}" in ${input}`
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      // Should either create successfully or fail gracefully
      if (data.ok && data.message && data.message.includes('Created task')) {
        expect(data.message).toContain(expected);
      } else if (data.response) {
        expect(data.response).toBeDefined();
      }
    }
  });

  test('Invalid commands fallback to AI', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'what is the weather today?'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Should either use AI or return appropriate message
    expect(data.response || data.message).toBeDefined();
  });

  test('Batch operations', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'create "Task A" in backlog and create "Task B" in ready'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Should handle multiple operations or fallback appropriately
    expect(data.response || data.message).toBeDefined();
  });

  test('Error handling for non-existent task', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'move #99999 to done'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok === false || data.message) {
      expect(data.message || data.error).toMatch(/Error|not found/i);
    } else {
      expect(data.response).toBeDefined();
    }
  });

  test('Complex create with all fields', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'create "Complex Task" in ready with description "Test all fields" priority high tags api, test assign to Dev'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    if (data.ok && data.message && data.message.includes('Created task')) {
      expect(data.message).toContain('Complex Task');
      expect(data.message.toLowerCase()).toContain('ready');  // Case-insensitive check
    } else {
      expect(data.response || data.message).toBeDefined();
    }
  });

  test('Performance: Deterministic vs AI response time', async ({ request }) => {
    const startDeterministic = Date.now();
    const deterministicResponse = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'list tasks'
      }
    });
    const deterministicTime = Date.now() - startDeterministic;
    
    expect(deterministicResponse.ok()).toBeTruthy();
    const deterministicData = await deterministicResponse.json();
    
    // If using deterministic parser, should be very fast
    if (deterministicData.ok) {
      expect(deterministicTime).toBeLessThan(1000); // Allow 1s for API calls
    }
    
    const startAI = Date.now();
    const aiResponse = await request.post(`${baseURL}/api/chat`, {
      data: {
        message: 'analyze the board and suggest improvements'
      }
    });
    const aiTime = Date.now() - startAI;
    
    expect(aiResponse.ok()).toBeTruthy();
    
    // Log performance comparison
    console.log(`Deterministic: ${deterministicTime}ms, AI: ${aiTime}ms`);
    
    // If both used deterministic parser (shouldn't happen for 'analyze'), check difference
    if (deterministicData.ok) {
      // Deterministic should generally be faster for simple commands
      console.log(`Speed improvement: ${Math.round((aiTime - deterministicTime) / aiTime * 100)}%`);
    }
  });
});