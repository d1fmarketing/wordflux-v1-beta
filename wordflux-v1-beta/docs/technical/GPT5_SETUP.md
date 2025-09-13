# GPT-5 Integration Setup & Troubleshooting Guide

## Overview
WordFlux uses OpenAI's GPT-5 models for intelligent board management. This guide covers setup, configuration, troubleshooting, and best practices.

## Available Models

### Production Models
- **`gpt-5`** - Full-size model with maximum capabilities
- **`gpt-5-mini`** - Cost-effective model for most operations (RECOMMENDED)
- **`gpt-5-nano`** - Smallest model for basic tasks

### Configuration
```bash
# .env.local
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-5-mini  # Current production setting
```

## API Integration Architecture

### Request Flow
```
User Input → /api/ai → GPT-5 API → Action DSL → Board Operations
```

### Key Files
- `/app/api/ai/route.js` - Main GPT-5 endpoint
- `/app/lib/board.js` - Board state management
- `/app/components/Board.jsx` - UI integration

## Common Issues & Solutions

### 1. SSL Wrong Version Number Error
**Symptom**: `ERR_SSL_WRONG_VERSION_NUMBER` when AI fetches board
**Cause**: Using HTTPS origin for internal localhost calls
**Fix**: 
```javascript
// app/api/ai/route.js - Line 177
const boardUrl = `http://localhost:3000/api/board/get`;  // Use HTTP not HTTPS
const applyUrl = `http://localhost:3000/api/board/apply`;  // Line 288
```

### 2. Version Conflict Errors
**Symptom**: "Board was updated by someone else" repeatedly
**Cause**: Board version mismatch between client and server
**Solutions**:
1. Always pass current board version:
```javascript
body: JSON.stringify({
  ops: operations,
  ifVersion: board.version  // Include current version
})
```
2. Handle conflicts gracefully:
```javascript
if (error.error === 'version_conflict') {
  // Refresh board and retry
  const fresh = await fetch('/api/board/get').then(r => r.json());
  // Retry with fresh.board.version
}
```

### 3. Model Not Found
**Symptom**: "Model does not exist" error from OpenAI
**Cause**: Using incorrect model name
**Fix**: Use exact model names: `gpt-5`, `gpt-5-mini`, or `gpt-5-nano`

### 4. Operations Format Error
**Symptom**: Board operations fail silently
**Cause**: API expects array of operations
**Fix**:
```javascript
// Correct format
body: JSON.stringify({
  ops: [{ op: 'create_card', args: {...} }],  // Array!
  ifVersion: board.version
})
```

### 5. "No Actions Needed" for Greetings (FIXED in v0.3.5)
**Symptom**: AI responds with "No actions needed" to "oi", "hello", or other greetings
**Cause**: AI in action-only mode doesn't generate conversational responses
**Fix**: ChatPanel now falls back to `/api/chat` for conversational responses
```javascript
// app/components/ChatPanel.jsx
if (!ai.actions || ai.actions.length === 0) {
  // Fall back to conversational chat
  const chat = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ message: text })
  }).then(r=>r.json());
  setMessages(m => [...m, { role:'assistant', text: chat.response }]);
}
```
**Result**: Natural conversations in Portuguese/English while maintaining action processing

## Action DSL Reference

### Supported Operations
```javascript
// Create card
{ intent: "create_card", column: "Backlog"|"Doing"|"Done", title, description?, priority?, labels?, assignees? }

// Update card
{ intent: "update_card", cardQuery|id, set: { title?, description?, priority?, labels? } }

// Move card
{ intent: "move_card", cardQuery|id, toColumn: "Backlog"|"Doing"|"Done" }

// Delete card
{ intent: "delete_card", cardQuery|id }

// Add comment
{ intent: "comment", cardQuery|id, text }
```

### Card Queries
```javascript
// By ID
{ id: "card_abc123" }

// By search
{ cardQuery: "title:bug priority:high owner:rj" }

// With limits
{ cardQuery: "status:Backlog", first: true }  // First match only
```

## Testing GPT-5 Integration

### Basic Test
```bash
curl -s -X POST http://localhost:3000/api/ai \
  -H "Content-Type: application/json" \
  -d '{"message": "Create a card titled Test GPT5 in Backlog"}' \
  | jq '.reply'
```

### With Board State
```bash
# Get current board
BOARD=$(curl -s http://localhost:3000/api/board/get | jq '.board')

# Send with board
curl -s -X POST http://localhost:3000/api/ai \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"List all high priority cards\", \"board\": $BOARD}" \
  | jq '.reply'
```

## Performance Optimization

### Request Timeouts
```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
const response = await fetch(OPENAI_URL, { 
  signal: controller.signal,
  // ...
});
clearTimeout(timeout);
```

### Response Limits
```javascript
max_completion_tokens: 1000,  // Limit response size
reasoning_effort: 'low',      // Faster responses
```

### Caching
- Use `requestId` for idempotent operations
- Cache board state in memory when possible
- ETags for conditional GET requests

## Monitoring & Debugging

### Enable Debug Logging
```javascript
// app/api/ai/route.js
console.log('GPT-5 Request:', { message, model: MODEL });
console.log('GPT-5 Response:', content);
console.log('Version conflict:', { expected: ifVersion, got: board.version });
```

### PM2 Logs
```bash
# View errors
pm2 logs wordflux --err --lines 50

# Monitor in real-time
pm2 monit
```

### Common Log Patterns
```
# Successful operation
"✅ Created 1 card(s)"
# Version conflict
"Version conflict: expected 10, got 11"
# Conversational fallback
"No actions generated, falling back to chat"
```

## Best Practices (v0.3.5)

### 1. Always Use Version Control
```javascript
// Include ifVersion in all mutations
await fetch('/api/board/apply', {
  body: JSON.stringify({
    op: 'move_card',
    args: { ... },
    ifVersion: currentBoard.version
  })
});
```

### 2. Handle Conflicts Gracefully
```javascript
if (response.status === 409) {
  // Resync board and notify user
  await mutate(); // SWR refresh
  toast.error('Board updated - please retry');
}
```

### 3. Support Conversational AI
- Let ChatPanel handle fallback to `/api/chat`
- Don't force action-only responses
- Support both task execution and friendly conversation

### 4. Optimize Drag-and-Drop
- Pause SWR during drag operations
- Gate animations when dragging
- Always bind draggable styles

### 5. Use Consistent Error Handling
```javascript
// All routes should use withErrorHandling
export const POST = withErrorHandling(async (req) => {
  // Route logic here
});

# Version conflict
"Version conflict: expected 9, got 10"

# SSL error (needs fix)
"ERR_SSL_WRONG_VERSION_NUMBER"
```

## Production Checklist

✅ **Environment Variables**
- [ ] OPENAI_API_KEY set and valid
- [ ] OPENAI_MODEL set to `gpt-5-mini`
- [ ] API key has sufficient credits

✅ **Code Fixes Applied**
- [ ] Internal URLs use http://localhost:3000
- [ ] Operations sent as arrays
- [ ] Version tracking implemented
- [ ] Error handling for conflicts

✅ **Performance**
- [ ] 30-second timeout on API calls
- [ ] Response token limit set
- [ ] Idempotency keys used

✅ **Monitoring**
- [ ] PM2 restart count stable
- [ ] Error logs clean
- [ ] Response times < 3s

## Best Practices

1. **Always include board version** in operations to prevent conflicts
2. **Use `gpt-5-mini`** for production - best balance of cost/performance
3. **Handle version conflicts** gracefully with retry logic
4. **Log important events** for debugging but avoid logging sensitive data
5. **Test locally first** before deploying changes
6. **Monitor token usage** to control costs

## Support Resources

- OpenAI Status: https://status.openai.com
- Model Documentation: https://platform.openai.com/docs/models/gpt-5
- WordFlux Issues: Contact RJ or check internal docs

---
*Last Updated: September 2025*
*Model Version: gpt-5-mini*
*Status: Production Ready*