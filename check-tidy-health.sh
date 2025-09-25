#!/bin/bash

set -e

echo "=== TIDY HEALTH CHECK ==="

echo "1. Backups:"
if [ -d /home/ubuntu/wordflux-v1-beta/data/tidy-backups ]; then
  ls -lh /home/ubuntu/wordflux-v1-beta/data/tidy-backups/ | tail -5
else
  echo "(nenhum backup ainda)"
fi

echo
echo "2. Recent tidy logs:"
if ls ~/wordflux-v1-beta/logs/out-*.log > /dev/null 2>&1; then
  grep "TIDY_AUDIT" ~/wordflux-v1-beta/logs/out-*.log | tail -10 || echo "(nenhum log TIDY_AUDIT)"
else
  echo "logs não encontrados"
fi

echo
echo "3. SSE status:"
timeout 2 curl -s -N http://52.4.68.118/api/chat/stream \
  -X POST -H 'Content-Type: application/json' \
  -d '{"message":"test"}' | head -1
