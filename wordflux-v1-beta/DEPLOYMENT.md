# WordFlux v1-beta Deployment Guide

## 🚀 Current Production Deployment
**Live URL**: http://52.4.68.118/workspace  
**Status**: ✅ Fully Operational  
**Version**: v1-beta (Deploy 21)  
**Infrastructure**: AWS EC2 + Docker + Nginx + PM2

## Quick Links
- **Detailed Production Guide**: [DEPLOYMENT_PRODUCTION.md](./DEPLOYMENT_PRODUCTION.md)
- **Security Report**: [SECURITY.md](./SECURITY.md)
- **System Status**: [SYSTEM_STATUS.md](./SYSTEM_STATUS.md)
- **AI Context**: [CLAUDE.md](./CLAUDE.md)

## Deployment Options

### Option 1: AWS EC2 Production (Currently Running)
Full production setup with monitoring, backups, and security hardening.
See [DEPLOYMENT_PRODUCTION.md](./DEPLOYMENT_PRODUCTION.md) for complete guide.

### Option 2: Local Development
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Start TaskCafe
docker run -d --name TaskCafe \
  -p 127.0.0.1:8090:80 \
  TaskCafe/TaskCafe:latest

# Run development server
npm run dev
# Access at http://localhost:3000
```

### Option 3: Docker Deployment
```bash
# Build Docker image
docker build -t wordflux:latest .

# Run with Docker Compose
docker-compose up -d
```

### Option 4: Vercel/Netlify
```bash
# Build for serverless
npm run build

# Deploy to Vercel
vercel --prod

# Or deploy to Netlify
netlify deploy --prod
```

## Environment Configuration

### Required Variables
```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini

# TaskCafe Configuration
TaskCafe_URL=http://localhost:8090/jsonrpc.php
TaskCafe_USERNAME=jsonrpc
TaskCafe_PASSWORD=your-token
TaskCafe_PROJECT_ID=1
```

### Optional Variables
```env
# Node Environment
NODE_ENV=production

# Custom Ports
PORT=3000

# Health Webhook (optional)
HEALTH_WEBHOOK_URL=https://your-webhook.com
```

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Internet  │────▶│    Nginx    │────▶│     PM2     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Port 80   │     │  Port 3000  │
                    └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Next.js   │
                                        └─────────────┘
                                               │
                           ┌───────────────────┴───────────────────┐
                           ▼                                       ▼
                    ┌─────────────┐                        ┌─────────────┐
                    │  TaskCafe   │                        │   OpenAI    │
                    │ localhost:  │                        │   GPT-5     │
                    │    8090     │                        │    API      │
                    └─────────────┘                        └─────────────┘
```

## Core Features Deployed

### Chat-Driven Interface
- GPT-5-mini powered natural language processing
- Create, move, and manage tasks via chat
- Intelligent task understanding and execution

### Kanban Board
- Real-time synchronization with TaskCafe
- Drag-and-drop task management
- 4 columns: Backlog, Ready, Work in progress, Done
- Auto-sync every 3 seconds

### Security & Monitoring
- All services on localhost only (except Nginx)
- Automated health checks every 5 minutes
- Daily backups with 7-day retention
- PM2 process management with auto-restart

## Deployment Commands

### Start Services
```bash
# Start application
pm2 start npm --name wf-v1-beta -- start

# Start TaskCafe
docker start wordflux-TaskCafe

# Start Nginx
sudo systemctl start nginx
```

### Stop Services
```bash
# Stop application
pm2 stop wf-v1-beta

# Stop TaskCafe
docker stop wordflux-TaskCafe

# Stop Nginx
sudo systemctl stop nginx
```

### Monitor & Debug
```bash
# Check status
pm2 status
docker ps
sudo systemctl status nginx

# View logs
pm2 logs wf-v1-beta
docker logs wordflux-TaskCafe
sudo tail -f /var/log/nginx/error.log

# Health check
curl http://localhost:3000/api/health
node scripts/health-monitor.js
```

### Backup & Restore
```bash
# Manual backup
bash scripts/backup.sh

# List backups
ls -la /home/ubuntu/backups/

# Restore from backup
tar -xzf /home/ubuntu/backups/wordflux-backup-YYYYMMDD_HHMMSS.tar.gz
```

## Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
pm2 logs wf-v1-beta --lines 100

# Rebuild
rm -rf .next node_modules
npm install
npm run build
pm2 restart wf-v1-beta
```

#### TaskCafe Connection Failed
```bash
# Check container
docker ps | grep TaskCafe
docker logs wordflux-TaskCafe

# Test connection
curl -X POST http://localhost:8090/jsonrpc.php \
  -d '{"jsonrpc":"2.0","method":"getVersion","id":1}'
```

#### Board Not Syncing
```bash
# Check board state API
curl http://localhost:3000/api/board/state

# Restart services
pm2 restart wf-v1-beta
docker restart wordflux-TaskCafe
```

## Performance Optimization

### Build Optimization
```bash
# Production build with optimization
NODE_ENV=production npm run build

# Analyze bundle size
npm run analyze
```

### PM2 Cluster Mode
```bash
# Run with multiple instances
pm2 start npm --name wf-v1-beta -i max -- start
```

### Nginx Caching
```nginx
# Add to nginx config
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Security Checklist

- [x] All Docker containers on localhost only
- [x] Environment variables in .env.local (gitignored)
- [x] Nginx as reverse proxy
- [x] AWS Security Groups configured
- [x] Regular security updates
- [x] Automated backups
- [x] Health monitoring
- [x] No hardcoded credentials

## Support & Maintenance

### Log Locations
- Application: `/home/ubuntu/.pm2/logs/`
- Nginx: `/var/log/nginx/`
- Docker: `docker logs [container]`
- Health: `/home/ubuntu/logs/health-monitor.log`
- Backups: `/home/ubuntu/logs/backup.log`

### Update Procedure
1. Create backup: `bash scripts/backup.sh`
2. Pull updates: `git pull`
3. Install deps: `npm install`
4. Build: `npm run build`
5. Restart: `pm2 restart wf-v1-beta`
6. Verify: `curl http://localhost:3000/api/health`

---
*Last Updated: 2025-09-12 | v1-beta Production*