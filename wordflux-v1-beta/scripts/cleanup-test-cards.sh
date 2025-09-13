#!/bin/bash

# Cleanup test cards from Kanboard
KANBOARD_URL="http://localhost:8090/jsonrpc.php"
KANBOARD_USER="jsonrpc"
KANBOARD_PASS="wordflux-api-token-2025"
PROJECT_ID=1

echo "🧹 Starting test card cleanup..."

# Get all tasks and filter test ones
TEST_TASK_IDS=$(curl -s -X POST "$KANBOARD_URL" \
  -u "$KANBOARD_USER:$KANBOARD_PASS" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"getAllTasks\",\"id\":1,\"params\":{\"project_id\":$PROJECT_ID}}" \
  | jq -r '.result[] | select(.title | test("Test|Tag Test|Consistency Test|Priority|Assign|Comment|Undo Flow|Test (backlog|ready|in progress|wip|doing|done|complete)")) | .id')

TOTAL=$(echo "$TEST_TASK_IDS" | wc -l)
echo "Found $TOTAL test tasks to delete"

DELETED=0
for TASK_ID in $TEST_TASK_IDS; do
  if [ -n "$TASK_ID" ]; then
    curl -s -X POST "$KANBOARD_URL" \
      -u "$KANBOARD_USER:$KANBOARD_PASS" \
      -H "Content-Type: application/json" \
      -d "{\"jsonrpc\":\"2.0\",\"method\":\"removeTask\",\"id\":1,\"params\":{\"task_id\":$TASK_ID}}" \
      > /dev/null
    
    if [ $? -eq 0 ]; then
      DELETED=$((DELETED + 1))
      echo -n "."
    else
      echo -n "x"
    fi
  fi
done

echo ""
echo "✅ Deleted $DELETED test tasks"

# Show remaining task count
REMAINING=$(curl -s -X POST "$KANBOARD_URL" \
  -u "$KANBOARD_USER:$KANBOARD_PASS" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"getAllTasks\",\"id\":1,\"params\":{\"project_id\":$PROJECT_ID}}" \
  | jq '.result | length')

echo "📊 Remaining tasks: $REMAINING"