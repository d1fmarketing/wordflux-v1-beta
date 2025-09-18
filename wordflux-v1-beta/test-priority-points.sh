#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
TOKEN_ENV="${MCP_TOKEN:-}"
if [[ -z "$TOKEN_ENV" ]]; then
  echo "MCP_TOKEN is not set" >&2
  exit 1
fi

printf '=== Creating card with [8pts] ===\n'
CREATE_RESPONSE=$(curl -s -X POST "$BASE/api/mcp" \
  -H "Authorization: $TOKEN_ENV" \
  -H "x-mcp-token: $TOKEN_ENV" \
  -H 'Content-Type: application/json' \
  --data @- <<'JSON'
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "create_card",
  "params": {
    "title": "Sprint Planning Task",
    "column": "Backlog",
    "description": "[8pts] Implementar autenticação OAuth2"
  }
}
JSON
)

CARD_ID=$(printf '%s' "$CREATE_RESPONSE" | jq -er '.result.taskId')
printf 'Card created: %s\n' "$CARD_ID"

printf '=== Setting priority to high ===\n'
curl -s -X POST "$BASE/api/mcp" \
  -H "Authorization: $TOKEN_ENV" \
  -H "x-mcp-token: $TOKEN_ENV" \
  -H 'Content-Type: application/json' \
  --data @- <<JSON | jq
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "set_priority",
  "params": {
    "taskId": "$CARD_ID",
    "priority": "high"
  }
}
JSON

printf '=== Verifying derived fields ===\n'
curl -s "$BASE/api/board/state" | jq --arg id "$CARD_ID" '
  .columns[].cards[]
  | select(.id==$id)
  | {
      id,
      title,
      priority,
      points,
      tags,
      description: (.description // "")[:50]
    }
'
