#!/bin/bash
set -euo pipefail

cd /home/ubuntu/wordflux-v1-beta

# Ensure correct Node & deps
if ! command -v node >/dev/null; then echo "Node missing" >&2; exit 1; fi
npm ci

# Fresh build
rm -rf .next/cache || true
npm run build

# PM2 (single instance; fork mode)
pm2 stop wf-v1-beta || true
pm2 delete wf-v1-beta || true
PORT=3000 NODE_ENV=production pm2 start npm --name wf-v1-beta -- start
pm2 save

# Health + asset checks (local)
curl -fsS http://localhost:3000/api/health >/dev/null
curl -fsS "http://localhost:3000/_next/static/chunks/*.js" | grep -q "Clarity in motion"

# Health + asset checks (public)
curl -fsS http://52.4.68.118/api/health >/dev/null
curl -fsS "http://52.4.68.118/_next/static/chunks/*.js" | grep -q "Clarity in motion"

echo "OK"