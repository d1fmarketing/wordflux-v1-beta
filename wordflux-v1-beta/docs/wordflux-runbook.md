# WordFlux – EC2 Operations Runbook

> Source of truth: the running EC2 instance (`wordflux`). Do not trust the old Git repo; this directory is canonical.

## 0) Fast paths

- Health check (local):
  curl -fsS http://127.0.0.1:${PORT:-3000}/api/board/state | head -c 600

- Logs:
  - PM2: pm2 ls · pm2 logs · pm2 logs <name>
  - systemd: journalctl -u <service> -e -f
- Restart:
  - PM2: pm2 reload <name> (zero‑downtime) or pm2 restart <name>
  - systemd: sudo systemctl restart <service>
  - Docker: docker compose restart <svc>

## 1) What’s running

Likely Node/Next.js app with App Router under `app/api/*`. Providers live in `lib/providers/*` (e.g., Kanboard, Taskcafe).

Enumerate:

ps -eo pid,ppid,user,pcpu,pmem,comm,args --sort=-pcpu | grep -E 'node|pm2|docker|nginx|next' || true
ss -ltnup | head -n 200
pm2 ls || true
systemctl list-units --type=service --state=running | grep -Ei 'node|pm2|nginx|wordflux|board' || true
docker ps || true

## 2) File layout (canonical)

- CODE_DIR: `/home/ubuntu/wordflux-v1-beta` (deployed directory)
- app/api/board/state/route.ts – returns current board state (columns + cards)
- app/api/board/move/route.ts – moves a card between columns (optionally to index/position)
- app/api/board/create/route.ts – creates a new card in a column
- lib/board-provider.ts – abstraction that chooses a backend provider
- lib/providers/kanboard-client.ts, lib/providers/taskcafe-client.ts – provider implementations

Note: exact schemas may differ by provider; confirm via the health check and code.

## 3) Configuration (env)

Create `.env.local` in CODE_DIR (server‑only). Example keys (values redacted here):

BOARD_BACKEND=taskcafe
KANBOARD_URL=<redacted>
KANBOARD_USERNAME=<redacted>
TASKCAFE_URL=<redacted>
PORT=3001

Reload after changes (see Restart above).

## 4) API contract (high‑level)

GET /api/board/state
- Response: JSON with board snapshot.
- Typical fields: columns[] (id, title, order), cards[] (id, columnId, title, order/position).

POST /api/board/move
- Body: { taskId, toColumnId, position }
- Effect: Moves a card to target column and position.

POST /api/board/create
- Body: { columnId, title }
- Effect: Creates a new card in the target column.

Validate against the running app if you change providers.

## 5) Deploy / rollback (on the server)

- Backup current:
  tar -C "$(dirname "$CODE_DIR")" -czf "wordflux-backup-$(date +%Y%m%d-%H%M%S).tgz" "$(basename "$CODE_DIR")"

- Update code safely:
  - If managed by git here, use git status (read‑only), then pm2 reload after changes.
  - If not git‑managed, use rsync into a new directory, switch symlink, then reload (minimizes downtime).

## 6) Troubleshooting

- Port not responding: check `ss -ltnp` for Node listener; verify nginx upstreams if used.
- Move/create failing: inspect provider client logs (`lib/providers/*`); verify upstream URLs and tokens.
- Memory/CPU spikes: `pm2 monit` or `top`; consider `pm2 reload` to clear leaks.


## MCP Endpoint

```
POST /api/mcp
{ "method": string, "params": object }
```

| Method        | Params (JSON)                                     | Notes                                   |
|---------------|---------------------------------------------------|-----------------------------------------|
| list_cards    | {}                                                | returns { columns }                     |
| create_card   | { title, columnId?, description? }                | columnId optional (provider default)    |
| move_card     | { taskId, toColumnId, position? }                 | uses ladder positioning                 |
| update_card   | { taskId, title?, description?, points? }         | maps to provider.updateTask             |
| remove_card   | { taskId }                                        | delete card                             |
| set_due       | { taskId, when }                                  | Kanboard only (natural language aware)  |
| assign_card   | { taskId, assignee }                              | Kanboard only (username)                |
| add_label     | { taskId, label }                                 | Kanboard only                           |
| remove_label  | { taskId, label }                                 | Kanboard only                           |
| add_comment   | { taskId, content }                               | Kanboard only                           |
| bulk_move     | { tasks: [{ taskId, position? }], toColumnId }    | multi-move                              |
| set_points    | { taskId, points }                                | Kanboard only                           |
| undo_create   | { taskId }                                        | calls remove_card                       |
| undo_move     | { taskId, columnId, position? }                   | move back                               |
| undo_update   | { taskId, patch }                                 | restore fields                          |

Set `MCP_INTERNAL_URL` to override the base URL; otherwise falls back to NEXTAUTH_URL or `http://127.0.0.1:${PORT}`.

## Fonts
- Primary (titles): Wondra (fallback to 'Inter Tight', system UI).
- Body: Belkin (fallback to 'Inter', system UI).
- Upload licensed fonts to `app/styles/fonts/` and adjust `brand.css` if needed.
