#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
: "${MCP_TOKEN:?MCP_TOKEN not set}"
mkdir -p ops/snapshots

jqm() { jq "$@" <<<"$RESP"; }

# Capture a named filter snapshot
capture() {
  local name="$1" body="$2"
  RESP=$(curl -s -X POST "$BASE/api/mcp" \
    -H "Authorization: Bearer $MCP_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":\"snap-$name\",\"method\":\"filter_cards\",\"params\":$body}")
  jqm '[.result.columns[].cards[] | select(.matched == true) | {id,title,priority,points:(.derived.points),openParts:(.derived.openParts),slaOver:(.derived.slaOver),idleOver:(.derived.idleOver)}]' \
    > "ops/snapshots/${name}.json"
  echo "snapshot -> ops/snapshots/${name}.json"
}

capture urgent-backlog   '{"where":{"priority":"urgent","columns":["Backlog"]}}'
capture my-open-parts    '{"where":{"myOpenParts":true}}'
capture sla-over         '{"where":{"slaOver":true}}'
capture points-5-8       '{"where":{"points":{"gte":5,"lte":8}}}'
