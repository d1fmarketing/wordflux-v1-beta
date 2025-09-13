# WordFlux v1-beta - AI-Powered Kanban Studio

## 🚀 Production Status: LIVE at http://52.4.68.118

## Overview
WordFlux v1-beta combines Kanboard (MIT-licensed kanban board) with a GPT-5-mini powered chat interface to create an intelligent task management system. Currently running in production on AWS EC2.

## Architecture
- **Backend**: Kanboard with JSON-RPC API (Docker container on localhost:8090)
- **Frontend**: Next.js 14.2.5 with TypeScript
- **AI**: OpenAI GPT-5-mini for natural language processing
- **Database**: SQLite (embedded in Kanboard container)
- **Process Manager**: PM2 (wf-v1-beta)
- **Reverse Proxy**: Nginx

## Features
- Natural language task management through chat (GPT‑5)
- Real-time board with optimistic updates (create/move)
- Filters in UI: search, column, status (All/Active/Done)
- Drag & drop between columns and reordering
- JSON‑RPC integration with Kanboard
- Responsive 2‑pane layout (Chat + Board)

## Final UI Spec (v1-beta)

- Single screen: Workspace = Board + Chat (chat on the left, fixed 384px; board on the right, flexible)
- Chat drives all actions (create/move/delete); board auto‑syncs; no board buttons.
- Board header sticky at the top of the board pane; no horizontal scroll at 1024×600, 1366×768, 1920×1080.
- Health/fallback: if Kanboard is down, the server returns a stub board (3 columns). The UI never breaks.

Tokens
- HEADER_HEIGHT_REM=3.5, CHAT_FIXED_PX=384, SPACE_SM=12, SPACE_MD=16, RADIUS_MD=8
- Colors: LAYOUT_BG=#f9fafb, SURFACE=#fff, SURFACE_SUBTLE=#f3f4f6, BORDER=#e5e7eb, TEXT_MUTED=#6b7280

Behaviors
- Auto‑sync: 3000ms visible, 15000ms hidden (visibilitychange aware)
- Chat enter‑to‑send; disabled during request; on success dispatches `board-refresh`
- Deploy bubble: 22px, semi‑transparent, bottom‑right of board; increments on every build; refetches every 30s and on visibilitychange

## Production Access
- **Main Application**: http://52.4.68.118/workspace
- **Health Status**: All systems operational ✅
- **Deploy Version**: 21
- **Uptime**: Stable with automated monitoring

## Quick Start (Development)

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- OpenAI API key (GPT-5-mini)

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Start Kanboard container
docker run -d --name wordflux-kanboard \
  -p 127.0.0.1:8090:80 \
  kanboard/kanboard:latest
> If using a remote Kanboard, configure `.env.local` to point to it (see `.env.example`).

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your OpenAI API key

# 4. Run development server
npm run dev
```

### Production Deployment
```bash
# Build for production
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

Host-built runner (Docker, no npm in Docker)
- Ensure `output: 'standalone'` in `next.config.js`.
- Run `npm run build` on the host to produce `.next/standalone` and `.next/static`.
- Keep `.next` included in Docker build context; exclude `node_modules`.
- The Dockerfile copies `.next/standalone`, `.next/static`, and `public` into the image; no registry/network access is needed during Docker build.

## Environment Variables
```env
# OpenAI
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5-mini

# Kanboard (JSON-RPC)
KANBOARD_URL=http://localhost:8090/jsonrpc.php
KANBOARD_USERNAME=jsonrpc
KANBOARD_PASSWORD=your_token_here
KANBOARD_PROJECT_ID=1
KANBOARD_SWIMLANE_ID=1

> Validate connectivity from the server:
> ```bash
> curl -s -X POST $KANBOARD_URL \
>   -H 'Content-Type: application/json' \
>   -u "$KANBOARD_USERNAME:$KANBOARD_PASSWORD" \
>   -d '{"jsonrpc":"2.0","method":"getVersion","id":1}'
> ```

## Nginx headers & caching

- `/_next/static` served with `Cache-Control: public, max-age=31536000, immutable`
- API dynamic routes use `no-cache, no-store, must-revalidate`
- gzip enabled; simple rate‑limits on `/api/chat` and `/api/board/*`

## Backup & Health

- Cron installs:
  - Daily backup 02:00 → `/home/ubuntu/backups`
  - Health monitor every 5 min → `/home/ubuntu/logs/health.log`
- Health monitor supports optional `HEALTH_WEBHOOK_URL` to push alerts.
```

## API Endpoints
- `GET /api/health` — Health check
- `GET /api/board/state` — Normalized board state for the UI
- `POST /api/board/move` — Persist task move `{ taskId, toColumnId, position }`
- `POST /api/board/create` — Create task `{ title, columnId?, description? }`
- `POST /api/chat` — Chat with AI agent

## Chat Commands
- Create: "Create a new task called [title] in [column]"
- Move: "Move #[id] to [column]"
- Update: "Update #[id] description to [text]"
- Delete: "Delete #[id]"
- List: "List all tasks" or "Show tasks in Ready status active"
- Search: "Search auth in Ready done" or "Search for [keyword]"

Notes
- Status filter maps to Kanboard `is_active` (active=1, done=0)
- Assignee filter supports plain usernames; `me` is reserved (identity mapping TBD)

## Agent Intents (Schemas + Examples)

The agent returns a JSON object with a `reply` and an array of `actions`. Supported actions:

Shapes
```jsonc
// create
{ "type": "create_card", "title": "string", "column": "string", "description": "optional" }

// move
{ "type": "move_card", "identifier": "#ID or title", "toColumn": "string" }

// update
{ "type": "update_card", "identifier": "#ID or title", "updates": { "title?": "string", "description?": "string" } }

// delete
{ "type": "delete_card", "identifier": "#ID or title" }

// list (with filters)
{ "type": "list_cards", "column?": "string", "query?": "string", "status?": "all|active|done", "assignee?": "string|me" }

// search (with filters)
{ "type": "search_cards", "query": "string", "column?": "string", "status?": "all|active|done", "assignee?": "string|me" }

// bulk move
{ "type": "bulk_move", "identifiers": ["#1", "#2"], "toColumn": "string" }

// add comment
{ "type": "add_comment", "identifier": "#ID or title", "comment": "string" }
```

Examples
```jsonc
// List active tasks in Ready containing "auth"
{
  "reply": "You have 2 active tasks in Ready containing 'auth'.",
  "actions": [
    { "type": "list_cards", "column": "Ready", "query": "auth", "status": "active", "assignee": "me" }
  ],
  "needsClarification": false
}

// Move a card
{
  "reply": "Moved 'Fix login bug' to Done.",
  "actions": [ { "type": "move_card", "identifier": "#5", "toColumn": "Done" } ]
}
```

## Project Structure
```
wordflux-v3/
├── app/
│   ├── api/          # API routes
│   ├── components/   # React components
│   └── page.tsx      # Main page
├── lib/
│   ├── kanboard-client.ts  # Kanboard API client
│   └── agent-controller.ts # GPT-5 agent logic
├── docker/
│   └── docker-compose.yml  # Kanboard + PostgreSQL
└── ecosystem.config.js     # PM2 configuration
```

## Docs
- Agent Intents: docs/agent-intents.md
- Board API: docs/board-api.md
- Deployment: DEPLOYMENT_PRODUCTION.md

## Monitoring
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs wordflux-v3

# Monitor resources
pm2 monit
```

## Testing
```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test chat API
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "List all tasks"}'

# Test board state
curl -s http://localhost:3000/api/board/state | jq '{columns:(.state.columns|length)}'

# Move task 12 to Done (example)
curl -s -X POST http://localhost:3000/api/board/move \
  -H 'Content-Type: application/json' \
  -d '{"taskId":12, "toColumnId":4, "position":1}'
```

## License
MIT

## Support
For issues and questions, check the logs:
- PM2 logs: `pm2 logs wordflux-v3`
- Docker logs: `sudo docker logs wordflux-kanboard`

---
Built with ❤️ using Kanboard, Next.js, and GPT-5
