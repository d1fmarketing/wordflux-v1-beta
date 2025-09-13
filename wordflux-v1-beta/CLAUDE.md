# Claude Code Context for WordFlux v1-beta

## Project Overview
WordFlux v1-beta - AI-powered Kanban board with GPT-5-mini chat integration
- **Stack**: Next.js 14.2.5, TypeScript, Tailwind CSS
- **APIs**: OpenAI GPT-5-mini, Kanboard JSON-RPC
- **State**: SWR for data fetching, localStorage for preferences
- **Deployment**: PM2 on AWS EC2 Ubuntu, Nginx reverse proxy
- **Production URL**: http://52.4.68.118/workspace

## Recent Changes (2025-09-12)
1. **Security Fix**: Removed 9 publicly exposed Docker containers
2. **Board State Fix**: Added null checks for project ID in polling
3. **Backup Script Fix**: Updated to backup SQLite instead of PostgreSQL
4. **Production Setup**: Configured Nginx redirect from / to /workspace
5. **Health Monitoring**: Added automated health checks via cron
6. **AI Features Added**:
   - ⏱️ Auto Time Tracking: Tracks time when tasks move through "Work in progress"
   - 📊 Smart Daily Summary: Use "daily summary" command for progress overview
   - 📝 Smart Task Templates: Auto-applies checklists for bug/deploy/meeting tasks

## Key Patterns
### SSR-Safe Components
```typescript
const ChatPanel = dynamic(() => import('../components/ChatPanel'), { 
  ssr: false 
})
```

### API Routes
- `/api/chat` - GPT-5 chat endpoint
- `/api/board/state` - Kanboard data
- `/api/meta` - Build information

### Environment Variables
```bash
OPENAI_MODEL=gpt-5-mini
OPENAI_API_KEY=sk-...
KANBOARD_URL=http://localhost:8090/jsonrpc.php
KANBOARD_USERNAME=jsonrpc
KANBOARD_PASSWORD=wordflux-api-token-2025
KANBOARD_PROJECT_ID=1
```

## Common Tasks
### Restart Application
```bash
pm2 restart wf-v1-beta --update-env
```

### Check Logs
```bash
pm2 logs wf-v1-beta --lines 100
```

### Run Health Check
```bash
node /home/ubuntu/wordflux-v1-beta/scripts/health-monitor.js
```

### Manual Backup
```bash
bash /home/ubuntu/wordflux-v1-beta/scripts/backup.sh
```

### Rebuild
```bash
rm -rf .next && npm run build
```

## System Status
- ✅ All systems operational
- ✅ Kanboard authentication working
- ✅ Board state syncing properly
- ✅ Automated backups running daily at 2 AM
- ✅ Health monitoring every 5 minutes
- ✅ Security: All containers on localhost only

## File Structure
```
app/
├── page.tsx            # Landing page
├── chat/page.tsx       # GPT-5 chat interface
├── dashboard/page.tsx  # Dashboard with timeline
├── board/page.tsx      # Kanban board
├── components/
│   ├── ChatPanel.tsx   # Chat UI component
│   └── board/
│       └── TimelineView.tsx  # Calendar timeline
└── api/
    ├── chat/route.ts   # Chat API
    └── meta/route.ts   # Meta endpoint
```

## AI Feature Commands
### Quick Commands (no AI needed)
- `done #123` or `done task name` - Move to Done
- `start #123` or `start task name` - Move to Work in progress  
- `ready #123` - Move to Ready
- `board summary` - Quick board overview
- `daily summary` - Daily progress report with motivation
- `whats next` - Suggest next task to work on
- `whats in progress` - List current work

### Smart Features
- **Auto Time Tracking**: Automatically tracks time when moving tasks through "Work in progress"
- **Task Templates**: Create tasks with keywords like "bug", "deploy", "meeting" for auto-templates
- **Duplicate Detection**: Warns when creating similar tasks (>70% similarity)
- **Status Emojis**: Auto-adds ✅🔄📌 emojis when moving tasks
- **Auto-Archive**: Old Done tasks archived after 7 days (runs hourly)

## Testing Commands
```bash
# E2E tests
npx playwright test

# API test
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# Test AI features
curl -X POST http://52.4.68.118/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "daily summary"}'
```

## Debugging Tips
- Check PM2 status: `pm2 status`
- Verify port 3000: `sudo ss -ltnp | grep 3000`
- Check Nginx: `sudo nginx -t`
- Browser console for client errors
- Network tab for API failures

## Production Infrastructure
- **Server**: AWS EC2 t2.micro (Ubuntu)
- **Process Manager**: PM2 (wf-v1-beta)
- **Reverse Proxy**: Nginx (port 80 → 3000)
- **Docker**: Kanboard container on 127.0.0.1:8090
- **Monitoring**: Automated health checks and backups via cron

---
*Last updated: 2025-09-12 | v1-beta (Deploy 21)*