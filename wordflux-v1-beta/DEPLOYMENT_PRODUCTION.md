# 🚀 WordFlux v1-beta - Production Deployment Guide

## Current Production Status
- **URL**: http://52.4.68.118/workspace
- **Status**: ✅ LIVE and operational
- **Deploy Version**: 21
- **Server**: AWS EC2 t2.micro (Ubuntu)
- **Region**: us-east-1

## Production Architecture

```
Internet → AWS EC2 (52.4.68.118:80)
         → Nginx (reverse proxy)
         → PM2 (wf-v1-beta:3000)
         → Next.js Application
         → Kanboard Docker (127.0.0.1:8090)
```

## Deployment Steps

### 1. Server Setup (AWS EC2)

```bash
# Launch EC2 instance
- AMI: Ubuntu Server 22.04 LTS
- Instance Type: t2.micro
- Security Group: Allow ports 22 (SSH), 80 (HTTP)
- Elastic IP: 52.4.68.118
```

### 2. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2
```

### 3. Deploy Application

```bash
# Clone repository
cd /home/ubuntu
git clone [repository-url] wordflux-v1-beta
cd wordflux-v1-beta

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with production values:
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-5-mini
# KANBOARD_URL=http://localhost:8090/jsonrpc.php
# KANBOARD_USERNAME=jsonrpc
# KANBOARD_PASSWORD=wordflux-api-token-2025

# Build for production
npm run build

# Start with PM2
pm2 start npm --name wf-v1-beta -- start
pm2 save
pm2 startup
```

### 4. Setup Kanboard Container

```bash
# Run Kanboard (localhost only for security)
docker run -d --name wordflux-kanboard \
  --restart=always \
  -p 127.0.0.1:8090:80 \
  kanboard/kanboard:latest

# Configure Kanboard via web UI at localhost:8090
# 1. Create admin account
# 2. Create project "WordFlux"
# 3. Enable JSON-RPC API
# 4. Create API user "jsonrpc"
```

### 5. Configure Nginx

```nginx
# /etc/nginx/sites-available/wordflux
server {
    listen 80;
    server_name 52.4.68.118;

    # Redirect root to workspace
    location = / {
        return 302 /workspace;
    }

    # Main application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Disable HTML caching
    location ~* \.(html|htm)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    }

    # Health check endpoint
    location /nginx-health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/wordflux /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Setup Monitoring & Backups

```bash
# Health monitoring (every 5 minutes)
crontab -e
*/5 * * * * /usr/bin/node /home/ubuntu/wordflux-v1-beta/scripts/health-monitor.js >> /home/ubuntu/logs/health-monitor.log 2>&1

# Daily backups (2 AM)
0 2 * * * /bin/bash /home/ubuntu/wordflux-v1-beta/scripts/backup.sh >> /home/ubuntu/logs/backup.log 2>&1
```

## Security Configuration

### Docker Security
All containers MUST bind to localhost only:
```bash
# ✅ SECURE - localhost only
docker run -p 127.0.0.1:8090:80 kanboard/kanboard

# ❌ INSECURE - publicly exposed
docker run -p 8090:80 kanboard/kanboard
```

### Current Security Status
- ✅ Kanboard: 127.0.0.1:8090 (localhost only)
- ✅ All other containers removed for security
- ✅ Nginx as reverse proxy on port 80
- ✅ PM2 process on localhost:3000

## Maintenance Commands

```bash
# Check application status
pm2 status
pm2 logs wf-v1-beta

# Restart application
pm2 restart wf-v1-beta

# Check health
node /home/ubuntu/wordflux-v1-beta/scripts/health-monitor.js

# Manual backup
bash /home/ubuntu/wordflux-v1-beta/scripts/backup.sh

# Check Docker containers
docker ps

# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# View logs
tail -f /home/ubuntu/.pm2/logs/wf-v1-beta-out.log
tail -f /home/ubuntu/logs/health-monitor.log
```

## Troubleshooting

### Application not responding
```bash
pm2 restart wf-v1-beta
pm2 logs wf-v1-beta --lines 100
```

### Board state errors
```bash
# Rebuild application
cd /home/ubuntu/wordflux-v1-beta
rm -rf .next
npm run build
pm2 restart wf-v1-beta
```

### Kanboard connection issues
```bash
# Check container
docker ps | grep kanboard
docker logs wordflux-kanboard

# Test API
curl -X POST http://localhost:8090/jsonrpc.php \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getVersion","id":1}' \
  -u jsonrpc:wordflux-api-token-2025
```

## Deployment Checklist

- [x] AWS EC2 instance running
- [x] Elastic IP assigned (52.4.68.118)
- [x] Node.js 18+ installed
- [x] Docker installed
- [x] Nginx configured
- [x] PM2 process manager setup
- [x] Kanboard container running (localhost only)
- [x] Environment variables configured
- [x] Application built and running
- [x] Health monitoring active
- [x] Automated backups configured
- [x] Security: All containers on localhost
- [x] Root redirect to /workspace

---
*Last updated: 2025-09-12 | Deploy Version: 21*