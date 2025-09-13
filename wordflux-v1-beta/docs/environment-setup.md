# Environment Setup (WordFlux v3)

## Requirements
- Node.js 20.x and npm 10.x
- Docker + Docker Compose
- OpenAI API key
- Cloud access for tunneling (Cloudflare Tunnel recommended)

## Steps

1) Install dependencies
```bash
cd wordflux-v3
npm install
```

2) Configure environment
```bash
cp .env.example .env.local
# Edit .env.local
# - OPENAI_API_KEY=...
# - KANBOARD_URL=http://localhost:8080/jsonrpc.php
# - KANBOARD_USERNAME=admin
# - KANBOARD_PASSWORD=admin
# - KANBOARD_PROJECT_ID=1
# - KANBOARD_SWIMLANE_ID=1
```

3) Start Kanboard (Docker)
```bash
cd docker
sudo docker compose up -d
sudo docker ps   # verify kanboard + postgres are up
```

4) Dev or Prod
```bash
# Dev
npm run dev   # Next.js on 3000 (or 3001 if busy)

# Prod
npm run build
pm2 start ecosystem.config.js
```

5) Public URL (Cloudflare Tunnel)
```bash
cloudflared tunnel --url http://localhost:3001
# Copy the https://<name>.trycloudflare.com URL
```

## Verify
```bash
# Health
curl -s http://localhost:3001/api/health | jq

# Board state
curl -s http://localhost:3001/api/board/state | jq '.state.columns | length'

# Chat: create
curl -s -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"create a task called Setup env"}' | jq
```

## Tips & Troubleshooting
- GPT‑5 temperature: model enforces default (1). Don’t override.
- Move task RPC requires `project_id` and `swimlane_id`. Missing either → "Invalid params".
- Browser cannot call `localhost:8080`; always fetch Kanboard through server routes (e.g., `/api/board/state`).
- If PM2 app binds to 3001, use that for tunnels and curls.
- White/blank iframe: Kanboard sets `X-Frame-Options`. Use our native board UI instead of iframes.

