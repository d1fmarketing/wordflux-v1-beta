# QA Checklist (WordFlux v3)

## Preflight
- [ ] `.env.local` configured (OpenAI + TaskCafe JSON-RPC + project/swimlane)
- [ ] Docker containers healthy (TaskCafe, postgres)
- [ ] Build done (`npm run build`) and running via PM2
- [ ] Cloudflare Tunnel active and public URL reachable

## Health & Board
- [ ] `GET /api/health` returns 200
- [ ] `GET /api/board/state` returns columns > 0
- [ ] Backlog has visible cards

## Chat Flows
- [ ] Create: “create a task called QA test” → success + appears immediately in board
- [ ] List: “list all tasks” → grouped summary + action payload
- [ ] Filtered: “show tasks in Ready status active” → only active in Ready
- [ ] Search: “search auth in Ready done” → filtered matches
- [ ] Move: “move #<id> to Done” → success + board reflects change

## Board UI
- [ ] Filters: search, column, status affect visible tasks
- [ ] Drag & drop within a column reorders tasks (optimistic and persisted)
- [ ] Drag & drop between columns moves tasks (optimistic and persisted)

## APIs (manual)
```bash
# State
curl -s $BASE/api/board/state | jq '{ok,columns:(.state.columns|length)}'
# Move (example)
curl -s -X POST $BASE/api/board/move -H 'Content-Type: application/json' \
  -d '{"taskId":12, "toColumnId":4, "position":1}' | jq
```

## Logs
- [ ] `pm2 logs wordflux-v3` shows agent init and board state polling
- [ ] No recurring errors (“Invalid params”, “No response from AI”)

## Cloudflare URL
- [ ] `/` loads chat + board
- [ ] `/api/health/detailed` returns status (OpenAI, TaskCafe, Redis if present)
- [ ] `/api/board/state` accessible and fresh (no-cache)

## Regression Watchouts
- TaskCafe URL must be JSON-RPC endpoint (`.../jsonrpc.php`)
- `moveTaskPosition` requires `project_id` and `swimlane_id`
- Browser should never call `localhost:8080` directly (use server routes)

