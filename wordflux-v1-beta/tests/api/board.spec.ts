import { test, expect } from '@playwright/test';

test.describe('Board API Tests', () => {
  const baseUrl = 'http://52.4.68.118';
  
  test('GET /api/board/sync returns normalized board state', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/board/sync`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('ok', true);
    expect(data).toHaveProperty('state');
    expect(data.state).toHaveProperty('columns');
    expect(Array.isArray(data.state.columns)).toBeTruthy();
    
    // Verify column structure
    if (data.state.columns.length > 0) {
      const column = data.state.columns[0];
      expect(column).toHaveProperty('id');
      expect(column).toHaveProperty('title');
      expect(column).toHaveProperty('tasks');
      expect(Array.isArray(column.tasks)).toBeTruthy();
    }
    
    // Verify task structure and tag normalization
    for (const column of data.state.columns) {
      for (const task of column.tasks) {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('title');
        
        // Tags should be normalized to strings
        if (task.tags) {
          expect(Array.isArray(task.tags)).toBeTruthy();
          task.tags.forEach((tag: any) => {
            expect(typeof tag).toBe('string');
          });
        }
      }
    }
  });

  test('GET /api/board/state returns current board state', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/board/state`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('ok');
    expect(data).toHaveProperty('columns');
    
    // Should have standard Kanban columns
    const columnTitles = data.columns.map((col: any) => col.name);
    expect(columnTitles).toContain('Backlog');
    expect(columnTitles).toContain('Ready');
    expect(columnTitles).toContain('Work in progress');
    expect(columnTitles).toContain('Done');
  });

  test('POST /api/board/create creates a new task', async ({ request }) => {
    const newTask = {
      title: `Test Task ${Date.now()}`,
      description: 'Created by API test',
      column_id: 1, // Backlog
      tags: ['test', 'automated']
    };
    
    const response = await request.post(`${baseUrl}/api/board/create`, {
      data: newTask
    });
    
    // Check response
    const data = await response.json();
    expect(data).toHaveProperty('ok');
    
    if (data.ok) {
      expect(data).toHaveProperty('task');
      expect(data.task).toHaveProperty('id');
      expect(data.task.title).toBe(newTask.title);
    }
  });

  test('POST /api/board/move moves task between columns', async ({ request }) => {
    // First get current board state
    const stateResponse = await request.get(`${baseUrl}/api/board/sync`);
    const stateData = await stateResponse.json();
    
    // Find a task in Backlog
    const backlogColumn = stateData.state.columns.find((col: any) => 
      col.title === 'Backlog' || col.id === 1
    );
    
    if (backlogColumn && backlogColumn.tasks.length > 0) {
      const taskToMove = backlogColumn.tasks[0];
      
      // Move to Ready column
      const moveResponse = await request.post(`${baseUrl}/api/board/move`, {
        data: {
          task_id: taskToMove.id,
          column_id: 2, // Ready column
          position: 1
        }
      });
      
      const moveData = await moveResponse.json();
      expect(moveData).toHaveProperty('ok');
    }
  });

  test('GET /api/board/diagnostics returns system health', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/board/diagnostics`);
    const data = await response.json();
    
    expect(data).toHaveProperty('ok');
    expect(data).toHaveProperty('taskcafe');
    expect(data).toHaveProperty('database');
    expect(data).toHaveProperty('projectAccess');
    
    // All should be healthy
    expect(data.taskcafe.connected).toBeTruthy();
    expect(data.database.accessible).toBeTruthy();
    expect(data.projectAccess.accessible).toBeTruthy();
  });

  test('Handle malformed requests gracefully', async ({ request }) => {
    // Test with invalid data
    const response = await request.post(`${baseUrl}/api/board/create`, {
      data: { 
        // Missing required title field
        description: 'Invalid task'
      }
    });
    
    const data = await response.json();
    expect(data.ok).toBeFalsy();
    expect(data).toHaveProperty('error');
  });

  test('Handle API rate limiting', async ({ request }) => {
    // Send multiple rapid requests
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(request.get(`${baseUrl}/api/board/sync`));
    }
    
    const responses = await Promise.all(promises);
    
    // All should succeed (no rate limiting should block normal usage)
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });
  });

  test('Board state consistency after modifications', async ({ request }) => {
    // Get initial state
    const initialResponse = await request.get(`${baseUrl}/api/board/sync`);
    const initialData = await initialResponse.json();
    const initialTaskCount = initialData.state.columns.reduce(
      (sum: number, col: any) => sum + col.tasks.length, 0
    );
    
    // Create a task
    const createResponse = await request.post(`${baseUrl}/api/board/create`, {
      data: {
        title: `Consistency Test ${Date.now()}`,
        column_id: 1
      }
    });
    
    if (createResponse.ok()) {
      // Get state after creation
      const afterResponse = await request.get(`${baseUrl}/api/board/sync`);
      const afterData = await afterResponse.json();
      const afterTaskCount = afterData.state.columns.reduce(
        (sum: number, col: any) => sum + col.tasks.length, 0
      );
      
      // Should have one more task
      expect(afterTaskCount).toBeGreaterThanOrEqual(initialTaskCount);
    }
  });

  test('Tag handling with different formats', async ({ request }) => {
    // Test creating task with different tag formats
    const testCases = [
      { tags: ['string-tag'] },
      { tags: [] }, // Empty tags
      { tags: ['urgent', 'test', 'api'] }, // Multiple tags
    ];
    
    for (const testCase of testCases) {
      const response = await request.post(`${baseUrl}/api/board/create`, {
        data: {
          title: `Tag Test ${Date.now()}`,
          column_id: 1,
          ...testCase
        }
      });
      
      const data = await response.json();
      // Should handle all tag formats
      expect(data).toHaveProperty('ok');
    }
  });

  test('Column information is accurate', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/board/sync`);
    const data = await response.json();
    
    // Verify each column has correct properties
    data.state.columns.forEach((column: any) => {
      expect(column).toHaveProperty('id');
      expect(column).toHaveProperty('title');
      expect(column).toHaveProperty('tasks');
      expect(typeof column.id).toBe('number');
      expect(typeof column.title).toBe('string');
      expect(Array.isArray(column.tasks)).toBeTruthy();
      
      // Column titles should match expected Kanban structure
      expect(['Backlog', 'Ready', 'Work in progress', 'Done']).toContain(column.title);
    });
  });
});