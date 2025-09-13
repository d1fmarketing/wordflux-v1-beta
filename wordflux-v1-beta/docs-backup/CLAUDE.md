# Claude Code Context for WordFlux v3

## Project Overview
WordFlux v3 - AI-powered Kanban board with GPT-5 chat integration
- **Stack**: Next.js 14.2.5, TypeScript, Tailwind CSS
- **APIs**: OpenAI GPT-5, Kanboard JSON-RPC
- **State**: SWR for data fetching, localStorage for preferences
- **Deployment**: PM2 on Ubuntu, Nginx reverse proxy

## Recent Changes (2025-09-11)
1. **Fixed GPT-5 Chat**: Created `/chat` page with SSR-safe dynamic imports
2. **Fixed Timeline Bug**: Separated weekday headers from calendar cells
3. **Added Meta Endpoint**: `/api/meta` for build verification

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
OPENAI_MODEL=gpt-5-pro  # or gpt-5-mini
OPENAI_API_KEY=sk-...
KANBOARD_URL=http://localhost:8080/jsonrpc.php
WFV3_TEST_STUBS=1  # Enable stub mode
```

## Common Tasks
### Restart Application
```bash
pm2 restart wf-v3 --update-env
```

### Check Logs
```bash
pm2 logs wf-v3 --lines 100
```

### Rebuild
```bash
rm -rf .next && npm run build
```

## Current Issues
- Kanboard auth needs fixing (showing unauthorized)
- Socket.io 503 errors in console
- Performance optimization needed for large boards

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

## Testing Commands
```bash
# E2E tests
npx playwright test

# API test
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

## Debugging Tips
- Check PM2 status: `pm2 status`
- Verify port 3000: `sudo ss -ltnp | grep 3000`
- Check Nginx: `sudo nginx -t`
- Browser console for client errors
- Network tab for API failures

---
*Last updated: 2025-09-11 | v3.0.0*