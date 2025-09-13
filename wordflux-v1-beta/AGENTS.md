# Repository Guidelines (v3)

This repository contains WordFlux v3 (Next.js + Kanboard + GPT‑5 agent). These guidelines reflect the current v3 structure and conventions. See `wordflux-v3/docs/README.md` for the docs index.

## Structure
- `wordflux-v3/app` — Next.js App Router (pages, components, API routes under `app/api/.../route.ts`).
- `wordflux-v3/app/components` — UI components. Shared kanban UI in `app/components/kanban/*`.
- `wordflux-v3/lib` — Server/agent libs (Kanboard client, agent controller, interpreter, board state).
- `wordflux-v3/docs` — Documentation index and pages (agent intents, board API, environment, QA checklist).
- `wordflux-v3/docker` — Docker files for Kanboard + Postgres.
- `wordflux-v3/logs` — PM2 logs.

## Environment
Copy `.env.example` to `.env.local` and fill:
```
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
KANBOARD_URL=http://localhost:8080/jsonrpc.php
KANBOARD_USERNAME=admin
KANBOARD_PASSWORD=admin
KANBOARD_PROJECT_ID=1
KANBOARD_SWIMLANE_ID=1
# Optional mapping for "assignee: me"
AGENT_ASSIGNEE_USERNAME=
```

## Development & Build
```
cd wordflux-v3
npm install

# Dev (Next.js on 3000 or 3001)
npm run dev

# Build + PM2 (prod)
npm run build
pm2 start ecosystem.config.js
```

Kanboard services:
```
cd wordflux-v3/docker
docker compose up -d
```

Expose public URL via Cloudflare Tunnel:
```
cloudflared tunnel --url http://localhost:3001
```

## API Surfaces (browser → server)
The browser must never call Kanboard directly. Use Next.js routes:
- `GET /api/board/state` — normalized board state (no-cache)
- `POST /api/board/create` — create task
- `POST /api/board/move` — move/reorder task
- `POST /api/board/bulk/*` — bulk move/update/delete/duplicate
- `POST /api/chat` — GPT‑5 agent

All write routes validate inputs (zod) and return `{ ok, ... }` with `code` and `message` on errors.

## UI Conventions
- Shared Kanban components in `app/components/kanban/*` are used by both the right‑pane board and `/board` for consistent UX.
- DnD ids follow `t-<id>` for tasks and `column-<id>` for columns.
- `/board` supports selection mode for bulk operations (checkbox overlays; Select all/Clear per column).

## Coding Style
- TypeScript + ES Modules. Indentation: 2 spaces; semicolons.
- Tailwind CSS with utility-first classes colocated in components.
- API routes: `app/api/.../route.ts` export HTTP methods (`GET`, `POST`).

## Testing (manual probes)
```
# Health
curl -s http://localhost:3001/api/health | jq

# Board state
curl -s http://localhost:3001/api/board/state | jq '{columns:(.state.columns|length)}'

# Chat create
curl -s -X POST http://localhost:3001/api/chat -H 'Content-Type: application/json' \
  -d '{"message":"create a task called quick test"}' | jq
```
E2E (optional): `npm run test:e2e`.

## Commits & PRs
- Conventional Commits preferred (`feat:`, `fix:`, `chore:`). Keep scope tight.
- PRs include: description, linked task, screenshots/GIFs, short test plan (endpoints used).
- Call out env/infra changes.

## Security & Secrets
- Do not commit secrets. Use `.env.example` to document new env vars.
- v3 uses Basic auth for Kanboard.

## Runbook (Ops)
1) Build & start app:
```
cd wordflux-v3 && npm run build && pm2 start ecosystem.config.js
```
2) Start Kanboard:
```
cd wordflux-v3/docker && docker compose up -d
```
3) Public URL:
```
cloudflared tunnel --url http://localhost:3001
```
4) Smoke tests:
```
curl -s $BASE/api/board/state | jq '{ok, columns:(.state.columns|length)}'
curl -s -X POST $BASE/api/chat -H 'Content-Type: application/json' -d '{"message":"list all tasks"}' | jq
```
5) Logs:
```
pm2 logs wordflux-v3 --lines 100
```

If the right pane is blank: Check `/api/board/state` and verify no browser calls to `localhost:8080` exist.

## Delivery Rhythm (macro → micro)
- Start macro (shared components, routes, docs), then go micro (UX polish, typed helpers).
- Ship one small improvement per timebox with a quick manual test.
