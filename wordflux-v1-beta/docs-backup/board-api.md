# Board API (WordFlux v3)

This document describes the board-related endpoints used by the browser UI.

## GET /api/board/state

Returns a normalized view of the Kanboard project for the browser. Responses are marked no‑cache and use dynamic rendering.

Response
```jsonc
{
  "ok": true,
  "state": {
    "columns": [
      {
        "id": 1,
        "name": "Backlog",
        "cards": [
          { "id": 12, "title": "Implement X", "description": "...", "assignees": ["alice"], "is_active": 1 }
        ]
      }
    ]
  }
}
```

Notes
- `is_active`: 1 = active, 0 = done (Kanboard field)
- The server builds state via Kanboard `getBoard` or falls back to `getColumns` + `getAllTasks`.

## POST /api/board/move

Persists task moves (within/between columns).

Request
```json
{ "taskId": 12, "toColumnId": 4, "position": 1 }
```

Response
```json
{ "ok": true }
```

Errors
```json
{ "ok": false, "error": "INVALID_PARAMS" }
{ "ok": false, "error": "MOVE_FAILED", "message": "..." }
```

Implementation
- Calls Kanboard `moveTaskPosition` with `project_id`, `task_id`, `column_id`, `position`, `swimlane_id`.
- Environment variables required: `KANBOARD_URL`, `KANBOARD_USERNAME`, `KANBOARD_PASSWORD`, `KANBOARD_PROJECT_ID`, `KANBOARD_SWIMLANE_ID`.

## POST /api/board/create

Creates a new task.

Request
```json
{ "title": "My task", "columnId": 1, "description": "optional" }
```

Response
```json
{ "ok": true, "taskId": 123 }
```

Errors
```json
{ "ok": false, "error": "TITLE_REQUIRED" }
{ "ok": false, "error": "CREATE_FAILED", "message": "..." }
```

## Caching
- `/api/board/state` sets `Cache-Control: no-cache, no-store, must-revalidate` and `revalidate = 0` to always fetch the latest state.

## Future
- Server-side filtering on `/api/board/state` (query, column, status, assignee) can be added if client-side filtering becomes insufficient on large boards.

## Bulk Endpoints

### POST /api/board/bulk/move
```json
{ "taskIds": [1,2,3], "toColumnId": 4 }
// or { "taskIds": [1,2], "toColumnName": "Ready" }
```

### POST /api/board/bulk/update
```json
{ "taskIds": [1,2], "updates": { "owner_id": 2, "date_due": 1733635200 } }
```

### POST /api/board/bulk/delete
```json
{ "taskIds": [1,2,3] }
```

### POST /api/board/bulk/duplicate
```json
{ "taskIds": [1,2] }
```
