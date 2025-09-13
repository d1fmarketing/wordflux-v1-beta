import { NextRequest, NextResponse } from 'next/server'
import { AgentControllerV2 } from '@/lib/agent-controller-v2'
import { FunctionAgent } from '@/lib/agent/function-agent'
import { processMessage as processDeterministic } from './deterministic-route'
import { withRateLimit } from '@/lib/rate-limiter'
import { chatMessageSchema, validateInput } from '@/lib/validation'

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

// Feature flags
const USE_DETERMINISTIC = process.env.USE_DETERMINISTIC_PARSER !== 'false' // Default to true
const USE_FUNCTION_AGENT = process.env.USE_FUNCTION_AGENT === 'true' || true // Default to new agent

let agentInstance: AgentControllerV2 | null = null
let functionAgentInstance: FunctionAgent | null = null

async function getAgent() {
  if (USE_FUNCTION_AGENT) {
    if (!functionAgentInstance) {
      functionAgentInstance = new FunctionAgent()
      await functionAgentInstance.initialize()
    }
    return functionAgentInstance
  } else {
    if (!agentInstance) {
      agentInstance = new AgentControllerV2()
      await agentInstance.initialize()
    }
    return agentInstance
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
        return NextResponse.json({
          ok: false,
          message: 'Invalid input',
          response: (validation as any).errors.join(', '),
          errors: (validation as any).errors,
          actions: [],
          results: [],
          metrics: { deterministic: false, duration_ms: Date.now() - startTime }
        }, { status: 400 })
      }
      
      const { message, preview } = validation.data

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

    const agent = await getAgent()
    const result = await agent.processMessage(message)

    // Normalize response format for AI agent
    return NextResponse.json({
      ok: result.success !== false,
      message: result.reply || 'Command processed.',
      response: result.reply || 'Command processed.',
      actions: result.actions || [],
      results: [],  // AI agent doesn't provide structured results yet
      metrics: { deterministic: false, duration_ms: Date.now() - startTime },
      boardUpdated: result.boardUpdated === true,
      suggestions: result.suggestions
    })
    } catch (error) {
      console.error('Chat error:', error)
      return NextResponse.json({
        ok: false,
        message: 'Sorry, I encountered an error processing your request.',
        response: 'Sorry, I encountered an error processing your request.',
        actions: [],
        results: [],
        metrics: { deterministic: false, duration_ms: Date.now() - startTime }
      })
    }
  })
}
