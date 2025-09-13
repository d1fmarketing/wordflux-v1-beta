# WordFlux API Docs

Base URL (dev): `http://localhost:3000`

All endpoints return JSON. Errors include `{ error: string }` with an appropriate HTTP status code (usually 500 for server errors).

## Health
- GET `/api/health`
  - Response: `{ ok: true }`
  - Usage:
    ```bash
    curl http://localhost:3000/api/health
    ```

## AI Assistant (GPT-5)
- POST `/api/ai`
  - Model: `gpt-5-mini` (configurable via OPENAI_MODEL env var)
  - Body:
    ```json
    { 
      "message": "string", 
      "board": { /* optional board override */ },
      "mode": "action" | "chat" // defaults to "action"
    }
    ```
  - Response:
    ```json
    { 
      "reply": "brief response ≤60 words",
      "actions": [{ "op": "create_card", "args": {...} }],
      "board": { /* updated board state */ },
      "version": 123,
      "rawActions": [ /* GPT-5 raw response */ ]
    }
    ```
  - Error Responses:
    ```json
    { "error": "version_conflict", "currentVersion": 10, "expectedVersion": 9 }
    { "error": "AI service error", "reply": "Failed to process request" }
    ```
  - **Conversational Fallback**: When no actions are generated (e.g., greetings), ChatPanel falls back to `/api/chat`
  - Supports card queries: `"cardQuery": "title:bug priority:high"`
  - Example:
    ```bash
    curl -s -X POST \
      -H 'Content-Type: application/json' \
      -d '{"message":"Add a task for user testing"}' \
      http://localhost:3000/api/ai | jq .
    ```

## Chat (Alternative GPT-5 Endpoint)
- POST `/api/chat`
  - Body:
    ```json
    { "message": "string", "board": { /* optional board override */ } }
    ```
  - Response:
    ```json
    { "response": "assistant text",
      "suggestions": [{ "type": "move" | "merge" | "wip", "text": "string" }],
      "model": "gpt-5-mini" }
    ```
  - Example:
    ```bash
    curl -s -X POST \
      -H 'Content-Type: application/json' \
      -d '{"message":"What should we prioritize next?"}' \
      http://localhost:3000/api/chat | jq .
    ```

## Board: Get
- GET `/api/board/get`
  - Response: `{ board: Board }`
  - Behavior: when `BOARD_ADAPTER=planka`, resolves via AdapterPlanka using `PLANKA_BOARD_ID`.
  - Example:
    ```bash
    curl http://localhost:3000/api/board/get | jq .
    ```

## Board: Seed
- POST `/api/board/seed`
  - Creates the default sample board in DynamoDB or in memory (fallback).
  - Response: `{ ok: true }` or `{ board }` depending on implementation.
  - Example:
    ```bash
    curl -X POST http://localhost:3000/api/board/seed
    ```

## Board: Move Card (simple)
- POST `/api/board/move-card`
  - Body:
    ```json
    { 
      "fromColumnId": "Backlog", 
      "toColumnId": "Doing", 
      "cardId": "backlog-1", 
      "position": 0,
      "ifVersion": 10  // optional: prevent conflicts
    }
    ```
  - Response: `{ ok: true, board: Board }`
  - Error Responses:
    ```json
    { "error": "Version conflict", "details": { "currentVersion": 11 } }  // 409
    { "error": "Missing required fields: toColumnId, cardId" }  // 400
    ```
  - **Error Handling**: Wrapped with `withErrorHandling` for consistent error envelopes
  - Example:
    ```bash
    curl -s -X POST \
      -H 'Content-Type: application/json' \
      -d '{"fromColumnId":"Backlog","toColumnId":"Doing","cardId":"backlog-1"}' \
      http://localhost:3000/api/board/move-card | jq .
    ```

## Board: Apply (generalized mutations)
- POST `/api/board/apply`
  - Body:
    ```json
    {
      "op": "operation_name",
      "args": { /* operation-specific arguments */ },
      "ifVersion": 10,      // optional: prevent conflicts
      "requestId": "uuid"   // optional: idempotency key
    }
    ```
  - Operations:
    - `set_wip_limit`: `{ columnId, limit }`
    - `move_card`: `{ fromColumnId, toColumnId, cardId, position? }`
    - `create_card`: `{ columnId, title, description?, owner?, priority? }`
    - `create_column`: `{ name }`
    - `add_card`: `{ columnId, title, desc?, owner?, priority?, id? }` (legacy)
    - `update_card`: `{ columnId, cardId, title?, desc?, owner?, priority? }`
    - `delete_card`: `{ columnId, cardId }`
    - `duplicate_card`: `{ columnId, cardId }`
    - `add_column`: `{ id?, name }`
    - `rename_column`: `{ columnId, newName }`
    - `delete_column`: `{ columnId }`
    - `move_column`: `{ fromIndex, toIndex }`
    - `bulk_move`: `{ operations: [...] }` // multiple operations
    - `bulk_delete`: `{ cardIds: [...] }` // delete multiple cards
  - Response: `{ ok: true, board: Board, version: 123 }`
  - Behavior:
    - When `BOARD_ADAPTER=planka`, supported operations are routed through AdapterPlanka and the returned `board` is a normalized snapshot via the adapter.
    - Unsupported operations in Planka mode return 400 with `Operation not supported in Planka mode`.
  - Error Responses:
    ```json
    { "error": "Version conflict", "details": { "currentVersion": 11 } }  // 409
    { "error": "Invalid operation: unknown_op" }  // 400
    { "error": "Column not found", "details": { "columnId": "Invalid" } }  // 404
    ```
  - **Concurrency Control**: Use `ifVersion` to prevent lost updates, `requestId` for idempotency
  - Example (set WIP limit with version check):
    ```bash
    curl -s -X POST \
      -H 'Content-Type: application/json' \
      -d '{"op":"set_wip_limit","args":{"columnId":"Doing","limit":3},"ifVersion":10}' \
      http://localhost:3000/api/board/apply | jq .
    ```

## Env Status
- GET `/api/env`
  - Returns whether AWS/DynamoDB is configured and whether the in‑memory fallback is active.
  - Example:
    ```bash
    curl http://localhost:3000/api/env | jq .
    ```

## Planka Verify
- GET `/api/admin/planka/verify?boardId=<id>&write=0|1`
  - Verifies the configured Planka mapping (board, lists, cards). When `write=1`, attempts to create+delete a temp card.
  - Response: `{ ok: boolean, steps: [{ label, ok, status?, count? }] }`
  - Uses env overrides from `PLANKA_ENDPOINT_*` and `PLANKA_FIELD_*`.

## Adapter Status
- GET `/api/admin/adapter/status`
  - Reports which adapter is active and basic Planka env presence.
  - Response: `{ ok: true, status: { adapter: 'internal'|'planka', planka: { baseUrl, token, boardId, strict, fallbackInternal } } }`

## Views Management
- POST `/api/views/save`
  - Save a filter view configuration
  - Body:
    ```json
    { "name": "string",
      "filters": { "q": "string", "priority": ["h","m"], "owner": ["rj"] } }
    ```
  - Response: `{ ok: true, saved: {...} }`
  - Example:
    ```bash
    curl -s -X POST \
      -H 'Content-Type: application/json' \
      -d '{"name":"High Priority","filters":{"priority":["h"]}}' \
      http://localhost:3000/api/views/save | jq .
    ```

- GET `/api/views/get`
  - Retrieve saved filter views
  - Response: `{ views: [...] }`
  - Example:
    ```bash
    curl http://localhost:3000/api/views/get | jq .
    ```

## Billing
- POST `/api/billing/checkout`
  - Initialize Stripe checkout for Pro upgrade
  - Body: `{ "email": "user@example.com" }`
  - Response: `{ "url": "stripe_checkout_url" }`
  - Currently returns stub response

## Types (shape overview)
```ts
type Card = {
  id: string;
  title: string;
  desc?: string;
  owner?: string;
  priority?: 'l' | 'm' | 'h';
};

type Column = {
  id: string;   // slug identifier
  name: string; // display name
  cards: Card[];
};

type Board = {
  id: string;
  wipLimits?: Record<string, number>;
  columns: Column[];
};

type FilterView = {
  name: string;
  filters: {
    q: string;
    priority: string[];
    owner: string[];
  };
};
```
## Agent (Interpret + Apply)
- POST `/api/agent/interpret`
  - Interprets natural language into actions and applies them via the configured Adapter.
  - Accepts direct actions to bypass LLM (for clarifications/testing).
  - Body options:
    ```json
    { 
      "message": "move the login card to Done",
      "boardId": "board_default",
      "requestId": "uuid",
      "actions": [
        { "intent": "move_card", "id": "card_abc123", "toColumn": "Done" },
        { "intent": "delete_card", "id": "card_abc123" },
        { "intent": "set_wip_limit", "column": "Doing", "limit": 3 }
      ]
    }
    ```
  - Response:
    ```json
    {
      "reply": "✅ Done",
      "actionsApplied": ["move_card"],
      "needClarification": false,
      "options": ["card_1", "card_2"],
      "clarify": { "intent": "move_card", "original": { "toColumn": "Done" } },
      "status": "ok",
      "tookMs": 42
    }
    ```
  - Notes:
    - Returns `needClarification: true` when a query matches multiple cards; `options` include candidate IDs and `clarify.original` holds the action context so clients can resubmit with a chosen `id`.
    - Rate limited (HTTP 429) with a small token bucket per IP.
    - Supports intents: create_card, move_card, update_card, assign, comment, delete_card, complete, set_wip_limit.
