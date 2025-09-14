# Repository Guidelines

Version: v1-beta

This repository hosts WordFlux v1‑beta (Next.js + Kanboard + GPT‑5 agent). Use this guide for day‑to‑day development, reviews, and agent contributions.

## Project Structure & Module Organization
- `wordflux-v3/app` — Next.js App Router; API routes in `app/api/.../route.ts`.
- `wordflux-v3/app/components` — UI components; shared Kanban in `app/components/kanban/*`.
- `wordflux-v3/lib` — Server/agent libs (Kanboard client, agent controller, interpreter, board state).
- `wordflux-v3/docs` — Docs index, agent intents, board API, environment, QA checklist.
- `wordflux-v3/docker` — Docker for Kanboard + Postgres.
- `wordflux-v3/logs` — PM2 logs.

## Build, Test, and Development Commands
- Install: `cd wordflux-v3 && npm install`.
- Dev: `npm run dev` (Next.js on 3000/3001).
- Build + PM2: `npm run build && pm2 start ecosystem.config.js`.
- Kanboard services: `cd wordflux-v3/docker && docker compose up -d`.
- Public URL: `cloudflared tunnel --url http://localhost:3001`.
- Health probes:
  - `curl -s http://localhost:3001/api/board/state | jq`.
  - `curl -s -X POST http://localhost:3001/api/chat -H 'Content-Type: application/json' -d '{"message":"list all tasks"}' | jq`.
- E2E (optional): `npm run test:e2e`.

## Coding Style & Naming Conventions
- TypeScript + ES Modules; 2 spaces; semicolons.
- Tailwind utility classes colocated in components.
- API routes export `GET`/`POST`; all writes validate inputs (zod) and return `{ ok, ... }` with `code` and `message` on errors.
- DnD ids: tasks `t-<id>`, columns `column-<id>`.
- Use shared Kanban components in both the right‑pane board and `/board`.

## Testing Guidelines
- Prefer quick manual probes (see commands above); run `npm run test:e2e` for end‑to‑end checks when applicable.
- Keep tests deterministic and stateless; avoid direct browser calls to Kanboard.
- No explicit coverage threshold; add focused tests alongside features where sensible.

## Commit & Pull Request Guidelines
- Conventional Commits (`feat:`, `fix:`, `chore:`). Keep scope tight.
- PRs include: description, linked task/issue, screenshots/GIFs, and a short test plan (endpoints used).
- Call out env/infra changes and update `.env.example` when adding variables.

## Security & Configuration Tips
- Do not commit secrets. Create `.env.local` from `.env.example` and set `OPENAI_*` and `KANBOARD_*` values.
- Kanboard uses Basic auth; the browser must never call Kanboard directly—always go through Next.js routes.
- If the right pane is blank: check `/api/board/state` and ensure no browser requests hit `localhost:8080`.
