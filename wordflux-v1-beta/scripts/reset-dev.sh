#!/usr/bin/env bash
set -euo pipefail

sudo fuser -k 3000/tcp 8787/tcp 2>/dev/null || true
pm2 delete mcp 2>/dev/null || true
pm2 delete mcp-proxy 2>/dev/null || true

echo "✅ Ports 3000/8787 clear; MCP pm2 process removed."
