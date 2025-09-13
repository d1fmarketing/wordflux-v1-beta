# Kanboard JSON‑RPC Cheat Sheet

> Use Basic auth with admin credentials or a user with appropriate permissions.

## Base
- URL: `http://localhost:8080/jsonrpc.php`
- Headers: `Content-Type: application/json`
- Auth: `-u admin:admin`
- Envelope: `{ "jsonrpc":"2.0", "method": "...", "params": { ... }, "id": 1 }`

## Common Methods

### getColumns
```bash
curl -s http://localhost:8080/jsonrpc.php \
  -u admin:admin -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getColumns","params":{"project_id":1},"id":1}' | jq
```

### getAllTasks
```bash
curl -s http://localhost:8080/jsonrpc.php \
  -u admin:admin -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getAllTasks","params":{"project_id":1},"id":1}' | jq
```

### getBoard (swimlane-aware)
- Some versions/plugins return an array of swimlanes. Use `[0].columns` for default swimlane.
```bash
curl -s http://localhost:8080/jsonrpc.php \
  -u admin:admin -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getBoard","params":{"project_id":1},"id":1}' | jq
```

### createTask
```bash
curl -s http://localhost:8080/jsonrpc.php \
  -u admin:admin -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"createTask","params":{"project_id":1,"title":"My Task","column_id":1,"description":"..."},"id":1}' | jq
```

### updateTask
```bash
curl -s http://localhost:8080/jsonrpc.php \
  -u admin:admin -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"updateTask","params":{"id":12,"title":"New Title"},"id":1}' | jq
```

### moveTaskPosition (requires project_id and swimlane_id)
```bash
curl -s http://localhost:8080/jsonrpc.php \
  -u admin:admin -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"moveTaskPosition","params":{"project_id":1,"task_id":12,"column_id":4,"position":1,"swimlane_id":1},"id":1}' | jq
```

### removeTask
```bash
curl -s http://localhost:8080/jsonrpc.php \
  -u admin:admin -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"removeTask","params":{"task_id":12},"id":1}' | jq
```

### getProjectUsers
```bash
curl -s http://localhost:8080/jsonrpc.php \
  -u admin:admin -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getProjectUsers","params":{"project_id":1},"id":1}' | jq
```

### getActiveSwimlanes
```bash
curl -s http://localhost:8080/jsonrpc.php \
  -u admin:admin -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getActiveSwimlanes","params":{"project_id":1},"id":1}' | jq
```

## Tips
- Always send `project_id` when moving tasks; include `swimlane_id`.
- Positions are 1‑based in `moveTaskPosition`.
- Prefer server-side fetching in Next routes; browsers cannot reach `localhost:8080` over tunnels.
- For large boards, prefer `getBoard` then navigate `columns` for task lists.

