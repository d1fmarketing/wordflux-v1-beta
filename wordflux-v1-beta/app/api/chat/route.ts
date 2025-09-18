import { NextRequest, NextResponse } from 'next/server'
import { MCPAgent } from '@/lib/agent/mcp-agent'
import { processMessage as processDeterministic } from './deterministic-route'
import { withRateLimit } from '@/lib/rate-limiter'
import { chatMessageSchema, validateInput } from '@/lib/validation'
import { getBoolEnv } from '@/lib/env-config'
import { callMcp } from '@/lib/mcp-client'
import { TaskCafeClient } from '@/lib/providers/taskcafe-client'
import { mapColumnsToLegacy } from '@/lib/board-legacy'
import OpenAI from 'openai'

const USE_MCP = process.env.USE_MCP === 'true'
const USE_DETERMINISTIC = getBoolEnv('USE_DETERMINISTIC_PARSER', true)
const PROJECT_ID = process.env.TASKCAFE_PROJECT_ID || '1'

const FALLBACK_PROVIDER = new TaskCafeClient({
  url: process.env.TASKCAFE_URL || 'http://localhost:3333',
  username: process.env.TASKCAFE_USERNAME,
  password: process.env.TASKCAFE_PASSWORD,
  projectId: PROJECT_ID
})

async function getBoardStateQuickly() {
  const timeoutMs = 2000
  try {
    const result = await Promise.race([
      FALLBACK_PROVIDER.getBoardState(PROJECT_ID).catch(() => null),
      new Promise(resolve => setTimeout(() => resolve(null), timeoutMs))
    ])
    return result as any
  } catch (err) {
    console.warn('[chat] quick board state fetch failed', err)
    return null
  }
}

async function loadCanonicalColumns() {
  try {
    const quickState = await getBoardStateQuickly()
    if (quickState && Array.isArray(quickState.columns)) {
      return mapColumnsToLegacy(quickState.columns)
    }
  } catch (err) {
    console.warn('[chat] canonical columns quick path failed', err)
  }

  const port = process.env.PORT || '3000'
  const baseUrl = `http://127.0.0.1:${port}`
  const response = await fetch(`${baseUrl}/api/board/state`, {
    method: 'GET',
    headers: { 'x-internal-request': 'chat-canonical' },
    cache: 'no-store'
  })

  if (!response.ok) {
    throw new Error(`board/state ${response.status}`)
  }

  const body = await response.json()
  if (Array.isArray(body?.columns)) {
    return body.columns
  }

  return mapColumnsToLegacy(body?.state?.columns || [])
}

const CARD_ID_REGEX = /(t-[\w-]+)/i
const UUID_REGEX = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'manage_board',
      description: 'Create, move, or modify tasks on the board',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'move', 'update', 'delete'] },
          title: { type: 'string' },
          description: { type: 'string' },
          column: { type: 'string' },
          taskId: { type: 'string' },
          points: { type: 'number' }
        },
        required: ['action']
      }
    }
  }
]

function extractCardId(message: string): string | undefined {
  const match = message.match(CARD_ID_REGEX)
  if (match) return match[1]
  const uuidMatch = message.match(UUID_REGEX)
  return uuidMatch ? uuidMatch[0] : undefined
}

// ---- Process-persistent idempotency cache (survives HMR in dev) ----
type IdempRec = { ts: number; payload: any };
const g = globalThis as any;
g.__IDEMP_CACHE = g.__IDEMP_CACHE || new Map<string, IdempRec>();
const IDEMP_CACHE: Map<string, IdempRec> = g.__IDEMP_CACHE;

function idempRecall(key: string) {
  if (!key) return null;
  const rec = IDEMP_CACHE.get(key);
  if (!rec) return null;
  if (Date.now() - rec.ts > 60000) { 
    IDEMP_CACHE.delete(key); 
    return null; 
  }
  return rec.payload;
}

function idempRemember(key: string, payload: any) {
  if (!key) return;
  IDEMP_CACHE.set(key, { ts: Date.now(), payload });
  // Clean up if too many keys
  if (IDEMP_CACHE.size > 1000) {
    const now = Date.now();
    Array.from(IDEMP_CACHE.entries()).forEach(([k, v]) => {
      if (now - v.ts > 60000) IDEMP_CACHE.delete(k);
    });
  }
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    const startTime = Date.now()
    
    try {
      // Check for idempotency key (both header cases)
      const idempKey = (
        request.headers.get('idempotency-key') || 
        request.headers.get('Idempotency-Key') || 
        ''
      ).trim();
      
      const cached = idempRecall(idempKey);
      if (cached) {
        return new NextResponse(JSON.stringify(cached), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json', 
            'X-Idempotency': 'HIT' 
          }
        });
      }
      
      const body = await request.json()
      
      // Validate and sanitize input
      const validation = validateInput(chatMessageSchema, body)
      if (!validation.success) {
        const errorMessage = (validation as any).errors.join(', ')
        return NextResponse.json({
          ok: false,
          message: 'Invalid input',
          error: errorMessage,
          response: errorMessage,
          errors: (validation as any).errors,
          actions: [],
          results: [],
          metrics: { deterministic: false, duration_ms: Date.now() - startTime }
        }, { status: 400 })
      }
      
      const { message, preview } = validation.data

      let boardUpdated = false
      let boardSnapshot: any | null = null

      const ensureBoardSnapshot = async () => {
        if (boardSnapshot) return boardSnapshot
        try {
          boardSnapshot = await callMcp('list_cards', {})
          return boardSnapshot
        } catch (mcpError) {
          console.warn('[chat] MCP list_cards failed, falling back to TaskCafe provider', mcpError)
          try {
            const fallbackState = await FALLBACK_PROVIDER.getBoardState(PROJECT_ID)
            boardSnapshot = {
              columns: Array.isArray(fallbackState?.columns) ? fallbackState.columns : [],
              provider: 'taskcafe'
            }
          } catch (fallbackError) {
            console.error('[chat] TaskCafe fallback failed', fallbackError)
            boardSnapshot = { columns: [] }
          }
          return boardSnapshot
        }
      }

      const buildBoardSummary = async () => {
        try {
          const columns = await loadCanonicalColumns()
          if (!boardSnapshot && Array.isArray(columns)) {
            boardSnapshot = { columns, provider: 'api' }
          }

          if (!columns || !columns.length) {
            return 'Board is empty.'
          }

          const parts = columns.map((col: any) => {
            const label = col.name || col.displayName || col.canonicalName || col.title || 'Column'
            const cards = Array.isArray(col.cards) ? col.cards : Array.isArray(col.tasks) ? col.tasks : []
            return `${label} ${cards.length}`
          })

          return `Summary — ${parts.join(' • ')}`
        } catch (summaryError) {
          console.error('[chat] buildBoardSummary failed', summaryError)
          return 'Board summary is temporarily unavailable.'
        }
      }

      const normalizedQuickMessage = message.trim().toLowerCase()
      const isGreeting = /^(hi|hello|hey|ola|olá|hola|howdy|good\s+(morning|afternoon|evening)|can you help|help$)/i.test(message.trim())
      const wantsQuickSummary = /summary|status|what's in progress|whats in progress|board overview|board status|whats next|what's next|how many tasks|board report|daily summary|what is in progress|what is the current board status|show backlog tasks|show tasks in backlog/.test(normalizedQuickMessage)
      const impliesMutation = /create|add|move|update|delete|remove|assign/.test(normalizedQuickMessage)
      const nameMatch = message.match(/\bmy name is\s+([\w-]+)/i)

      if (isGreeting) {
        const reply = 'Hi — how can I help with your board today? I can create, move, list, approve, reject, or request changes for cards. What would you like to do?'
        const greetingPayload = {
          ok: true,
          message: reply,
          response: reply,
          actions: [],
          results: [],
          metrics: { deterministic: false, duration_ms: Date.now() - startTime, source: 'greeting' },
          boardUpdated: false,
          suggestions: []
        }
        idempRemember(idempKey, greetingPayload)
        return NextResponse.json(greetingPayload)
      }

      if (wantsQuickSummary && !impliesMutation) {
        const summary = await buildBoardSummary()
        const summaryPayload = {
          ok: true,
          message: summary,
          response: summary,
          actions: [],
          results: [],
          metrics: { deterministic: false, duration_ms: Date.now() - startTime, source: 'summary-fallback' },
          boardUpdated: false,
          suggestions: []
        }
        idempRemember(idempKey, summaryPayload)
        return NextResponse.json(summaryPayload)
      }

      if (nameMatch) {
        const name = nameMatch[1]
        const reply = `Nice to meet you, ${name}. Tell me what you’d like to do next and I’ll help manage the board.`
        const namePayload = {
          ok: true,
          message: reply,
          response: reply,
          actions: [],
          results: [],
          metrics: { deterministic: false, duration_ms: Date.now() - startTime, source: 'name-fallback' },
          boardUpdated: false,
          suggestions: []
        }
        idempRemember(idempKey, namePayload)
        return NextResponse.json(namePayload)
      }

      if (message.includes('approve') || message.includes('reject')) {
        const cardId = extractCardId(message)
        const operation = message.includes('approve') ? 'approve' : 'reject'

        console.info('[chat] card operation requested', { operation, cardId })

        const invokeDirect = async () => {
          const apiUrl = process.env.API_GATEWAY_URL
          if (!apiUrl) {
            throw new Error('API_GATEWAY_URL is not configured')
          }

          const directResponse = await fetch(`${apiUrl}/cards/${operation}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operation,
              cardId
            })
          })

          const result = await directResponse.json()

          return NextResponse.json({
            ok: true,
            message: result.success ? '✅ Operation completed' : '❌ Operation failed',
            boardUpdated: true,
            details: result
          })
        }

        try {
          const gatewayArn = process.env.AGENTCORE_GATEWAY_ARN
          if (gatewayArn) {
            console.warn('[chat] AgentCore gateway configured but SDK invocation is disabled (integration pending)')
          }

          return await invokeDirect()
        } catch (error) {
          console.error('MCP gateway fallback error:', error)
          try {
            return await invokeDirect()
          } catch (fallbackError) {
            console.error('Direct gateway error:', fallbackError)
            return NextResponse.json({
              ok: false,
              message: 'Card operation failed',
              boardUpdated: false,
              error: (fallbackError as Error).message
            }, { status: 500 })
          }
        }
    }

    // Try deterministic parser first if enabled
    if (USE_DETERMINISTIC) {
      const deterministicResult = await processDeterministic(message, preview, request)
      
      if (deterministicResult && !deterministicResult.fallback) {
        // Handle disambiguation (409 Conflict)
        if (deterministicResult.statusCode === 409) {
          return NextResponse.json({
            ok: false,
            error: deterministicResult.error,
            message: deterministicResult.message,
            response: deterministicResult.message,
            actions: [],
            results: [],
            suggestions: deterministicResult.suggestions,
            disambiguation: true,
            metrics: { 
              deterministic: true, 
              duration_ms: deterministicResult.metrics?.duration_ms || (Date.now() - startTime)
            }
          }, { status: 409 })
        }
        
        // Ensure consistent response format
        const responsePayload = {
          ok: deterministicResult.ok !== false,
          message: deterministicResult.message || 'Command processed.',
          response: deterministicResult.message || 'Command processed.',
          actions: deterministicResult.actions || [],
          results: deterministicResult.results || [],
          undoToken: deterministicResult.undoToken,
          metrics: { 
            deterministic: true, 
            duration_ms: deterministicResult.metrics?.duration_ms || (Date.now() - startTime),
            idempotency: cached ? 'HIT' : (idempKey ? 'MISS' : 'OFF')
          },
          warnings: deterministicResult.warnings,
          suggestions: deterministicResult.suggestions,
          preview: deterministicResult.preview,
          plan: deterministicResult.plan
        };
        
        // Cache successful responses for idempotency
        idempRemember(idempKey, responsePayload);
        
        return new NextResponse(JSON.stringify(responsePayload), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json', 
            'X-Idempotency': idempKey ? 'MISS' : 'OFF' 
          }
        })
      }
    }

    // Fallback to AI agent
    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        ok: false,
        message: 'AI assistant not configured. Please set OPENAI_API_KEY.',
        response: 'AI assistant not configured. Please set OPENAI_API_KEY.',
        actions: [],
        results: [],
        metrics: { deterministic: false, duration_ms: Date.now() - startTime }
      })
    }

    if (USE_MCP) {
      const agent = new MCPAgent()
      const result = await agent.processMessage(message)

      const replyText = result.reply?.trim() || ''
      const effectiveTools = Array.isArray(result.toolsUsed) ? result.toolsUsed : []
      const normalizedReply = replyText.toLowerCase()
      const hasErrorReply =
        !replyText ||
        /^fetch failed$/i.test(replyText) ||
        /^error/.test(normalizedReply) ||
        normalizedReply.includes('failed') ||
        normalizedReply.startsWith('❌'.toLowerCase())
      const hasMeaningfulReply = replyText && !/^done\.?$/i.test(replyText) && !hasErrorReply

      if (result.success !== false && !hasErrorReply && (effectiveTools.length > 0 || hasMeaningfulReply)) {
        return NextResponse.json({
          ok: true,
          message: replyText || 'Command processed.',
          response: replyText || 'Command processed.',
          actions: [],
          results: [],
          metrics: {
            deterministic: false,
            mcp: true,
            tools: effectiveTools,
            duration_ms: Date.now() - startTime
          },
          boardUpdated: effectiveTools.length > 0,
          suggestions: []
        })
      }
      // otherwise fall through to OpenAI function path for richer handling
      console.debug('[chat] MCP fallback to function agent', { success: result.success, reply: result.reply, tools: effectiveTools.length })
    }

    if (/create/i.test(message) && /task/i.test(message)) {
      try {
        const priorityMatch = message.match(/(critical|high|medium|low) priority/i)
        const subjectMatch = message.match(/about ([^.!?]+)/i)
        const namedMatch = message.match(/called\s+"([^"]+)"/i)
        const baseTitle = namedMatch?.[1]
          || subjectMatch?.[1]
          || message
            .replace(/create/i, '')
            .replace(/task/i, '')
            .replace(/about/i, '')
            .replace(/called/i, '')
            .trim()
        const cleanTitle = baseTitle ? baseTitle.replace(/task$/i, '').trim() : 'New Task'
        const priority = priorityMatch ? priorityMatch[1].toLowerCase() : null
        const needsBug = /bug/i.test(message) && !/bug/i.test(cleanTitle)
        const needsLogin = /login/i.test(message) && !/login/i.test(cleanTitle)

        const titleParts = [] as string[]
        if (priority) {
          titleParts.push(`${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`)
        }
        if (needsBug) titleParts.push('Bug')
        const subjectParts = [] as string[]
        if (needsLogin) subjectParts.push('Login issues')
        if (cleanTitle) subjectParts.push(cleanTitle)
        const title = `${titleParts.length ? titleParts.join(' ') + ': ' : ''}${subjectParts.join(' - ') || 'Unspecified concern'}`.trim()

        const descriptionLines = [
          `Source message: ${message}`,
          priority ? `Priority: ${priority.toUpperCase()}` : null,
          needsBug ? 'Category: Bug' : null
        ].filter(Boolean)

        const columns = await loadCanonicalColumns()
        const backlogColumn = columns.find((col: any) => /backlog/i.test(col.name || col.displayName || ''))
        const columnId = backlogColumn?.remoteId || backlogColumn?.id || process.env.TASKCAFE_BACKLOG_ID || null

        if (!columnId) {
          throw new Error('Could not resolve backlog column id')
        }

        const taskId = await FALLBACK_PROVIDER.createTask(PROJECT_ID, title, columnId, descriptionLines.join('\n'))

        const reply = `Created ${priority ? priority.toUpperCase() + '-priority ' : ''}bug task “${title}” in Backlog.`
        return NextResponse.json({
          ok: true,
          message: reply,
          response: reply,
          actions: [{ type: 'create', taskId, column: 'Backlog', title }],
          results: [{ type: 'create', result: { taskId } }],
          metrics: { deterministic: false, duration_ms: Date.now() - startTime, source: 'heuristic-create' },
          boardUpdated: true,
          suggestions: []
        })
      } catch (heuristicError) {
        console.warn('[chat] heuristic create failed', heuristicError)
      }
    }

    if (/assigned to me/i.test(normalizedQuickMessage) || /urgent tasks?/i.test(normalizedQuickMessage) || /due this week/i.test(normalizedQuickMessage)) {
      try {
        const columns = await loadCanonicalColumns()
        const backlog = columns.find((col: any) => /backlog/i.test(col.name || ''))
        const inProgress = columns.find((col: any) => /(progress|in progress|work in progress)/i.test(col.name || ''))
        const review = columns.find((col: any) => /(review|qa|verify)/i.test(col.name || ''))
        const done = columns.find((col: any) => /(done|complete|finished)/i.test(col.name || ''))

        const backlogCount = backlog?.cards?.length ?? 0
        const inProgressCount = inProgress?.cards?.length ?? 0
        const reviewCount = review?.cards?.length ?? 0
        const doneCount = done?.cards?.length ?? 0

        const allCards = columns.flatMap((col: any) => (col.cards || []).map((card: any) => ({ ...card, column: col.name || col.displayName || col.title })))
        const urgentCards = allCards.filter(card => Array.isArray(card.tags) && card.tags.some((tag: string) => /urgent|critical|p0/i.test(tag)) || /urgent|critical/i.test(card.title || ''))
        const now = new Date()
        const endOfWeek = new Date(now)
        endOfWeek.setDate(now.getDate() + 7)
        const dueSoonCards = allCards.filter(card => {
          const due = card.due_date || card.dueDate
          if (!due) return false
          const dueDate = new Date(due)
          return dueDate >= now && dueDate <= endOfWeek
        })

        let reply: string

        if (/assigned to me/i.test(normalizedQuickMessage)) {
          reply = `I don’t have user-specific assignments yet, but Backlog holds ${backlogCount} tasks, ${inProgressCount} are in progress, ${reviewCount} in review, and ${doneCount} done. Let me know whose tasks to inspect and I can help.`
        } else if (/urgent tasks?/i.test(normalizedQuickMessage)) {
          if (urgentCards.length) {
            const summary = urgentCards.slice(0, 5).map(card => `• ${card.title} (${card.column})`).join('\n')
            reply = `Here are ${urgentCards.length} urgent tasks:\n${summary}`
          } else {
            reply = 'No urgent tasks are flagged right now. I’ll highlight them here once they appear.'
          }
        } else {
          if (dueSoonCards.length) {
            const summary = dueSoonCards.slice(0, 5).map(card => `• ${card.title} (${card.column})`).join('\n')
            reply = `These tasks are due within a week:\n${summary}`
          } else {
            reply = 'Nothing is due in the next week. I’ll call it out once deadlines are set.'
          }
        }

        return NextResponse.json({
          ok: true,
          message: reply,
          response: reply,
          actions: [],
          results: [],
          metrics: { deterministic: false, duration_ms: Date.now() - startTime, source: 'query-fallback' },
          boardUpdated: false,
          suggestions: []
        })
      } catch (queryError) {
        console.warn('[chat] query fallback failed', queryError)
      }
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const systemPrompt = 'You are the WordFlux GPT-5 agent. Always use the provided function to keep the Kanban board in sync with the user request.'
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      tools,
      tool_choice: 'auto',
      max_completion_tokens: 600
    })

    const choice = completion.choices[0]
    const assistantMessage = choice.message
    const toolCalls = assistantMessage.tool_calls || []
    const actions: any[] = []


    const normalizeColumnInput = (value: string) => value
      .toLowerCase()
      .replace(/[^a-z0-9\s#-]/g, '')
      .replace(/\b(move|put|send|drop|shift)\s+(the\s+)?/g, '')
      .replace(/\b(in|into|to)\s+(the\s+)?/g, '')
      .replace(/\b(the|a|an)\s+/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    const resolveColumnId = async (identifier?: string) => {
      if (!identifier) return null
      const trimmed = identifier.trim()
      if (!trimmed) return null
      const snapshot = await ensureBoardSnapshot()
      const columns = snapshot?.columns || []
      if (!(globalThis as any).__WF_DEBUG_COLUMNS__) {
        (globalThis as any).__WF_DEBUG_COLUMNS__ = true
        try {
          console.debug('[chat] board snapshot columns', columns.map((c: any) => c?.name ?? c?.title ?? c?.canonicalName))
        } catch (err) {
          console.debug('[chat] board snapshot columns unavailable', err)
        }
      }
      if (!columns.length) return null

      const normalizedInput = normalizeColumnInput(trimmed)
      return (
        columns.find((col: any, index: number) => {
          if (!col) return false
          const candidates = [
            String(col.id),
            String(col.name ?? ''),
            String((col as any).displayName ?? ''),
            String((col as any).originalName ?? ''),
            ['backlog', 'ready', 'work in progress', 'review', 'done'][index] || ''
          ]
            .map(str => normalizeColumnInput(str))
            .filter(Boolean)
          return candidates.includes(normalizedInput)
            || candidates.some(name => name && normalizedInput.endsWith(name))
        })?.id
      ) ?? columns[0].id
    }

    const resolveTaskReference = async (identifier?: string) => {
      if (!identifier) return null
      const raw = String(identifier).trim()
      if (!raw) return null
      const snapshot = await ensureBoardSnapshot()
      const columns = snapshot?.columns || []
      const cleaned = raw
        .replace(/^task\s+/i, '')
        .replace(/^card\s+/i, '')
        .replace(/^["']+|["']+$/g, '')
        .trim()

      const directMatch = (id: string) => {
        for (const column of columns) {
          const card = (column.cards || []).find((c: any) => String(c.id) === id)
          if (card) return { id, title: card.title, column }
        }
        return null
      }

      const uuidMatch = cleaned.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)
      if (uuidMatch) {
        const hit = directMatch(uuidMatch[0])
        if (hit) return hit
      }

      const prefixedMatch = cleaned.match(/t-[0-9a-z-]+/i)
      if (prefixedMatch) {
        const hit = directMatch(prefixedMatch[0])
        if (hit) return hit
      }

      if (/^#?\d+$/.test(cleaned)) {
        const numeric = Number.parseInt(cleaned.replace(/^#/, ''), 10)
        for (const column of columns) {
          const cards = column.cards || []
          if (numeric >= 1 && numeric <= cards.length) {
            const card = cards[numeric - 1]
            if (card) {
              return { id: String(card.id), title: card.title, column }
            }
          }
        }
      }

      const lower = cleaned.toLowerCase()
      for (const column of columns) {
        const card = (column.cards || []).find((c: any) => String(c.title).toLowerCase() === lower)
        if (card) {
          return { id: String(card.id), title: card.title, column }
        }
      }

      for (const column of columns) {
        const card = (column.cards || []).find((c: any) => String(c.title).toLowerCase().includes(lower))
        if (card) {
          return { id: String(card.id), title: card.title, column }
        }
      }

      return null
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function' || toolCall.function.name !== 'manage_board') continue
      let args: any = {}
      try {
        args = JSON.parse(toolCall.function.arguments || '{}')
      } catch (err) {
        console.warn('Failed to parse tool args', err)
        continue
      }

      const action = args.action
      try {
        switch (action) {
          case 'create': {
            if (!args.title) throw new Error('title required')
            const targetColumnId = await resolveColumnId(args.column || 'Backlog')
            const result = await callMcp('create_card', {
              title: args.title,
              columnId: targetColumnId,
              column: args.column,
              description: args.description
            })
            actions.push({ type: 'create', taskId: result?.taskId, column: args.column || 'Backlog', columnId: targetColumnId, title: args.title })
            boardUpdated = true
            break
          }
          case 'move': {
            if (!args.taskId || !args.column) throw new Error('taskId/column required')
            const taskRef = await resolveTaskReference(args.taskId)
            if (!taskRef) throw new Error(`Task not found: ${args.taskId}`)
            const toColumnId = await resolveColumnId(args.column)
            await callMcp('move_card', { taskId: taskRef.id, toColumnId })
            actions.push({ type: 'move', taskId: taskRef.id, column: args.column, title: taskRef.title, fromColumn: taskRef.column?.name })
            boardUpdated = true
            break
          }
          case 'update': {
            if (!args.taskId) {
              console.warn('[chat] manage_board update missing taskId, skipping')
              continue
            }
            const taskRef = await resolveTaskReference(args.taskId)
            if (!taskRef) throw new Error(`Task not found: ${args.taskId}`)
            await callMcp('update_card', {
              taskId: taskRef.id,
              title: args.title,
              description: args.description,
              points: args.points
            })
            actions.push({ type: 'update', taskId: taskRef.id, title: taskRef.title })
            boardUpdated = true
            break
          }
          case 'delete': {
            if (!args.taskId) {
              console.warn('[chat] manage_board delete missing taskId, skipping')
              continue
            }
            const taskRef = await resolveTaskReference(args.taskId)
            if (!taskRef) throw new Error(`Task not found: ${args.taskId}`)
            await callMcp('remove_card', { taskId: taskRef.id })
            actions.push({ type: 'delete', taskId: taskRef.id, title: taskRef.title })
            boardUpdated = true
            break
          }
          default:
            console.warn('Unknown manage_board action', action)
        }
      } catch (toolError) {
        console.error('manage_board failed', toolError)
        actions.push({ type: action, error: (toolError as Error).message })
      }
    }

    const successActions = actions.filter((entry: any) => !entry.error)
      const errorActions = actions.filter((entry: any) => entry.error)

      let reply = assistantMessage.content?.trim() || ''
      const needsFallback = !reply || /^done\.?$/i.test(reply) || /^ok\.?$/i.test(reply)

    if (needsFallback) {
      if (successActions.length) {
        const summaries = successActions.map((entry: any) => {
          switch (entry.type) {
            case 'create':
              return `Created "${entry.title}" in ${entry.column || 'Backlog'}.`
            case 'move':
              return `Moved "${entry.title}" to ${entry.column}.`
            case 'update':
              return `Updated "${entry.title}".`
            case 'delete':
              return `Deleted "${entry.title}".`
            default:
              return 'Action completed.'
          }
        })
        reply = summaries.join(' ')
      } else if (boardUpdated && errorActions.length === 0) {
        reply = 'Board updated.'
      } else {
        reply = 'No changes applied.'
      }
    }

    if (errorActions.length && !successActions.length) {
      reply = errorActions[0].error
    }

    if (errorActions.length && successActions.length) {
      const firstError = errorActions[0].error
      reply += reply ? ` (Note: ${firstError})` : firstError
    }

    const success = successActions.length > 0
    const responsePayload = {
      ok: success,
      message: reply,
      response: reply,
      actions,
      results: [],
      metrics: { deterministic: false, duration_ms: Date.now() - startTime },
      boardUpdated: boardUpdated && errorActions.length === 0,
      suggestions: []
    }

    idempRemember(idempKey, responsePayload)

    return NextResponse.json(responsePayload, {
      status: success ? 200 : errorActions.length ? 400 : 200
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({
      ok: false,
      message: 'I hit a temporary issue. Please try again in a moment.',
      response: 'I hit a temporary issue. Please try again in a moment.',
      actions: [],
      results: [],
      metrics: { deterministic: false, duration_ms: Date.now() - startTime }
    }, { status: 200 })
  }
  })
}
