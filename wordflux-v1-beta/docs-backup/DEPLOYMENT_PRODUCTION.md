# 🚀 WORDFLUX V3 - PRODUCTION DEPLOYMENT (100% WORKING)

## The ONLY Way to Deploy This Properly

### 1. BUILD FOR PRODUCTION FIRST

```bash
cd /home/ubuntu/wordflux-v3

# Build the Next.js app for production
npm run build

# This creates optimized production build in .next/
```

### 2. USE CLOUDFLARE TUNNEL (FREE & SECURE)

Cloudflare Tunnel gives you:
- Public HTTPS URL instantly
- No port forwarding needed
- DDoS protection built-in
- Zero configuration on router
- Works behind any NAT/firewall

```bash
# Install cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Run tunnel - this gives you public URL immediately
cloudflared tunnel --url http://localhost:3001
```

### 3. RUN WITH PM2 FOR STABILITY

```bash
# Install PM2 globally
npm install -g pm2

# Start WordFlux with PM2
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save

# Set PM2 to start on boot
pm2 startup
```

### 4. DOCKER CONTAINERS MUST BE RUNNING

```bash
# Ensure all containers are up
docker compose up -d

# Verify they're healthy
sudo docker ps

# Should show:
# - wordflux-postgres (port 5432)
# - wordflux-kanboard (port 8080) 
# - wordflux-redis (port 6379)
```

### 5. COMPLETE PRODUCTION CHECKLIST

- [ ] Next.js built with `npm run build`
- [ ] Running on PM2, not `npm run dev`
- [ ] All Docker containers healthy
- [ ] Environment variables in .env.local
- [ ] KANBOARD_URL points to JSON-RPC endpoint (…/jsonrpc.php)
- [ ] KANBOARD_USERNAME / KANBOARD_PASSWORD set
- [ ] KANBOARD_PROJECT_ID and KANBOARD_SWIMLANE_ID set
- [ ] Cloudflare tunnel running
- [ ] Public URL accessible

## THE FINAL COMMAND SEQUENCE

```bash
# 1. Build
cd /home/ubuntu/wordflux-v3
npm run build

# 2. Start services
docker compose up -d
pm2 start ecosystem.config.js

# 3. Get public URL
cloudflared tunnel --url http://localhost:3001

# You'll see:
# +--------------------------------------------------------------------------------------------+
# |  Your quick tunnel has been created! Visit it at:                                        |
# |  https://example-random-name.trycloudflare.com                                           |
# +--------------------------------------------------------------------------------------------+
```

## WHAT USERS WILL ACCESS

Once running, share this URL: `https://your-tunnel-name.trycloudflare.com`

They get:
- `/` - AI Chat Interface
- `/board` - Kanban Board with drag-drop (alternate full-board view)
- `/analytics` - Real-time analytics
- `/automation` - Workflow automation
- `/api/health/detailed` - System status
- `/api/board/state` - Board JSON for the UI (no-cache)
- `/api/board/move` - Persist task move `{ taskId, toColumnId, position }`

## MONITORING

```bash
# Watch logs
pm2 logs wordflux-v3

# Check status
pm2 status

# Monitor resources
pm2 monit
```

## IF SOMETHING BREAKS

```bash
# Restart everything
pm2 restart wordflux-v3
docker compose restart

# Check logs
pm2 logs --lines 100
docker compose logs -f
```

---

**THIS IS THE ONLY WAY. NO SHORTCUTS. NO "QUICK" OPTIONS.**
