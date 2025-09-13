# Contributing to WordFlux v3

## Branching & Commits
- Create a feature branch from main: `git checkout -b feat/<short-scope>`
- Use Conventional Commits where possible (e.g., `feat:`, `fix:`, `chore:`). Keep messages imperatively phrased and scoped.

## Run Locally
```
cd wordflux-v3
npm install
npm run dev
```
Kanboard services:
```
cd wordflux-v3/docker
docker compose up -d
```

## Manual Smoke Test
- Health: `curl -s http://localhost:3001/api/health | jq`
- Board state: `curl -s http://localhost:3001/api/board/state | jq '{columns:(.state.columns|length)}'`
- Chat create: `curl -s -X POST http://localhost:3001/api/chat -H 'Content-Type: application/json' -d '{"message":"create a task called quick test"}' | jq`
- DnD: drag a card within/between columns and verify it persists.

Or run the script:
```
./scripts/smoke.sh http://localhost:3001
```

## PR Checklist
- Clear description, linked task/issue
- Screenshots or GIF for UI changes
- Short test plan (URLs and expected JSON fields)
- Call out any env/infra changes

## Macro → Micro Rhythm
- Start with macro cohesiveness (shared components, server APIs, docs).
- Deliver one small, focused improvement per timebox with a quick probe.

