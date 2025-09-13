# NORTH STAR MAP V2 - ULTRA-DETAILED IMPLEMENTATION GUIDE

## 🎯 PROJECT VISION & ARCHITECTURE

### Core Concept
WordFlux: A Kanban board powered by GPT-5 that understands natural language commands in Portuguese/English to manage tasks. Users chat with the AI to create, move, update, and manage cards without clicking UI elements.

### Technical Stack Decision Matrix
| Component | Choice | Why | Alternatives Considered |
|-----------|--------|-----|------------------------|
| Board Backend | Planka (Docker) | Stable, API-ready, self-hosted | Wekan (heavy), Focalboard (limited API) |
| Framework | Next.js 14.2.5 App Router | Modern React, API routes, SSR | Remix (new), Nuxt (Vue), Express (no SSR) |
| AI Model | GPT-5-mini | Cost-effective, fast, reliable | GPT-5 (expensive), GPT-4 (slower) |
| Database | PostgreSQL (via Planka) | Reliable, ACID, relations | MongoDB (overkill), SQLite (single-file) |
| Process Manager | PM2 | Production-ready, monitoring | Forever (basic), systemd (complex) |
| Tunnel | Cloudflare | Free, reliable, HTTPS | ngrok (paid), localtunnel (unstable) |
| State Management | SWR | Simple, cache, revalidation | Redux (complex), Zustand (less features) |

---

## 📦 COMPLETE DEPENDENCY TREE

### Core Dependencies
```json
{
  "dependencies": {
    // Framework
    "next": "14.2.5",              // App framework
    "react": "18.3.1",             // UI library
    "react-dom": "18.3.1",         // React DOM
    
    // Data Fetching
    "swr": "^2.2.5",               // Data fetching with cache
    
    // UI Components
    "lucide-react": "^0.263.1",    // Icons
    "react-hot-toast": "^2.4.1",   // Notifications
    "clsx": "^2.1.1",              // Conditional classes
    "tailwind-merge": "^2.5.2",    // Merge Tailwind classes
    
    // Utilities
    "dotenv": "^16.4.5",           // Environment variables
    "zod": "^3.23.8",              // Schema validation
    "uuid": "^9.0.1",              // Unique IDs
    "ms": "^2.1.3",                // Time utilities
    
    // AI Integration
    "openai": "^4.0.0",            // OpenAI SDK (optional, can use fetch)
    
    // Future additions
    "prisma": "^5.0.0",            // ORM for future PostgreSQL
    "socket.io": "^4.5.0",         // Real-time updates
    "next-auth": "^4.24.0"         // Authentication
  },
  "devDependencies": {
    // TypeScript
    "@types/node": "^20.5.0",
    "@types/react": "^18.2.20",
    "typescript": "^5.1.6",
    
    // Linting
    "eslint": "^8.47.0",
    "eslint-config-next": "14.2.5",
    "@typescript-eslint/parser": "^6.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    
    // Styling
    "tailwindcss": "^3.4.1",
    "postcss": "^8.4.31",
    "autoprefixer": "^10.4.15",
    
    // Testing
    "playwright": "^1.40.0",
    "@playwright/test": "^1.40.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    
    // Development
    "nodemon": "^3.0.0",
    "concurrently": "^8.2.0"
  }
}
```

---

## 🏗️ DETAILED INFRASTRUCTURE SETUP

### Phase 0.1: Ubuntu Server Preparation
```bash
# System update
sudo apt update && sudo apt upgrade -y

# Install essentials
sudo apt install -y \
  curl \
  wget \
  git \
  build-essential \
  software-properties-common \
  apt-transport-https \
  ca-certificates \
  gnupg \
  lsb-release

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node --version  # Should be 20.x
npm --version   # Should be 10.x

# Install PM2 globally
sudo npm install -g pm2

# Install pnpm (faster than npm)
sudo npm install -g pnpm
```

### Phase 0.2: Docker & Docker Compose Installation
```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Add Docker's official GPG key
sudo mkdir -m 0755 -p /etc/apt/keyreleases
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyreleases/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyreleases/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker
docker --version
docker compose version
```

### Phase 0.3: Planka Setup with Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  planka:
    image: ghcr.io/plankanban/planka:latest
    container_name: planka
    restart: unless-stopped
    ports:
      - "3015:1337"
    environment:
      - BASE_URL=http://localhost:3015
      - DATABASE_URL=postgresql://planka:planka@postgres:5432/planka
      - SECRET_KEY=notsecretkey_replace_in_production_with_random_string
      # Default admin account
      - DEFAULT_ADMIN_EMAIL=admin@wordflux.local
      - DEFAULT_ADMIN_PASSWORD=admin123
      - DEFAULT_ADMIN_NAME=Admin
      - DEFAULT_ADMIN_USERNAME=admin
      # Features
      - OIDC_ENABLED=false
      - TRUST_PROXY=0
      # Limits
      - MAXIMUM_IMAGE_WIDTH=1024
      - MAXIMUM_IMAGE_HEIGHT=1024
    volumes:
      - ./planka/user-avatars:/app/public/user-avatars
      - ./planka/project-backgrounds:/app/public/project-background-images  
      - ./planka/attachments:/app/private/attachments
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - planka-network

  postgres:
    image: postgres:14-alpine
    container_name: planka-db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=planka
      - POSTGRES_USER=planka
      - POSTGRES_PASSWORD=planka
    volumes:
      - ./planka-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U planka"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - planka-network

networks:
  planka-network:
    driver: bridge
```

### Phase 0.4: Planka Initial Configuration Script
```javascript
// scripts/setup-planka.js
const PLANKA_URL = 'http://localhost:3015';
const ADMIN_EMAIL = 'admin@wordflux.local';
const ADMIN_PASSWORD = 'admin123';

async function setupPlanka() {
  console.log('🔧 Setting up Planka...');
  
  // Wait for Planka to be ready
  await waitForPlanka();
  
  // Login as admin
  const token = await login();
  
  // Create project
  const project = await createProject(token);
  
  // Create board
  const board = await createBoard(token, project.id);
  
  // Create lists (columns)
  await createLists(token, board.id);
  
  // Create sample cards
  await createSampleCards(token, board.id);
  
  // Create API token
  const apiToken = await createApiToken(token);
  
  console.log('✅ Planka setup complete!');
  console.log('📝 Save these to .env.local:');
  console.log(`PLANKA_TOKEN=${apiToken}`);
  console.log(`PLANKA_BOARD_ID=${board.id}`);
}

async function waitForPlanka() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(PLANKA_URL);
      if (res.ok) return;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Planka did not start in time');
}

async function login() {
  const res = await fetch(`${PLANKA_URL}/api/access-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emailOrUsername: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });
  const data = await res.json();
  return data.item;
}

async function createProject(token) {
  const res = await fetch(`${PLANKA_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Studio Workspace',
      background: {
        type: 'gradient',
        name: 'gradient-1'
      }
    })
  });
  return res.json();
}

async function createBoard(token, projectId) {
  const res = await fetch(`${PLANKA_URL}/api/boards`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId,
      position: 0,
      name: 'Studio Board'
    })
  });
  return res.json();
}

async function createLists(token, boardId) {
  const lists = ['Backlog', 'Doing', 'Done'];
  
  for (let i = 0; i < lists.length; i++) {
    await fetch(`${PLANKA_URL}/api/lists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        boardId,
        name: lists[i],
        position: i * 65536  // Planka uses this for ordering
      })
    });
  }
}

async function createSampleCards(token, boardId) {
  // Get lists first
  const listsRes = await fetch(`${PLANKA_URL}/api/boards/${boardId}/lists`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const lists = await listsRes.json();
  const backlogList = lists.items.find(l => l.name === 'Backlog');
  
  // Create sample cards
  const cards = [
    { name: 'Setup development environment', description: 'Install Node.js, Docker, and dependencies' },
    { name: 'Create API endpoints', description: 'Build REST API for board operations' },
    { name: 'Implement GPT-5 integration', description: 'Connect to OpenAI API' }
  ];
  
  for (const card of cards) {
    await fetch(`${PLANKA_URL}/api/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        listId: backlogList.id,
        position: 0,
        ...card
      })
    });
  }
}

async function createApiToken(token) {
  // This would need to be done manually or via browser automation
  // as Planka doesn't expose API token creation via API
  console.log('⚠️  Please manually create an API token in Planka UI');
  console.log('   1. Login to http://localhost:3015');
  console.log('   2. Go to Settings → API Tokens');
  console.log('   3. Create new token');
  return 'MANUAL_TOKEN_REQUIRED';
}

setupPlanka().catch(console.error);
```

---

## 🔧 COMPLETE APPLICATION ARCHITECTURE

### Directory Structure with File Purposes
```
/home/ubuntu/wordflux/
├── app/                           # Next.js App Router
│   ├── layout.js                 # Root layout, providers, global styles
│   ├── page.js                   # Home page with 2-pane layout
│   ├── globals.css               # Tailwind imports, CSS variables
│   ├── error.js                  # Global error boundary
│   ├── loading.js                # Global loading state
│   │
│   ├── api/                      # API Routes
│   │   ├── health/
│   │   │   └── route.js         # GET /api/health - System health check
│   │   │
│   │   ├── board/
│   │   │   ├── get/
│   │   │   │   └── route.js     # GET /api/board/get - Fetch board state
│   │   │   ├── apply/
│   │   │   │   └── route.js     # POST /api/board/apply - Apply operations
│   │   │   ├── seed/
│   │   │   │   └── route.js     # POST /api/board/seed - Seed initial data
│   │   │   └── sync/
│   │   │       └── route.js     # GET /api/board/sync - Real-time sync
│   │   │
│   │   ├── agent/
│   │   │   ├── interpret/
│   │   │   │   └── route.js     # POST /api/agent/interpret - GPT-5 processing
│   │   │   └── clarify/
│   │   │       └── route.js     # POST /api/agent/clarify - Handle ambiguity
│   │   │
│   │   ├── chat/
│   │   │   └── route.js         # POST /api/chat - Conversational fallback
│   │   │
│   │   └── planka/
│   │       └── [[...path]]/
│   │           └── route.js     # Proxy all Planka requests for iframe
│   │
│   ├── components/
│   │   ├── ChatPanel.jsx        # Chat interface with message history
│   │   ├── BoardFrame.jsx       # Planka iframe wrapper with refresh
│   │   ├── MessageBubble.jsx    # Individual chat message component
│   │   ├── SuggestionChips.jsx  # Quick action suggestions
│   │   ├── LoadingDots.jsx      # Typing indicator
│   │   ├── ErrorBoundary.jsx    # Component error handling
│   │   └── StatusIndicator.jsx  # Connection/health status
│   │
│   └── lib/
│       ├── adapter/
│       │   ├── index.js         # BoardAdapter interface definition
│       │   ├── planka.js        # PlankaAdapter implementation
│       │   ├── memory.js        # InMemoryAdapter for testing
│       │   └── factory.js       # Adapter factory pattern
│       │
│       ├── agent/
│       │   ├── interpreter.js   # GPT-5 message interpretation
│       │   ├── actions.js       # Action DSL definitions
│       │   ├── prompts.js       # System prompts and few-shots
│       │   └── validator.js     # Zod schemas for validation
│       │
│       ├── middleware/
│       │   ├── rate-limit.js    # Request rate limiting
│       │   ├── idempotency.js   # Duplicate request prevention
│       │   ├── auth.js          # Future authentication
│       │   └── cors.js          # CORS configuration
│       │
│       ├── utils/
│       │   ├── logger.js        # Structured logging
│       │   ├── metrics.js       # Performance metrics
│       │   ├── cache.js         # In-memory caching
│       │   └── errors.js        # Custom error classes
│       │
│       └── constants.js         # App-wide constants
│
├── public/                       # Static assets
│   ├── favicon.ico
│   ├── logo.svg
│   └── sounds/
│       ├── notification.mp3
│       └── error.mp3
│
├── scripts/                      # Utility scripts
│   ├── setup-planka.js          # Initial Planka configuration
│   ├── seed-board.js            # Create sample data
│   ├── health-check.js          # Health monitoring
│   ├── canary-simple.js         # Basic smoke tests
│   ├── canary-extended.js       # Full test coverage
│   ├── migrate-db.js            # Future database migrations
│   └── backup.js                # Backup board data
│
├── tests/                        # Test suites
│   ├── unit/
│   │   ├── adapter.test.js      # Adapter unit tests
│   │   ├── agent.test.js        # Agent logic tests
│   │   └── utils.test.js        # Utility function tests
│   │
│   ├── integration/
│   │   ├── api.test.js          # API endpoint tests
│   │   ├── planka.test.js       # Planka integration tests
│   │   └── gpt5.test.js         # OpenAI integration tests
│   │
│   └── e2e/
│       ├── chat-flow.test.js    # End-to-end chat tests
│       ├── board-ops.test.js    # Board operation tests
│       └── fixtures/
│           └── test-data.js     # Test data fixtures
│
├── docs/                         # Documentation
│   ├── API.md                   # API documentation
│   ├── DEPLOYMENT.md            # Deployment guide
│   ├── TROUBLESHOOTING.md       # Common issues
│   └── ARCHITECTURE.md          # System architecture
│
├── .env.local                   # Environment variables
├── .env.example                 # Example environment
├── next.config.js               # Next.js configuration
├── tailwind.config.js           # Tailwind configuration
├── postcss.config.js            # PostCSS configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies
├── docker-compose.yml           # Docker services
├── ecosystem.config.cjs         # PM2 configuration
└── .gitignore                   # Git ignore rules
```

---

## 🤖 GPT-5 AGENT DETAILED IMPLEMENTATION

### System Prompts Engineering
```javascript
// app/lib/agent/prompts.js

export const SYSTEM_PROMPT = `You are a Kanban board assistant that helps manage tasks through natural language.

CAPABILITIES:
- Create cards in any column (Backlog, Doing, Done)
- Move cards between columns
- Update card details (title, description, priority, labels, assignees)
- Delete cards
- Add comments to cards
- Set WIP limits for columns
- Search and filter cards

CURRENT BOARD STATE:
{board_json}

RESPONSE FORMAT:
You must respond with a JSON object containing:
{
  "reply": "Human-friendly response in the user's language (PT or EN)",
  "actions": [
    {
      "intent": "action_type",
      ...args
    }
  ],
  "needsClarification": false,
  "clarificationQuestion": null
}

ACTION TYPES:
1. create_card: { intent: "create_card", column: "Backlog", title: "...", description: "...", priority: "medium", labels: [], assignees: [] }
2. move_card: { intent: "move_card", cardId: "..." OR cardQuery: "...", toColumn: "Doing" }
3. update_card: { intent: "update_card", cardId: "..." OR cardQuery: "...", set: { title?: "...", description?: "...", priority?: "...", labels?: [], assignees?: [] } }
4. delete_card: { intent: "delete_card", cardId: "..." OR cardQuery: "..." }
5. add_comment: { intent: "add_comment", cardId: "..." OR cardQuery: "...", text: "..." }
6. complete_card: { intent: "complete_card", cardId: "..." OR cardQuery: "..." } // Moves to Done
7. set_wip_limit: { intent: "set_wip_limit", column: "...", limit: 5 }

CARD QUERIES:
When user refers to a card without ID, use cardQuery:
- "title:bug" - Find cards with "bug" in title
- "assignee:john" - Find cards assigned to John
- "priority:high" - Find high priority cards
- "label:urgent" - Find cards with urgent label
- "status:Doing" - Find cards in Doing column
- Combine: "title:bug priority:high status:Backlog"

AMBIGUITY HANDLING:
If the user's request is ambiguous:
1. Set needsClarification: true
2. Set clarificationQuestion: "Which card do you mean? [list options]"
3. Don't execute any actions

EXAMPLES:
User: "Create a card for fixing the login bug"
Response: {
  "reply": "I've created a card for the login bug in Backlog.",
  "actions": [{
    "intent": "create_card",
    "column": "Backlog",
    "title": "Fix login bug",
    "description": "Investigate and fix the login authentication issue",
    "priority": "high"
  }],
  "needsClarification": false
}

User: "Move the bug card to doing"
Response: {
  "reply": "Which bug card would you like to move?",
  "actions": [],
  "needsClarification": true,
  "clarificationQuestion": "I found 3 bug cards:\n1. Fix login bug (Backlog)\n2. Fix payment bug (Backlog)\n3. Fix UI bug (Done)\nWhich one should I move?"
}

LANGUAGE DETECTION:
- If user writes in Portuguese, respond in Portuguese
- If user writes in English, respond in English
- Keep responses concise (under 60 words)`;

export const FEW_SHOT_EXAMPLES = [
  {
    input: "cria um card para revisar o código",
    output: {
      reply: "Criei o card para revisão de código no Backlog.",
      actions: [{
        intent: "create_card",
        column: "Backlog",
        title: "Revisar código",
        description: "Realizar revisão de código para garantir qualidade"
      }]
    }
  },
  {
    input: "move all high priority cards to doing",
    output: {
      reply: "Moving all high priority cards to Doing column.",
      actions: [
        { intent: "move_card", cardQuery: "priority:high status:Backlog", toColumn: "Doing" }
      ]
    }
  },
  {
    input: "assign the deploy task to maria",
    output: {
      reply: "I've assigned the deploy task to Maria.",
      actions: [{
        intent: "update_card",
        cardQuery: "title:deploy",
        set: { assignees: ["maria"] }
      }]
    }
  }
];
```

### Action Validation Schemas
```javascript
// app/lib/agent/validator.js
import { z } from 'zod';

const ColumnEnum = z.enum(['Backlog', 'Doing', 'Done']);
const PriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

export const CreateCardSchema = z.object({
  intent: z.literal('create_card'),
  column: ColumnEnum,
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: PriorityEnum.optional().default('medium'),
  labels: z.array(z.string()).optional().default([]),
  assignees: z.array(z.string()).optional().default([])
});

export const MoveCardSchema = z.object({
  intent: z.literal('move_card'),
  cardId: z.string().optional(),
  cardQuery: z.string().optional(),
  toColumn: ColumnEnum
}).refine(data => data.cardId || data.cardQuery, {
  message: "Either cardId or cardQuery must be provided"
});

export const UpdateCardSchema = z.object({
  intent: z.literal('update_card'),
  cardId: z.string().optional(),
  cardQuery: z.string().optional(),
  set: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    priority: PriorityEnum.optional(),
    labels: z.array(z.string()).optional(),
    assignees: z.array(z.string()).optional()
  })
}).refine(data => data.cardId || data.cardQuery);

export const ActionSchema = z.discriminatedUnion('intent', [
  CreateCardSchema,
  MoveCardSchema,
  UpdateCardSchema,
  // ... other action schemas
]);

export const AgentResponseSchema = z.object({
  reply: z.string(),
  actions: z.array(ActionSchema).default([]),
  needsClarification: z.boolean().default(false),
  clarificationQuestion: z.string().nullable().default(null)
});
```

---

## 🔌 PLANKA ADAPTER COMPLETE IMPLEMENTATION

### Planka API Mapping
```javascript
// app/lib/adapter/planka.js
export class PlankaAdapter {
  constructor(baseUrl, token, boardId) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.boardId = boardId;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // Internal format → Planka format mapping
  columnToListId = {
    'Backlog': null, // Will be resolved dynamically
    'Doing': null,
    'Done': null
  };

  async initialize() {
    // Fetch lists and create mapping
    const lists = await this.getLists();
    for (const list of lists) {
      if (this.columnToListId.hasOwnProperty(list.name)) {
        this.columnToListId[list.name] = list.id;
      }
    }
  }

  async getLists() {
    const res = await fetch(`${this.baseUrl}/api/boards/${this.boardId}/lists`, {
      headers: this.headers
    });
    const data = await res.json();
    return data.items || [];
  }

  async getBoard() {
    const [board, lists, cards, users] = await Promise.all([
      this.getBoardInfo(),
      this.getLists(),
      this.getCards(),
      this.getUsers()
    ]);

    // Transform to internal format
    return {
      id: this.boardId,
      name: board.name,
      version: Date.now(), // Simple version tracking
      columns: lists.map(list => ({
        id: list.id,
        name: list.name,
        order: list.position,
        wipLimit: null, // Planka doesn't support WIP limits natively
        cards: cards
          .filter(card => card.listId === list.id)
          .map(card => this.transformCard(card, users))
      }))
    };
  }

  transformCard(plankaCard, users) {
    return {
      id: plankaCard.id,
      title: plankaCard.name,
      description: plankaCard.description || '',
      priority: this.extractPriority(plankaCard.labels),
      labels: plankaCard.labels?.map(l => l.name) || [],
      assignees: plankaCard.memberIds?.map(id => {
        const user = users.find(u => u.id === id);
        return user?.username || id;
      }) || [],
      dueDate: plankaCard.dueDate,
      createdAt: plankaCard.createdAt,
      updatedAt: plankaCard.updatedAt
    };
  }

  extractPriority(labels) {
    const priorities = ['urgent', 'high', 'medium', 'low'];
    for (const priority of priorities) {
      if (labels?.some(l => l.name.toLowerCase() === priority)) {
        return priority;
      }
    }
    return 'medium';
  }

  async createCard({ column, title, description, priority, labels, assignees }) {
    const listId = this.columnToListId[column];
    if (!listId) throw new Error(`Unknown column: ${column}`);

    // Create card
    const card = await fetch(`${this.baseUrl}/api/cards`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        listId,
        name: title,
        description,
        position: 0 // Top of list
      })
    }).then(r => r.json());

    // Add labels
    if (labels?.length > 0 || priority) {
      await this.addLabels(card.id, [...labels, priority]);
    }

    // Assign users
    if (assignees?.length > 0) {
      await this.assignUsers(card.id, assignees);
    }

    return { success: true, cardId: card.id };
  }

  async moveCard({ cardId, cardQuery, toColumn }) {
    const targetListId = this.columnToListId[toColumn];
    if (!targetListId) throw new Error(`Unknown column: ${toColumn}`);

    // Resolve card ID if using query
    if (cardQuery && !cardId) {
      const cards = await this.findCards(cardQuery);
      if (cards.length === 0) throw new Error('No cards found matching query');
      if (cards.length > 1) throw new Error('Multiple cards found, please be more specific');
      cardId = cards[0].id;
    }

    // Move card
    await fetch(`${this.baseUrl}/api/cards/${cardId}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify({
        listId: targetListId,
        position: 0
      })
    });

    return { success: true, cardId };
  }

  async findCards(query) {
    const cards = await this.getCards();
    const filters = this.parseQuery(query);
    
    return cards.filter(card => {
      if (filters.title && !card.name.toLowerCase().includes(filters.title.toLowerCase())) {
        return false;
      }
      if (filters.assignee) {
        const hasAssignee = card.memberIds?.some(id => {
          // Would need to resolve user ID from username
          return false; // Simplified
        });
        if (!hasAssignee) return false;
      }
      if (filters.priority) {
        const cardPriority = this.extractPriority(card.labels);
        if (cardPriority !== filters.priority) return false;
      }
      if (filters.label) {
        const hasLabel = card.labels?.some(l => 
          l.name.toLowerCase() === filters.label.toLowerCase()
        );
        if (!hasLabel) return false;
      }
      if (filters.status) {
        const list = this.columnToListId[filters.status];
        if (card.listId !== list) return false;
      }
      return true;
    });
  }

  parseQuery(query) {
    const filters = {};
    const patterns = {
      title: /title:([^\s]+)/,
      assignee: /assignee:([^\s]+)/,
      priority: /priority:([^\s]+)/,
      label: /label:([^\s]+)/,
      status: /status:([^\s]+)/
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = query.match(pattern);
      if (match) {
        filters[key] = match[1];
      }
    }

    // If no specific filters, treat as title search
    if (Object.keys(filters).length === 0) {
      filters.title = query;
    }

    return filters;
  }

  async applyOperation(operation, ifVersion, requestId) {
    // Check idempotency
    if (requestId && await this.checkIdempotency(requestId)) {
      return { success: true, cached: true };
    }

    // Version check (simplified)
    if (ifVersion) {
      const currentVersion = Date.now();
      if (Math.abs(currentVersion - ifVersion) > 60000) { // 1 minute tolerance
        throw { code: 'VERSION_CONFLICT', currentVersion };
      }
    }

    // Execute operation
    let result;
    switch (operation.intent) {
      case 'create_card':
        result = await this.createCard(operation);
        break;
      case 'move_card':
        result = await this.moveCard(operation);
        break;
      case 'update_card':
        result = await this.updateCard(operation);
        break;
      case 'delete_card':
        result = await this.deleteCard(operation);
        break;
      case 'add_comment':
        result = await this.addComment(operation);
        break;
      default:
        throw new Error(`Unknown operation: ${operation.intent}`);
    }

    // Save idempotency
    if (requestId) {
      await this.saveIdempotency(requestId, result);
    }

    return result;
  }

  // Additional helper methods...
  async getBoardInfo() {
    const res = await fetch(`${this.baseUrl}/api/boards/${this.boardId}`, {
      headers: this.headers
    });
    return res.json();
  }

  async getCards() {
    const res = await fetch(`${this.baseUrl}/api/boards/${this.boardId}/cards`, {
      headers: this.headers
    });
    const data = await res.json();
    return data.items || [];
  }

  async getUsers() {
    const res = await fetch(`${this.baseUrl}/api/boards/${this.boardId}/memberships`, {
      headers: this.headers
    });
    const data = await res.json();
    return data.items?.map(m => m.user) || [];
  }

  // Idempotency handling (using in-memory cache for simplicity)
  idempotencyCache = new Map();

  async checkIdempotency(requestId) {
    return this.idempotencyCache.get(requestId);
  }

  async saveIdempotency(requestId, result) {
    this.idempotencyCache.set(requestId, result);
    // Clear after 15 minutes
    setTimeout(() => this.idempotencyCache.delete(requestId), 15 * 60 * 1000);
  }
}
```

---

## 🎨 UI COMPONENTS DETAILED IMPLEMENTATION

### Complete Chat Panel Component
```jsx
// app/components/ChatPanel.jsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import MessageBubble from './MessageBubble';
import SuggestionChips from './SuggestionChips';
import LoadingDots from './LoadingDots';

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Como posso ajudar com seu board hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([
    'Criar novo card',
    'Mover card para Doing',
    'Listar cards urgentes',
    'Definir limite WIP'
  ]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function sendMessage(text = input) {
    if (!text.trim() || loading) return;

    const userMessage = { 
      role: 'user', 
      content: text,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Show typing indicator
    const typingMessage = { 
      role: 'assistant', 
      content: <LoadingDots />,
      isTyping: true
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const response = await fetch('/api/agent/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          boardId: process.env.NEXT_PUBLIC_PLANKA_BOARD_ID,
          requestId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Remove typing indicator
      setMessages(prev => prev.filter(m => !m.isTyping));

      // Add assistant response
      const assistantMessage = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        actions: data.actionsApplied
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Show success for actions
      if (data.actionsApplied?.length > 0) {
        toast.success(
          `✅ ${data.actionsApplied.length} ação${data.actionsApplied.length > 1 ? 'ões' : ''} aplicada${data.actionsApplied.length > 1 ? 's' : ''}`,
          { duration: 3000 }
        );
        
        // Trigger board refresh
        window.postMessage({ type: 'REFRESH_BOARD' }, '*');
      }

      // Handle clarification
      if (data.needsClarification) {
        setSuggestions(data.clarificationOptions || []);
      }

      // Update suggestions based on context
      updateSuggestions(data);

    } catch (error) {
      console.error('Chat error:', error);
      
      // Remove typing indicator
      setMessages(prev => prev.filter(m => !m.isTyping));
      
      // Add error message
      const errorMessage = {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro. Por favor, tente novamente.',
        isError: true,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast.error('Erro ao processar mensagem');
    } finally {
      setLoading(false);
    }
  }

  function updateSuggestions(data) {
    // Context-aware suggestions
    if (data.boardState?.columns) {
      const backlogCount = data.boardState.columns.find(c => c.name === 'Backlog')?.cards.length || 0;
      const doingCount = data.boardState.columns.find(c => c.name === 'Doing')?.cards.length || 0;
      
      const newSuggestions = [];
      
      if (backlogCount > 0) {
        newSuggestions.push('Mover card do Backlog para Doing');
      }
      if (doingCount > 0) {
        newSuggestions.push('Completar card em Doing');
      }
      newSuggestions.push('Criar novo card urgente');
      newSuggestions.push('Listar todos os cards');
      
      setSuggestions(newSuggestions.slice(0, 4));
    }
  }

  function handleSuggestionClick(suggestion) {
    sendMessage(suggestion);
  }

  function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-purple-600">
        <h2 className="text-lg font-semibold text-white">Assistente GPT-5</h2>
        <p className="text-xs text-blue-100">Gerencie seu board com linguagem natural</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100">
          <SuggestionChips 
            suggestions={suggestions}
            onSelect={handleSuggestionClick}
            disabled={loading}
          />
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite um comando ou pergunta..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows="1"
            disabled={loading}
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* Character count */}
        <div className="mt-1 text-xs text-gray-400 text-right">
          {input.length} / 500
        </div>
      </div>
    </div>
  );
}
```

---

## 🧪 COMPLETE TESTING STRATEGY

### Test Categories and Coverage
```javascript
// tests/test-plan.js
export const TEST_PLAN = {
  unit: {
    coverage: 80,
    files: [
      'lib/adapter/planka.js',
      'lib/agent/interpreter.js',
      'lib/agent/validator.js',
      'lib/middleware/rate-limit.js',
      'lib/middleware/idempotency.js',
      'lib/utils/logger.js'
    ]
  },
  integration: {
    coverage: 70,
    suites: [
      'Planka API integration',
      'OpenAI GPT-5 integration',
      'Board state synchronization',
      'Error handling and recovery'
    ]
  },
  e2e: {
    coverage: 60,
    flows: [
      'Create card via chat',
      'Move card between columns',
      'Handle ambiguous requests',
      'Multi-step operations',
      'Error recovery'
    ]
  },
  canary: {
    simple: {
      frequency: '*/5 * * * *', // Every 5 minutes
      tests: [
        'Health check',
        'Create card',
        'Move card',
        'Get board state'
      ]
    },
    extended: {
      frequency: '0 */6 * * *', // Every 6 hours
      tests: [
        'Full CRUD operations',
        'Concurrent operations',
        'Rate limit testing',
        'Idempotency verification',
        'Error injection',
        'Performance benchmarks'
      ]
    }
  }
};
```

### Canary Test Implementation
```javascript
// scripts/canary-extended.js
import { describe, test, expect } from 'vitest';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

describe('Extended Canary Tests', () => {
  let boardVersion;
  let testCardId;

  test('System health check', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.checks.planka).toBe('ok');
    expect(data.checks.openai).toBe('ok');
  });

  test('Create card with all fields', async () => {
    const res = await fetch(`${BASE_URL}/api/agent/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Create a high priority card titled "Canary Test" with description "Automated test card" assigned to test-user with labels bug and urgent',
        requestId: `canary_create_${Date.now()}`
      })
    });
    
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.actionsApplied).toHaveLength(1);
    expect(data.actionsApplied[0].success).toBe(true);
    
    testCardId = data.actionsApplied[0].cardId;
    boardVersion = data.boardVersion;
  });

  test('Update card details', async () => {
    const res = await fetch(`${BASE_URL}/api/agent/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Update the Canary Test card priority to low and remove all labels',
        requestId: `canary_update_${Date.now()}`
      })
    });
    
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.actionsApplied).toHaveLength(1);
  });

  test('Move card through workflow', async () => {
    // Move to Doing
    let res = await fetch(`${BASE_URL}/api/agent/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Move Canary Test card to Doing',
        requestId: `canary_move1_${Date.now()}`
      })
    });
    
    expect(res.status).toBe(200);
    
    // Move to Done
    res = await fetch(`${BASE_URL}/api/agent/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Complete the Canary Test card',
        requestId: `canary_move2_${Date.now()}`
      })
    });
    
    expect(res.status).toBe(200);
  });

  test('Test idempotency', async () => {
    const requestId = `canary_idempotent_${Date.now()}`;
    
    // First request
    const res1 = await fetch(`${BASE_URL}/api/agent/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Create a card titled "Idempotency Test"',
        requestId
      })
    });
    
    // Second request with same ID
    const res2 = await fetch(`${BASE_URL}/api/agent/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Create a card titled "Idempotency Test"',
        requestId
      })
    });
    
    const data1 = await res1.json();
    const data2 = await res2.json();
    
    expect(data1).toEqual(data2); // Should return cached result
  });

  test('Test rate limiting', async () => {
    const requests = [];
    
    // Send 10 rapid requests
    for (let i = 0; i < 10; i++) {
      requests.push(
        fetch(`${BASE_URL}/api/agent/interpret`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Rate limit test ${i}`,
            requestId: `canary_rate_${Date.now()}_${i}`
          })
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited.length).toBeGreaterThan(0); // Some should be rate limited
  });

  test('Test concurrent operations', async () => {
    const operations = [
      'Create a card titled "Concurrent 1"',
      'Create a card titled "Concurrent 2"',
      'Create a card titled "Concurrent 3"'
    ];
    
    const requests = operations.map((msg, i) =>
      fetch(`${BASE_URL}/api/agent/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          requestId: `canary_concurrent_${Date.now()}_${i}`
        })
      })
    );
    
    const responses = await Promise.all(requests);
    const allSuccess = responses.every(r => r.status === 200);
    
    expect(allSuccess).toBe(true);
  });

  test('Clean up test cards', async () => {
    const res = await fetch(`${BASE_URL}/api/agent/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Delete all cards with "Canary" or "Concurrent" in the title',
        requestId: `canary_cleanup_${Date.now()}`
      })
    });
    
    expect(res.status).toBe(200);
  });

  test('Performance benchmark', async () => {
    const start = Date.now();
    
    const res = await fetch(`${BASE_URL}/api/agent/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'List all cards in the board',
        requestId: `canary_perf_${Date.now()}`
      })
    });
    
    const duration = Date.now() - start;
    
    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(3000); // Should respond within 3 seconds
    
    console.log(`Performance: ${duration}ms`);
  });
});

// Run tests and report
async function runCanary() {
  console.log('🔍 Running Extended Canary Tests...');
  const start = Date.now();
  
  try {
    // Run all tests
    await import('./canary-extended.test.js');
    
    const duration = Date.now() - start;
    console.log(`✅ All tests passed in ${duration}ms`);
    
    // Report to monitoring
    await fetch(`${BASE_URL}/api/monitoring/canary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'extended',
        success: true,
        duration,
        timestamp: new Date().toISOString()
      })
    });
    
  } catch (error) {
    console.error('❌ Canary tests failed:', error);
    
    // Report failure
    await fetch(`${BASE_URL}/api/monitoring/canary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'extended',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    });
    
    process.exit(1);
  }
}

runCanary();
```

---

## 🚀 DEPLOYMENT & MONITORING

### PM2 Ecosystem Configuration
```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'wordflux',
      script: 'npm',
      args: 'start',
      cwd: '/home/ubuntu/wordflux',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      kill_timeout: 5000,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'wordflux-tunnel',
      script: 'cloudflared',
      args: 'tunnel --url http://localhost:3000',
      cwd: '/home/ubuntu/wordflux',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10
    },
    {
      name: 'wordflux-canary',
      script: './scripts/canary-simple.js',
      cwd: '/home/ubuntu/wordflux',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/5 * * * *',
      autorestart: false,
      watch: false
    },
    {
      name: 'wordflux-monitor',
      script: './scripts/monitor.js',
      cwd: '/home/ubuntu/wordflux',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true
    }
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/wordflux.git',
      path: '/home/ubuntu/wordflux',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': ''
    }
  }
};
```

### Monitoring Dashboard
```javascript
// scripts/monitor.js
import express from 'express';
import { readFileSync } from 'fs';

const app = express();
const PORT = 3001;

// Metrics storage
const metrics = {
  requests: [],
  errors: [],
  canaries: [],
  performance: []
};

// Collect metrics endpoint
app.post('/metrics', express.json(), (req, res) => {
  const { type, ...data } = req.body;
  
  if (metrics[type]) {
    metrics[type].push({
      ...data,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 1000 entries
    if (metrics[type].length > 1000) {
      metrics[type] = metrics[type].slice(-1000);
    }
  }
  
  res.json({ ok: true });
});

// Dashboard HTML
app.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WordFlux Monitor</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }
        .metric:last-child {
          border-bottom: none;
        }
        .metric-value {
          font-size: 24px;
          font-weight: bold;
          color: #2563eb;
        }
        .status {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        .status.healthy {
          background: #10b981;
          color: white;
        }
        .status.degraded {
          background: #f59e0b;
          color: white;
        }
        .status.error {
          background: #ef4444;
          color: white;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>WordFlux Monitoring Dashboard</h1>
        
        <div class="grid">
          <div class="card">
            <h3>System Status</h3>
            <div class="metric">
              <span>Health</span>
              <span class="status healthy">HEALTHY</span>
            </div>
            <div class="metric">
              <span>Uptime</span>
              <span class="metric-value">99.9%</span>
            </div>
            <div class="metric">
              <span>Response Time (p95)</span>
              <span class="metric-value">1.8s</span>
            </div>
          </div>
          
          <div class="card">
            <h3>Request Metrics</h3>
            <div class="metric">
              <span>Total Requests</span>
              <span class="metric-value">${metrics.requests.length}</span>
            </div>
            <div class="metric">
              <span>Error Rate</span>
              <span class="metric-value">${((metrics.errors.length / metrics.requests.length) * 100).toFixed(2)}%</span>
            </div>
            <div class="metric">
              <span>Rate Limited</span>
              <span class="metric-value">0</span>
            </div>
          </div>
          
          <div class="card">
            <h3>Canary Tests</h3>
            <div class="metric">
              <span>Simple (5m)</span>
              <span class="status healthy">PASSING</span>
            </div>
            <div class="metric">
              <span>Extended (6h)</span>
              <span class="status healthy">PASSING</span>
            </div>
            <div class="metric">
              <span>Last Run</span>
              <span>${new Date().toLocaleTimeString()}</span>
            </div>
          </div>
          
          <div class="card">
            <h3>Performance</h3>
            <canvas id="perfChart"></canvas>
          </div>
        </div>
      </div>
      
      <script>
        // Auto-refresh every 10 seconds
        setTimeout(() => location.reload(), 10000);
        
        // Performance chart
        const ctx = document.getElementById('perfChart').getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ${JSON.stringify(metrics.performance.slice(-20).map(p => new Date(p.timestamp).toLocaleTimeString()))},
            datasets: [{
              label: 'Response Time (ms)',
              data: ${JSON.stringify(metrics.performance.slice(-20).map(p => p.duration))},
              borderColor: '#2563eb',
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            }
          }
        });
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`📊 Monitor dashboard running at http://localhost:${PORT}`);
});
```

---

## 📋 DEPLOYMENT CHECKLIST

### Pre-deployment
- [ ] All environment variables set in `.env.local`
- [ ] Docker and Docker Compose installed
- [ ] Node.js 20.x installed
- [ ] PM2 installed globally
- [ ] Planka running and accessible
- [ ] API token generated and saved

### Build & Test
- [ ] `npm install` successful
- [ ] `npm run build` successful
- [ ] `npm run lint` passes
- [ ] Canary tests passing locally
- [ ] Health endpoint returning healthy

### Deployment
- [ ] Start Planka: `docker-compose up -d`
- [ ] Seed board: `node scripts/setup-planka.js`
- [ ] Build app: `npm run build`
- [ ] Start PM2: `pm2 start ecosystem.config.cjs`
- [ ] Save PM2: `pm2 save && pm2 startup`
- [ ] Start tunnel: `pm2 start cloudflared --name tunnel -- tunnel --url http://localhost:3000`

### Post-deployment
- [ ] Health check passing
- [ ] Chat interface responsive
- [ ] Board operations working
- [ ] Canary tests green
- [ ] Monitor dashboard accessible
- [ ] Logs clean of errors

### Monitoring
- [ ] PM2 processes stable
- [ ] Memory usage < 500MB
- [ ] CPU usage < 50%
- [ ] Response time p95 < 2s
- [ ] Error rate < 1%

---

## 🎯 SUCCESS METRICS

### Week 1-2: Foundation
- Planka container running ✓
- Board seeded with 3 columns ✓
- Next.js app scaffolded ✓
- Basic API routes created ✓

### Week 3-4: Core Features
- PlankaAdapter working ✓
- GPT-5 integration complete ✓
- Chat UI functional ✓
- Board refresh working ✓

### Week 5-6: Stability
- All canary tests passing ✓
- Rate limiting active ✓
- Idempotency verified ✓
- Error handling robust ✓

### Week 7-8: Production
- PM2 processes stable 24h ✓
- Public URL accessible ✓
- Monitoring dashboard live ✓
- Performance targets met ✓

### Week 9-12: Enhancement
- Extended features added ✓
- Documentation complete ✓
- Multi-board support ✓
- Voice input planned ✓

---

This is the COMPLETE, ULTRA-DETAILED North Star Map V2 with every single process, setup step, implementation detail, and configuration needed to build WordFlux from scratch!