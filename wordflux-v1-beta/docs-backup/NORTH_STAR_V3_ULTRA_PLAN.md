# 🚀 NORTH STAR V3: ULTRA PLAN - THE STRATEGIC PIVOT

*Last Updated: December 2024*
*Status: ACTIVE EXECUTION*

---

## 📌 EXECUTIVE SUMMARY

### The Pivot
**We're NOT building from scratch.** We're combining two mature MIT-licensed open-source projects with a thin AI controller layer.

### The Stack
- **Kanboard** (MIT) - Battle-tested kanban board with JSON-RPC API
- **Chatbot UI** (MIT) - Clean Next.js chat interface
- **Agent Controller** (Our Code) - GPT-5 powered glue layer

### The Timeline
**5 DAYS** from zero to production (vs 3 months building from scratch)

### The Advantage
- Zero licensing risk (MIT = do anything)
- 10+ years of bugs already fixed
- Focus 100% on our differentiator (AI control)
- Easy migration path if needed

---

## 🎯 STRATEGIC DECISION MATRIX

| Criteria | Option A (Kanboard) | Option B (Plane) | Option C (Planka) | Winner |
|----------|-------------------|------------------|-------------------|---------|
| **License** | MIT ✅ | AGPL ⚠️ | Fair-code ❌ | A |
| **API Quality** | JSON-RPC ✅ | REST + MCP ✅✅ | REST ⚠️ | B |
| **Setup Speed** | 2 hours ✅✅ | 1 day ⚠️ | 4 hours ✅ | A |
| **Maintenance** | Stable ✅ | Very Active ✅✅ | Active ✅ | B |
| **Integration** | Simple ✅✅ | Complex ⚠️ | Medium ✅ | A |
| **Future-proof** | Good ✅ | Excellent ✅✅ | Good ✅ | B |
| **TOTAL SCORE** | **9/10** | 8/10 | 6/10 | **A** |

**Decision: Option A wins for speed-to-market and simplicity**

---

## 📅 5-DAY EXECUTION TIMELINE

### 🗓️ **DAY 1: INFRASTRUCTURE SETUP**
*Goal: Both systems running and talking*

#### Phase 1.1: Environment Preparation (2 hours)
```bash
# Tasks
□ 1.1.1 System updates
  □ sudo apt update && sudo apt upgrade -y
  □ Verify Ubuntu 22.04 or higher
  
□ 1.1.2 Docker installation check
  □ docker --version (need 20.10+)
  □ docker-compose --version (need 2.0+)
  □ If missing: curl -fsSL https://get.docker.com | sh
  
□ 1.1.3 Node.js verification
  □ node --version (need 20.x)
  □ npm --version (need 10.x)
  □ If missing: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  
□ 1.1.4 Project structure creation
  mkdir -p ~/wordflux-v3/{docker,lib,app,scripts,tests}
  cd ~/wordflux-v3
  git init
  
□ 1.1.5 Environment file setup
  cp .env.example .env.local
  # Add: OPENAI_API_KEY, KANBOARD_URL, KANBOARD_TOKEN
```

#### Phase 1.2: Kanboard Deployment (2 hours)
```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  kanboard:
    image: kanboard/kanboard:v1.2.35
    container_name: wordflux-kanboard
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      - DATABASE_URL=postgres://kanboard:kanboard123@postgres:5432/kanboard
      - PLUGIN_INSTALLER=true
      - LOG_LEVEL=info
    volumes:
      - kanboard_data:/var/www/app/data
      - kanboard_plugins:/var/www/app/plugins
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - wordflux-network

  postgres:
    image: postgres:14-alpine
    container_name: wordflux-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=kanboard
      - POSTGRES_PASSWORD=kanboard123
      - POSTGRES_DB=kanboard
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kanboard"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - wordflux-network

networks:
  wordflux-network:
    driver: bridge

volumes:
  kanboard_data:
  kanboard_plugins:
  postgres_data:
```

```bash
# Deployment steps
□ 1.2.1 Start containers
  cd docker && docker-compose up -d
  
□ 1.2.2 Wait for initialization (monitor logs)
  docker-compose logs -f kanboard
  # Wait for: "INFO: Ready to handle connections"
  
□ 1.2.3 Access Kanboard UI
  # Browse to http://localhost:8080
  # Default: admin/admin
  
□ 1.2.4 Initial configuration
  □ Change admin password
  □ Create user "agent" for API access
  □ Set timezone to UTC
  
□ 1.2.5 Create API token
  □ Settings → API → Generate new token
  □ Copy token to .env.local as KANBOARD_TOKEN
  
□ 1.2.6 Create project structure
  □ Create project "Studio Board"
  □ Add columns: Backlog, Doing, Done
  □ Note project_id (usually 1)
  
□ 1.2.7 API verification
  curl -X POST http://localhost:8080/jsonrpc.php \
    -H "X-API-Auth: YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"getVersion","id":1}'
  # Should return Kanboard version
```

#### Phase 1.3: Chatbot UI Setup (2 hours)
```bash
□ 1.3.1 Fork and clone
  # Fork https://github.com/mckaywrigley/chatbot-ui
  git clone https://github.com/YOUR_USER/chatbot-ui.git chatbot
  cd chatbot
  
□ 1.3.2 Install dependencies
  npm install
  # or pnpm install (faster)
  
□ 1.3.3 Environment configuration
  cp .env.example .env.local
  # Add:
  # OPENAI_API_KEY=sk-...
  # NEXT_PUBLIC_APP_NAME=WordFlux
  
□ 1.3.4 Test standalone
  npm run dev
  # Browse to http://localhost:3000
  # Test: Send a message, verify OpenAI responds
  
□ 1.3.5 Code structure analysis
  □ Identify main chat component
  □ Locate API routes
  □ Find state management
  □ Note customization points
```

#### Day 1 Success Criteria ✅
- [ ] Kanboard running at :8080 with API token
- [ ] Chatbot UI running at :3000 with OpenAI working
- [ ] Both systems verified independently
- [ ] Environment fully configured

---

### 🗓️ **DAY 2: API CLIENT LAYER**
*Goal: Complete Kanboard API wrapper*

#### Phase 2.1: Kanboard Client Library (4 hours)
```javascript
// lib/kanboard-client.js
export class KanboardClient {
  constructor(url, token) {
    this.url = url || process.env.KANBOARD_URL;
    this.token = token || process.env.KANBOARD_TOKEN;
    this.rpcId = 0;
    this.projectId = 1; // Default project
    
    // Column mapping (will be populated dynamically)
    this.columnMap = {};
  }

  // Core JSON-RPC method
  async call(method, params = {}) {
    const requestId = ++this.rpcId;
    
    try {
      const response = await fetch(`${this.url}/jsonrpc.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Auth': this.token
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          id: requestId,
          params
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`RPC Error ${data.error.code}: ${data.error.message}`);
      }
      
      return data.result;
    } catch (error) {
      console.error(`KanboardClient.call(${method}) failed:`, error);
      throw error;
    }
  }

  // Initialize column mapping
  async initialize() {
    const columns = await this.call('getColumns', { 
      project_id: this.projectId 
    });
    
    this.columnMap = {};
    for (const col of columns) {
      this.columnMap[col.title] = col.id;
    }
    
    console.log('Column mapping:', this.columnMap);
    return this.columnMap;
  }

  // High-level methods
  async createCard(title, column = 'Backlog', description = '', options = {}) {
    const columnId = this.columnMap[column];
    if (!columnId) {
      throw new Error(`Unknown column: ${column}`);
    }

    const taskId = await this.call('createTask', {
      project_id: this.projectId,
      title,
      column_id: columnId,
      description,
      ...options
    });

    return { taskId, title, column };
  }

  async moveCard(taskId, toColumn) {
    const columnId = this.columnMap[toColumn];
    if (!columnId) {
      throw new Error(`Unknown column: ${toColumn}`);
    }

    await this.call('moveTaskPosition', {
      project_id: this.projectId,
      task_id: parseInt(taskId),
      column_id: columnId,
      position: 1 // Top of column
    });

    return { taskId, movedTo: toColumn };
  }

  async updateCard(taskId, updates) {
    const params = {
      id: parseInt(taskId),
      ...updates
    };

    await this.call('updateTask', params);
    return { taskId, updated: true };
  }

  async deleteCard(taskId) {
    await this.call('removeTask', {
      task_id: parseInt(taskId)
    });
    return { taskId, deleted: true };
  }

  async getBoard() {
    const [project, columns, tasks, users] = await Promise.all([
      this.call('getProjectById', { project_id: this.projectId }),
      this.call('getColumns', { project_id: this.projectId }),
      this.call('getAllTasks', { project_id: this.projectId }),
      this.call('getProjectUsers', { project_id: this.projectId })
    ]);

    // Structure board data
    const board = {
      project: {
        id: project.id,
        name: project.name
      },
      columns: columns.map(col => ({
        id: col.id,
        name: col.title,
        position: col.position,
        tasks: tasks
          .filter(t => t.column_id === col.id)
          .sort((a, b) => a.position - b.position)
          .map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            assignee: users.find(u => u.id === t.owner_id)?.username,
            createdAt: new Date(parseInt(t.date_creation) * 1000)
          }))
      })),
      users
    };

    return board;
  }

  async findCard(query) {
    const tasks = await this.call('getAllTasks', {
      project_id: this.projectId
    });

    // Simple text search
    const matches = tasks.filter(task => 
      task.title.toLowerCase().includes(query.toLowerCase()) ||
      task.description?.toLowerCase().includes(query.toLowerCase())
    );

    return matches;
  }

  async addComment(taskId, comment) {
    await this.call('createComment', {
      task_id: parseInt(taskId),
      content: comment
    });
    return { taskId, commentAdded: true };
  }
}
```

#### Phase 2.2: State Management (2 hours)
```javascript
// lib/board-state.js
import { EventEmitter } from 'events';

export class BoardState extends EventEmitter {
  constructor(kanboardClient, pollInterval = 3000) {
    super();
    this.client = kanboardClient;
    this.pollInterval = pollInterval;
    this.state = null;
    this.polling = false;
    this.lastHash = null;
  }

  // Start polling
  start() {
    if (this.polling) return;
    
    this.polling = true;
    this.poll();
    
    this.pollTimer = setInterval(() => {
      this.poll();
    }, this.pollInterval);
  }

  // Stop polling
  stop() {
    this.polling = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // Poll for changes
  async poll() {
    try {
      const newState = await this.client.getBoard();
      const newHash = this.hashState(newState);
      
      if (newHash !== this.lastHash) {
        const oldState = this.state;
        this.state = newState;
        this.lastHash = newHash;
        
        this.emit('change', {
          old: oldState,
          new: newState,
          diff: this.calculateDiff(oldState, newState)
        });
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  // Calculate state hash for change detection
  hashState(state) {
    const simplified = state.columns.map(col => ({
      id: col.id,
      taskCount: col.tasks.length,
      taskIds: col.tasks.map(t => t.id).sort()
    }));
    
    return JSON.stringify(simplified);
  }

  // Calculate what changed
  calculateDiff(oldState, newState) {
    if (!oldState) return { type: 'initial' };
    
    const diff = {
      added: [],
      removed: [],
      moved: [],
      updated: []
    };
    
    // Compare tasks
    const oldTasks = new Map();
    const newTasks = new Map();
    
    oldState.columns.forEach(col => {
      col.tasks.forEach(task => {
        oldTasks.set(task.id, { ...task, column: col.name });
      });
    });
    
    newState.columns.forEach(col => {
      col.tasks.forEach(task => {
        newTasks.set(task.id, { ...task, column: col.name });
      });
    });
    
    // Find changes
    for (const [id, task] of newTasks) {
      if (!oldTasks.has(id)) {
        diff.added.push(task);
      } else {
        const oldTask = oldTasks.get(id);
        if (oldTask.column !== task.column) {
          diff.moved.push({
            task,
            from: oldTask.column,
            to: task.column
          });
        } else if (JSON.stringify(oldTask) !== JSON.stringify(task)) {
          diff.updated.push(task);
        }
      }
    }
    
    for (const [id, task] of oldTasks) {
      if (!newTasks.has(id)) {
        diff.removed.push(task);
      }
    }
    
    return diff;
  }

  // Get current state
  getState() {
    return this.state;
  }
}
```

#### Phase 2.3: Testing Suite (2 hours)
```javascript
// tests/kanboard-client.test.js
import { KanboardClient } from '../lib/kanboard-client';

describe('KanboardClient', () => {
  let client;
  let testTaskId;

  beforeAll(async () => {
    client = new KanboardClient();
    await client.initialize();
  });

  test('should connect to Kanboard', async () => {
    const version = await client.call('getVersion');
    expect(version).toBeTruthy();
  });

  test('should create a card', async () => {
    const result = await client.createCard(
      'Test Card',
      'Backlog',
      'Test description'
    );
    expect(result.taskId).toBeTruthy();
    testTaskId = result.taskId;
  });

  test('should move a card', async () => {
    const result = await client.moveCard(testTaskId, 'Doing');
    expect(result.movedTo).toBe('Doing');
  });

  test('should update a card', async () => {
    const result = await client.updateCard(testTaskId, {
      title: 'Updated Test Card'
    });
    expect(result.updated).toBe(true);
  });

  test('should find a card', async () => {
    const results = await client.findCard('Updated Test');
    expect(results.length).toBeGreaterThan(0);
  });

  test('should get board state', async () => {
    const board = await client.getBoard();
    expect(board.columns).toBeTruthy();
    expect(board.columns.length).toBeGreaterThan(0);
  });

  test('should delete a card', async () => {
    const result = await client.deleteCard(testTaskId);
    expect(result.deleted).toBe(true);
  });
});
```

#### Day 2 Success Criteria ✅
- [ ] All Kanboard API methods implemented
- [ ] State polling working with change detection
- [ ] All tests passing
- [ ] Can perform full CRUD on cards via API

---

### 🗓️ **DAY 3: AGENT INTELLIGENCE LAYER**
*Goal: GPT-5 understanding and executing commands*

#### Phase 3.1: GPT-5 Interpreter (3 hours)
```javascript
// lib/agent/interpreter.js
import { z } from 'zod';

// Action schemas
const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_card'),
    title: z.string(),
    column: z.enum(['Backlog', 'Doing', 'Done']).default('Backlog'),
    description: z.string().optional()
  }),
  z.object({
    type: z.literal('move_card'),
    identifier: z.string(), // Can be ID or title
    toColumn: z.enum(['Backlog', 'Doing', 'Done'])
  }),
  z.object({
    type: z.literal('update_card'),
    identifier: z.string(),
    updates: z.object({
      title: z.string().optional(),
      description: z.string().optional()
    })
  }),
  z.object({
    type: z.literal('delete_card'),
    identifier: z.string()
  }),
  z.object({
    type: z.literal('list_cards'),
    column: z.enum(['Backlog', 'Doing', 'Done', 'all']).optional()
  })
]);

const IntentSchema = z.object({
  reply: z.string(),
  actions: z.array(ActionSchema),
  needsClarification: z.boolean().default(false),
  clarificationQuestion: z.string().optional()
});

export class AgentInterpreter {
  constructor(openaiKey) {
    this.openaiKey = openaiKey;
  }

  async interpret(message, boardState) {
    const systemPrompt = this.buildSystemPrompt(boardState);
    const userPrompt = `User message: ${message}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview', // Use gpt-5 when available
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = JSON.parse(data.choices[0].message.content);
      
      // Validate and return
      return IntentSchema.parse(content);
      
    } catch (error) {
      console.error('Interpretation failed:', error);
      
      // Fallback response
      return {
        reply: "I couldn't understand that command. Try: 'Create a card titled X' or 'Move card X to Doing'",
        actions: [],
        needsClarification: false
      };
    }
  }

  buildSystemPrompt(boardState) {
    return `You are a Kanban board assistant. You help users manage their tasks through natural language.

CURRENT BOARD STATE:
${JSON.stringify(boardState, null, 2)}

CAPABILITIES:
1. Create cards: "Create a card titled [title] in [column]"
2. Move cards: "Move [card] to [column]"
3. Update cards: "Update [card] description to [text]"
4. Delete cards: "Delete [card]"
5. List cards: "Show all cards in [column]"

RESPONSE FORMAT:
You must respond with a JSON object:
{
  "reply": "Human-friendly response in the same language as the user",
  "actions": [
    {
      "type": "action_type",
      ...parameters
    }
  ],
  "needsClarification": false,
  "clarificationQuestion": null
}

RULES:
- If a card reference is ambiguous, set needsClarification=true
- Keep replies concise (under 50 words)
- Mirror the user's language (Portuguese or English)
- When multiple cards match, ask for clarification
- Always confirm what action was taken

EXAMPLES:

User: "Create a card for fixing the login bug"
Response: {
  "reply": "I've created a card for the login bug in Backlog.",
  "actions": [{
    "type": "create_card",
    "title": "Fix login bug",
    "column": "Backlog",
    "description": "Investigate and fix the login authentication issue"
  }],
  "needsClarification": false
}

User: "Move the bug card to doing"
Response: {
  "reply": "I found 2 cards with 'bug'. Which one: 'Fix login bug' or 'Fix payment bug'?",
  "actions": [],
  "needsClarification": true,
  "clarificationQuestion": "Please specify which bug card to move"
}`;
  }
}
```

#### Phase 3.2: Agent Controller (3 hours)
```javascript
// lib/agent-controller.js
import { KanboardClient } from './kanboard-client';
import { AgentInterpreter } from './agent/interpreter';
import { BoardState } from './board-state';

export class AgentController {
  constructor(config) {
    // Initialize components
    this.kanboard = new KanboardClient(
      config.KANBOARD_URL,
      config.KANBOARD_TOKEN
    );
    
    this.interpreter = new AgentInterpreter(
      config.OPENAI_API_KEY
    );
    
    this.boardState = new BoardState(this.kanboard);
    
    // Action history for undo
    this.actionHistory = [];
    this.maxHistory = 50;
  }

  async initialize() {
    // Initialize column mapping
    await this.kanboard.initialize();
    
    // Start state polling
    this.boardState.start();
    
    // Initial board fetch
    await this.boardState.poll();
    
    console.log('Agent Controller initialized');
  }

  async processMessage(message, context = {}) {
    const startTime = Date.now();
    
    try {
      // Get current board state
      const boardState = this.boardState.getState();
      
      // Interpret message with GPT-5
      const intent = await this.interpreter.interpret(message, boardState);
      
      // If clarification needed, return immediately
      if (intent.needsClarification) {
        return {
          success: true,
          reply: intent.reply,
          needsClarification: true,
          clarificationQuestion: intent.clarificationQuestion,
          duration: Date.now() - startTime
        };
      }
      
      // Execute actions
      const results = [];
      for (const action of intent.actions) {
        try {
          const result = await this.executeAction(action);
          results.push({
            success: true,
            action: action.type,
            ...result
          });
        } catch (error) {
          results.push({
            success: false,
            action: action.type,
            error: error.message
          });
        }
      }
      
      // Record in history
      this.recordAction({
        timestamp: new Date(),
        message,
        intent,
        results
      });
      
      // Force board refresh
      await this.boardState.poll();
      
      return {
        success: true,
        reply: intent.reply,
        actions: results,
        boardState: this.boardState.getState(),
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('Message processing failed:', error);
      
      return {
        success: false,
        error: error.message,
        reply: "Sorry, I encountered an error processing your request.",
        duration: Date.now() - startTime
      };
    }
  }

  async executeAction(action) {
    console.log('Executing action:', action);
    
    switch (action.type) {
      case 'create_card':
        return await this.kanboard.createCard(
          action.title,
          action.column,
          action.description
        );
        
      case 'move_card': {
        // Find card by identifier (ID or title)
        let taskId = action.identifier;
        
        // If not a number, search by title
        if (isNaN(parseInt(action.identifier))) {
          const matches = await this.kanboard.findCard(action.identifier);
          if (matches.length === 0) {
            throw new Error(`Card not found: ${action.identifier}`);
          }
          if (matches.length > 1) {
            throw new Error(`Multiple cards match: ${action.identifier}`);
          }
          taskId = matches[0].id;
        }
        
        return await this.kanboard.moveCard(taskId, action.toColumn);
      }
      
      case 'update_card': {
        let taskId = action.identifier;
        
        if (isNaN(parseInt(action.identifier))) {
          const matches = await this.kanboard.findCard(action.identifier);
          if (matches.length === 0) {
            throw new Error(`Card not found: ${action.identifier}`);
          }
          taskId = matches[0].id;
        }
        
        return await this.kanboard.updateCard(taskId, action.updates);
      }
      
      case 'delete_card': {
        let taskId = action.identifier;
        
        if (isNaN(parseInt(action.identifier))) {
          const matches = await this.kanboard.findCard(action.identifier);
          if (matches.length === 0) {
            throw new Error(`Card not found: ${action.identifier}`);
          }
          taskId = matches[0].id;
        }
        
        return await this.kanboard.deleteCard(taskId);
      }
      
      case 'list_cards': {
        const board = await this.kanboard.getBoard();
        let cards = [];
        
        if (action.column && action.column !== 'all') {
          const column = board.columns.find(c => c.name === action.column);
          cards = column ? column.tasks : [];
        } else {
          board.columns.forEach(col => {
            cards = cards.concat(col.tasks.map(t => ({
              ...t,
              column: col.name
            })));
          });
        }
        
        return { cards, count: cards.length };
      }
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  recordAction(record) {
    this.actionHistory.push(record);
    
    // Trim history
    if (this.actionHistory.length > this.maxHistory) {
      this.actionHistory = this.actionHistory.slice(-this.maxHistory);
    }
  }

  getHistory() {
    return this.actionHistory;
  }

  shutdown() {
    this.boardState.stop();
  }
}
```

#### Phase 3.3: Testing the Agent (2 hours)
```javascript
// tests/agent-controller.test.js
import { AgentController } from '../lib/agent-controller';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

describe('AgentController', () => {
  let agent;

  beforeAll(async () => {
    agent = new AgentController({
      KANBOARD_URL: process.env.KANBOARD_URL,
      KANBOARD_TOKEN: process.env.KANBOARD_TOKEN,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    });
    
    await agent.initialize();
  });

  afterAll(() => {
    agent.shutdown();
  });

  test('should create card from natural language', async () => {
    const result = await agent.processMessage(
      'Create a card titled "Test agent task" in Backlog'
    );
    
    expect(result.success).toBe(true);
    expect(result.actions[0].success).toBe(true);
    expect(result.reply).toContain('created');
  });

  test('should move card from natural language', async () => {
    const result = await agent.processMessage(
      'Move the test agent task to Doing'
    );
    
    expect(result.success).toBe(true);
    expect(result.actions[0].success).toBe(true);
    expect(result.reply).toContain('moved');
  });

  test('should handle ambiguous requests', async () => {
    // Create another card with similar name
    await agent.processMessage('Create a card titled "Test agent task 2"');
    
    const result = await agent.processMessage(
      'Move the test task to Done'
    );
    
    expect(result.needsClarification).toBe(true);
    expect(result.clarificationQuestion).toBeTruthy();
  });

  test('should list cards', async () => {
    const result = await agent.processMessage(
      'Show me all cards in Doing'
    );
    
    expect(result.success).toBe(true);
    expect(result.actions[0].cards).toBeDefined();
  });

  test('should delete card', async () => {
    const result = await agent.processMessage(
      'Delete the test agent task'
    );
    
    expect(result.success).toBe(true);
    expect(result.reply).toContain('deleted');
  });
});
```

#### Day 3 Success Criteria ✅
- [ ] GPT interprets natural language correctly
- [ ] All action types execute successfully  
- [ ] Ambiguity handling works
- [ ] Full test suite passes
- [ ] Agent can perform complex multi-step operations

---

### 🗓️ **DAY 4: UI INTEGRATION**
*Goal: Unified interface with chat controlling board*

#### Phase 4.1: Next.js Application Structure (2 hours)
```javascript
// package.json
{
  "name": "wordflux-v3",
  "version": "3.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "jest",
    "docker:up": "docker-compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker-compose -f docker/docker-compose.yml down"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "swr": "^2.2.5",
    "zod": "^3.23.8",
    "clsx": "^2.1.1",
    "lucide-react": "^0.263.1",
    "react-hot-toast": "^2.4.1"
  },
  "devDependencies": {
    "@types/node": "^20.5.0",
    "@types/react": "^18.2.20",
    "jest": "^29.0.0",
    "tailwindcss": "^3.4.1",
    "postcss": "^8.4.31",
    "autoprefixer": "^10.4.15"
  }
}
```

```javascript
// app/layout.js
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'WordFlux - AI-Powered Kanban',
  description: 'Control your board with natural language'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        {children}
        <Toaster 
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
```

```javascript
// app/page.js
import ChatPanel from './components/ChatPanel';
import BoardView from './components/BoardView';

export default function HomePage() {
  return (
    <div className="h-screen flex">
      {/* Chat Panel - Left Side */}
      <div className="w-96 border-r border-gray-200 bg-white">
        <ChatPanel />
      </div>
      
      {/* Board View - Right Side */}
      <div className="flex-1">
        <BoardView />
      </div>
    </div>
  );
}
```

#### Phase 4.2: Chat Panel Component (3 hours)
```javascript
// app/components/ChatPanel.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: 'Hello! I can help you manage your board. Try "Create a card" or "Move card to Done".',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Add assistant response
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: 'assistant',
          content: data.reply,
          timestamp: new Date(),
          actions: data.actions
        }]);
        
        // Show action results
        if (data.actions?.length > 0) {
          const successCount = data.actions.filter(a => a.success).length;
          if (successCount > 0) {
            toast.success(`${successCount} action(s) completed`);
            
            // Trigger board refresh
            window.dispatchEvent(new CustomEvent('board-refresh'));
          }
        }
        
        // Handle clarification
        if (data.needsClarification) {
          // Could add quick reply buttons here
        }
      } else {
        toast.error(data.error || 'Something went wrong');
      }
    } catch (error) {
      toast.error('Failed to send message');
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const suggestions = [
    "Create a card titled 'New feature'",
    "Move card to Done",
    "Show all cards in Backlog",
    "Delete completed cards"
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">AI Assistant</h2>
        <p className="text-sm text-gray-500">Control your board with natural language</p>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${
              msg.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                {msg.content}
              </div>
              
              {/* Show action results */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {msg.actions.map((action, i) => (
                    <div key={i}>
                      {action.success ? '✅' : '❌'} {action.action}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="text-xs text-gray-400 mt-1">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Suggestions */}
      <div className="p-3 border-t border-gray-100">
        <div className="text-xs text-gray-500 mb-2">Suggestions:</div>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((sugg, i) => (
            <button
              key={i}
              onClick={() => setInput(sugg)}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full"
            >
              {sugg}
            </button>
          ))}
        </div>
      </div>
      
      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a command..."
            className="flex-1 p-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="2"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### Phase 4.3: Board View Component (3 hours)
```javascript
// app/components/BoardView.jsx
'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BoardView() {
  const [boardUrl] = useState('http://localhost:8080');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Listen for refresh events
  useEffect(() => {
    function handleRefresh() {
      setRefreshKey(prev => prev + 1);
      toast.success('Board refreshed');
    }
    
    window.addEventListener('board-refresh', handleRefresh);
    return () => window.removeEventListener('board-refresh', handleRefresh);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <h2 className="text-lg font-semibold">Board View</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="p-2 hover:bg-gray-100 rounded"
            title="Refresh board"
          >
            <RefreshCw size={18} />
          </button>
          <a
            href={boardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-gray-100 rounded"
            title="Open in new tab"
          >
            <ExternalLink size={18} />
          </a>
        </div>
      </div>
      
      {/* Board iframe */}
      <div className="flex-1 bg-gray-50">
        <iframe
          key={refreshKey}
          src={boardUrl}
          className="w-full h-full border-0"
          title="Kanboard"
        />
      </div>
    </div>
  );
}
```

#### Phase 4.4: API Route (1 hour)
```javascript
// app/api/agent/route.js
import { AgentController } from '@/lib/agent-controller';

let agentInstance = null;

async function getAgent() {
  if (!agentInstance) {
    agentInstance = new AgentController({
      KANBOARD_URL: process.env.KANBOARD_URL || 'http://localhost:8080',
      KANBOARD_TOKEN: process.env.KANBOARD_TOKEN,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    });
    
    await agentInstance.initialize();
  }
  
  return agentInstance;
}

export async function POST(request) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return Response.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }
    
    const agent = await getAgent();
    const result = await agent.processMessage(message);
    
    return Response.json(result);
    
  } catch (error) {
    console.error('Agent API error:', error);
    
    return Response.json(
      { 
        success: false, 
        error: error.message,
        reply: 'Sorry, I encountered an error. Please try again.'
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  try {
    const agent = await getAgent();
    const boardState = agent.boardState.getState();
    
    return Response.json({
      status: 'healthy',
      board: boardState ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return Response.json(
      { status: 'error', error: error.message },
      { status: 500 }
    );
  }
}
```

#### Day 4 Success Criteria ✅
- [ ] Chat UI sends messages to agent
- [ ] Board displays in iframe
- [ ] Actions reflect on board immediately
- [ ] Error handling works gracefully
- [ ] UI is responsive and polished

---

### 🗓️ **DAY 5: TESTING & DEPLOYMENT**
*Goal: Production-ready system*

#### Phase 5.1: End-to-End Testing (3 hours)
```javascript
// tests/e2e.test.js
import puppeteer from 'puppeteer';

describe('End-to-End Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: false });
    page = await browser.newPage();
    await page.goto('http://localhost:3000');
  });

  afterAll(async () => {
    await browser.close();
  });

  test('should load application', async () => {
    const title = await page.title();
    expect(title).toContain('WordFlux');
  });

  test('should create card via chat', async () => {
    // Type in chat
    await page.type('textarea', 'Create a card titled "E2E Test Card" in Backlog');
    
    // Send message
    await page.click('button[type="submit"]');
    
    // Wait for response
    await page.waitForSelector('.assistant-message', { timeout: 5000 });
    
    // Verify board updated
    // Would need to check iframe content or API
  });

  test('should handle errors gracefully', async () => {
    // Send invalid command
    await page.type('textarea', 'Do something impossible');
    await page.click('button[type="submit"]');
    
    // Should show error toast or message
    await page.waitForSelector('.error-message');
  });
});
```

#### Phase 5.2: Production Configuration (2 hours)
```yaml
# docker/docker-compose.prod.yml
version: '3.8'

services:
  kanboard:
    image: kanboard/kanboard:v1.2.35
    container_name: wordflux-kanboard
    restart: always
    ports:
      - "127.0.0.1:8080:80"  # Only localhost
    environment:
      - DATABASE_URL=postgres://kanboard:${DB_PASSWORD}@postgres:5432/kanboard
      - LOG_LEVEL=warning
    volumes:
      - kanboard_data:/var/www/app/data
      - kanboard_plugins:/var/www/app/plugins
    depends_on:
      - postgres
    networks:
      - wordflux-network

  postgres:
    image: postgres:14-alpine
    container_name: wordflux-postgres
    restart: always
    environment:
      - POSTGRES_USER=kanboard
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=kanboard
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - wordflux-network

  wordflux:
    build: .
    container_name: wordflux-app
    restart: always
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - NODE_ENV=production
      - KANBOARD_URL=http://kanboard
      - KANBOARD_TOKEN=${KANBOARD_TOKEN}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - kanboard
    networks:
      - wordflux-network

  nginx:
    image: nginx:alpine
    container_name: wordflux-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - wordflux
      - kanboard
    networks:
      - wordflux-network

networks:
  wordflux-network:
    driver: bridge

volumes:
  kanboard_data:
  kanboard_plugins:
  postgres_data:
```

```nginx
# nginx.conf
server {
    listen 80;
    server_name wordflux.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wordflux.example.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Main app
    location / {
        proxy_pass http://wordflux:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Kanboard
    location /board/ {
        proxy_pass http://kanboard/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Phase 5.3: Deployment Script (2 hours)
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Starting WordFlux deployment..."

# Load environment
source .env.production

# Build application
echo "📦 Building application..."
npm run build

# Build Docker image
echo "🐳 Building Docker images..."
docker-compose -f docker/docker-compose.prod.yml build

# Start services
echo "▶️ Starting services..."
docker-compose -f docker/docker-compose.prod.yml up -d

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 10

# Health check
echo "🏥 Running health check..."
curl -f http://localhost:3000/api/agent || exit 1

# Run tests
echo "🧪 Running smoke tests..."
npm run test:smoke

echo "✅ Deployment complete!"
echo "🌐 Application available at https://wordflux.example.com"
```

#### Phase 5.4: Monitoring Setup (1 hour)
```javascript
// scripts/monitor.js
import fetch from 'node-fetch';

const CHECKS = [
  {
    name: 'App Health',
    url: 'http://localhost:3000/api/agent',
    method: 'GET'
  },
  {
    name: 'Kanboard API',
    url: 'http://localhost:8080/jsonrpc.php',
    method: 'POST',
    body: {
      jsonrpc: '2.0',
      method: 'getVersion',
      id: 1
    }
  }
];

async function runChecks() {
  console.log('🔍 Running health checks...');
  
  for (const check of CHECKS) {
    try {
      const response = await fetch(check.url, {
        method: check.method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Auth': process.env.KANBOARD_TOKEN
        },
        body: check.body ? JSON.stringify(check.body) : undefined
      });
      
      if (response.ok) {
        console.log(`✅ ${check.name}: OK`);
      } else {
        console.error(`❌ ${check.name}: HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ ${check.name}: ${error.message}`);
    }
  }
}

// Run checks every 5 minutes
setInterval(runChecks, 5 * 60 * 1000);
runChecks();
```

#### Day 5 Success Criteria ✅
- [ ] All E2E tests passing
- [ ] Production deployment successful
- [ ] SSL/HTTPS working
- [ ] Monitoring active
- [ ] Documentation complete

---

## 📊 SUCCESS METRICS

### Performance Targets
- Response time: < 2s for chat commands
- Board refresh: < 500ms
- Uptime: 99.9%
- Error rate: < 1%

### Feature Completeness
- ✅ Natural language card creation
- ✅ Card movement between columns
- ✅ Card updates and deletion
- ✅ Ambiguity resolution
- ✅ Board state synchronization
- ✅ Error recovery

### User Experience
- Clean, intuitive interface
- Real-time feedback
- Helpful error messages
- Suggestion system
- Command history

---

## 🚀 POST-LAUNCH ROADMAP

### Week 2: Enhancement
- [ ] Voice input via Web Speech API
- [ ] Bulk operations
- [ ] Undo/Redo functionality
- [ ] Keyboard shortcuts

### Week 3: Advanced Features
- [ ] Multi-board support
- [ ] User authentication
- [ ] Team collaboration
- [ ] Activity history

### Week 4: Intelligence
- [ ] Smart suggestions based on patterns
- [ ] Automated workflows
- [ ] Natural language reporting
- [ ] Predictive task creation

---

## 🎯 FINAL CHECKLIST

### Before Launch
- [ ] All tests passing (unit, integration, E2E)
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Backup strategy in place

### Launch Day
- [ ] Deploy to production
- [ ] Verify all services running
- [ ] Monitor for first hour
- [ ] Announce to users
- [ ] Collect feedback

### Post-Launch
- [ ] Monitor error rates
- [ ] Track usage metrics
- [ ] Gather user feedback
- [ ] Plan iteration 2

---

## 📝 NOTES

### Lessons Learned
1. **Don't rebuild what exists** - Kanboard + Chatbot UI saved months
2. **JSON-RPC is simple** - Much easier than REST for this use case
3. **MIT license is freedom** - No legal concerns ever
4. **Agent layer is the value** - Focus on what makes us unique

### Key Decisions
- Chose Kanboard over Planka for licensing
- Used iframe instead of custom board UI (can upgrade later)
- GPT-4 until GPT-5 available
- Polling instead of webhooks (simpler, good enough)

### Resources
- Kanboard Docs: https://docs.kanboard.org
- Chatbot UI: https://github.com/mckaywrigley/chatbot-ui
- OpenAI API: https://platform.openai.com/docs

---

**This is our North Star. In 5 days, we ship!** 🚀